// Tool functions for the AI to use
export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_web',
      description: 'Search the web for current information such as current date/time, cryptocurrency prices, news, weather, or any other information that changes frequently. Use this when you need up-to-date information that you\'re not certain about.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Be specific about what information you need (e.g., "current Bitcoin price USD", "today\'s date", "weather in New York").',
          },
        },
        required: ['query'],
      },
    },
  },
];

// Execute tool calls
export async function executeTool(toolName: string, args: any): Promise<string> {
  if (toolName === 'search_web') {
    return await searchWeb(args.query);
  }
  return `Unknown tool: ${toolName}`;
}

// Web search implementation using DuckDuckGo or similar
async function searchWeb(query: string): Promise<string> {
  try {
    // Handle special cases first
    const lowerQuery = query.toLowerCase();
    
    // Current date/time
    if (lowerQuery.includes('date') || lowerQuery.includes('time') || lowerQuery.includes('today')) {
      const now = new Date();
      return `Current date and time: ${now.toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })} (UTC: ${now.toISOString()})`;
    }
    
    // Bitcoin price
    if (lowerQuery.includes('bitcoin') || lowerQuery.includes('btc')) {
      try {
        const response = await fetch('https://api.coindesk.com/v1/bpi/currentprice/BTC.json');
        const data = await response.json();
        const price = parseFloat(data.bpi.USD.rate.replace(/,/g, ''));
        return `Bitcoin (BTC) price: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      } catch (error) {
        return 'Unable to fetch Bitcoin price at this time.';
      }
    }
    
    // Ethereum price
    if (lowerQuery.includes('ethereum') || lowerQuery.includes('eth')) {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        const price = data.ethereum.usd;
        return `Ethereum (ETH) price: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      } catch (error) {
        return 'Unable to fetch Ethereum price at this time.';
      }
    }
    
    // For other queries, use DuckDuckGo Instant Answer API
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
      const data = await response.json();
      
      if (data.AbstractText) {
        return data.AbstractText;
      }
      
      if (data.Answer) {
        return data.Answer;
      }
      
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        return data.RelatedTopics[0].Text || 'Information found but unable to format.';
      }
      
      return `Search completed for "${query}". No specific information found. Please try rephrasing your query.`;
    } catch (error) {
      return `Unable to search for "${query}" at this time. Error: ${error}`;
    }
  } catch (error) {
    return `Error executing search: ${error}`;
  }
}
