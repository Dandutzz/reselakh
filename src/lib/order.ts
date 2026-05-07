import { prisma } from "./prisma";

export interface OrderResult {
  ok: true;
  subtotal: number;
  discount: number;
  totalPrice: number;
  accountData: string;
  productName: string;
  variationName: string;
  voucherCode?: string;
}

export interface OrderError {
  ok: false;
  error: string;
}

/**
 * Atomically claim `qty` available stocks for the given variation code, apply
 * an optional voucher discount, and create the order record. Returns the
 * resulting account data on success.
 *
 * Stock claim, voucher claim, and order create all happen in a single
 * transaction so concurrent buyers cannot oversell and a voucher cannot be
 * claimed past `maxUses`.
 */
export async function placeBotOrder(params: {
  ownerUserId: string;
  code: string;
  qty: number;
  source: "telegram" | "whatsapp";
  voucherCode?: string;
}): Promise<OrderResult | OrderError> {
  const { ownerUserId, code, qty, source, voucherCode } = params;

  if (!Number.isFinite(qty) || qty <= 0 || qty > 100) {
    return { ok: false, error: "Jumlah tidak valid (1-100)" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const variation = await tx.productVariation.findFirst({
        where: {
          code,
          isActive: true,
          product: { userId: ownerUserId, isActive: true },
        },
        include: { product: true },
      });

      if (!variation) {
        return { ok: false, error: "Produk tidak ditemukan" } as OrderError;
      }

      const candidateStocks = await tx.stock.findMany({
        where: { variationId: variation.id, isSold: false },
        take: qty,
        select: { id: true, data: true },
      });

      if (candidateStocks.length < qty) {
        return {
          ok: false,
          error: `Stock tidak cukup. Tersedia: ${candidateStocks.length}`,
        } as OrderError;
      }

      const ids = candidateStocks.map((s) => s.id);

      // Atomic claim — only updates rows that are still available.
      const claimed = await tx.stock.updateMany({
        where: { id: { in: ids }, isSold: false },
        data: { isSold: true, soldAt: new Date() },
      });

      if (claimed.count < qty) {
        // Someone else got there first; rollback.
        throw new Error("Stock terjual oleh transaksi lain, coba lagi");
      }

      const subtotal = variation.price * qty;

      // Optional voucher application — capped at subtotal so we never go
      // negative.
      let discount = 0;
      let appliedVoucherId: string | null = null;
      const trimmedVoucherCode = voucherCode?.trim();
      if (trimmedVoucherCode) {
        const voucher = await tx.voucher.findUnique({
          where: { code: trimmedVoucherCode.toUpperCase() },
        });
        if (!voucher || !voucher.isActive) {
          throw new Error("Voucher tidak ditemukan / nonaktif");
        }
        if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) {
          throw new Error("Voucher kadaluarsa");
        }
        if (voucher.minPurchase != null && subtotal < voucher.minPurchase) {
          throw new Error(
            `Minimal pembelian untuk voucher ini Rp ${voucher.minPurchase.toLocaleString("id-ID")}`,
          );
        }
        if (voucher.usedCount >= voucher.maxUses) {
          throw new Error("Voucher sudah habis");
        }

        const rawDiscount =
          voucher.type === "percentage"
            ? Math.floor((subtotal * voucher.amount) / 100)
            : Math.floor(voucher.amount);
        discount = Math.min(Math.max(0, rawDiscount), subtotal);
        appliedVoucherId = voucher.id;

        // Atomic claim — only succeeds if voucher still has room.
        const voucherClaimed = await tx.voucher.updateMany({
          where: {
            id: voucher.id,
            isActive: true,
            usedCount: { lt: voucher.maxUses },
          },
          data: { usedCount: { increment: 1 } },
        });
        if (voucherClaimed.count === 0) {
          throw new Error("Voucher sudah habis");
        }
      }

      const totalPrice = Math.max(0, subtotal - discount);
      const accountData = candidateStocks.map((s) => s.data).join("\n");

      const order = await tx.order.create({
        data: {
          userId: ownerUserId,
          productId: variation.product.id,
          variationId: variation.id,
          quantity: qty,
          totalPrice,
          status: "completed",
          accountData,
          source,
        },
      });

      if (appliedVoucherId) {
        await tx.voucherUsage.create({
          data: {
            voucherId: appliedVoucherId,
            userId: ownerUserId,
            amount: discount,
          },
        });
      }

      return {
        ok: true,
        subtotal,
        discount,
        totalPrice,
        accountData,
        productName: variation.product.name,
        variationName: variation.name,
        voucherCode: trimmedVoucherCode || undefined,
        orderId: order.id,
      } as unknown as OrderResult;
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Order gagal",
    };
  }
}
