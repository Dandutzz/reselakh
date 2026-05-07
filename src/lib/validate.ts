import { z, ZodError, type ZodType } from "zod";
import { ValidationError } from "./auth";

/**
 * Parse a Request JSON body against a Zod schema. Throws ValidationError on failure
 * (which is converted to HTTP 400 by handleApiError).
 */
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Body JSON tidak valid");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = (result.error as ZodError).issues?.[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    throw new ValidationError(`${path}${issue?.message || "Input tidak valid"}`);
  }
  return result.data;
}

export const moneySchema = z
  .number({ message: "Harus angka" })
  .finite("Harus angka")
  .positive("Harus lebih dari 0")
  .max(1_000_000_000, "Terlalu besar");

export const nonNegativeMoneySchema = z
  .number({ message: "Harus angka" })
  .finite("Harus angka")
  .min(0, "Tidak boleh negatif")
  .max(1_000_000_000, "Terlalu besar");

export const idSchema = z.string().min(1, "ID wajib").max(64);

export const slugStringSchema = z.string().min(1).max(100);

export function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
