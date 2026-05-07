import { Bot as GrammyBot, GrammyError, HttpError } from "grammy";
import { prisma } from "./prisma";
import { escapeMarkdownV2 } from "./utils";
import { placeBotOrder } from "./order";
import { createQris, generateOrderId } from "./payments";

const activeBots = new Map<string, GrammyBot>();

function md(text: string | number | null | undefined): string {
  return escapeMarkdownV2(String(text ?? ""));
}

/**
 * Find or create a Customer keyed by `(ownerUserId, chatId)` for Telegram.
 * Mirrors the WhatsApp flow but keys on the numeric Telegram chat id instead
 * of a JID.
 */
async function getOrCreateTelegramCustomer(
  ownerUserId: string,
  botId: string,
  chatId: string,
  name: string | null,
): Promise<{
  id: string;
  balance: number;
  status: string;
  name: string | null;
}> {
  const existing = await prisma.customer.findUnique({
    where: { ownerUserId_chatId: { ownerUserId, chatId } },
    select: { id: true, balance: true, status: true, name: true },
  });
  if (existing) return existing;
  try {
    const created = await prisma.customer.create({
      data: { ownerUserId, botId, chatId, name },
      select: { id: true, balance: true, status: true, name: true },
    });
    return created;
  } catch {
    const fallback = await prisma.customer.findUnique({
      where: { ownerUserId_chatId: { ownerUserId, chatId } },
      select: { id: true, balance: true, status: true, name: true },
    });
    if (!fallback) throw new Error("Customer create gagal");
    return fallback;
  }
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
      `Selamat datang di ${botConfig.name}!\n\n` +
        `/menu - Lihat produk\n` +
        `/saldo - Cek saldo\n` +
        `/buy KODE [QTY] - Beli pakai saldo\n` +
        `/buynow KODE [QTY] - Beli langsung pakai QRIS\n` +
        `/topup NOMINAL - Isi saldo via QRIS`;
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
    text +=
      "Order pakai saldo: /buy KODE \\[QTY\\]\n" +
      "Order pakai QRIS: /buynow KODE \\[QTY\\]\n" +
      "Cek saldo: /saldo";
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
        "Format: /order [kode_variasi] [jumlah] [voucher]\nContoh: /order NETFLIX1 1 PROMO10",
      );
      return;
    }

    const code = args[0]!;
    const qty = parseInt(args[1] || "1");
    const voucherCode = args[2] || undefined;

    const chatId = String(ctx.chat?.id ?? "");
    const customer = chatId
      ? await getOrCreateTelegramCustomer(
          botConfig.userId,
          botId,
          chatId,
          ctx.from?.first_name ?? null,
        )
      : null;

    const result = await placeBotOrder({
      ownerUserId: botConfig.userId,
      code,
      qty,
      source: "telegram",
      voucherCode,
      customerId: customer?.id,
    });

    if (!result.ok) {
      await ctx.reply(result.error);
      return;
    }

    const lines = [
      `✅ *Order Berhasil\\!*`,
      ``,
      `Produk: ${md(result.productName)}`,
      `Variasi: ${md(result.variationName)}`,
      `Jumlah: ${qty}`,
      `Subtotal: Rp ${md(result.subtotal.toLocaleString("id-ID"))}`,
    ];
    if (result.discount > 0) {
      lines.push(
        `Voucher \\(${md(result.voucherCode || "")}\\): \\-Rp ${md(result.discount.toLocaleString("id-ID"))}`,
      );
    }
    lines.push(
      `Total: Rp ${md(result.totalPrice.toLocaleString("id-ID"))}`,
      ``,
      `📋 *Data Akun:*\n\`\`\`\n${result.accountData}\n\`\`\``,
    );

    await ctx.reply(lines.join("\n"), { parse_mode: "MarkdownV2" });
  });

  bot.command("buy", async (ctx) => {
    if (!botConfig.isAutoOrder) {
      await ctx.reply("Auto order tidak aktif. Hubungi admin.");
      return;
    }
    const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
    if (args.length < 1) {
      await ctx.reply(
        "Format: /buy KODE [QTY] [VOUCHER]\nContoh: /buy NETFLIX1 1",
      );
      return;
    }
    const code = args[0]!;
    const qty = parseInt(args[1] || "1");
    const voucherCode = args[2] || undefined;
    const chatId = String(ctx.chat?.id ?? "");
    if (!chatId) {
      await ctx.reply("Chat tidak valid.");
      return;
    }
    const customer = await getOrCreateTelegramCustomer(
      botConfig.userId,
      botId,
      chatId,
      ctx.from?.first_name ?? null,
    );
    const result = await placeBotOrder({
      ownerUserId: botConfig.userId,
      code,
      qty,
      source: "telegram",
      voucherCode,
      customerId: customer.id,
      paymentMode: "balance",
    });
    if (!result.ok) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    const fresh = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { balance: true },
    });
    const lines = [
      `✅ Pembelian Berhasil (saldo)`,
      ``,
      `Produk: ${result.productName}`,
      `Variasi: ${result.variationName}`,
      `Jumlah: ${qty}`,
      `Subtotal: Rp ${result.subtotal.toLocaleString("id-ID")}`,
    ];
    if (result.discount > 0) {
      lines.push(
        `Voucher (${result.voucherCode || ""}): -Rp ${result.discount.toLocaleString("id-ID")}`,
      );
    }
    lines.push(
      `Total: Rp ${result.totalPrice.toLocaleString("id-ID")}`,
      `Sisa Saldo: Rp ${(fresh?.balance ?? 0).toLocaleString("id-ID")}`,
      ``,
      `📋 Data Akun:\n${result.accountData}`,
    );
    await ctx.reply(lines.join("\n"));
  });

  bot.command("buynow", async (ctx) => {
    if (!botConfig.isAutoOrder) {
      await ctx.reply("Auto order tidak aktif. Hubungi admin.");
      return;
    }
    if (!botConfig.qrisServerId) {
      await ctx.reply("QRIS belum diatur untuk bot ini. Hubungi admin.");
      return;
    }
    const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
    if (args.length < 1) {
      await ctx.reply("Format: /buynow KODE [QTY]");
      return;
    }
    const code = args[0]!;
    const qty = parseInt(args[1] || "1");
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100) {
      await ctx.reply("Jumlah tidak valid (1-100)");
      return;
    }
    const variation = await prisma.productVariation.findFirst({
      where: {
        code,
        isActive: true,
        product: { userId: botConfig.userId, isActive: true },
      },
      include: {
        product: { select: { name: true } },
        _count: { select: { stocks: { where: { isSold: false } } } },
      },
    });
    if (!variation) {
      await ctx.reply("Produk tidak ditemukan.");
      return;
    }
    if (variation._count.stocks < qty) {
      await ctx.reply(`Stock tidak cukup. Tersedia: ${variation._count.stocks}`);
      return;
    }
    const amount = variation.price * qty;
    const server = await prisma.qrisServer.findUnique({
      where: { id: botConfig.qrisServerId },
    });
    if (!server || !server.isActive) {
      await ctx.reply("QRIS tidak aktif.");
      return;
    }
    const chatId = String(ctx.chat?.id ?? "");
    const customer = chatId
      ? await getOrCreateTelegramCustomer(
          botConfig.userId,
          botId,
          chatId,
          ctx.from?.first_name ?? null,
        )
      : null;
    const orderId = generateOrderId("BN");
    const created = await createQris(server, { amount, orderId });
    if (!created.ok) {
      await ctx.reply(`❌ Gagal generate QRIS: ${created.error}`);
      return;
    }
    await prisma.payment.create({
      data: {
        ownerUserId: botConfig.userId,
        customerId: customer?.id,
        botId,
        qrisServerId: server.id,
        provider: server.provider,
        orderId,
        amount,
        fee: created.fee,
        totalAmount: created.totalAmount,
        status: "pending",
        qrString: created.qrString,
        paymentUrl: created.paymentUrl,
        productCode: code,
        qty,
        purpose: "buynow",
        expiresAt: created.expiresAt,
        rawResponse: JSON.stringify(created.raw ?? null),
      },
    });
    const lines = [
      `🧾 QRIS Pembayaran`,
      ``,
      `Produk: ${variation.product.name} - ${variation.name}`,
      `Jumlah: ${qty}`,
      `Total: Rp ${created.totalAmount.toLocaleString("id-ID")}`,
      `Order ID: ${orderId}`,
      ``,
    ];
    if (created.paymentUrl) lines.push(`Bayar di: ${created.paymentUrl}`);
    if (created.qrString) lines.push(`QR String:\n${created.qrString}`);
    if (created.expiresAt) {
      lines.push(``, `⏰ Expired: ${created.expiresAt.toLocaleString("id-ID")}`);
    }
    lines.push(``, `Setelah bayar, akun akan otomatis terkirim.`);
    await ctx.reply(lines.join("\n"));
  });

  bot.command("topup", async (ctx) => {
    if (!botConfig.qrisServerId) {
      await ctx.reply("QRIS belum diatur untuk bot ini. Hubungi admin.");
      return;
    }
    const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
    const amount = parseInt((args[0] || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(amount) || amount < 1000 || amount > 10_000_000) {
      await ctx.reply(
        "Format: /topup NOMINAL\nMinimal Rp 1.000, maksimal Rp 10.000.000",
      );
      return;
    }
    const server = await prisma.qrisServer.findUnique({
      where: { id: botConfig.qrisServerId },
    });
    if (!server || !server.isActive) {
      await ctx.reply("QRIS tidak aktif.");
      return;
    }
    const chatId = String(ctx.chat?.id ?? "");
    if (!chatId) {
      await ctx.reply("Chat tidak valid.");
      return;
    }
    const customer = await getOrCreateTelegramCustomer(
      botConfig.userId,
      botId,
      chatId,
      ctx.from?.first_name ?? null,
    );
    const orderId = generateOrderId("TP");
    const created = await createQris(server, { amount, orderId });
    if (!created.ok) {
      await ctx.reply(`❌ Gagal generate QRIS: ${created.error}`);
      return;
    }
    await prisma.payment.create({
      data: {
        ownerUserId: botConfig.userId,
        customerId: customer.id,
        botId,
        qrisServerId: server.id,
        provider: server.provider,
        orderId,
        amount,
        fee: created.fee,
        totalAmount: created.totalAmount,
        status: "pending",
        qrString: created.qrString,
        paymentUrl: created.paymentUrl,
        purpose: "topup",
        expiresAt: created.expiresAt,
        rawResponse: JSON.stringify(created.raw ?? null),
      },
    });
    const lines = [
      `🧾 QRIS Topup Saldo`,
      ``,
      `Nominal: Rp ${amount.toLocaleString("id-ID")}`,
      `Total: Rp ${created.totalAmount.toLocaleString("id-ID")}`,
      `Order ID: ${orderId}`,
      ``,
    ];
    if (created.paymentUrl) lines.push(`Bayar di: ${created.paymentUrl}`);
    if (created.qrString) lines.push(`QR String:\n${created.qrString}`);
    if (created.expiresAt) {
      lines.push(``, `⏰ Expired: ${created.expiresAt.toLocaleString("id-ID")}`);
    }
    lines.push(``, `Saldo akan otomatis bertambah setelah bayar.`);
    await ctx.reply(lines.join("\n"));
  });

  bot.command("saldo", async (ctx) => {
    const chatId = String(ctx.chat?.id ?? "");
    if (!chatId) {
      await ctx.reply("Chat tidak valid.");
      return;
    }
    const customer = await getOrCreateTelegramCustomer(
      botConfig.userId,
      botId,
      chatId,
      ctx.from?.first_name ?? null,
    );
    const fresh = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { balance: true },
    });
    await ctx.reply(
      `💰 Saldo Anda: Rp ${(fresh?.balance ?? 0).toLocaleString("id-ID")}\n\nIsi saldo: /topup NOMINAL`,
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
        "/buy KODE [QTY] - Beli pakai saldo\n" +
        "/buynow KODE [QTY] - Beli langsung pakai QRIS\n" +
        "/saldo - Cek saldo\n" +
        "/topup NOMINAL - Isi saldo via QRIS\n" +
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

/**
 * Push a plain-text message to a Telegram chat from a bot context. Used by
 * the payment webhook handler to notify the customer once their QRIS has
 * been settled. Returns false if the bot is not currently running.
 */
export async function notifyTelegramChat(
  botId: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  const bot = activeBots.get(botId);
  if (!bot) return false;
  try {
    await bot.api.sendMessage(chatId, text);
    return true;
  } catch (err) {
    console.error("[telegram] notifyTelegramChat failed:", err);
    return false;
  }
}

export function isBotActive(botId: string): boolean {
  return activeBots.has(botId);
}
