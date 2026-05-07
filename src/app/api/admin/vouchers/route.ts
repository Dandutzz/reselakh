import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAdmin, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, moneySchema, parseJson } from "@/lib/validate";

const CreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  type: z.enum(["fixed", "percentage"]),
  amount: moneySchema,
  maxUses: z.number().int().min(1).max(1_000_000),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

const UpdateSchema = z.object({
  id: idSchema,
  code: z.string().trim().min(1).max(50).optional(),
  type: z.enum(["fixed", "percentage"]).optional(),
  amount: moneySchema.optional(),
  maxUses: z.number().int().min(1).max(1_000_000).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

const DeleteSchema = z.object({ id: idSchema });

export async function GET() {
  try {
    await requireAdmin();
    const vouchers = await prisma.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    return NextResponse.json({ vouchers });
  } catch (err) {
    return handleApiError("admin/vouchers:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const data = await parseJson(request, CreateSchema);
    const voucher = await prisma.voucher.create({
      data: {
        code: data.code,
        type: data.type,
        amount: data.amount,
        maxUses: data.maxUses,
        isActive: data.isActive ?? true,
        createdBy: admin.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    return NextResponse.json({ success: true, voucher });
  } catch (err) {
    return handleApiError("admin/vouchers:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, expiresAt, ...rest } = await parseJson(request, UpdateSchema);
    const exists = await prisma.voucher.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new ValidationError("Voucher tidak ditemukan");

    const data: Record<string, unknown> = { ...rest };
    if (expiresAt !== undefined) {
      data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const voucher = await prisma.voucher.update({ where: { id }, data });
    return NextResponse.json({ success: true, voucher });
  } catch (err) {
    return handleApiError("admin/vouchers:PATCH", err);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await parseJson(request, DeleteSchema);
    await prisma.voucher.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("admin/vouchers:DELETE", err);
  }
}
