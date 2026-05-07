import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";
import { sendTelegramBroadcast } from "@/lib/telegram";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp";

const Schema = z.object({
  botId: idSchema,
  message: z.string().trim().min(1).max(4000),
  targets: z.array(z.string().trim().min(1).max(80)).min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { botId, message, targets } = await parseJson(request, Schema);

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.id },
      select: { id: true, type: true },
    });
    if (!bot) throw new ValidationError("Bot tidak ditemukan");

    const broadcast = await prisma.broadcast.create({
      data: {
        botId,
        message,
        targets: JSON.stringify(targets),
        status: "pending",
      },
    });

    let results;
    if (bot.type === "telegram") {
      results = await sendTelegramBroadcast(botId, message, targets);
    } else {
      results = await sendWhatsAppBroadcast(botId, message, targets);
    }

    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "sent", sentAt: new Date() },
    });

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return handleApiError("bot/broadcast:POST", err);
  }
}
