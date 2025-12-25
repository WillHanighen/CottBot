import OpenAI from 'openai';

// Configure OpenAI SDK to use OpenRouter's endpoint
export const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/cottage-ubu/CottBot', // Optional: for OpenRouter analytics
    'X-Title': 'CottBot', // Optional: for OpenRouter analytics
  },
});
