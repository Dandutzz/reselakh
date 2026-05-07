import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authCookieOptions,
  generateToken,
  handleApiError,
  hashPassword,
  ValidationError,
} from "@/lib/auth";
import { parseJson } from "@/lib/validate";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(32, "Username maksimal 32 karakter")
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, underscore"),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(254),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(128, "Password maksimal 128 karakter"),
});

export async function POST(request: Request) {
  try {
    if (!checkRateLimit(`register:${getClientKey(request)}`, 5, 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const { username, email, password } = await parseJson(request, RegisterSchema);
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    });

    if (existing) {
      throw new ValidationError("Username atau email sudah terdaftar");
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username: normalizedUsername, email: normalizedEmail, password: hashed },
    });

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
    return handleApiError("auth/register", err);
  }
}
