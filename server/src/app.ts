import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";

import { adminAuthRouter } from "@/src/routes/admin-auth";
import { adminManagementRouter } from "@/src/routes/admin-management";
import { residentAuthRouter } from "@/src/routes/resident-auth";
import { residentSurveysRouter } from "@/src/routes/resident-surveys";

export function createApp() {
  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

  app.use(
    cors({
      origin: clientOrigin,
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/resident", residentAuthRouter);
  app.use("/api/resident", residentSurveysRouter);
  app.use("/api/admin", adminAuthRouter);
  app.use("/api/admin", adminManagementRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: "Internal server error." });
  });

  return app;
}
