import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, hashPassword, requireAdmin, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampInt, idSchema, moneySchema, parseJson } from "@/lib/validate";

const CreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, underscore"),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(["user", "admin"]).optional(),
  balance: z.number().min(0).max(1_000_000_000).optional(),
  phone: z.string().max(32).optional().nullable(),
});

const PatchBaseSchema = z.object({
  id: idSchema,
  action: z
    .enum([
      "add_balance",
      "subtract_balance",
      "set_balance",
      "ban",
      "unban",
      "update",
    ])
    .optional(),
  amount: moneySchema.optional(),
  description: z.string().max(500).optional(),
  username: z.string().trim().min(3).max(32).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["user", "admin"]).optional(),
  phone: z.string().max(32).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
    const limit = clampInt(searchParams.get("limit"), 20, 1, 100);

    const where: { OR?: object[]; status?: string } = {};
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          balance: true,
          status: true,
          phone: true,
          createdAt: true,
          _count: { select: { orders: true, bots: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError("admin/users:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const data = await parseJson(request, CreateSchema);

    const username = data.username.toLowerCase();
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true },
    });
    if (existing) throw new ValidationError("Username atau email sudah terdaftar");

    const hashed = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        role: data.role || "user",
        balance: data.balance || 0,
        phone: data.phone ?? null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        balance: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (err) {
    return handleApiError("admin/users:POST", err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await parseJson(request, PatchBaseSchema);
    const { id, action, ...data } = body;

    if (
      action === "add_balance" ||
      action === "subtract_balance" ||
      action === "set_balance"
    ) {
      if (data.amount === undefined) throw new ValidationError("Amount wajib");

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id } });
        if (!user) throw new ValidationError("User tidak ditemukan");

        let newBalance = user.balance;
        if (action === "add_balance") newBalance = user.balance + data.amount!;
        else if (action === "subtract_balance") newBalance = user.balance - data.amount!;
        else if (action === "set_balance") newBalance = data.amount!;

        if (newBalance < 0) throw new ValidationError("Saldo akhir tidak boleh negatif");

        await tx.user.update({ where: { id }, data: { balance: newBalance } });
        await tx.mutation.create({
          data: {
            userId: id,
            type: action === "subtract_balance" ? "debit" : "credit",
            amount: Math.abs(newBalance - user.balance),
            balBefore: user.balance,
            balAfter: newBalance,
            description: data.description || `Admin ${action.replace(/_/g, " ")}`,
            source: "admin",
          },
        });

        return newBalance;
      });

      return NextResponse.json({ success: true, balance: result });
    }

    if (action === "ban") {
      await prisma.user.update({ where: { id }, data: { status: "banned" } });
      return NextResponse.json({ success: true });
    }

    if (action === "unban") {
      await prisma.user.update({ where: { id }, data: { status: "active" } });
      return NextResponse.json({ success: true });
    }

    const updateData: Record<string, unknown> = {};
    if (data.username) updateData.username = data.username.toLowerCase();
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.password = await hashPassword(data.password);

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError("Tidak ada perubahan");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        balance: true,
        phone: true,
        status: true,
      },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    return handleApiError("admin/users:PATCH", err);
  }
}
