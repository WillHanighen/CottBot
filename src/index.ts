import { Client, GatewayIntentBits, Events, REST, Routes, Message, MessageFlags, EmbedBuilder, Attachment } from 'discord.js';
import { getCommandBuilders, getCommandHandler } from './commands';
import { getUserPreferences, isUserBanned } from './database';
import { getUserSystemPrompt, getUserPromptType } from './systemPrompt';
import { openrouter } from './openrouter';
import { getModelDisplayName, modelSupportsVision } from './models';
import { calculateCost, formatCost } from './pricing';
import { tools, executeTool } from './tools';
import { checkRateLimit } from './rateLimit';
import { estimateMessagesTokens, trimMessagesToTokenLimit } from './tokenCounter';
import { isSpam } from './spamDetection';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Get all command builders
const commands = getCommandBuilders();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Register commands when the bot starts
async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

// Bot ready event
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  await registerCommands();
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const handler = getCommandHandler(interaction.commandName);
  if (handler) {
    try {
      await handler(interaction, client);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while executing this command.',
          flags: MessageFlags.Ephemeral,
        }).catch(console.error);
      }
    }
  }
});

// Handle messages - respond to mentions and replies
client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Check if bot is mentioned (but not role mentions like @here, @everyone)
  const botMentioned = message.mentions.users.has(client.user!.id);
  
  // Check if replying to a bot message
  let replyingToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      replyingToBot = referencedMessage.author.id === client.user!.id;
    } catch {
      // Message might not be in cache, try cache first
      const cachedMessage = message.channel.messages.cache.get(message.reference.messageId);
      replyingToBot = cachedMessage?.author.id === client.user!.id;
    }
  }
  
  if (!botMentioned && !replyingToBot) return;
  
  // Check if user is banned
  if (isUserBanned(message.author.id)) {
    console.log(`[BAN CHECK] User ${message.author.username} (${message.author.id}) is banned`);
    await message.reply('🚫 You are banned from using AI features.').catch(console.error);
    return;
  }
  
  // Check for spam
  const spamCheck = isSpam(message.content);
  if (spamCheck.isSpam) {
    console.log(`[SPAM CHECK] User ${message.author.username} (${message.author.id}) - ${spamCheck.reason}`);
    await message.reply(`🚫 Your message was flagged as spam: ${spamCheck.reason}`).catch(console.error);
    return;
  }
  
  // Check rate limit (5 seconds per user)
  const rateLimitCheck = checkRateLimit(message.author.id);
  if (!rateLimitCheck.allowed) {
    console.log(`[RATE LIMIT] User ${message.author.username} (${message.author.id}) - ${rateLimitCheck.remainingSeconds}s remaining`);
    await message.reply(`⏱️ Please wait ${rateLimitCheck.remainingSeconds} more second(s) before sending another message.`).catch(console.error);
    return;
  }
  
  // Get user preferences
  const prefs = getUserPreferences(message.author.id);
  // Ensure model ID is valid (migration might not have run yet)
  let model = prefs?.model || 'moonshotai/kimi-k2';
  // Fix old model IDs that might still be in database
  if (model === 'moonshot-v1-8k' || model === 'moonshot/moonshot-v1-8k') {
    model = 'moonshotai/kimi-k2';
  }
  // Get system prompt (defaults to femboy if not set)
  const systemPrompt = await getUserSystemPrompt(message.author.id);
  const systemPromptType = await getUserPromptType(message.author.id) || 'femboy';
  
  // Log generation request
  const username = message.author.username;
  const userId = message.author.id;
  const userContent = message.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim();
  console.log(`[GENERATION] User: ${username} (${userId})`);
  console.log(`[GENERATION] Model: ${getModelDisplayName(model)} (${model})`);
  console.log(`[GENERATION] System Prompt: ${systemPromptType}`);
  console.log(`[GENERATION] User Message: ${userContent || '[No text content]'}`);
  
  // Show typing indicator (if channel supports it)
  if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
    await message.channel.sendTyping();
  }
  
  try {
    // Fetch conversation history (last 15 messages)
    let conversationHistory: Message[] = [];
    try {
      const fetchedMessages = await message.channel.messages.fetch({ limit: 15 });
      conversationHistory = Array.from(fetchedMessages.values())
        .filter(msg => !msg.author.bot || msg.author.id === client.user!.id) // Include bot messages but not other bots
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp) // Sort chronologically
        .slice(-15); // Take last 15
    } catch (error) {
      console.error('Error fetching conversation history:', error);
    }
    
    // If replying, prioritize messages in the reply chain
    let prioritizedHistory: Message[] = [];
    if (replyingToBot && message.reference?.messageId) {
      // Build reply chain by following references
      const replyChain = new Set<string>();
      let currentMsgId: string | null = message.reference.messageId;
      
      // Follow the chain backwards
      while (currentMsgId && replyChain.size < 15) {
        replyChain.add(currentMsgId);
        const msg = conversationHistory.find(m => m.id === currentMsgId);
        if (msg?.reference?.messageId && !replyChain.has(msg.reference.messageId)) {
          currentMsgId = msg.reference.messageId;
        } else {
          break;
        }
      }
      
      // Separate reply chain messages and other messages
      const chainMessages = conversationHistory.filter(m => replyChain.has(m.id));
      const otherMessages = conversationHistory.filter(m => !replyChain.has(m.id));
      
      // Prioritize: reply chain first, then other recent messages
      prioritizedHistory = [...chainMessages, ...otherMessages].slice(-15);
    } else {
      // Not a reply, just use recent messages
      prioritizedHistory = conversationHistory.slice(-15);
    }
    
    // Remove the current message from history (we'll add it separately)
    prioritizedHistory = prioritizedHistory.filter(m => m.id !== message.id);
    
    // Process attachments
    const allAttachments = Array.from(message.attachments.values());
    const imageAttachments = allAttachments.filter(att => att.contentType?.startsWith('image/'));
    const textAttachments = allAttachments.filter(att => 
      att.contentType?.startsWith('text/') || 
      att.name?.endsWith('.txt') || 
      att.name?.endsWith('.md') ||
      att.name?.endsWith('.json') ||
      att.name?.endsWith('.csv')
    );
    const otherAttachments = allAttachments.filter(att => 
      !att.contentType?.startsWith('image/') && 
      !att.contentType?.startsWith('text/') &&
      !att.name?.endsWith('.txt') &&
      !att.name?.endsWith('.md') &&
      !att.name?.endsWith('.json') &&
      !att.name?.endsWith('.csv')
    );
    
    let attachmentDescriptions: string[] = [];
    const modelSupportsVisionCapability = modelSupportsVision(model);
    
    // Process text files - read them directly and check for spam
    if (textAttachments.length > 0) {
      console.log(`[GENERATION] Processing ${textAttachments.length} text file attachment(s)`);
      for (const attachment of textAttachments) {
        try {
          const response = await fetch(attachment.url);
          const textContent = await response.text();
          
          // Check text file content for spam
          const spamCheck = isSpam(textContent);
          if (spamCheck.isSpam) {
            console.log(`[SPAM CHECK] Text file ${attachment.name} from ${message.author.username} (${message.author.id}) - ${spamCheck.reason}`);
            await message.reply(`🚫 The text file \`"${attachment.name}"\` was flagged as spam: ${spamCheck.reason}`).catch(console.error);
            return;
          }
          
          attachmentDescriptions.push(`[Text file: ${attachment.name}]\n${textContent}`);
          console.log(`[GENERATION] Loaded text file ${attachment.name}: ${textContent.length} characters`);
        } catch (error) {
          console.error(`[GENERATION] Error reading text file ${attachment.name}:`, error);
          attachmentDescriptions.push(`[Text file: ${attachment.name} - Unable to read]`);
        }
      }
    }
    
    // Process images - use Gemini if model doesn't support vision
    if (imageAttachments.length > 0) {
      console.log(`[GENERATION] Processing ${imageAttachments.length} image attachment(s)`);
      
      if (!modelSupportsVisionCapability) {
        // Model doesn't support vision, use Gemini as ingest layer
        console.log(`[GENERATION] Model doesn't support vision, using Gemini 2.5 Flash as ingest layer`);
        try {
          const imageUrls = imageAttachments.map(att => att.url);
          
          const visionCompletion = await openrouter.chat.completions.create({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Please describe these images in detail. Be thorough and descriptive. Include any text visible in the images.',
                  },
                  ...imageUrls.map(url => ({
                    type: 'image_url' as const,
                    image_url: { url },
                  })),
                ] as any,
              },
            ],
            provider: {
              sort: 'throughput',
            },
          } as any);
          
          const description = visionCompletion.choices[0]?.message?.content || '';
          attachmentDescriptions.push(`[Image description: ${description}]`);
          console.log(`[GENERATION] Image description generated via Gemini: ${description.substring(0, 100)}...`);
        } catch (error) {
          console.error('[GENERATION] Error describing images with Gemini:', error);
          attachmentDescriptions.push(`[Image description unavailable]`);
        }
      } else {
        // Model supports vision, images will be included directly in the API call
        console.log(`[GENERATION] Model supports vision, images will be included directly`);
      }
    }
    
    // Process other attachments - use Gemini as ingest layer
    if (otherAttachments.length > 0) {
      console.log(`[GENERATION] Processing ${otherAttachments.length} other attachment(s) via Gemini ingest layer`);
      try {
        const attachmentInfo = otherAttachments.map(att => `${att.name} (${att.contentType || 'unknown type'})`).join(', ');
        
        // For non-image, non-text files, try to get basic info
        const geminiCompletion = await openrouter.chat.completions.create({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: `The user has attached the following files: ${attachmentInfo}. Please provide a brief description of what these files might contain based on their names and types. If you can access them, describe their contents.`,
            },
          ],
          provider: {
            sort: 'throughput',
          },
        } as any);
        
        const description = geminiCompletion.choices[0]?.message?.content || '';
        attachmentDescriptions.push(`[Other attachments: ${attachmentInfo}]\n${description}`);
        console.log(`[GENERATION] Other attachments processed via Gemini`);
      } catch (error) {
        console.error('[GENERATION] Error processing other attachments:', error);
        attachmentDescriptions.push(`[Other attachments: Unable to process]`);
      }
    }
    
    // Prepare messages for the API
    let messages: any[] = [];
    
    // Add system prompt if available
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }
    
    // Add conversation history
    for (const histMessage of prioritizedHistory) {
      const isBotMessage = histMessage.author.id === client.user!.id;
      const histContent = histMessage.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim();
      
      if (!histContent && histMessage.attachments.size === 0) continue;
      
      if (isBotMessage) {
        // Bot's previous messages
        messages.push({
          role: 'assistant',
          content: histContent || '[Message with attachments]',
        });
      } else {
        // User's previous messages
        const histDisplayName = histMessage.member?.displayName || histMessage.author.displayName || histMessage.author.username;
        const histUserId = histMessage.author.id;
        messages.push({
          role: 'user',
          content: `${histDisplayName} (${histUserId}): ${histContent || '[Message with attachments]'}`,
        });
      }
    }
    
    // Add current user message with display name and user ID
    const userContent = message.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim();
    const displayName = message.member?.displayName || message.author.displayName || message.author.username;
    const userId = message.author.id;
    
    // Build the formatted message
    let formattedMessage = '';
    if (userContent) {
      formattedMessage = `${displayName} (${userId}): ${userContent}`;
    } else {
      formattedMessage = `${displayName} (${userId}):`;
    }
    
    // Add attachment descriptions if available
    if (attachmentDescriptions.length > 0) {
      formattedMessage += '\n\n' + attachmentDescriptions.join('\n\n');
    }
    
    // Build message content - include images directly if model supports vision
    let messageContent: any = formattedMessage.trim();
    
    if (modelSupportsVisionCapability && imageAttachments.length > 0) {
      // Model supports vision, include images directly
      messageContent = [
        {
          type: 'text',
          text: formattedMessage.trim() || 'Please analyze these images.',
        },
        ...imageAttachments.map(att => ({
          type: 'image_url' as const,
          image_url: { url: att.url },
        })),
      ];
    }
    
    // Only add message if there's content, attachments, or attachment descriptions
    if (formattedMessage.trim() || attachmentDescriptions.length > 0 || (modelSupportsVisionCapability && imageAttachments.length > 0)) {
      messages.push({
        role: 'user',
        content: messageContent,
      });
    }
    
    if (messages.length === 0 || (messages.length === 1 && messages[0].role === 'system')) {
      await message.reply('Please provide a message to respond to!');
      return;
    }
    
    // Check token limit (12k tokens) and trim if necessary
    const MAX_INPUT_TOKENS = 12000;
    const estimatedTokens = estimateMessagesTokens(messages);
    console.log(`[GENERATION] Estimated input tokens: ${estimatedTokens}`);
    console.log(`[GENERATION] Conversation history: ${prioritizedHistory.length} messages`);
    
    if (estimatedTokens > MAX_INPUT_TOKENS) {
      // Trim messages to fit within token limit (keeps system message and most recent messages)
      const beforeTrim = messages.length;
      messages = trimMessagesToTokenLimit(messages, MAX_INPUT_TOKENS);
      const afterTrim = messages.length;
      const finalTokens = estimateMessagesTokens(messages);
      console.log(`[GENERATION] Trimmed messages: ${beforeTrim} -> ${afterTrim} messages, ${estimatedTokens} -> ${finalTokens} tokens`);
    }
    
    // Track total usage across all API calls (including tool calls)
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    let finalResponse = '';
    let maxIterations = 5; // Prevent infinite loops
    let iterations = 0;
    
    // Loop to handle tool calls
    while (iterations < maxIterations) {
      iterations++;
      
      console.log(`[GENERATION] API Call #${iterations} - Model: ${getModelDisplayName(model)}, Messages: ${messages.length}`);
      
      // Call OpenRouter API with preference for higher-TPS providers and tools
      const completion = await openrouter.chat.completions.create({
        model: model,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        provider: {
          sort: 'throughput',
        },
      } as any);
      
      // Accumulate usage stats
      const usage = completion.usage;
      const promptTokens = usage?.prompt_tokens || 0;
      const completionTokens = usage?.completion_tokens || 0;
      totalPromptTokens += promptTokens;
      totalCompletionTokens += completionTokens;
      totalCost += calculateCost(model, promptTokens, completionTokens);
      
      console.log(`[GENERATION] API Response #${iterations} - Input: ${promptTokens} tokens, Output: ${completionTokens} tokens`);
      
      const messageResponse = completion.choices[0]?.message;
      
      // Check if model wants to call a tool
      if (messageResponse?.tool_calls && messageResponse.tool_calls.length > 0) {
        console.log(`[GENERATION] Tool calls requested: ${messageResponse.tool_calls.length}`);
        // Add assistant's message with tool calls to conversation
        messages.push({
          role: 'assistant',
          content: messageResponse.content || null,
          tool_calls: messageResponse.tool_calls,
        });
        
        // Execute all tool calls
        for (const toolCall of messageResponse.tool_calls) {
          const toolCallData = toolCall as any;
          const toolName = toolCallData.function?.name || '';
          let toolArgs = {};
          
          // Parse tool arguments with error handling
          try {
            const argsString = toolCallData.function?.arguments || '{}';
            toolArgs = JSON.parse(argsString);
          } catch (error) {
            console.error(`[GENERATION] Error parsing tool arguments for ${toolName}:`, error);
            toolArgs = {};
          }
          
          console.log(`[GENERATION] Executing tool: ${toolName} with args:`, toolArgs);
          
          // Ensure tool_call_id exists
          if (!toolCall.id) {
            console.error(`[GENERATION] Tool call missing ID, skipping:`, toolCall);
            continue;
          }
          
          try {
            const toolResult = await executeTool(toolName, toolArgs);
            console.log(`[GENERATION] Tool result: ${toolResult.substring(0, 100)}${toolResult.length > 100 ? '...' : ''}`);
            
            // Add tool result to conversation
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult,
            } as any);
          } catch (error) {
            console.error(`[GENERATION] Error executing tool ${toolName}:`, error);
            // Add error result to conversation so model knows tool failed
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
            } as any);
          }
        }
        
        // Continue the loop to get the model's response with tool results
        continue;
      }
      
      // No tool calls, we have the final response
      finalResponse = messageResponse?.content || '';
      console.log(`[GENERATION] Final response length: ${finalResponse.length} characters`);
      break;
    }
    
    if (finalResponse) {
      // Get system prompt type (default to femboy if not set)
      const systemPromptTypeDisplay = systemPromptType === 'cat-girl' ? 'Cat Girl' :
        systemPromptType === 'femboy' ? 'Femboy' : 'Furry';
      
      console.log(`[GENERATION] Completed - Total tokens: ${totalPromptTokens + totalCompletionTokens}, Cost: ${formatCost(totalCost)}`);
      
      // Create embed with usage stats
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Usage Stats')
        .addFields(
          { name: 'Model', value: getModelDisplayName(model), inline: true },
          { name: 'System Prompt', value: systemPromptTypeDisplay, inline: true },
          { name: 'Input Tokens', value: totalPromptTokens.toLocaleString(), inline: true },
          { name: 'Output Tokens', value: totalCompletionTokens.toLocaleString(), inline: true },
          { name: 'Total Tokens', value: (totalPromptTokens + totalCompletionTokens).toLocaleString(), inline: true },
          { name: 'Cost', value: formatCost(totalCost), inline: true }
        )
        .setTimestamp();
      
      await message.reply({
        content: finalResponse,
        embeds: [embed],
      });
    } else {
      console.log(`[GENERATION] Failed - No response generated`);
      await message.reply('Sorry, I couldn\'t generate a response.');
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    await message.reply('Sorry, an error occurred while generating a response.').catch(console.error);
  }
});

// Login to Discord
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN environment variable is required!');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('CLIENT_ID environment variable is required!');
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY) {
  console.warn('Warning: OPENROUTER_API_KEY not set. OpenRouter features will not work.');
}

client.login(process.env.DISCORD_TOKEN);