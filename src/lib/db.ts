import { PrismaClient } from "@prisma/client";

// One client per process; survives Next.js hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["warn"] }); // handled errors (e.g. unique conflicts) are not noise; api() logs the rest

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
