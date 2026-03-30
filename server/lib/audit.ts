import { ActorType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorType: ActorType;
  action: string;
  residentId?: string;
  adminUserId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType,
        action: input.action,
        residentId: input.residentId,
        adminUserId: input.adminUserId,
        metadata: input.metadata
      }
    });
  } catch {
    // Swallow audit failures to avoid breaking user-facing workflows.
  }
}
