import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    const products = await prisma.product.findMany({
      where: { userId: session.id },
      include: {
        category: { select: { name: true } },
        variations: { include: { _count: { select: { stocks: { where: { isSold: false } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await request.json();
    const product = await prisma.product.create({
      data: {
        userId: session.id,
        categoryId: data.categoryId,
        name: data.name,
        slug: generateSlug(data.name),
        description: data.description,
        price: data.price,
        image: data.image,
        banner: data.banner,
      },
    });
    return NextResponse.json({ success: true, product });
  } catch {
    return NextResponse.json({ error: "Gagal membuat produk" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...data } = await request.json();
    if (data.name) data.slug = generateSlug(data.name);
    const product = await prisma.product.update({
      where: { id, userId: session.id },
      data,
    });
    return NextResponse.json({ success: true, product });
  } catch {
    return NextResponse.json({ error: "Gagal update produk" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await request.json();
    await prisma.product.delete({ where: { id, userId: session.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus produk" }, { status: 500 });
  }
}
