import { Bot as GrammyBot, GrammyError, HttpError } from "grammy";
import { prisma } from "./prisma";
import { escapeMarkdownV2 } from "./utils";
import { placeBotOrder } from "./order";

const activeBots = new Map<string, GrammyBot>();

function md(text: string | number | null | undefined): string {
  return escapeMarkdownV2(String(text ?? ""));
}

export async function startTelegramBot(botId: string) {
  const botConfig = await prisma.bot.findUnique({
    where: { id: botId },
    include: { user: true },
  });

  if (!botConfig || !botConfig.token || botConfig.type !== "telegram") {
    throw new Error("Invalid bot configuration");
  }

  if (activeBots.has(botId)) {
    await stopTelegramBot(botId);
  }

  const bot = new GrammyBot(botConfig.token);

  bot.command("start", async (ctx) => {
    const welcome =
      botConfig.welcomeMsg ||
      `Selamat datang di ${botConfig.name}! Ketik /menu untuk melihat produk.`;
    await ctx.reply(welcome);
  });

  bot.command("menu", async (ctx) => {
    const categories = await prisma.category.findMany({
      where: { userId: botConfig.userId, isActive: true },
      include: {
        products: {
          where: { isActive: true },
          include: {
            variations: {
              where: { isActive: true },
              include: {
                _count: { select: { stocks: { where: { isSold: false } } } },
              },
            },
          },
        },
      },
    });

    if (categories.length === 0) {
      await ctx.reply("Belum ada produk tersedia.");
      return;
    }

    let text = "📦 *Daftar Produk*\n\n";
    for (const cat of categories) {
      text += `📁 *${md(cat.name)}*\n`;
      for (const prod of cat.products) {
        const totalStock = prod.variations.reduce(
          (sum, v) => sum + v._count.stocks,
          0,
        );
        text += `  ├ ${md(prod.name)} \\- Rp ${md(
          prod.price.toLocaleString("id-ID"),
        )} \\(Stock: ${totalStock}\\)\n`;
        for (const v of prod.variations) {
          text += `  │  └ ${md(v.name)} \\[${md(v.code)}\\] \\- Rp ${md(
            v.price.toLocaleString("id-ID"),
          )} \\(${v._count.stocks}\\)\n`;
        }
      }
      text += "\n";
    }
    text += "Untuk order ketik: /order \\[kode\\] \\[jumlah\\]";
    await ctx.reply(text, { parse_mode: "MarkdownV2" });
  });

  bot.command("order", async (ctx) => {
    if (!botConfig.isAutoOrder) {
      await ctx.reply("Auto order tidak aktif. Hubungi admin.");
      return;
    }

    const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
    if (args.length < 1) {
      await ctx.reply(
        "Format: /order [kode_variasi] [jumlah]\nContoh: /order NETFLIX1 1",
      );
      return;
    }

    const code = args[0]!;
    const qty = parseInt(args[1] || "1");

    const result = await placeBotOrder({
      ownerUserId: botConfig.userId,
      code,
      qty,
      source: "telegram",
    });

    if (!result.ok) {
      await ctx.reply(result.error);
      return;
    }

    const text =
      `✅ *Order Berhasil\\!*\n\n` +
      `Produk: ${md(result.productName)}\n` +
      `Variasi: ${md(result.variationName)}\n` +
      `Jumlah: ${qty}\n` +
      `Total: Rp ${md(result.totalPrice.toLocaleString("id-ID"))}\n\n` +
      `📋 *Data Akun:*\n\`\`\`\n${result.accountData}\n\`\`\``;

    await ctx.reply(text, { parse_mode: "MarkdownV2" });
  });

  bot.command("saldo", async (ctx) => {
    await ctx.reply(
      "💰 Untuk isi saldo, silakan transfer ke rekening yang tersedia.\nKetik /topup [jumlah] setelah transfer.",
    );
  });

  bot.command("help", async (ctx) => {
    const contact = botConfig.contactPerson
      ? `\n\n📞 Contact: ${botConfig.contactPerson}`
      : "";
    await ctx.reply(
      "📌 Perintah Bot:\n\n" +
        "/start - Mulai\n" +
        "/menu - Lihat produk\n" +
        "/order [kode] [jumlah] - Order produk\n" +
        "/saldo - Info saldo\n" +
        "/help - Bantuan" +
        contact,
    );
  });

  bot.catch((err) => {
    if (err instanceof GrammyError) {
      console.error(`Bot ${botId} grammy error:`, err.description);
    } else if (err instanceof HttpError) {
      console.error(`Bot ${botId} network error:`, err.message);
    } else {
      console.error(`Bot ${botId} error:`, err);
    }
  });

  bot.start().catch((err) => {
    console.error(`Bot ${botId} start error:`, err);
  });
  activeBots.set(botId, bot);

  await prisma.bot.update({
    where: { id: botId },
    data: { isConnected: true, status: "active" },
  });

  return true;
}

export async function stopTelegramBot(botId: string) {
  const bot = activeBots.get(botId);
  if (bot) {
    await bot.stop().catch(() => {});
    activeBots.delete(botId);
  }
  await prisma.bot.update({
    where: { id: botId },
    data: { isConnected: false, status: "inactive" },
  });
}

export async function sendTelegramBroadcast(
  botId: string,
  message: string,
  targets: string[],
) {
  const bot = activeBots.get(botId);
  if (!bot) throw new Error("Bot belum aktif. Start bot terlebih dahulu.");

  const results = [];
  for (const target of targets) {
    try {
      // Use plain text (no parse_mode) so user-supplied formatting characters
      // don't break message delivery.
      await bot.api.sendMessage(target, message);
      results.push({ target, success: true });
    } catch (err) {
      results.push({ target, success: false, error: String(err) });
    }
  }
  return results;
}

export function isBotActive(botId: string): boolean {
  return activeBots.has(botId);
}
