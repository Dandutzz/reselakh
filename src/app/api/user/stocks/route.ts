import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAccountData } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const variationId = searchParams.get("variationId") || "";
    const sold = searchParams.get("sold");

    const where: Record<string, unknown> = { variationId };
    if (sold === "true") where.isSold = true;
    if (sold === "false") where.isSold = false;

    const stocks = await prisma.stock.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ stocks });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const data = await request.json();

    if (data.bulk) {
      const accounts = parseAccountData(data.bulk);
      const stocks = await prisma.stock.createMany({
        data: accounts.map((acc) => ({
          variationId: data.variationId,
          data: `${acc.email}|${acc.password}|${acc.info}`,
        })),
      });
      return NextResponse.json({ success: true, count: stocks.count });
    }

    const stock = await prisma.stock.create({
      data: { variationId: data.variationId, data: data.data },
    });
    return NextResponse.json({ success: true, stock });
  } catch {
    return NextResponse.json({ error: "Gagal menambah stock" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();
    const { id, variationId, deleteAll } = await request.json();

    if (deleteAll && variationId) {
      await prisma.stock.deleteMany({ where: { variationId, isSold: false } });
    } else if (id) {
      await prisma.stock.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus stock" }, { status: 500 });
  }
}
