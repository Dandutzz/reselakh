import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moneySchema, parseJson } from "@/lib/validate";

const MIN_WITHDRAWAL = 10_000; // IDR

const WithdrawSchema = z.object({
  amount: moneySchema.refine((n) => n >= MIN_WITHDRAWAL, {
    message: `Minimum withdraw Rp ${MIN_WITHDRAWAL.toLocaleString("id-ID")}`,
  }),
  bankName: z.string().trim().min(1).max(50),
  bankAccount: z.string().trim().min(1).max(64),
  bankHolder: z.string().trim().min(1).max(100),
});

export async function GET() {
  try {
    const session = await requireAuth();
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ withdrawals });
  } catch (err) {
    return handleApiError("user/withdraw:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await parseJson(request, WithdrawSchema);

    // Atomic check-and-hold: ensure user has enough balance accounting for any
    // existing pending withdrawals so the user can't request more than they have.
    const withdrawal = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.id },
        select: { balance: true },
      });
      if (!user) throw new ValidationError("User tidak ditemukan");

      const pendingAggregate = await tx.withdrawal.aggregate({
        where: { userId: session.id, status: "pending" },
        _sum: { amount: true },
      });
      const pending = pendingAggregate._sum.amount || 0;
      const available = user.balance - pending;
      if (available < data.amount) {
        throw new ValidationError("Saldo tidak cukup (termasuk withdraw pending)");
      }

      return tx.withdrawal.create({ data: { userId: session.id, ...data } });
    });

    return NextResponse.json({ success: true, withdrawal });
  } catch (err) {
    return handleApiError("user/withdraw:POST", err);
  }
}
