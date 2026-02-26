export function requireAuth(token: string): void {
  const expected = process.env.PRACTICE_AUTH_TOKEN;
  if (!expected) throw new Error("Server misconfigured: PRACTICE_AUTH_TOKEN not set");
  if (token !== expected) throw new Error("Unauthorized");
}
