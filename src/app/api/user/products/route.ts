import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueSlug } from "@/lib/utils";
import { idSchema, moneySchema, parseJson } from "@/lib/validate";

const CreateSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  price: moneySchema,
  image: z.string().url().max(500).optional().nullable(),
  banner: z.string().url().max(500).optional().nullable(),
});

const UpdateSchema = z.object({
  id: idSchema,
  categoryId: idSchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  price: moneySchema.optional(),
  image: z.string().url().max(500).optional().nullable(),
  banner: z.string().url().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

const DeleteSchema = z.object({ id: idSchema });

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
  } catch (err) {
    return handleApiError("user/products:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await parseJson(request, CreateSchema);

    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: session.id },
      select: { id: true },
    });
    if (!category) throw new ValidationError("Kategori tidak ditemukan");

    const slug = await generateUniqueSlug(data.name, async (s) => {
      const existing = await prisma.product.findFirst({
        where: { userId: session.id, slug: s },
        select: { id: true },
      });
      return !existing;
    });

    const product = await prisma.product.create({
      data: {
        userId: session.id,
        categoryId: data.categoryId,
        name: data.name,
        slug,
        description: data.description ?? null,
        price: data.price,
        image: data.image ?? null,
        banner: data.banner ?? null,
      },
    });
    return NextResponse.json({ success: true, product });
  } catch (err) {
    return handleApiError("user/products:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...rest } = await parseJson(request, UpdateSchema);

    const owned = await prisma.product.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    });
    if (!owned) throw new ValidationError("Produk tidak ditemukan");

    if (rest.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: rest.categoryId, userId: session.id },
        select: { id: true },
      });
      if (!category) throw new ValidationError("Kategori tidak ditemukan");
    }

    const data: Record<string, unknown> = { ...rest };
    if (rest.name) {
      data.slug = await generateUniqueSlug(rest.name, async (s) => {
        const existing = await prisma.product.findFirst({
          where: { userId: session.id, slug: s, NOT: { id } },
          select: { id: true },
        });
        return !existing;
      });
    }

    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json({ success: true, product });
  } catch (err) {
    return handleApiError("user/products:PATCH", err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await parseJson(request, DeleteSchema);

    const owned = await prisma.product.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    });
    if (!owned) throw new ValidationError("Produk tidak ditemukan");

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("user/products:DELETE", err);
  }
}
