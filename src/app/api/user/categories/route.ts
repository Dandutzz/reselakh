import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    const categories = await prisma.category.findMany({
      where: { userId: session.id },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await request.json();
    const category = await prisma.category.create({
      data: {
        userId: session.id,
        name: data.name,
        slug: generateSlug(data.name),
        icon: data.icon,
        sortOrder: data.sortOrder || 0,
      },
    });
    return NextResponse.json({ success: true, category });
  } catch {
    return NextResponse.json({ error: "Gagal membuat kategori" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...data } = await request.json();
    if (data.name) data.slug = generateSlug(data.name);
    const category = await prisma.category.update({
      where: { id, userId: session.id },
      data,
    });
    return NextResponse.json({ success: true, category });
  } catch {
    return NextResponse.json({ error: "Gagal update kategori" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await request.json();
    await prisma.category.delete({ where: { id, userId: session.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus kategori" }, { status: 500 });
  }
}
