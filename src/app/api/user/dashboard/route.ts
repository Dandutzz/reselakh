import { NextResponse } from "next/server";
import { handleApiError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireAuth();

    const [
      user,
      totalProducts,
      totalOrders,
      totalResellers,
      recentOrders,
      recentMutations,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, username: true, email: true, balance: true, status: true },
      }),
      prisma.product.count({ where: { userId: session.id } }),
      prisma.order.count({ where: { userId: session.id } }),
      prisma.reseller.count({ where: { userId: session.id } }),
      prisma.order.findMany({
        where: { userId: session.id },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true } } },
      }),
      prisma.mutation.findMany({
        where: { userId: session.id },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      user,
      stats: { totalProducts, totalOrders, totalResellers },
      recentOrders,
      recentMutations,
    });
  } catch (err) {
    return handleApiError("user/dashboard:GET", err);
  }
}
