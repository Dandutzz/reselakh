import { Bot as GrammyBot } from "grammy";
import { prisma } from "./prisma";

const activeBots = new Map<string, GrammyBot>();

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
    const welcome = botConfig.welcomeMsg || `Selamat datang di ${botConfig.name}! Ketik /menu untuk melihat produk.`;
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
              include: { _count: { select: { stocks: { where: { isSold: false } } } } },
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
      text += `📁 *${cat.name}*\n`;
      for (const prod of cat.products) {
        const totalStock = prod.variations.reduce(
          (sum, v) => sum + v._count.stocks,
          0
        );
        text += `  ├ ${prod.name} - Rp ${prod.price.toLocaleString("id-ID")} (Stock: ${totalStock})\n`;
        for (const v of prod.variations) {
          text += `  │  └ ${v.name} [${v.code}] - Rp ${v.price.toLocaleString("id-ID")} (${v._count.stocks})\n`;
        }
      }
      text += "\n";
    }
    text += "Untuk order ketik: /order [kode_variasi] [jumlah]";
    await ctx.reply(text, { parse_mode: "Markdown" });
  });

  bot.command("order", async (ctx) => {
    if (!botConfig.isAutoOrder) {
      await ctx.reply("Auto order tidak aktif. Hubungi admin.");
      return;
    }

    const args = ctx.message?.text?.split(" ").slice(1) || [];
    if (args.length < 1) {
      await ctx.reply("Format: /order [kode_variasi] [jumlah]\nContoh: /order NETFLIX1 1");
      return;
    }

    const code = args[0];
    const qty = parseInt(args[1] || "1");

    const variation = await prisma.productVariation.findFirst({
      where: { code, product: { userId: botConfig.userId, isActive: true } },
      include: { product: true },
    });

    if (!variation) {
      await ctx.reply("Produk tidak ditemukan.");
      return;
    }

    const stocks = await prisma.stock.findMany({
      where: { variationId: variation.id, isSold: false },
      take: qty,
    });

    if (stocks.length < qty) {
      await ctx.reply(`Stock tidak cukup. Tersedia: ${stocks.length}`);
      return;
    }

    const totalPrice = variation.price * qty;
    const accountData = stocks.map((s) => s.data).join("\n");

    await prisma.$transaction([
      ...stocks.map((s) =>
        prisma.stock.update({
          where: { id: s.id },
          data: { isSold: true, soldAt: new Date() },
        })
      ),
      prisma.order.create({
        data: {
          userId: botConfig.userId,
          productId: variation.product.id,
          variationId: variation.id,
          quantity: qty,
          totalPrice,
          status: "completed",
          accountData,
          source: "telegram",
        },
      }),
    ]);

    await ctx.reply(
      `✅ *Order Berhasil!*\n\nProduk: ${variation.product.name}\nVariasi: ${variation.name}\nJumlah: ${qty}\nTotal: Rp ${totalPrice.toLocaleString("id-ID")}\n\n📋 *Data Akun:*\n${accountData}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("saldo", async (ctx) => {
    await ctx.reply(
      "💰 Untuk isi saldo, silakan transfer ke rekening yang tersedia.\nKetik /topup [jumlah] setelah transfer.",
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📌 *Perintah Bot:*\n\n/start - Mulai\n/menu - Lihat produk\n/order [kode] [jumlah] - Order produk\n/saldo - Info saldo\n/help - Bantuan\n\n" +
        (botConfig.contactPerson
          ? `📞 Contact: ${botConfig.contactPerson}`
          : ""),
      { parse_mode: "Markdown" }
    );
  });

  bot.catch((err) => {
    console.error(`Bot ${botId} error:`, err);
  });

  bot.start();
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
    await bot.stop();
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
  targets: string[]
) {
  const bot = activeBots.get(botId);
  if (!bot) throw new Error("Bot not active");

  const results = [];
  for (const target of targets) {
    try {
      await bot.api.sendMessage(target, message, { parse_mode: "Markdown" });
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
