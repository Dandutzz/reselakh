import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalOrders,
      totalRevenue,
      pendingWithdrawals,
      recentOrders,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "banned" } }),
      prisma.order.count(),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "credit" },
      }),
      prisma.withdrawal.count({ where: { status: "pending" } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true } }, product: { select: { name: true } } },
      }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, username: true, email: true, balance: true, status: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        bannedUsers,
        totalOrders,
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingWithdrawals,
      },
      recentOrders,
      recentUsers,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
