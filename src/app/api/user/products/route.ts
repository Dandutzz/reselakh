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

const configSchema = z
  .object({
    terms: z.string().max(2000).optional(),
    shortDescription: z.string().max(500).optional(),
    cashbackType: z.enum(["nominal", "percent"]).optional(),
    cashbackValue: z.number().finite().min(0).max(100_000_000).optional(),
    profit: z.number().finite().min(0).max(100_000_000).optional(),
    modeBulking: z.number().int().min(0).max(10_000).optional(),
    stockFormat: z.string().max(120).optional(),
    defaultAutoDelivery: z.boolean().optional(),
  })
  .strict()
  .optional()
  .nullable();

// Accepts either a normal http(s) URL (capped 500 chars) or a data: URL up to
// ~500KB so the drag-and-drop foto picker can store the image inline without a
// separate upload endpoint.
const imageSchema = z
  .string()
  .max(500_000)
  .refine(
    (s) => /^https?:\/\//i.test(s) || /^data:image\//i.test(s),
    "Foto harus berupa URL http(s) atau data:image",
  )
  .optional()
  .nullable();

const CreateSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(1).max(120),
  code: codeSchema,
  description: z.string().max(2000).optional().nullable(),
  price: moneySchema,
  image: imageSchema,
  banner: imageSchema,
  config: configSchema,
});

const UpdateSchema = z.object({
  id: idSchema,
  categoryId: idSchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  code: codeSchema.optional(),
  description: z.string().max(2000).optional().nullable(),
  price: moneySchema.optional(),
  image: imageSchema,
  banner: imageSchema,
  isActive: z.boolean().optional(),
  config: configSchema,
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

    const variationIds = products.flatMap((p) => p.variations.map((v) => v.id));
    const soldGroup =
      variationIds.length === 0
        ? []
        : await prisma.stock.groupBy({
            by: ["variationId"],
            where: { variationId: { in: variationIds }, isSold: true },
            _count: { id: true },
          });
    const soldByVariation = new Map(soldGroup.map((g) => [g.variationId, g._count.id]));

    const enriched = products.map((p) => {
      const variationsWithSold = p.variations.map((v) => ({
        ...v,
        soldCount: soldByVariation.get(v.id) ?? 0,
      }));
      const soldCount = variationsWithSold.reduce((sum, v) => sum + v.soldCount, 0);
      const stockCount = variationsWithSold.reduce((sum, v) => sum + v._count.stocks, 0);
      return { ...p, variations: variationsWithSold, soldCount, stockCount };
    });

    return NextResponse.json({ products: enriched });
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
          config: data.config ? JSON.stringify(data.config) : null,
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

    const { config: configIn, ...restNoConfig } = rest;
    const data: Record<string, unknown> = { ...restNoConfig };
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
    if (configIn !== undefined) {
      data.config = configIn ? JSON.stringify(configIn) : null;
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
