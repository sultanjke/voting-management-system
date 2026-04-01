import { z } from "zod";
import { Router } from "express";
import { ResidentStatus } from "@prisma/client";

import { requestResidentOtp, verifyResidentOtp } from "@/lib/otp";
import { RESIDENT_SESSION_COOKIE } from "@/lib/constants";
import { normalizeHouseCode, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  clearResidentSessionCookie,
  getResidentTrustedTokenFromRequest,
  getResidentSessionForRequest,
  issueResidentSession,
  issueResidentTrustedToken,
  revokeSession,
  resolveResidentTrustedToken,
  setResidentSessionCookie,
  setResidentTrustedCookie
} from "@/src/services/session";

const requestSchema = z.object({
  phone: z.string().min(4),
  houseCode: z.string().min(1)
});

const verifySchema = z.object({
  phone: z.string().min(4),
  houseCode: z.string().min(1),
  code: z.string().length(6)
});

export const residentAuthRouter = Router();

residentAuthRouter.get("/session", async (request, response) => {
  const session = await getResidentSessionForRequest(request);
  if (!session) {
    response.json({ authenticated: false });
    return;
  }

  response.json({
    authenticated: true,
    resident: {
      id: session.resident.id,
      houseCode: session.resident.house.code
    }
  });
});

residentAuthRouter.post("/auth/otp/request", async (request, response) => {
  const payload = requestSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid OTP request payload." });
    return;
  }

  const phoneNormalized = normalizePhone(payload.data.phone);
  const houseCode = normalizeHouseCode(payload.data.houseCode);
  const trustedToken = getResidentTrustedTokenFromRequest(request);
  const trusted = resolveResidentTrustedToken(trustedToken);

  if (
    trusted &&
    trusted.phoneNormalized === phoneNormalized &&
    trusted.houseCode === houseCode
  ) {
    const trustedResident = await prisma.resident.findFirst({
      where: {
        id: trusted.residentId,
        phoneNormalized,
        status: ResidentStatus.ACTIVE,
        house: {
          code: houseCode
        }
      }
    });

    if (trustedResident) {
      const sessionToken = await issueResidentSession(trustedResident.id);
      setResidentSessionCookie(response, sessionToken);

      const refreshedTrustedToken = issueResidentTrustedToken({
        residentId: trustedResident.id,
        phoneNormalized,
        houseCode
      });
      setResidentTrustedCookie(response, refreshedTrustedToken);

      response.json({
        message: "Session restored from trusted device.",
        sessionIssued: true
      });
      return;
    }
  }

  const result = await requestResidentOtp(payload.data.phone, payload.data.houseCode);
  if (!result.ok) {
    response.status(result.status).json({
      error: result.message,
      retryAfterSeconds: result.retryAfterSeconds
    });
    return;
  }

  response.json({
    message: "Verification code sent.",
    devCode: result.devCode,
    sessionIssued: false
  });
});

residentAuthRouter.post("/auth/otp/verify", async (request, response) => {
  const payload = verifySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid OTP verification payload." });
    return;
  }

  const result = await verifyResidentOtp(payload.data.phone, payload.data.houseCode, payload.data.code);
  if (!result.ok) {
    response.status(result.status).json({ error: result.message });
    return;
  }

  const token = await issueResidentSession(result.residentId);
  setResidentSessionCookie(response, token);

  const trustedToken = issueResidentTrustedToken({
    residentId: result.residentId,
    phoneNormalized: result.phoneNormalized,
    houseCode: result.houseCode
  });
  setResidentTrustedCookie(response, trustedToken);

  response.json({ success: true });
});

residentAuthRouter.post("/auth/logout", async (request, response) => {
  const token = request.cookies?.[RESIDENT_SESSION_COOKIE] as string | undefined;
  if (token) {
    await revokeSession(token);
  }

  clearResidentSessionCookie(response);
  response.json({ success: true });
});
