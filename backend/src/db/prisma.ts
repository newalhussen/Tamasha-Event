import { PrismaClient } from "@prisma/client";

/** The single Prisma client used by every service. */
export const db = new PrismaClient();
