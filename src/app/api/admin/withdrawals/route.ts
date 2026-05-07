import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: { user: { select: { username: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.withdrawal.count({ where }),
    ]);

    return NextResponse.json({ withdrawals, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, status, note } = await request.json();

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (status === "approved" && withdrawal.status === "pending") {
      await prisma.$transaction([
        prisma.withdrawal.update({ where: { id }, data: { status: "approved", note } }),
        prisma.mutation.create({
          data: {
            userId: withdrawal.userId,
            type: "debit",
            amount: withdrawal.amount,
            balBefore: withdrawal.user.balance,
            balAfter: withdrawal.user.balance - withdrawal.amount,
            description: `Withdrawal approved: ${withdrawal.bankName} ${withdrawal.bankAccount}`,
            source: "withdraw",
          },
        }),
        prisma.user.update({
          where: { id: withdrawal.userId },
          data: { balance: { decrement: withdrawal.amount } },
        }),
      ]);
    } else {
      await prisma.withdrawal.update({ where: { id }, data: { status, note } });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal update withdrawal" }, { status: 500 });
  }
}
