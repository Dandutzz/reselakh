import { NextResponse } from "next/server";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
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
          id: true, username: true, email: true, role: true,
          balance: true, status: true, phone: true, createdAt: true,
          _count: { select: { orders: true, bots: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { username, email, password, role, balance, phone } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, email, password: hashed, role: role || "user", balance: balance || 0, phone },
    });

    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ error: "Gagal membuat user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, action, ...data } = await request.json();

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    if (action === "add_balance" || action === "subtract_balance" || action === "set_balance") {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      let newBalance = user.balance;
      if (action === "add_balance") newBalance += data.amount;
      else if (action === "subtract_balance") newBalance -= data.amount;
      else if (action === "set_balance") newBalance = data.amount;

      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { balance: newBalance } }),
        prisma.mutation.create({
          data: {
            userId: id,
            type: action === "subtract_balance" ? "debit" : "credit",
            amount: data.amount,
            balBefore: user.balance,
            balAfter: newBalance,
            description: data.description || `Admin ${action.replace("_", " ")}`,
            source: "admin",
          },
        }),
      ]);

      return NextResponse.json({ success: true, balance: newBalance });
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
    if (data.username) updateData.username = data.username;
    if (data.email) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.password = await hashPassword(data.password);

    const updated = await prisma.user.update({ where: { id }, data: updateData });
    return NextResponse.json({ success: true, user: updated });
  } catch {
    return NextResponse.json({ error: "Gagal update user" }, { status: 500 });
  }
}
