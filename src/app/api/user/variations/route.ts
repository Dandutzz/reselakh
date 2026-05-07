import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, moneySchema, parseJson } from "@/lib/validate";

const CreateSchema = z.object({
  productId: idSchema,
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  price: moneySchema,
});

const UpdateSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(50).optional(),
  price: moneySchema.optional(),
  isActive: z.boolean().optional(),
});

const DeleteSchema = z.object({ id: idSchema });

async function ensureVariationOwned(variationId: string, userId: string) {
  const variation = await prisma.productVariation.findFirst({
    where: { id: variationId, product: { userId } },
    select: { id: true },
  });
  if (!variation) throw new ValidationError("Variasi tidak ditemukan");
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") || "";

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: session.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    const variations = await prisma.productVariation.findMany({
      where: { productId },
      include: { _count: { select: { stocks: { where: { isSold: false } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ variations });
  } catch (err) {
    return handleApiError("user/variations:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await parseJson(request, CreateSchema);

    const product = await prisma.product.findFirst({
      where: { id: data.productId, userId: session.id },
      select: { id: true },
    });
    if (!product) throw new ValidationError("Produk tidak ditemukan");

    const variation = await prisma.productVariation.create({ data });
    return NextResponse.json({ success: true, variation });
  } catch (err) {
    return handleApiError("user/variations:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...data } = await parseJson(request, UpdateSchema);
    await ensureVariationOwned(id, session.id);
    const variation = await prisma.productVariation.update({ where: { id }, data });
    return NextResponse.json({ success: true, variation });
  } catch (err) {
    return handleApiError("user/variations:PATCH", err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await parseJson(request, DeleteSchema);
    await ensureVariationOwned(id, session.id);
    await prisma.productVariation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("user/variations:DELETE", err);
  }
}
