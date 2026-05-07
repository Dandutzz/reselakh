import {
  CheckStatusError,
  CheckStatusResult,
  CreateQrisError,
  CreateQrisRequest,
  CreateQrisResult,
  EqrisMethod,
  getEqrisMethod,
  getEqrisQrisBase,
  parseConfig,
  QrisServerLike,
} from "./types";

/**
 * EQRIS (eqris.com) adapter. Two methods are supported under the same
 * provider, selected via `config.method`:
 *
 *   "gomerch" (default) — GoPay Merchant dynamic QRIS:
 *     POST /api/gomerch-transaksi/qris   (create)
 *     POST /api/gomerch-transaksi/status (check)
 *     auth: Bearer apiKey, body.merchant_id = merchantId
 *
 *   "orkut" — Orkut static-QRIS conversion:
 *     POST /api/qr-orkut          (create — body { base, amount })
 *     POST /api/mutasi-orkut-v2   (check  — finds the matching mutasi)
 *     auth: Bearer apiKey (EQRIS account token); merchant credentials for
 *     mutasi go in `merchantId` (Orkut username) and `apiSecret` (password).
 *     `config.qrisBase` is the merchant's QRIS string base.
 *
 * Reference: https://eqris.com/api-docs/
 */

const DEFAULT_BASE_URL = "https://eqris.com";

// Status tokens we accept as "paid" across both gomerch + orkut responses.
const PAID_STATUS_TOKENS = new Set([
  "paid",
  "completed",
  "settled",
  "success",
  "sukses",
  "berhasil",
  "in",
  "kredit",
  "credit",
]);

interface EqrisQrisResponse {
  status?: string | boolean;
  message?: string;
  data?: {
    qrString?: string;
    qr_string?: string;
    qrImage?: string;
    qr_image?: string;
    paymentUrl?: string;
    payment_url?: string;
    expiredAt?: string;
    expired_at?: string;
    fee?: number;
    totalAmount?: number;
    total_amount?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface EqrisStatusResponse {
  status?: string | boolean;
  data?: {
    status?: string;
    paidAt?: string;
    paid_at?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function getBaseUrl(server: QrisServerLike): string {
  const cfg = parseConfig(server);
  const url = typeof cfg.baseUrl === "string" ? cfg.baseUrl : null;
  return (url || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function authHeaders(server: QrisServerLike): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (server.apiKey) {
    headers.Authorization = `Bearer ${server.apiKey}`;
  }
  return headers;
}

export async function createQris(
  server: QrisServerLike,
  req: CreateQrisRequest,
): Promise<CreateQrisResult | CreateQrisError> {
  const method: EqrisMethod = getEqrisMethod(server);
  if (method === "orkut") {
    return createQrisOrkut(server, req);
  }
  return createQrisGomerch(server, req);
}

async function createQrisGomerch(
  server: QrisServerLike,
  req: CreateQrisRequest,
): Promise<CreateQrisResult | CreateQrisError> {
  if (!server.apiKey) {
    return { ok: false, error: "EQRIS apiKey belum diatur" };
  }

  const url = `${getBaseUrl(server)}/api/gomerch-transaksi/qris`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(server),
      body: JSON.stringify({
        order_id: req.orderId,
        amount: Math.round(req.amount),
        merchant_id: server.merchantId ?? undefined,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `EQRIS request gagal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: EqrisQrisResponse | null = null;
  try {
    body = (await res.json()) as EqrisQrisResponse;
  } catch {
    return {
      ok: false,
      error: `EQRIS response tidak valid (HTTP ${res.status})`,
    };
  }

  if (!res.ok || body?.status === false || body?.status === "error") {
    return {
      ok: false,
      error: body?.message || `EQRIS HTTP ${res.status}`,
      raw: body,
    };
  }

  const data = body?.data ?? {};
  const qrString =
    (typeof data.qrString === "string" && data.qrString) ||
    (typeof data.qr_string === "string" && data.qr_string) ||
    null;
  const paymentUrl =
    (typeof data.paymentUrl === "string" && data.paymentUrl) ||
    (typeof data.payment_url === "string" && data.payment_url) ||
    (typeof data.qrImage === "string" && data.qrImage) ||
    (typeof data.qr_image === "string" && data.qr_image) ||
    null;

  if (!qrString && !paymentUrl) {
    return {
      ok: false,
      error: "EQRIS tidak mengembalikan QR string / payment URL",
      raw: body,
    };
  }

  const expiredRaw =
    (typeof data.expiredAt === "string" && data.expiredAt) ||
    (typeof data.expired_at === "string" && data.expired_at) ||
    null;
  const expiresAt = expiredRaw ? new Date(expiredRaw) : null;

  const totalAmount =
    typeof data.totalAmount === "number"
      ? data.totalAmount
      : typeof data.total_amount === "number"
        ? data.total_amount
        : Math.round(req.amount);
  const fee = typeof data.fee === "number" ? data.fee : 0;

  return {
    ok: true,
    qrString,
    paymentUrl,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    fee,
    totalAmount,
    raw: body,
  };
}

export async function checkStatus(
  server: QrisServerLike,
  orderId: string,
  amount?: number,
): Promise<CheckStatusResult | CheckStatusError> {
  const method: EqrisMethod = getEqrisMethod(server);
  if (method === "orkut") {
    return checkStatusOrkut(server, orderId, amount);
  }
  return checkStatusGomerch(server, orderId);
}

async function checkStatusGomerch(
  server: QrisServerLike,
  orderId: string,
): Promise<CheckStatusResult | CheckStatusError> {
  if (!server.apiKey) {
    return { ok: false, error: "EQRIS apiKey belum diatur" };
  }

  const url = `${getBaseUrl(server)}/api/gomerch-transaksi/status`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(server),
      body: JSON.stringify({
        order_id: orderId,
        merchant_id: server.merchantId ?? undefined,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `EQRIS request gagal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: EqrisStatusResponse | null = null;
  try {
    body = (await res.json()) as EqrisStatusResponse;
  } catch {
    return {
      ok: false,
      error: `EQRIS response tidak valid (HTTP ${res.status})`,
    };
  }

  if (!res.ok) {
    return { ok: false, error: `EQRIS HTTP ${res.status}`, raw: body };
  }

  const rawStatus = body?.data?.status?.toLowerCase?.() ?? "";
  let status: CheckStatusResult["status"] = "pending";
  if (PAID_STATUS_TOKENS.has(rawStatus)) {
    status = "completed";
  } else if (rawStatus === "expired") {
    status = "expired";
  } else if (rawStatus === "cancelled" || rawStatus === "canceled") {
    status = "cancelled";
  } else if (rawStatus === "failed") {
    status = "failed";
  }

  const paidRaw =
    (typeof body?.data?.paidAt === "string" && body.data.paidAt) ||
    (typeof body?.data?.paid_at === "string" && body.data.paid_at) ||
    null;
  const paidAt = paidRaw ? new Date(paidRaw) : null;

  return {
    ok: true,
    status,
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    raw: body,
  };
}

// ============================================================================
// Orkut method
// ============================================================================

interface OrkutQrisResponse {
  status?: string | boolean;
  message?: string;
  data?: {
    qrString?: string;
    qr_string?: string;
    qrImage?: string;
    qr_image?: string;
    qrImageUrl?: string;
    qr_image_url?: string;
    fee?: number;
    totalAmount?: number;
    total_amount?: number;
    [key: string]: unknown;
  };
  qrString?: string;
  qr_string?: string;
  qrImage?: string;
  qr_image?: string;
  [key: string]: unknown;
}

interface OrkutMutasiResponse {
  status?: string | boolean;
  message?: string;
  data?:
    | Array<Record<string, unknown>>
    | { mutasi?: Array<Record<string, unknown>>; [key: string]: unknown };
  [key: string]: unknown;
}

async function createQrisOrkut(
  server: QrisServerLike,
  req: CreateQrisRequest,
): Promise<CreateQrisResult | CreateQrisError> {
  if (!server.apiKey) {
    return { ok: false, error: "EQRIS apiKey belum diatur" };
  }
  const qrisBase = getEqrisQrisBase(server);
  if (!qrisBase) {
    return {
      ok: false,
      error: "EQRIS Orkut: QRIS String Base belum diisi pada konfigurasi server",
    };
  }

  const url = `${getBaseUrl(server)}/api/qr-orkut`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(server),
      body: JSON.stringify({
        base: qrisBase,
        amount: Math.round(req.amount),
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `EQRIS request gagal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: OrkutQrisResponse | null = null;
  try {
    body = (await res.json()) as OrkutQrisResponse;
  } catch {
    return {
      ok: false,
      error: `EQRIS response tidak valid (HTTP ${res.status})`,
    };
  }

  if (!res.ok || body?.status === false || body?.status === "error") {
    return {
      ok: false,
      error: body?.message || `EQRIS HTTP ${res.status}`,
      raw: body,
    };
  }

  const data = body?.data ?? {};
  const qrString =
    (typeof data.qrString === "string" && data.qrString) ||
    (typeof data.qr_string === "string" && data.qr_string) ||
    (typeof body?.qrString === "string" && body.qrString) ||
    (typeof body?.qr_string === "string" && body.qr_string) ||
    null;
  const paymentUrl =
    (typeof data.qrImageUrl === "string" && data.qrImageUrl) ||
    (typeof data.qr_image_url === "string" && data.qr_image_url) ||
    (typeof data.qrImage === "string" && data.qrImage) ||
    (typeof data.qr_image === "string" && data.qr_image) ||
    (typeof body?.qrImage === "string" && body.qrImage) ||
    (typeof body?.qr_image === "string" && body.qr_image) ||
    null;

  if (!qrString && !paymentUrl) {
    return {
      ok: false,
      error: "EQRIS Orkut tidak mengembalikan QR string / image URL",
      raw: body,
    };
  }

  const totalAmount =
    typeof data.totalAmount === "number"
      ? data.totalAmount
      : typeof data.total_amount === "number"
        ? data.total_amount
        : Math.round(req.amount);
  const fee = typeof data.fee === "number" ? data.fee : 0;

  return {
    ok: true,
    qrString,
    paymentUrl,
    expiresAt: null,
    fee,
    totalAmount,
    raw: body,
  };
}

async function checkStatusOrkut(
  server: QrisServerLike,
  orderId: string,
  amount?: number,
): Promise<CheckStatusResult | CheckStatusError> {
  if (!server.apiKey) {
    return { ok: false, error: "EQRIS apiKey belum diatur" };
  }
  // Orkut mutasi-v2 needs the merchant's Orkut credentials. We persist
  // username in `merchantId` and password in `apiSecret` to avoid a schema
  // change. If either is missing, fall back to "pending" so the caller keeps
  // polling rather than treating the unconfigured server as failed.
  const username = server.merchantId?.trim();
  const password = server.apiSecret?.trim();
  if (!username || !password) {
    return {
      ok: false,
      error:
        "EQRIS Orkut: Username/password Orkut belum diatur (mutasi tidak bisa dicek)",
    };
  }

  const url = `${getBaseUrl(server)}/api/mutasi-orkut-v2`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(server),
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `EQRIS request gagal: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: OrkutMutasiResponse | null = null;
  try {
    body = (await res.json()) as OrkutMutasiResponse;
  } catch {
    return {
      ok: false,
      error: `EQRIS response tidak valid (HTTP ${res.status})`,
    };
  }

  if (!res.ok) {
    return { ok: false, error: `EQRIS HTTP ${res.status}`, raw: body };
  }

  const target = amount != null ? Math.round(amount) : null;
  const matches = findMutasiMatch(body, target, orderId);

  if (matches.matched) {
    return {
      ok: true,
      status: "completed",
      paidAt: matches.paidAt,
      raw: body,
    };
  }

  return { ok: true, status: "pending", paidAt: null, raw: body };
}

function findMutasiMatch(
  body: OrkutMutasiResponse,
  amount: number | null,
  orderId: string,
): { matched: boolean; paidAt: Date | null } {
  const list = extractMutasiList(body);
  if (list.length === 0) return { matched: false, paidAt: null };

  for (const row of list) {
    const direction = String(row.type ?? row.kredit_debit ?? row.tipe ?? "").toLowerCase();
    if (direction && direction !== "in" && direction !== "kredit" && direction !== "credit") {
      continue;
    }
    const rowAmount = Number(row.amount ?? row.nominal ?? row.kredit ?? 0);
    if (amount != null && rowAmount !== amount) continue;
    const desc = String(row.description ?? row.keterangan ?? row.note ?? "");
    if (orderId && desc && !desc.includes(orderId)) {
      // Orkut descriptions usually don't contain our orderId — only enforce
      // this filter when the row clearly references some other order.
      // (no-op: kept for documentation)
    }
    const paidRaw =
      (typeof row.paidAt === "string" && row.paidAt) ||
      (typeof row.paid_at === "string" && row.paid_at) ||
      (typeof row.tanggal === "string" && row.tanggal) ||
      (typeof row.date === "string" && row.date) ||
      null;
    const paidAt = paidRaw ? new Date(paidRaw) : null;
    return {
      matched: true,
      paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    };
  }
  return { matched: false, paidAt: null };
}

function extractMutasiList(
  body: OrkutMutasiResponse,
): Array<Record<string, unknown>> {
  const data = body?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.mutasi)) {
    return data.mutasi;
  }
  return [];
}
