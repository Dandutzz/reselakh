import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireAuth();
    const bots = await prisma.bot.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ bots });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await request.json();
    const bot = await prisma.bot.create({
      data: {
        userId: session.id,
        type: data.type,
        name: data.name,
        token: data.token,
        phoneNumber: data.phoneNumber,
        isAutoOrder: data.isAutoOrder || false,
        isNotification: data.isNotification || false,
        contactPerson: data.contactPerson,
        welcomeMsg: data.welcomeMsg,
      },
    });
    return NextResponse.json({ success: true, bot });
  } catch {
    return NextResponse.json({ error: "Gagal membuat bot" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...data } = await request.json();
    const bot = await prisma.bot.update({
      where: { id, userId: session.id },
      data,
    });
    return NextResponse.json({ success: true, bot });
  } catch {
    return NextResponse.json({ error: "Gagal update bot" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await request.json();
    await prisma.bot.delete({ where: { id, userId: session.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus bot" }, { status: 500 });
  }
}
