import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = process.env.NAT_DATABASE_URL;
if (!connectionString) throw new Error('NAT_DATABASE_URL is not defined');
const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma || new PrismaClient({adapter})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
