export function normalizeEmail(email: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized === "" ? null : normalized ?? null;
}
