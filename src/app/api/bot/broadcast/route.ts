import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegramBroadcast } from "@/lib/telegram";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { botId, message, targets } = await request.json();

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.id },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
