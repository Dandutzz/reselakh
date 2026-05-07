/**
 * Common payment-gateway types shared by EQRIS and Pakasir adapters.
 */

export interface QrisServerLike {
  id: string;
  name: string;
  provider: string;
  apiKey: string | null;
  apiSecret: string | null;
  merchantId: string | null;
  config: string | null;
}

export interface CreateQrisRequest {
  amount: number;
  orderId: string;
  redirectUrl?: string | null;
}

export interface CreateQrisResult {
  ok: true;
  qrString: string | null;
  paymentUrl: string | null;
  expiresAt: Date | null;
  fee: number;
  totalAmount: number;
  raw: unknown;
}

export interface CreateQrisError {
  ok: false;
  error: string;
  raw?: unknown;
}

export interface CheckStatusResult {
  ok: true;
  status: "pending" | "completed" | "expired" | "cancelled" | "failed";
  paidAt: Date | null;
  raw: unknown;
}

export interface CheckStatusError {
  ok: false;
  error: string;
  raw?: unknown;
}

export type PaymentProvider = "eqris" | "pakasir";

/**
 * EQRIS supports two distinct flows that we expose under the same provider:
 *   - "gomerch" — GoPay Merchant dynamic QRIS (`/api/gomerch-transaksi/*`).
 *                 Auth via Bearer apiKey + merchantId. Default for backwards
 *                 compatibility with existing servers (config.method unset).
 *   - "orkut"   — Orkut static-QRIS conversion (`/api/qr-orkut` +
 *                 `/api/mutasi-orkut-v2`). Requires the merchant's QRIS string
 *                 base; status is inferred from Orkut mutasi rather than a
 *                 dedicated transaction id.
 */
export type EqrisMethod = "gomerch" | "orkut";

export function parseConfig(server: QrisServerLike): Record<string, unknown> {
  if (!server.config) return {};
  try {
    const parsed = JSON.parse(server.config);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function getEqrisMethod(server: QrisServerLike): EqrisMethod {
  const cfg = parseConfig(server);
  const m = typeof cfg.method === "string" ? cfg.method.toLowerCase() : "";
  return m === "orkut" ? "orkut" : "gomerch";
}

export function getEqrisQrisBase(server: QrisServerLike): string | null {
  const cfg = parseConfig(server);
  const v = typeof cfg.qrisBase === "string" ? cfg.qrisBase.trim() : "";
  return v.length > 0 ? v : null;
}
