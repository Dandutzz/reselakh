import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueSlug } from "@/lib/utils";
import { idSchema, parseJson } from "@/lib/validate";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const UpdateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

const DeleteSchema = z.object({ id: idSchema });

export async function GET() {
  try {
    const session = await requireAuth();
    const categories = await prisma.category.findMany({
      where: { userId: session.id },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ categories });
  } catch (err) {
    return handleApiError("user/categories:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await parseJson(request, CreateSchema);

    const slug = await generateUniqueSlug(data.name, async (s) => {
      const existing = await prisma.category.findFirst({
        where: { userId: session.id, slug: s },
        select: { id: true },
      });
      return !existing;
    });

    const category = await prisma.category.create({
      data: {
        userId: session.id,
        name: data.name,
        slug,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ success: true, category });
  } catch (err) {
    return handleApiError("user/categories:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...rest } = await parseJson(request, UpdateSchema);

    const owned = await prisma.category.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    });
    if (!owned) throw new ValidationError("Kategori tidak ditemukan");

    const data: Record<string, unknown> = { ...rest };
    if (rest.name) {
      data.slug = await generateUniqueSlug(rest.name, async (s) => {
        const existing = await prisma.category.findFirst({
          where: { userId: session.id, slug: s, NOT: { id } },
          select: { id: true },
        });
        return !existing;
      });
    }

    const category = await prisma.category.update({ where: { id }, data });
    return NextResponse.json({ success: true, category });
  } catch (err) {
    return handleApiError("user/categories:PATCH", err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await parseJson(request, DeleteSchema);

    const owned = await prisma.category.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    });
    if (!owned) throw new ValidationError("Kategori tidak ditemukan");

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("user/categories:DELETE", err);
  }
}
