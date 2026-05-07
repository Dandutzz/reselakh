import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authCookieOptions,
  generateToken,
  handleApiError,
  ValidationError,
  verifyPassword,
} from "@/lib/auth";
import { parseJson } from "@/lib/validate";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

const LoginSchema = z.object({
  login: z.string().min(1, "Login wajib").max(254),
  password: z.string().min(1, "Password wajib").max(128),
});

export async function POST(request: Request) {
  try {
    const ipKey = getClientKey(request);
    if (!checkRateLimit(`login:${ipKey}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const { login, password } = await parseJson(request, LoginSchema);
    const normalized = login.trim().toLowerCase();

    if (!checkRateLimit(`login-account:${normalized}`, 8, 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new ValidationError("Username atau password salah");
    }

    if (user.status === "banned") {
      throw new ValidationError("Akun Anda dibanned");
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
    response.cookies.set("auth-token", token, authCookieOptions());
    return response;
  } catch (err) {
    return handleApiError("auth/login", err);
  }
}
