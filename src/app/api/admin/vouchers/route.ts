import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const vouchers = await prisma.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    return NextResponse.json({ vouchers });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const data = await request.json();
    const voucher = await prisma.voucher.create({
      data: {
        ...data,
        createdBy: admin.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    return NextResponse.json({ success: true, voucher });
  } catch {
    return NextResponse.json({ error: "Gagal membuat voucher" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, ...data } = await request.json();
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    const voucher = await prisma.voucher.update({ where: { id }, data });
    return NextResponse.json({ success: true, voucher });
  } catch {
    return NextResponse.json({ error: "Gagal update voucher" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await prisma.voucher.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus voucher" }, { status: 500 });
  }
}
