export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Generate a slug, suffixing -2/-3/... until `isAvailable(slug)` returns true.
 */
export async function generateUniqueSlug(
  text: string,
  isAvailable: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = generateSlug(text) || "item";
  if (await isAvailable(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (await isAvailable(candidate)) return candidate;
  }
  // Fallback: append timestamp
  return `${base}-${Date.now()}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Parse multi-line bulk account data in the form `email|password|info`.
 * Lines that do not contain a `|` separator or have empty email are skipped
 * (silently — caller should also count returned length).
 */
export function parseAccountData(
  bulk: string,
): { email: string; password: string; info: string }[] {
  return bulk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes("|"))
    .map((line) => {
      const parts = line.split("|");
      return {
        email: parts[0]?.trim() || "",
        password: parts[1]?.trim() || "",
        info: parts[2]?.trim() || "",
      };
    })
    .filter((acc) => acc.email.length > 0);
}

/**
 * Escape user-supplied text for Telegram's MarkdownV2 parse mode.
 * Required for any text containing characters in the reserved set.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
