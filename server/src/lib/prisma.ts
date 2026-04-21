import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Extend globalThis type safely
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create adapter
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

// Create or reuse Prisma instance
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

// Prevent multiple instances in dev (hot reload fix)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;