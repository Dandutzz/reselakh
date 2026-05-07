import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAuth, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";

const BaseFields = {
  type: z.enum(["telegram", "whatsapp"]),
  name: z.string().trim().min(1).max(80),
  token: z.string().trim().max(500).optional().nullable(),
  phoneNumber: z.string().trim().max(32).optional().nullable(),
  isAutoOrder: z.boolean().optional(),
  isNotification: z.boolean().optional(),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  welcomeMsg: z.string().max(2000).optional().nullable(),
};

const CreateSchema = z.object(BaseFields);

const UpdateSchema = z.object({
  id: idSchema,
  ...BaseFields,
  type: BaseFields.type.optional(),
  name: BaseFields.name.optional(),
  status: z.string().max(40).optional(),
});

const DeleteSchema = z.object({ id: idSchema });

export async function GET() {
  try {
    const session = await requireAuth();
    const bots = await prisma.bot.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ bots });
  } catch (err) {
    return handleApiError("user/bots:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const data = await parseJson(request, CreateSchema);
    const bot = await prisma.bot.create({
      data: {
        userId: session.id,
        type: data.type,
        name: data.name,
        token: data.token ?? null,
        phoneNumber: data.phoneNumber ?? null,
        isAutoOrder: data.isAutoOrder ?? false,
        isNotification: data.isNotification ?? false,
        contactPerson: data.contactPerson ?? null,
        welcomeMsg: data.welcomeMsg ?? null,
      },
    });
    return NextResponse.json({ success: true, bot });
  } catch (err) {
    return handleApiError("user/bots:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, ...data } = await parseJson(request, UpdateSchema);

    const owned = await prisma.bot.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    });
    if (!owned) throw new ValidationError("Bot tidak ditemukan");

    const bot = await prisma.bot.update({ where: { id }, data });
    return NextResponse.json({ success: true, bot });
  } catch (err) {
    return handleApiError("user/bots:PATCH", err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { id } = await parseJson(request, DeleteSchema);

    const owned = await prisma.bot.findFirst({
      where: { id, userId: session.id },
      select: { id: true },
    });
    if (!owned) throw new ValidationError("Bot tidak ditemukan");

    await prisma.bot.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError("user/bots:DELETE", err);
  }
}
