// ============================================================================
// @mention Parser Utility
// ============================================================================

/**
 * Parses @mention tokens from comment text and resolves them to member email
 * addresses. Each token is matched case-insensitively against:
 *   - full email address
 *   - email local part (before the @)
 *   - username
 *   - firstName
 *   - lastName
 *   - "firstName.lastName" combined
 *
 * Returns a deduplicated array of matched email addresses.
 */
export function parseMentions(
  text: string,
  projectMembers: Array<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  }>
): string[] {
  // Extract all @word tokens (everything after @ until whitespace)
  const tokenRegex = /@(\S+)/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    tokens.push(match[1].toLowerCase());
  }

  if (tokens.length === 0) return [];

  const matched = new Set<string>();

  for (const token of tokens) {
    for (const member of projectMembers) {
      const email = member.email.toLowerCase();
      const localPart = email.split('@')[0];
      const username = member.username?.toLowerCase() ?? null;
      const firstName = member.firstName?.toLowerCase() ?? null;
      const lastName = member.lastName?.toLowerCase() ?? null;
      const fullName =
        firstName && lastName ? `${firstName}.${lastName}` : null;

      if (
        token === email ||
        token === localPart ||
        (username !== null && token === username) ||
        (firstName !== null && token === firstName) ||
        (lastName !== null && token === lastName) ||
        (fullName !== null && token === fullName)
      ) {
        matched.add(member.email);
        break;
      }
    }
  }

  return Array.from(matched);
}
