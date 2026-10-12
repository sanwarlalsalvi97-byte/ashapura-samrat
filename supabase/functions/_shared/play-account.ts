/** Deterministic non-PII identifier sent to Play, not a credential or a token claim. */
export async function playAccountIdentifier(userId: string): Promise<string> {
  if (!userId) throw new Error("Authenticated account required");
  const bytes = new TextEncoder().encode(`ashapura-play-account:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Only Google-returned ownership is trusted; never accept an ID from the request body. */
export async function ownsPlayPurchase(userId: string, googleAccountId: unknown): Promise<boolean> {
  if (typeof googleAccountId !== "string" || !googleAccountId) return false;
  return googleAccountId === await playAccountIdentifier(userId);
}