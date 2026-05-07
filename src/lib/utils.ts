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

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function parseAccountData(
  bulk: string
): { email: string; password: string; info: string }[] {
  return bulk
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.split("|");
      return {
        email: parts[0]?.trim() || "",
        password: parts[1]?.trim() || "",
        info: parts[2]?.trim() || "",
      };
    });
}
