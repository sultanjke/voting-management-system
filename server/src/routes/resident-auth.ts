import { z } from "zod";
import { Router } from "express";

import { RESIDENT_SESSION_COOKIE } from "@/lib/constants";
import {
  clearResidentSessionCookie,
  getResidentSessionForRequest,
  issueResidentSession,
  revokeSession,
  setResidentSessionCookie
} from "@/src/services/session";
import {
  beginResidentPasskeyLogin,
  beginResidentPasskeyRegistration,
  completeResidentPasskeyLogin,
  completeResidentPasskeyRegistration
} from "@/src/services/passkey";

const registerOptionsSchema = z.object({
  phone: z.string().min(4),
  houseCode: z.string().min(1)
});

const verifySchema = z.object({
  challengeId: z.string().min(1),
  response: z.unknown()
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

residentAuthRouter.post("/auth/passkey/register/options", async (request, response) => {
  const payload = registerOptionsSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid passkey registration payload." });
    return;
  }

  const result = await beginResidentPasskeyRegistration(payload.data.phone, payload.data.houseCode);
  if (!result.ok) {
    response.status(result.status).json({ error: result.message });
    return;
  }

  response.json(result.data);
});

residentAuthRouter.post("/auth/passkey/register/verify", async (request, response) => {
  const payload = verifySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid passkey registration verification payload." });
    return;
  }

  const result = await completeResidentPasskeyRegistration(payload.data.challengeId, payload.data.response);
  if (!result.ok) {
    response.status(result.status).json({ error: result.message });
    return;
  }

  const token = await issueResidentSession(result.data.residentId);
  setResidentSessionCookie(response, token);
  response.json({ success: true });
});

residentAuthRouter.post("/auth/passkey/login/options", async (_request, response) => {
  const result = await beginResidentPasskeyLogin();
  if (!result.ok) {
    response.status(result.status).json({ error: result.message });
    return;
  }

  response.json(result.data);
});

residentAuthRouter.post("/auth/passkey/login/verify", async (request, response) => {
  const payload = verifySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid passkey login verification payload." });
    return;
  }

  const result = await completeResidentPasskeyLogin(payload.data.challengeId, payload.data.response);
  if (!result.ok) {
    response.status(result.status).json({ error: result.message });
    return;
  }

  const token = await issueResidentSession(result.data.residentId);
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
