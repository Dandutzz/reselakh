import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET environment variable is required. Set it in .env to a long random string.",
  );
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day; rotate via re-login

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: number;
  status: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

export function generateToken(user: Pick<AuthUser, "id" | "username" | "email" | "role">): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET as string,
    { expiresIn: TOKEN_TTL_SECONDS },
  );
}

export function verifyToken(token: string): Pick<AuthUser, "id" | "username" | "email" | "role"> | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as Pick<
      AuthUser,
      "id" | "username" | "email" | "role"
    >;
  } catch {
    return null;
  }
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: TOKEN_TTL_SECONDS,
    path: "/",
  };
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      balance: true,
      status: true,
    },
  });
  if (!user || user.status === "banned") return null;
  return user;
}

export async function requireAuth(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireAdmin(): Promise<AuthUser> {
  const session = await requireAuth();
  if (session.role !== "admin") throw new ForbiddenError();
  return session;
}

/**
 * Convert thrown errors from route handlers into appropriate JSON responses.
 * Preserves Auth/Forbidden/Validation distinctions and logs unexpected errors.
 */
export function handleApiError(scope: string, err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(`[api:${scope}]`, err);
  return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
}

export function normalizeIdentifier(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("Format tidak valid");
  return value.trim().toLowerCase();
}
