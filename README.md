# CottBot

A basic Discord bot built with BunJS, Discord.js, and TypeScript.

## Features

- `/ping` command - Responds with "Pong!" and shows latency information

## Prerequisites

- [Bun](https://bun.sh) installed on your system
- A Discord application and bot token

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

   Edit `.env` and add your Discord bot token and client ID:
   - Get your bot token from `https://discord.com/developers/applications`
   - Your client ID is also available in the Discord Developer Portal under "General Information"

   ```bash
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

4. **Invite your bot to a server:**

   Use this URL (replace `YOUR_CLIENT_ID` with your actual client ID): `https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot%20applications.commands`

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

Once the bot is running and invited to your server, you can use the `/ping` command to test it. The bot will respond with latency information.
