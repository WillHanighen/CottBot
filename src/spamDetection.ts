/**
 * Spam detection utilities
 */

/**
 * Check if a message contains spam patterns
 * @param content The message content to check
 * @returns Object with isSpam boolean and reason string
 */
export function isSpam(content: string): { isSpam: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { isSpam: false };
  }

  // Check for repeated characters (same character repeated 10+ times)
  const repeatedCharPattern = /(.)\1{9,}/;
  if (repeatedCharPattern.test(content)) {
    return { isSpam: true, reason: 'Repeated characters detected' };
  }

  // Check for excessive Unicode/emoji (more than 50% of message is non-ASCII)
  const unicodeChars = content.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{3299}-\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FAB0}-\u{1FAFF}]|[\u{1FAC0}-\u{1FAFF}]|[\u{1FAD0}-\u{1FAFF}]|[\u{1FAE0}-\u{1FAFF}]|[\u{1FAF0}-\u{1FAFF}]/gu);
  const unicodeCount = unicodeChars ? unicodeChars.length : 0;
  const totalChars = content.length;
  
  if (totalChars > 0 && unicodeCount / totalChars > 0.5 && unicodeCount >= 10) {
    return { isSpam: true, reason: 'Excessive Unicode/emoji detected' };
  }

  // Check for excessive special characters (more than 60% special chars)
  const specialCharPattern = /[^\w\s]/g;
  const specialChars = content.match(specialCharPattern);
  const specialCharCount = specialChars ? specialChars.length : 0;
  
  if (totalChars > 0 && specialCharCount / totalChars > 0.6 && specialCharCount >= 15) {
    return { isSpam: true, reason: 'Excessive special characters detected' };
  }

  // Check for excessive whitespace (more than 50% whitespace)
  const whitespaceCount = (content.match(/\s/g) || []).length;
  if (totalChars > 0 && whitespaceCount / totalChars > 0.5 && whitespaceCount >= 20) {
    return { isSpam: true, reason: 'Excessive whitespace detected' };
  }

  // Check for mixed repeated patterns (like "a!a!a!a!" or "123123123")
  const mixedRepeatPattern = /(.{1,5})\1{4,}/;
  if (mixedRepeatPattern.test(content)) {
    return { isSpam: true, reason: 'Repeated pattern detected' };
  }

  // Check for very long messages with minimal unique characters (like 500+ chars but only 5 unique chars)
  if (content.length >= 200) {
    const uniqueChars = new Set(content.toLowerCase().replace(/\s/g, ''));
    if (uniqueChars.size <= 5) {
      return { isSpam: true, reason: 'Long message with minimal unique characters' };
    }
  }

  return { isSpam: false };
}

