import { ActorType, type AdminUser, type Resident } from "@prisma/client";
import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DAYS,
  RESIDENT_SESSION_COOKIE,
  RESIDENT_SESSION_DAYS,
  RESIDENT_TRUSTED_COOKIE,
  RESIDENT_TRUSTED_DAYS
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

export type ResidentTrustedPayload = {
  residentId: string;
  phoneNormalized: string;
  houseCode: string;
  exp: number;
};

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}:${env.SESSION_SECRET}`).digest("hex");
}

function signTrustedPayload(encodedPayload: string): string {
  return createHash("sha256").update(`${encodedPayload}:${env.SESSION_SECRET}`).digest("hex");
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

function encodeTrustedPayload(payload: ResidentTrustedPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeTrustedPayload(encoded: string): ResidentTrustedPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ResidentTrustedPayload;
    if (!parsed?.residentId || !parsed?.phoneNormalized || !parsed?.houseCode || typeof parsed.exp !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

export function issueResidentTrustedToken(input: {
  residentId: string;
  phoneNormalized: string;
  houseCode: string;
}): string {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + RESIDENT_TRUSTED_DAYS * 24 * 60 * 60;
  const payload: ResidentTrustedPayload = {
    residentId: input.residentId,
    phoneNormalized: input.phoneNormalized,
    houseCode: input.houseCode,
    exp: expiresAtSeconds
  };
  const encodedPayload = encodeTrustedPayload(payload);
  const signature = signTrustedPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function resolveResidentTrustedToken(token: string | undefined): ResidentTrustedPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTrustedPayload(encodedPayload);
  if (expectedSignature !== signature) {
    return null;
  }

  const payload = decodeTrustedPayload(encodedPayload);
  if (!payload) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return null;
  }

  return payload;
}

export function setResidentTrustedCookie(response: Response, token: string): void {
  applyCookie(response, RESIDENT_TRUSTED_COOKIE, token, RESIDENT_TRUSTED_DAYS);
}

export function clearResidentTrustedCookie(response: Response): void {
  clearCookie(response, RESIDENT_TRUSTED_COOKIE);
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

export function getResidentTrustedTokenFromRequest(request: Request): string | undefined {
  return request.cookies?.[RESIDENT_TRUSTED_COOKIE] as string | undefined;
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({
    where: {
      tokenHash: hashToken(token)
    }
  });
}
