import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";
import {
  getPairingCode,
  isWhatsAppConnected,
  startWhatsAppBot,
  stopWhatsAppBot,
} from "@/lib/whatsapp";

const Schema = z.object({
  botId: idSchema,
  action: z.enum(["start", "stop", "status"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { botId, action } = await parseJson(request, Schema);

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.id, type: "whatsapp" },
      select: { id: true },
    });
    if (!bot) throw new ValidationError("Bot tidak ditemukan");

    if (action === "start") {
      const pairingCode = await startWhatsAppBot(botId);
      return NextResponse.json({
        success: true,
        pairingCode,
        message: pairingCode ? `Pairing code: ${pairingCode}` : "Bot connected",
      });
    }

    if (action === "stop") {
      await stopWhatsAppBot(botId);
      return NextResponse.json({ success: true, message: "Bot disconnected" });
    }

    return NextResponse.json({
      connected: isWhatsAppConnected(botId),
      pairingCode: getPairingCode(botId),
    });
  } catch (err) {
    return handleApiError("bot/whatsapp:POST", err);
  }
}
