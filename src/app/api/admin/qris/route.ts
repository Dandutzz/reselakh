import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const servers = await prisma.qrisServer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { selections: true } } },
    });
    return NextResponse.json({ servers });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();
    const server = await prisma.qrisServer.create({ data });
    return NextResponse.json({ success: true, server });
  } catch {
    return NextResponse.json({ error: "Gagal menambah QRIS" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, ...data } = await request.json();
    const server = await prisma.qrisServer.update({ where: { id }, data });
    return NextResponse.json({ success: true, server });
  } catch {
    return NextResponse.json({ error: "Gagal update QRIS" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    await prisma.qrisServer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus QRIS" }, { status: 500 });
  }
}
