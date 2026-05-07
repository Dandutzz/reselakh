import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") || "";

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: session.id },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const variations = await prisma.productVariation.findMany({
      where: { productId },
      include: { _count: { select: { stocks: { where: { isSold: false } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ variations });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await request.json();

    const product = await prisma.product.findFirst({
      where: { id: data.productId, userId: session.id },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const variation = await prisma.productVariation.create({
      data: {
        productId: data.productId,
        name: data.name,
        code: data.code,
        price: data.price,
      },
    });
    return NextResponse.json({ success: true, variation });
  } catch {
    return NextResponse.json({ error: "Gagal membuat variasi" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAuth();
    const { id, ...data } = await request.json();
    const variation = await prisma.productVariation.update({ where: { id }, data });
    return NextResponse.json({ success: true, variation });
  } catch {
    return NextResponse.json({ error: "Gagal update variasi" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();
    const { id } = await request.json();
    await prisma.productVariation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus variasi" }, { status: 500 });
  }
}
