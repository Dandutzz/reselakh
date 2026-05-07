import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState as getMultiFileAuthState,
  WASocket,
} from "baileys";
import { prisma } from "./prisma";
import path from "path";
import fs from "fs";

const activeSockets = new Map<string, WASocket>();
const pairingCodes = new Map<string, string>();

const SESSION_DIR = path.join(process.cwd(), ".wa-sessions");

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

export async function startWhatsAppBot(botId: string): Promise<string | null> {
  ensureSessionDir();

  const botConfig = await prisma.bot.findUnique({
    where: { id: botId },
    include: { user: true },
  });

  if (!botConfig || botConfig.type !== "whatsapp") {
    throw new Error("Invalid bot configuration");
  }

  if (activeSockets.has(botId)) {
    await stopWhatsAppBot(botId);
  }

  const sessionPath = path.join(SESSION_DIR, botId);
  const { state, saveCreds } = await getMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
          ?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        await startWhatsAppBot(botId);
      } else {
        await prisma.bot.update({
          where: { id: botId },
          data: { isConnected: false, status: "inactive" },
        });
        activeSockets.delete(botId);
      }
    }

    if (connection === "open") {
      await prisma.bot.update({
        where: { id: botId },
        data: { isConnected: true, status: "active" },
      });
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      const from = msg.key.remoteJid;
      if (!from || !text) continue;

      await handleWhatsAppMessage(botId, botConfig, sock, from, text);
    }
  });

  activeSockets.set(botId, sock);

  if (!sock.authState.creds.registered && botConfig.phoneNumber) {
    try {
      const code = await sock.requestPairingCode(
        botConfig.phoneNumber.replace(/[^0-9]/g, "")
      );
      pairingCodes.set(botId, code);
      return code;
    } catch (err) {
      console.error("Pairing code error:", err);
      return null;
    }
  }

  return null;
}

async function handleWhatsAppMessage(
  _botId: string,
  botConfig: {
    userId: string;
    isAutoOrder: boolean;
    welcomeMsg: string | null;
    name: string;
    contactPerson: string | null;
  },
  sock: WASocket,
  from: string,
  text: string
) {
  const cmd = text.trim().toLowerCase();

  if (cmd === "/start" || cmd === "halo" || cmd === "hi" || cmd === "hello") {
    const welcome =
      botConfig.welcomeMsg ||
      `Selamat datang di ${botConfig.name}! Ketik *menu* untuk melihat produk.`;
    await sock.sendMessage(from, { text: welcome });
    return;
  }

  if (cmd === "menu" || cmd === "/menu") {
    const categories = await prisma.category.findMany({
      where: { userId: botConfig.userId, isActive: true },
      include: {
        products: {
          where: { isActive: true },
          include: {
            variations: {
              include: {
                _count: { select: { stocks: { where: { isSold: false } } } },
              },
            },
          },
        },
      },
    });

    if (categories.length === 0) {
      await sock.sendMessage(from, { text: "Belum ada produk tersedia." });
      return;
    }

    let reply = "📦 *Daftar Produk*\n\n";
    for (const cat of categories) {
      reply += `📁 *${cat.name}*\n`;
      for (const prod of cat.products) {
        const totalStock = prod.variations.reduce(
          (sum, v) => sum + v._count.stocks,
          0
        );
        reply += `  ├ ${prod.name} - Rp ${prod.price.toLocaleString("id-ID")} (Stock: ${totalStock})\n`;
        for (const v of prod.variations) {
          reply += `  │  └ ${v.name} [${v.code}] - Rp ${v.price.toLocaleString("id-ID")} (${v._count.stocks})\n`;
        }
      }
      reply += "\n";
    }
    reply += "Untuk order ketik: *order [kode] [jumlah]*";
    await sock.sendMessage(from, { text: reply });
    return;
  }

  if (cmd.startsWith("order ") || cmd.startsWith("/order ")) {
    if (!botConfig.isAutoOrder) {
      await sock.sendMessage(from, {
        text: "Auto order tidak aktif. Hubungi admin.",
      });
      return;
    }

    const parts = text.trim().split(/\s+/).slice(1);
    if (parts.length < 1) {
      await sock.sendMessage(from, {
        text: "Format: *order [kode] [jumlah]*\nContoh: order NETFLIX1 1",
      });
      return;
    }

    const code = parts[0];
    const qty = parseInt(parts[1] || "1");

    const variation = await prisma.productVariation.findFirst({
      where: { code, product: { userId: botConfig.userId, isActive: true } },
      include: { product: true },
    });

    if (!variation) {
      await sock.sendMessage(from, { text: "Produk tidak ditemukan." });
      return;
    }

    const stocks = await prisma.stock.findMany({
      where: { variationId: variation.id, isSold: false },
      take: qty,
    });

    if (stocks.length < qty) {
      await sock.sendMessage(from, {
        text: `Stock tidak cukup. Tersedia: ${stocks.length}`,
      });
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
          source: "whatsapp",
        },
      }),
    ]);

    await sock.sendMessage(from, {
      text: `✅ *Order Berhasil!*\n\nProduk: ${variation.product.name}\nVariasi: ${variation.name}\nJumlah: ${qty}\nTotal: Rp ${totalPrice.toLocaleString("id-ID")}\n\n📋 *Data Akun:*\n${accountData}`,
    });
    return;
  }

  if (cmd === "help" || cmd === "/help") {
    await sock.sendMessage(from, {
      text:
        "📌 *Perintah Bot:*\n\n*menu* - Lihat produk\n*order [kode] [jumlah]* - Order produk\n*saldo* - Info saldo\n*help* - Bantuan\n\n" +
        (botConfig.contactPerson
          ? `📞 Contact: ${botConfig.contactPerson}`
          : ""),
    });
    return;
  }
}

export async function stopWhatsAppBot(botId: string) {
  const sock = activeSockets.get(botId);
  if (sock) {
    await sock.logout().catch(() => {});
    activeSockets.delete(botId);
  }
  await prisma.bot.update({
    where: { id: botId },
    data: { isConnected: false, status: "inactive" },
  });
}

export async function sendWhatsAppBroadcast(
  botId: string,
  message: string,
  targets: string[]
) {
  const sock = activeSockets.get(botId);
  if (!sock) throw new Error("Bot not connected");

  const results = [];
  for (const target of targets) {
    try {
      const jid = target.includes("@") ? target : `${target}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: message });
      results.push({ target, success: true });
    } catch (err) {
      results.push({ target, success: false, error: String(err) });
    }
  }
  return results;
}

export function getPairingCode(botId: string): string | null {
  return pairingCodes.get(botId) || null;
}

export function isWhatsAppConnected(botId: string): boolean {
  return activeSockets.has(botId);
}
