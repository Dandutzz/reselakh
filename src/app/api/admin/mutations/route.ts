import { NextResponse } from "next/server";
import { handleApiError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampInt } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const type = searchParams.get("type") || "";
    const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
    const limit = clampInt(searchParams.get("limit"), 50, 1, 200);

    const where: { userId?: string; type?: string } = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const [mutations, total] = await Promise.all([
      prisma.mutation.findMany({
        where,
        include: { user: { select: { username: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mutation.count({ where }),
    ]);

    return NextResponse.json({
      mutations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError("admin/mutations:GET", err);
  }
}
