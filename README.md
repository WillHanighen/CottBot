# CottBot

An AI-powered Discord bot built with BunJS, Discord.js, TypeScript, and OpenRouter. Features multiple AI models, customizable system prompts, attachment handling, spam detection, and admin controls.

## Features

### AI Capabilities

- **Multiple AI Models**: Choose from Kimi K2, Gemini 2.5 Flash, or GLM-4.7
- **Customizable System Prompts**: Select from pre-made personalities (Femboy, Cat Girl, Furry) or create your own
- **Conversation Context**: Maintains conversation history (last 15 messages) with reply chain prioritization
- **Attachment Support**:
  - Text files (`.txt`, `.md`, `.json`, `.csv`) are read and included
  - Images are processed (vision-capable models) or described via Gemini
  - Other attachments are processed through Gemini as an ingest layer
- **Tool Calling**: AI can search the web for real-time information (date, Bitcoin price, etc.)
- **Smart Model Routing**: Automatically uses Gemini 2.5 Flash for vision tasks when the selected model doesn't support it

### Commands

- `/ping` - Check bot latency and status
- `/system-prompt` - Select your AI personality (Femboy, Cat Girl, or Furry)
- `/model` - Choose which AI model to use
- `/ban` - Ban a user from using AI features (Admin only)
- `/unban` - Unban a user (Admin only)

### Safety & Moderation

- **Spam Detection**: Automatically detects and blocks spam messages (repeated characters, excessive Unicode, etc.)
- **Rate Limiting**: 5-second cooldown per user to prevent abuse
- **Token Management**: Automatic conversation trimming to stay within 12k token limit
- **User Bans**: Admins can ban/unban users from AI features
- **Text File Spam Check**: Text file attachments are also checked for spam

### User Preferences

- **Per-User Settings**: Each user can have their own system prompt and model selection
- **Persistent Storage**: Preferences are saved in SQLite database
- **Defaults**: New users default to Femboy personality and Kimi K2 model

## Prerequisites

- [Bun](https://bun.sh) installed on your system
- A Discord application and bot token
- An OpenRouter API key ([get one here](https://openrouter.ai/))

## Setup

1. **Clone or navigate to this repository**

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root directory:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   - Get your Discord bot token from `https://discord.com/developers/applications`
   - Your client ID is also available in the Discord Developer Portal under "General Information"
   - Get your OpenRouter API key from `https://openrouter.ai/keys`

   ```bash
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

4. **Invite your bot to a server:**

   Use this URL (replace `YOUR_CLIENT_ID` with your actual client ID):

   ```none
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot%20applications.commands
   ```

   **Required Permissions:**
   - Send Messages
   - Read Message History
   - Attach Files (for image processing)
   - Use Slash Commands

## Running the Bot

**Development mode (with watch):**

```bash
bun run dev
```

**Production mode:**

```bash
bun run start
```

## Usage

### Interacting with the Bot

The bot responds when:

- You mention it directly (`@CottBot`)
- You reply to a message the bot sent

### Setting Up Your Preferences

1. **Choose a system prompt:**

```none
/system-prompt
   ``

   Select from: Femboy, Cat Girl, or Furry

2. **Select an AI model:**

```none
/model
```

   Choose from: Kimi K2, Gemini 2.5 Flash, or GLM-4.7

### Admin Commands

**Ban a user:**

```none
/ban user:@username reason:Spam (optional)
```

**Unban a user:**

```none
/unban user:@username
```

> **Note:** Only approved admin user IDs can use ban/unban commands. The default admin ID is configured in the database.

### Examples

- **Basic conversation:**

  ```none
  @CottBot Hello! How are you?
  ```

- **With image:**

  ```none
  @CottBot What's in this image? [attach image]
  ```

- **With text file:**

  ```none
  @CottBot Analyze this data [attach .txt file]
  ```

- **In a reply thread:**

  ```none
  [Reply to bot message] Can you explain more?
  ```

## System Prompts

System prompts are stored in the `prompts/` directory as Markdown files. You can:

- Use the pre-made prompts (Femboy, Cat Girl, Furry)
- Create custom prompts by adding new `.md` files
- Update existing prompts to modify AI behavior

## Database

The bot uses SQLite to store:

- User preferences (system prompt, model selection)
- Banned users
- Approved admins

Database files are stored in the `data/` directory (gitignored).

## Rate Limits & Token Management

- **Rate Limit**: 5 seconds between messages per user
- **Token Limit**: 12k input tokens per request
- **Auto-trimming**: Conversation history is automatically trimmed if it exceeds token limits

## Cost Tracking

Each AI response includes an embed showing:

- Model used
- System prompt type
- Input/output tokens
- Total tokens
- Estimated cost

## Architecture

- **Runtime**: BunJS
- **Discord Library**: Discord.js v14
- **Language**: TypeScript
- **AI Provider**: OpenRouter (OpenAI-compatible API)
- **Database**: SQLite (via Bun's native support)
- **Modular Commands**: Commands are organized in `src/commands/`
