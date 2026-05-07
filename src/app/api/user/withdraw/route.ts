import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireAuth();
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ withdrawals });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await request.json();

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.balance < data.amount) {
      return NextResponse.json({ error: "Saldo tidak cukup" }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: session.id,
        amount: data.amount,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankHolder: data.bankHolder,
      },
    });

    return NextResponse.json({ success: true, withdrawal });
  } catch {
    return NextResponse.json({ error: "Gagal request withdrawal" }, { status: 500 });
  }
}
