import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startTelegramBot, stopTelegramBot, isBotActive } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { botId, action } = await request.json();

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.id, type: "telegram" },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (action === "start") {
      if (!bot.token) {
        return NextResponse.json({ error: "Token belum diatur" }, { status: 400 });
      }
      await startTelegramBot(botId);
      return NextResponse.json({ success: true, message: "Bot started" });
    }

    if (action === "stop") {
      await stopTelegramBot(botId);
      return NextResponse.json({ success: true, message: "Bot stopped" });
    }

    if (action === "status") {
      return NextResponse.json({ active: isBotActive(botId) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
