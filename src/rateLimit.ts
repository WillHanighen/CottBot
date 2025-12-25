// Rate limiting: track last message time per user
const userLastMessage: Map<string, number> = new Map();
const RATE_LIMIT_SECONDS = 5;

export function checkRateLimit(userId: string): { allowed: boolean; remainingSeconds?: number } {
  const lastMessageTime = userLastMessage.get(userId);
  const now = Date.now();
  
  if (lastMessageTime) {
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;
    if (timeSinceLastMessage < RATE_LIMIT_SECONDS) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil(RATE_LIMIT_SECONDS - timeSinceLastMessage),
      };
    }
  }
  
  // Update last message time
  userLastMessage.set(userId, now);
  return { allowed: true };
}

// Clean up old entries periodically (older than 1 minute)
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of userLastMessage.entries()) {
    if (now - timestamp > 60000) {
      userLastMessage.delete(userId);
    }
  }
}, 60000); // Run every minute
