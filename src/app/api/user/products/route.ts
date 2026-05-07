import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueSlug } from "@/lib/utils";
import { idSchema, moneySchema, parseJson } from "@/lib/validate";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Kode produk wajib")
  .max(50, "Kode produk terlalu panjang")
  .regex(/^[A-Za-z0-9_-]+$/, "Kode produk hanya boleh huruf/angka/tanda - dan _");

const CreateSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(1).max(120),
  code: codeSchema,
  description: z.string().max(2000).optional().nullable(),
  price: moneySchema,
  image: z.string().url().max(500).optional().nullable(),
  banner: z.string().url().max(500).optional().nullable(),
});

const UpdateSchema = z.object({
  id: idSchema,
  categoryId: idSchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  code: codeSchema.optional(),
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

    try {
      const product = await prisma.product.create({
        data: {
          userId: session.id,
          categoryId: data.categoryId,
          name: data.name,
          slug,
          code: data.code.toUpperCase(),
          description: data.description ?? null,
          price: data.price,
          image: data.image ?? null,
          banner: data.banner ?? null,
        },
      });
      return NextResponse.json({ success: true, product });
    } catch (err) {
      if (isUniqueCodeError(err)) {
        throw new ValidationError(
          `Kode produk "${data.code}" sudah dipakai produk lain milikmu. Pilih kode lain.`,
        );
      }
      throw err;
    }
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
    if (rest.code) {
      data.code = rest.code.toUpperCase();
    }

    try {
      const product = await prisma.product.update({ where: { id }, data });
      return NextResponse.json({ success: true, product });
    } catch (err) {
      if (isUniqueCodeError(err)) {
        throw new ValidationError(
          `Kode produk "${rest.code}" sudah dipakai produk lain milikmu. Pilih kode lain.`,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleApiError("user/products:PATCH", err);
  }
}

function isUniqueCodeError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
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
