import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";
import { isBotActive, startTelegramBot, stopTelegramBot } from "@/lib/telegram";

const Schema = z.object({
  botId: idSchema,
  action: z.enum(["start", "stop", "status"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { botId, action } = await parseJson(request, Schema);

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.id, type: "telegram" },
      select: { id: true, token: true },
    });
    if (!bot) throw new ValidationError("Bot tidak ditemukan");

    if (action === "start") {
      if (!bot.token) throw new ValidationError("Token belum diatur");
      await startTelegramBot(botId);
      return NextResponse.json({ success: true, message: "Bot started" });
    }

    if (action === "stop") {
      await stopTelegramBot(botId);
      return NextResponse.json({ success: true, message: "Bot stopped" });
    }

    return NextResponse.json({ active: isBotActive(botId) });
  } catch (err) {
    return handleApiError("bot/telegram:POST", err);
  }
}
