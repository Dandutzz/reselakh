import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";
import { getKodeUnikRange, getServerFee } from "@/lib/payments/types";

const SelectSchema = z.object({ qrisId: idSchema });

interface PublicServer {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  fee: number;
  kodeUnik: { min: number; max: number } | null;
}

function toPublic(s: {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  merchantId: string | null;
  config: string | null;
}): PublicServer {
  return {
    id: s.id,
    name: s.name,
    provider: s.provider,
    isActive: s.isActive,
    fee: getServerFee(s),
    kodeUnik: getKodeUnikRange(s),
  };
}

export async function GET() {
  try {
    const session = await requireAuth();
    const [servers, selection] = await Promise.all([
      prisma.qrisServer.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          provider: true,
          isActive: true,
          apiKey: true,
          apiSecret: true,
          merchantId: true,
          config: true,
        },
      }),
      prisma.userQrisSelection.findUnique({
        where: { userId: session.id },
        include: {
          qrisServer: {
            select: {
              id: true,
              name: true,
              provider: true,
              isActive: true,
              apiKey: true,
              apiSecret: true,
              merchantId: true,
              config: true,
            },
          },
        },
      }),
    ]);
    const publicServers = servers.map(toPublic);
    const publicSelection = selection
      ? {
          ...selection,
          qrisServer: selection.qrisServer ? toPublic(selection.qrisServer) : null,
        }
      : null;
    return NextResponse.json({ servers: publicServers, selection: publicSelection });
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
