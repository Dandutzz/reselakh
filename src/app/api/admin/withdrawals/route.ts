import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAdmin, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampInt, idSchema, parseJson } from "@/lib/validate";

const PatchSchema = z.object({
  id: idSchema,
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
    const limit = clampInt(searchParams.get("limit"), 20, 1, 100);

    const where: { status?: string } = {};
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

    return NextResponse.json({
      withdrawals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError("admin/withdrawals:GET", err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, status, note } = await parseJson(request, PatchSchema);

    await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
        include: { user: { select: { id: true, balance: true } } },
      });
      if (!withdrawal) throw new ValidationError("Withdrawal tidak ditemukan");
      if (withdrawal.status !== "pending") {
        throw new ValidationError("Withdrawal sudah diproses");
      }

      // Defense in depth: refuse to approve a non-positive amount even if it
      // somehow slipped past the user-facing validation.
      if (withdrawal.amount <= 0) {
        throw new ValidationError("Jumlah withdraw tidak valid");
      }

      if (status === "approved") {
        if (withdrawal.user.balance < withdrawal.amount) {
          throw new ValidationError("Saldo user tidak mencukupi");
        }

        await tx.withdrawal.update({
          where: { id },
          data: { status, note },
        });
        await tx.user.update({
          where: { id: withdrawal.userId },
          data: { balance: { decrement: withdrawal.amount } },
        });
        await tx.mutation.create({
          data: {
            userId: withdrawal.userId,
            type: "debit",
            amount: withdrawal.amount,
            balBefore: withdrawal.user.balance,
            balAfter: withdrawal.user.balance - withdrawal.amount,
            description: `Withdrawal approved: ${withdrawal.bankName} ${withdrawal.bankAccount}`,
            source: "withdraw",
          },
        });
      } else {
        await tx.withdrawal.update({ where: { id }, data: { status, note } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("admin/withdrawals:PATCH", err);
  }
}
