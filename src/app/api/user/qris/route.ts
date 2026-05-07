import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireAuth();
    const [servers, selection] = await Promise.all([
      prisma.qrisServer.findMany({ where: { isActive: true } }),
      prisma.userQrisSelection.findUnique({
        where: { userId: session.id },
        include: { qrisServer: true },
      }),
    ]);
    return NextResponse.json({ servers, selection });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { qrisId } = await request.json();

    await prisma.userQrisSelection.upsert({
      where: { userId: session.id },
      update: { qrisId },
      create: { userId: session.id, qrisId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal memilih QRIS" }, { status: 500 });
  }
}
