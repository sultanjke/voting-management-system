import { ActorType, type AdminUser, type Resident } from "@prisma/client";
import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DAYS,
  RESIDENT_SESSION_COOKIE,
  RESIDENT_SESSION_DAYS
} from "@/lib/constants";
import { env, isProduction } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type ResidentSession = {
  token: string;
  resident: Resident & { house: { id: string; code: string } };
};

export type AdminSession = {
  token: string;
  adminUser: AdminUser;
};

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}:${env.SESSION_SECRET}`).digest("hex");
}

function tokenExpiry(days: number): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

function createToken(): string {
  return randomBytes(32).toString("hex");
}

function applyCookie(response: Response, name: string, value: string, days: number): void {
  response.cookie(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: days * 24 * 60 * 60 * 1000
  });
}

function clearCookie(response: Response, name: string): void {
  response.clearCookie(name, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
  });
}

export async function issueResidentSession(residentId: string): Promise<string> {
  const token = createToken();
  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(token),
      actorType: ActorType.RESIDENT,
      residentId,
      expiresAt: tokenExpiry(RESIDENT_SESSION_DAYS)
    }
  });
  return token;
}

export async function issueAdminSession(adminUserId: string): Promise<string> {
  const token = createToken();
  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(token),
      actorType: ActorType.ADMIN,
      adminUserId,
      expiresAt: tokenExpiry(ADMIN_SESSION_DAYS)
    }
  });
  return token;
}

export function setResidentSessionCookie(response: Response, token: string): void {
  applyCookie(response, RESIDENT_SESSION_COOKIE, token, RESIDENT_SESSION_DAYS);
}

export function setAdminSessionCookie(response: Response, token: string): void {
  applyCookie(response, ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_DAYS);
}

export function clearResidentSessionCookie(response: Response): void {
  clearCookie(response, RESIDENT_SESSION_COOKIE);
}

export function clearAdminSessionCookie(response: Response): void {
  clearCookie(response, ADMIN_SESSION_COOKIE);
}

async function resolveResidentToken(token: string | undefined): Promise<ResidentSession | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      resident: {
        include: {
          house: {
            select: {
              id: true,
              code: true
            }
          }
        }
      }
    }
  });

  if (!session || session.actorType !== ActorType.RESIDENT || !session.resident || session.expiresAt < new Date()) {
    return null;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return {
    token,
    resident: session.resident
  };
}

async function resolveAdminToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      adminUser: true
    }
  });

  if (!session || session.actorType !== ActorType.ADMIN || !session.adminUser || session.expiresAt < new Date()) {
    return null;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return {
    token,
    adminUser: session.adminUser
  };
}

export async function getResidentSessionForRequest(request: Request): Promise<ResidentSession | null> {
  const token = request.cookies?.[RESIDENT_SESSION_COOKIE] as string | undefined;
  return resolveResidentToken(token);
}

export async function getAdminSessionForRequest(request: Request): Promise<AdminSession | null> {
  const token = request.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
  return resolveAdminToken(token);
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({
    where: {
      tokenHash: hashToken(token)
    }
  });
}
