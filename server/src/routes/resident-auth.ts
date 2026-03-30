import { z } from "zod";
import { Router } from "express";

import { requestResidentOtp, verifyResidentOtp } from "@/lib/otp";
import { RESIDENT_SESSION_COOKIE } from "@/lib/constants";
import {
  clearResidentSessionCookie,
  getResidentSessionForRequest,
  issueResidentSession,
  revokeSession,
  setResidentSessionCookie
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
    devCode: result.devCode
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
