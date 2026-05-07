import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireAdmin, ValidationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idSchema, parseJson } from "@/lib/validate";

const ToggleSchema = z.object({
  action: z.literal("toggle"),
  id: idSchema,
});

const CreateSchema = z.object({
  action: z.literal("create"),
  userId: idSchema,
  type: z.enum(["s3", "local"]),
  isEnabled: z.boolean().optional(),
  s3Bucket: z.string().max(120).optional().nullable(),
  s3Region: z.string().max(40).optional().nullable(),
  s3Key: z.string().max(200).optional().nullable(),
  s3Secret: z.string().max(500).optional().nullable(),
  localPath: z.string().max(500).optional().nullable(),
  schedule: z.string().max(80).optional().nullable(),
});

const RunSchema = z.object({
  action: z.literal("run_backup"),
  id: idSchema,
});

const Schema = z.union([ToggleSchema, CreateSchema, RunSchema]);

export async function GET() {
  try {
    await requireAdmin();
    const configs = await prisma.backupConfig.findMany({
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ configs });
  } catch (err) {
    return handleApiError("admin/backup:GET", err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const data = await parseJson(request, Schema);

    if (data.action === "toggle") {
      const config = await prisma.backupConfig.findUnique({
        where: { id: data.id },
        select: { id: true, isEnabled: true },
      });
      if (!config) throw new ValidationError("Config tidak ditemukan");
      await prisma.backupConfig.update({
        where: { id: data.id },
        data: { isEnabled: !config.isEnabled },
      });
      return NextResponse.json({ success: true });
    }

    if (data.action === "create") {
      const config = await prisma.backupConfig.create({
        data: {
          userId: data.userId,
          type: data.type,
          isEnabled: data.isEnabled ?? false,
          s3Bucket: data.s3Bucket ?? null,
          s3Region: data.s3Region ?? null,
          s3Key: data.s3Key ?? null,
          s3Secret: data.s3Secret ?? null,
          localPath: data.localPath ?? null,
          schedule: data.schedule ?? null,
        },
      });
      return NextResponse.json({ success: true, config });
    }

    // run_backup is currently a stub. Real backup must zip the SQLite DB and
    // optionally upload to S3 — implement separately to avoid claiming a
    // backup ran when it did not.
    return NextResponse.json(
      {
        error:
          "Backup belum diimplementasikan. Lakukan backup manual atau implement worker terpisah.",
      },
      { status: 501 },
    );
  } catch (err) {
    return handleApiError("admin/backup:POST", err);
  }
}
