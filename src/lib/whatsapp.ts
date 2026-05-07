import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState as getMultiFileAuthState,
  WASocket,
} from "baileys";
import { prisma } from "./prisma";
import path from "path";
import fs from "fs";
import { placeBotOrder } from "./order";

const activeSockets = new Map<string, WASocket>();
const pairingCodes = new Map<string, string>();
const reconnectAttempts = new Map<string, number>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();

const SESSION_DIR = path.join(process.cwd(), ".wa-sessions");
const MAX_RECONNECT_ATTEMPTS = 8;

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function clearReconnect(botId: string) {
  const t = reconnectTimers.get(botId);
  if (t) {
    clearTimeout(t);
    reconnectTimers.delete(botId);
  }
}

function scheduleReconnect(botId: string) {
  const attempts = (reconnectAttempts.get(botId) || 0) + 1;
  reconnectAttempts.set(botId, attempts);
  if (attempts > MAX_RECONNECT_ATTEMPTS) {
    console.warn(
      `[whatsapp] giving up reconnect for ${botId} after ${attempts} attempts`,
    );
    return;
  }
  // Exponential backoff capped at 5 minutes.
  const delay = Math.min(5 * 60_000, 1000 * 2 ** attempts);
  clearReconnect(botId);
  reconnectTimers.set(
    botId,
    setTimeout(() => {
      startWhatsAppBot(botId).catch((err) => {
        console.error(`[whatsapp] reconnect failed for ${botId}:`, err);
        scheduleReconnect(botId);
      });
    }, delay),
  );
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
      activeSockets.delete(botId);
      const statusCode = (
        lastDisconnect?.error as { output?: { statusCode?: number } }
      )?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      await prisma.bot.update({
        where: { id: botId },
        data: { isConnected: false, status: shouldReconnect ? "reconnecting" : "inactive" },
      }).catch(() => {});

      if (shouldReconnect) {
        scheduleReconnect(botId);
      } else {
        reconnectAttempts.delete(botId);
        clearReconnect(botId);
      }
    }

    if (connection === "open") {
      reconnectAttempts.delete(botId);
      clearReconnect(botId);
      await prisma.bot
        .update({
          where: { id: botId },
          data: { isConnected: true, status: "active" },
        })
        .catch(() => {});
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

      try {
        await handleWhatsAppMessage(botId, botConfig, sock, from, text);
      } catch (err) {
        console.error(`[whatsapp] handler error:`, err);
      }
    }
  });

  activeSockets.set(botId, sock);

  if (!sock.authState.creds.registered && botConfig.phoneNumber) {
    try {
      const code = await sock.requestPairingCode(
        botConfig.phoneNumber.replace(/[^0-9]/g, ""),
      );
      pairingCodes.set(botId, code);
      return code;
    } catch (err) {
      console.error("[whatsapp] pairing code error:", err);
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
  text: string,
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
      await sock.sendMessage(from, { text: "Belum ada produk tersedia." });
      return;
    }

    let reply = "📦 *Daftar Produk*\n\n";
    for (const cat of categories) {
      reply += `📁 *${cat.name}*\n`;
      for (const prod of cat.products) {
        const totalStock = prod.variations.reduce(
          (sum, v) => sum + v._count.stocks,
          0,
        );
        reply += `  ├ ${prod.name} - Rp ${prod.price.toLocaleString(
          "id-ID",
        )} (Stock: ${totalStock})\n`;
        for (const v of prod.variations) {
          reply += `  │  └ ${v.name} [${v.code}] - Rp ${v.price.toLocaleString(
            "id-ID",
          )} (${v._count.stocks})\n`;
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
        text: "Format: *order [kode] [jumlah] [voucher]*\nContoh: order NETFLIX1 1 PROMO10",
      });
      return;
    }

    const code = parts[0]!;
    const qty = parseInt(parts[1] || "1");
    const voucherCode = parts[2] || undefined;

    const result = await placeBotOrder({
      ownerUserId: botConfig.userId,
      code,
      qty,
      source: "whatsapp",
      voucherCode,
    });

    if (!result.ok) {
      await sock.sendMessage(from, { text: result.error });
      return;
    }

    const lines = [
      `✅ *Order Berhasil!*`,
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
      ``,
      `📋 *Data Akun:*\n${result.accountData}`,
    );

    await sock.sendMessage(from, { text: lines.join("\n") });
    return;
  }

  if (cmd === "help" || cmd === "/help") {
    const contact = botConfig.contactPerson
      ? `\n\n📞 Contact: ${botConfig.contactPerson}`
      : "";
    await sock.sendMessage(from, {
      text:
        "📌 *Perintah Bot:*\n\n" +
        "*menu* - Lihat produk\n" +
        "*order [kode] [jumlah] [voucher]* - Order produk\n" +
        "*saldo* - Info saldo\n" +
        "*help* - Bantuan" +
        contact,
    });
    return;
  }
}

export async function stopWhatsAppBot(botId: string) {
  clearReconnect(botId);
  reconnectAttempts.delete(botId);
  const sock = activeSockets.get(botId);
  if (sock) {
    await sock.logout().catch(() => {});
    activeSockets.delete(botId);
  }
  pairingCodes.delete(botId);
  await prisma.bot
    .update({
      where: { id: botId },
      data: { isConnected: false, status: "inactive" },
    })
    .catch(() => {});
}

export async function sendWhatsAppBroadcast(
  botId: string,
  message: string,
  targets: string[],
) {
  const sock = activeSockets.get(botId);
  if (!sock) throw new Error("Bot belum terhubung");

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
