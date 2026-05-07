import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAccountData } from "@/lib/utils";
import { idSchema, parseJson } from "@/lib/validate";

const PostSchema = z.union([
  z.object({
    variationId: idSchema,
    bulk: z.string().min(1).max(200_000),
    replaceAll: z.boolean().optional(),
  }),
  z.object({
    variationId: idSchema,
    data: z.string().min(1).max(10_000),
  }),
]);

const DeleteSchema = z.union([
  z.object({ id: idSchema }),
  z.object({ deleteAll: z.literal(true), variationId: idSchema }),
]);

async function ensureVariationOwned(variationId: string, userId: string) {
  const variation = await prisma.productVariation.findFirst({
    where: { id: variationId, product: { userId } },
    select: { id: true },
  });
  if (!variation) throw new ValidationError("Variasi tidak ditemukan");
}

async function ensureStockOwned(stockId: string, userId: string) {
  const stock = await prisma.stock.findFirst({
    where: { id: stockId, variation: { product: { userId } } },
    select: { id: true },
  });
  if (!stock) throw new ValidationError("Stock tidak ditemukan");
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const variationId = searchParams.get("variationId") || "";
    const sold = searchParams.get("sold");

    await ensureVariationOwned(variationId, session.id);

    const where: { variationId: string; isSold?: boolean } = { variationId };
    if (sold === "true") where.isSold = true;
    if (sold === "false") where.isSold = false;

    const stocks = await prisma.stock.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ stocks });
  } catch (err) {
    return handleApiError("user/stocks:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await parseJson(request, PostSchema);
    await ensureVariationOwned(body.variationId, session.id);

    if ("bulk" in body) {
      const accounts = parseAccountData(body.bulk);
      if (accounts.length === 0) {
        throw new ValidationError("Data bulk kosong atau tidak valid");
      }
      const inserts = accounts.map((acc) => ({
        variationId: body.variationId,
        data: `${acc.email}|${acc.password}|${acc.info}`,
      }));
      if (body.replaceAll) {
        const result = await prisma.$transaction(async (tx) => {
          await tx.stock.deleteMany({
            where: { variationId: body.variationId, isSold: false },
          });
          return tx.stock.createMany({ data: inserts });
        });
        return NextResponse.json({ success: true, count: result.count, replaced: true });
      }
      const stocks = await prisma.stock.createMany({ data: inserts });
      return NextResponse.json({ success: true, count: stocks.count });
    }

    const stock = await prisma.stock.create({
      data: { variationId: body.variationId, data: body.data },
    });
    return NextResponse.json({ success: true, stock });
  } catch (err) {
    return handleApiError("user/stocks:POST", err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const body = await parseJson(request, DeleteSchema);

    if ("deleteAll" in body) {
      await ensureVariationOwned(body.variationId, session.id);
      await prisma.stock.deleteMany({
        where: { variationId: body.variationId, isSold: false },
      });
    } else {
      await ensureStockOwned(body.id, session.id);
      await prisma.stock.delete({ where: { id: body.id } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("user/stocks:DELETE", err);
  }
}
