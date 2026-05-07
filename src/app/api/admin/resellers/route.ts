import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;

    const resellers = await prisma.reseller.findMany({
      where,
      include: {
        user: { select: { username: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ resellers });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
