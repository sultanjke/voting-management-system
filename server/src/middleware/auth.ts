import type { NextFunction, Request, Response } from "express";

import { getAdminSessionForRequest, getResidentSessionForRequest } from "@/src/services/session";

export async function requireResidentSession(request: Request, response: Response, next: NextFunction) {
  const session = await getResidentSessionForRequest(request);
  if (!session) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  request.residentSession = session;
  next();
}

export async function requireAdminSession(request: Request, response: Response, next: NextFunction) {
  const session = await getAdminSessionForRequest(request);
  if (!session) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  request.adminSession = session;
  next();
}
