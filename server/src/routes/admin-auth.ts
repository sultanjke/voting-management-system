import { ActorType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";
import {
  clearAdminSessionCookie,
  getAdminSessionForRequest,
  issueAdminSession,
  revokeSession,
  setAdminSessionCookie
} from "@/src/services/session";

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export const adminAuthRouter = Router();

adminAuthRouter.get("/session", async (request, response) => {
  const session = await getAdminSessionForRequest(request);
  if (!session) {
    response.json({ authenticated: false });
    return;
  }

  response.json({
    authenticated: true,
    admin: {
      id: session.adminUser.id,
      login: session.adminUser.email
    }
  });
});

adminAuthRouter.post("/auth/login", async (request, response) => {
  const payload = loginSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid login payload." });
    return;
  }

  const normalizedLogin = payload.data.login.trim().toLowerCase();

  let admin = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: normalizedLogin,
        mode: "insensitive"
      }
    }
  });

  if (!admin && !normalizedLogin.includes("@")) {
    admin = await prisma.adminUser.findFirst({
      where: {
        email: {
          startsWith: `${normalizedLogin}@`,
          mode: "insensitive"
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  if (!admin) {
    await writeAuditLog({
      actorType: ActorType.ADMIN,
      action: "admin.login.failed",
      metadata: { login: normalizedLogin }
    });

    response.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const validPassword = await verifyPassword(payload.data.password, admin.passwordHash);
  if (!validPassword) {
    await writeAuditLog({
      actorType: ActorType.ADMIN,
      action: "admin.login.failed",
      adminUserId: admin.id
    });

    response.status(401).json({ error: "Invalid credentials." });
    return;
  }

  await writeAuditLog({
    actorType: ActorType.ADMIN,
    action: "admin.login.accepted",
    adminUserId: admin.id
  });

  const token = await issueAdminSession(admin.id);
  setAdminSessionCookie(response, token);
  response.json({ success: true });
});

adminAuthRouter.post("/auth/logout", async (request, response) => {
  const token = request.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
  if (token) {
    await revokeSession(token);
  }

  clearAdminSessionCookie(response);
  response.json({ success: true });
});
