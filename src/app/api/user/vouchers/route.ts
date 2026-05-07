import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/validate";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

const RedeemSchema = z.object({
  code: z.string().trim().min(1).max(50),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (!checkRateLimit(`voucher:${session.id}`, 10, 60_000) ||
        !checkRateLimit(`voucher-ip:${getClientKey(request)}`, 30, 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const { code } = await parseJson(request, RedeemSchema);

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({ where: { code } });
      if (!voucher) throw new ValidationError("Voucher tidak ditemukan");
      if (!voucher.isActive) throw new ValidationError("Voucher tidak aktif");
      if (voucher.expiresAt && new Date() > voucher.expiresAt) {
        throw new ValidationError("Voucher sudah expired");
      }
      if (voucher.type !== "fixed") {
        // Percentage discount vouchers must be applied at order time, not
        // redeemed for balance. Reject here until that flow is implemented.
        throw new ValidationError("Tipe voucher ini belum didukung");
      }
      if (voucher.amount <= 0) {
        throw new ValidationError("Voucher tidak valid");
      }

      const alreadyUsed = await tx.voucherUsage.findFirst({
        where: { voucherId: voucher.id, userId: session.id },
        select: { id: true },
      });
      if (alreadyUsed) throw new ValidationError("Voucher sudah pernah digunakan");

      // Atomic claim: only succeeds if voucher hasn't been fully redeemed yet.
      const claimed = await tx.voucher.updateMany({
        where: {
          id: voucher.id,
          isActive: true,
          usedCount: { lt: voucher.maxUses },
        },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count === 0) throw new ValidationError("Voucher sudah habis");

      const user = await tx.user.findUnique({
        where: { id: session.id },
        select: { balance: true },
      });
      if (!user) throw new ValidationError("User tidak ditemukan");

      const amount = voucher.amount;
      await tx.user.update({
        where: { id: session.id },
        data: { balance: { increment: amount } },
      });
      await tx.voucherUsage.create({
        data: { voucherId: voucher.id, userId: session.id, amount },
      });
      await tx.mutation.create({
        data: {
          userId: session.id,
          type: "credit",
          amount,
          balBefore: user.balance,
          balAfter: user.balance + amount,
          description: `Voucher: ${code}`,
          source: "voucher",
        },
      });

      return { amount };
    });

    return NextResponse.json({ success: true, amount: result.amount });
  } catch (err) {
    return handleApiError("user/vouchers:POST", err);
  }
}
