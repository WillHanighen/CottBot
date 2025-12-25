// Simple token estimation: ~4 characters per token (rough approximation)
// This is a conservative estimate - actual tokenization varies by model
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimation: divide character count by 4
  // Add some overhead for message structure
  return Math.ceil(text.length / CHARS_PER_TOKEN) + 10; // +10 for message overhead
}

export function estimateMessagesTokens(messages: any[]): number {
  let totalTokens = 0;
  
  for (const msg of messages) {
    if (msg.content) {
      totalTokens += estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
    }
    
    // Add overhead for message structure (role, etc.)
    totalTokens += 5;
    
    // Add overhead for tool calls if present
    if (msg.tool_calls) {
      totalTokens += msg.tool_calls.length * 20;
    }
  }
  
  return totalTokens;
}

export function trimMessagesToTokenLimit(messages: any[], maxTokens: number): any[] {
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  // Always keep system message
  const trimmed: any[] = systemMessage ? [systemMessage] : [];
  
  // Calculate system message tokens
  let currentTokens = systemMessage ? estimateMessagesTokens([systemMessage]) : 0;
  
  // Start from the end (most recent) and work backwards to keep recent messages
  const messagesToKeep: any[] = [];
  
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i];
    const msgTokens = estimateMessagesTokens([msg]);
    
    if (currentTokens + msgTokens <= maxTokens) {
      messagesToKeep.unshift(msg); // Add to beginning to maintain order
      currentTokens += msgTokens;
    } else {
      // Can't fit this message, stop
      break;
    }
  }
  
  // Combine: system message first, then other messages in chronological order
  return [...trimmed, ...messagesToKeep];
}
