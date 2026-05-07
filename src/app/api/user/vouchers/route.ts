import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { code } = await request.json();

    const voucher = await prisma.voucher.findUnique({ where: { code } });
    if (!voucher) return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });
    if (!voucher.isActive) return NextResponse.json({ error: "Voucher tidak aktif" }, { status: 400 });
    if (voucher.usedCount >= voucher.maxUses) return NextResponse.json({ error: "Voucher sudah habis" }, { status: 400 });
    if (voucher.expiresAt && new Date() > voucher.expiresAt) return NextResponse.json({ error: "Voucher sudah expired" }, { status: 400 });

    const alreadyUsed = await prisma.voucherUsage.findFirst({
      where: { voucherId: voucher.id, userId: session.id },
    });
    if (alreadyUsed) return NextResponse.json({ error: "Voucher sudah pernah digunakan" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const amount = voucher.type === "percentage" ? 0 : voucher.amount;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.id },
        data: { balance: { increment: amount } },
      }),
      prisma.voucherUsage.create({
        data: { voucherId: voucher.id, userId: session.id, amount },
      }),
      prisma.voucher.update({
        where: { id: voucher.id },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.mutation.create({
        data: {
          userId: session.id,
          type: "credit",
          amount,
          balBefore: user.balance,
          balAfter: user.balance + amount,
          description: `Voucher: ${code}`,
          source: "voucher",
        },
      }),
    ]);

    return NextResponse.json({ success: true, amount });
  } catch {
    return NextResponse.json({ error: "Gagal redeem voucher" }, { status: 500 });
  }
}
