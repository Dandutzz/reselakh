import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const userPassword = await bcrypt.hash("user123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@reselakh.com" },
    update: {},
    create: {
      username: "admin",
      email: "admin@reselakh.com",
      password: adminPassword,
      role: "admin",
      balance: 0,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@reselakh.com" },
    update: {},
    create: {
      username: "demo",
      email: "user@reselakh.com",
      password: userPassword,
      role: "user",
      balance: 100000,
    },
  });

  console.log("Seeded admin:", admin.username);
  console.log("Seeded user:", user.username);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
