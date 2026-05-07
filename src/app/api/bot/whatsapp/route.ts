import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  startWhatsAppBot,
  stopWhatsAppBot,
  getPairingCode,
  isWhatsAppConnected,
} from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { botId, action } = await request.json();

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.id, type: "whatsapp" },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (action === "start") {
      const pairingCode = await startWhatsAppBot(botId);
      return NextResponse.json({
        success: true,
        pairingCode,
        message: pairingCode
          ? `Pairing code: ${pairingCode}`
          : "Bot connected",
      });
    }

    if (action === "stop") {
      await stopWhatsAppBot(botId);
      return NextResponse.json({ success: true, message: "Bot disconnected" });
    }

    if (action === "status") {
      return NextResponse.json({
        connected: isWhatsAppConnected(botId),
        pairingCode: getPairingCode(botId),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
