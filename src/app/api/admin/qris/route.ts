import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAdmin, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(40),
  apiKey: z.string().trim().min(1).max(500).optional().nullable(),
  apiSecret: z.string().trim().min(1).max(500).optional().nullable(),
  merchantId: z.string().trim().max(120).optional().nullable(),
  config: z.string().max(8000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const UpdateSchema = CreateSchema.partial().extend({ id: idSchema });
const DeleteSchema = z.object({ id: idSchema });

export async function GET() {
  try {
    await requireAdmin();
    const servers = await prisma.qrisServer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { selections: true } } },
    });
    return NextResponse.json({ servers });
  } catch (err) {
    return handleApiError("admin/qris:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const data = await parseJson(request, CreateSchema);
    const server = await prisma.qrisServer.create({ data });
    return NextResponse.json({ success: true, server });
  } catch (err) {
    return handleApiError("admin/qris:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, ...data } = await parseJson(request, UpdateSchema);
    const exists = await prisma.qrisServer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new ValidationError("QRIS tidak ditemukan");
    const server = await prisma.qrisServer.update({ where: { id }, data });
    return NextResponse.json({ success: true, server });
  } catch (err) {
    return handleApiError("admin/qris:PATCH", err);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await parseJson(request, DeleteSchema);
    await prisma.qrisServer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("admin/qris:DELETE", err);
  }
}
