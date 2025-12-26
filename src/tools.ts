// Tool functions for the AI to use
export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_web',
      description: 'Search the web for current, real-time information. ALWAYS use this tool when asked about: current date/time, today\'s date, cryptocurrency prices (Bitcoin, Ethereum, etc.), news, weather, or any information that changes frequently. This tool provides up-to-date information that may not be in your training data. You MUST call this function (not just mention it) when you need current information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The specific search query. Be clear and specific (e.g., "current Bitcoin price in USD", "today\'s date and time", "weather forecast for New York City today").',
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
    
    // For other queries, try multiple search methods
    try {
      // Method 1: Try DuckDuckGo Instant Answer API
      try {
        const ddgResponse = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CottBot/1.0)',
          },
        });
        const ddgData = await ddgResponse.json();
        
        if (ddgData.AbstractText) {
          return ddgData.AbstractText;
        }
        
        if (ddgData.Answer) {
          return ddgData.Answer;
        }
        
        // Try to extract useful info from RelatedTopics
        if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
          const topics: string[] = [];
          for (const topic of ddgData.RelatedTopics.slice(0, 5)) {
            if (topic.Text) {
              topics.push(topic.Text);
            } else if (topic.FirstURL) {
              // Extract title from URL or use URL
              const urlParts = topic.FirstURL.split('/');
              const title = urlParts[urlParts.length - 1].replace(/_/g, ' ').replace(/%20/g, ' ');
              topics.push(title);
            }
          }
          
          if (topics.length > 0) {
            return `Related information:\n\n${topics.join('\n\n')}`;
          }
        }
        
        // Try Results if available
        if (ddgData.Results && ddgData.Results.length > 0) {
          const results: string[] = [];
          for (const result of ddgData.Results.slice(0, 3)) {
            if (result.Text) {
              results.push(result.Text);
            } else if (result.FirstURL) {
              results.push(`See: ${result.FirstURL}`);
            }
          }
          
          if (results.length > 0) {
            return `Search results:\n\n${results.join('\n\n')}`;
          }
        }
        
        // Try Definition if available
        if (ddgData.Definition) {
          return `Definition: ${ddgData.Definition}`;
        }
      } catch (ddgError) {
        console.error('[TOOLS] DuckDuckGo search error:', ddgError);
      }
      
      // Method 2: Try Wikipedia API for factual queries (works well for many topics)
      try {
        // Clean query for Wikipedia - remove common words and use main terms
        const cleanQuery = query
          .replace(/\b(latest|new|recent|current|what is|who is|when|where|how|why)\b/gi, '')
          .trim()
          .split(' ')
          .slice(0, 5)
          .join('_');
        
        const wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`, {
          headers: {
            'User-Agent': 'CottBot/1.0 (https://github.com/cottage-ubu/CottBot)',
          },
        });
        
        if (wikiResponse.ok) {
          const wikiData = await wikiResponse.json();
          if (wikiData.extract && !wikiData.extract.includes('may refer to')) {
            const extract = wikiData.extract.length > 600 
              ? wikiData.extract.substring(0, 600) + '...' 
              : wikiData.extract;
            return `Wikipedia: ${extract}`;
          }
        }
      } catch (wikiError) {
        // Wikipedia not found, continue to final fallback
        console.error('[TOOLS] Wikipedia search error:', wikiError);
      }
      
      // If all methods fail, return a helpful message
      return `I searched for "${query}" but couldn't find specific information. The query might be too specific or the information may not be available. Try rephrasing with more general terms or asking about a specific aspect.`;
    } catch (error) {
      return `Unable to search for "${query}" at this time. Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  } catch (error) {
    return `Error executing search: ${error}`;
  }
}
