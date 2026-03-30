import type { AdminSession, ResidentSession } from "@/src/services/session";

declare global {
  namespace Express {
    interface Request {
      residentSession?: ResidentSession;
      adminSession?: AdminSession;
    }
  }
}

export {};
