import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const configs = await prisma.backupConfig.findMany({
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ configs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();

    if (data.action === "toggle") {
      const config = await prisma.backupConfig.findUnique({ where: { id: data.id } });
      if (config) {
        await prisma.backupConfig.update({
          where: { id: data.id },
          data: { isEnabled: !config.isEnabled },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (data.action === "create") {
      const config = await prisma.backupConfig.create({
        data: {
          userId: data.userId,
          type: data.type,
          isEnabled: data.isEnabled || false,
          s3Bucket: data.s3Bucket,
          s3Region: data.s3Region,
          s3Key: data.s3Key,
          s3Secret: data.s3Secret,
          localPath: data.localPath,
          schedule: data.schedule,
        },
      });
      return NextResponse.json({ success: true, config });
    }

    if (data.action === "run_backup") {
      await prisma.backupConfig.update({
        where: { id: data.id },
        data: { lastBackup: new Date() },
      });
      return NextResponse.json({ success: true, message: "Backup started" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Backup operation failed" }, { status: 500 });
  }
}
