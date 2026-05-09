import * as eqris from "./eqris";
import * as pakasir from "./pakasir";
import {
  CheckStatusError,
  CheckStatusResult,
  CreateQrisError,
  CreateQrisRequest,
  CreateQrisResult,
  PaymentProvider,
  QrisServerLike,
  getKodeUnikRange,
  getServerFee,
  pickKodeUnik,
} from "./types";

export type { CreateQrisRequest, CreateQrisResult, CreateQrisError, CheckStatusResult, CheckStatusError, PaymentProvider, QrisServerLike };

function normaliseProvider(provider: string | null | undefined): PaymentProvider | null {
  if (!provider) return null;
  const p = provider.toLowerCase();
  if (p === "eqris" || p === "pakasir") return p;
  return null;
}

export function isSupportedProvider(provider: string | null | undefined): provider is PaymentProvider {
  return normaliseProvider(provider) !== null;
}

/**
 * Apply per-server "biaya admin" (`config.fee`) and a random "kode unik"
 * (`config.kodeUnikMin/Max`, 1-99) on top of the caller-supplied subtotal,
 * then delegate to the underlying provider with the final amount. Returns
 * `fee = serverFee + kodeUnik` and `totalAmount = subtotal + fee` so that
 * `Payment.amount` (subtotal), `Payment.fee`, and `Payment.totalAmount` all
 * line up with what the customer actually pays — and so that mutasi matching
 * (which compares against `Payment.totalAmount`) keeps working.
 */
export async function createQris(
  server: QrisServerLike,
  req: CreateQrisRequest,
): Promise<CreateQrisResult | CreateQrisError> {
  const provider = normaliseProvider(server.provider);
  if (!provider) {
    return {
      ok: false,
      error: `Provider QRIS '${server.provider}' belum didukung (eqris | pakasir)`,
    };
  }

  const subtotal = Math.max(0, Math.round(req.amount));
  const serverFee = getServerFee(server);
  const range = getKodeUnikRange(server);
  const kodeUnik = range ? pickKodeUnik(range) : 0;
  const finalAmount = subtotal + serverFee + kodeUnik;
  const totalFee = serverFee + kodeUnik;

  const adjustedReq: CreateQrisRequest = { ...req, amount: finalAmount };
  const result =
    provider === "eqris"
      ? await eqris.createQris(server, adjustedReq)
      : await pakasir.createQris(server, adjustedReq);

  if (!result.ok) return result;

  // Override the gateway-echoed totals with our locally-authoritative
  // breakdown. Payment.fee = adminFee + kodeUnik so mutasi matching can use
  // Payment.totalAmount directly (= subtotal + fee).
  return {
    ...result,
    fee: totalFee,
    totalAmount: finalAmount,
  };
}

export async function checkStatus(
  server: QrisServerLike,
  orderId: string,
  amount: number,
): Promise<CheckStatusResult | CheckStatusError> {
  const provider = normaliseProvider(server.provider);
  if (provider === "eqris") return eqris.checkStatus(server, orderId, amount);
  if (provider === "pakasir") return pakasir.checkStatus(server, orderId, amount);
  return {
    ok: false,
    error: `Provider QRIS '${server.provider}' belum didukung`,
  };
}

/**
 * Generate a short, idempotent order id used as the gateway-facing reference.
 * Pattern: `RS-<timestamp36>-<random5>` (~14-16 chars). Pakasir slug imposes
 * fewer than 64-char limits; staying conservatively short.
 */
export function generateOrderId(prefix = "RS"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}
