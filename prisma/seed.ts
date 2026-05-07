import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const adapter = new PrismaPg({ connectionString });
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
