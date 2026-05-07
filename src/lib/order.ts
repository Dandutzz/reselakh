import { prisma } from "./prisma";

export interface OrderResult {
  ok: true;
  totalPrice: number;
  accountData: string;
  productName: string;
  variationName: string;
}

export interface OrderError {
  ok: false;
  error: string;
}

/**
 * Atomically claim `qty` available stocks for the given variation code and
 * create the order record. Returns the resulting account data on success.
 *
 * The stock claim is implemented as `updateMany(... isSold: false ...)` inside
 * a transaction so concurrent buyers cannot grab the same stock row.
 */
export async function placeBotOrder(params: {
  ownerUserId: string;
  code: string;
  qty: number;
  source: "telegram" | "whatsapp";
}): Promise<OrderResult | OrderError> {
  const { ownerUserId, code, qty, source } = params;

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

      const totalPrice = variation.price * qty;
      const accountData = candidateStocks.map((s) => s.data).join("\n");

      await tx.order.create({
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

      return {
        ok: true,
        totalPrice,
        accountData,
        productName: variation.product.name,
        variationName: variation.name,
      } as OrderResult;
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Order gagal",
    };
  }
}
