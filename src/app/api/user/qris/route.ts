import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";

const SelectSchema = z.object({ qrisId: idSchema });

export async function GET() {
  try {
    const session = await requireAuth();
    const [servers, selection] = await Promise.all([
      prisma.qrisServer.findMany({
        where: { isActive: true },
        select: { id: true, name: true, isActive: true },
      }),
      prisma.userQrisSelection.findUnique({
        where: { userId: session.id },
        include: {
          qrisServer: { select: { id: true, name: true, isActive: true } },
        },
      }),
    ]);
    return NextResponse.json({ servers, selection });
  } catch (err) {
    return handleApiError("user/qris:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { qrisId } = await parseJson(request, SelectSchema);

    const server = await prisma.qrisServer.findFirst({
      where: { id: qrisId, isActive: true },
      select: { id: true },
    });
    if (!server) throw new ValidationError("QRIS server tidak tersedia");

    await prisma.userQrisSelection.upsert({
      where: { userId: session.id },
      update: { qrisId },
      create: { userId: session.id, qrisId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("user/qris:POST", err);
  }
}
