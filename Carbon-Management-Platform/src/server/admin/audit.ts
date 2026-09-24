import "server-only";
import { Prisma } from "@/generated/prisma/client";

export type AuditInput = {
  actorId: string;
  schoolId?: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Prisma.InputJsonValue;
};

export async function audit(tx: Prisma.TransactionClient, input: AuditInput) {
  await tx.auditLog.create({ data: input });
}
