import { createHash, randomInt } from "node:crypto";

import { ActorType, ResidentStatus } from "@prisma/client";
import twilio from "twilio";

import { writeAuditLog } from "@/lib/audit";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES } from "@/lib/constants";
import { env, isProduction } from "@/lib/env";
import { isOtpExpired, remainingCooldownSeconds } from "@/lib/otp-policy";
import { normalizeHouseCode, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

type OtpRequestResult =
  | { ok: true; residentId: string; houseId: string; phoneNormalized: string; devCode?: string }
  | { ok: false; status: number; message: string; retryAfterSeconds?: number };

type OtpVerifyResult =
  | { ok: true; residentId: string; houseId: string; phoneNormalized: string; houseCode: string }
  | { ok: false; status: number; message: string };

type OtpProvider = "twilio" | "vonage" | "twilio_whatsapp";

function hashCode(code: string): string {
  return createHash("sha256").update(`${code}:${env.SESSION_SECRET}`).digest("hex");
}

function createCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function buildMessageBody(code: string): string {
  return `Код подтверждения: ${code}. Этот код истекает через ${OTP_TTL_MINUTES} минут.`;
}

function asWhatsAppAddress(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials are not configured.");
  }

  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

async function sendViaTwilio(phone: string, code: string): Promise<void> {
  const client = getTwilioClient();
  const messageBody = buildMessageBody(code);

  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    await client.messages.create({
      to: phone,
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
      body: messageBody
    });
    return;
  }

  if (!env.TWILIO_FROM_NUMBER) {
    throw new Error("TWILIO_FROM_NUMBER is required when messaging service SID is not set.");
  }

  await client.messages.create({
    to: phone,
    from: env.TWILIO_FROM_NUMBER,
    body: messageBody
  });
}

async function sendViaTwilioWhatsApp(phone: string, code: string): Promise<void> {
  const client = getTwilioClient();
  const fromRaw = env.TWILIO_WHATSAPP_FROM_NUMBER ?? env.TWILIO_FROM_NUMBER;

  if (!fromRaw) {
    throw new Error("TWILIO_WHATSAPP_FROM_NUMBER is required for Twilio WhatsApp OTP delivery.");
  }

  await client.messages.create({
    to: asWhatsAppAddress(phone),
    from: asWhatsAppAddress(fromRaw),
    body: buildMessageBody(code)
  });
}

type VonageSmsResponse = {
  messages?: Array<{
    status?: string;
    "error-text"?: string;
  }>;
};

async function sendViaVonage(phone: string, code: string): Promise<void> {
  if (!env.VONAGE_API_KEY || !env.VONAGE_API_SECRET) {
    throw new Error("Vonage credentials are not configured.");
  }
  if (!env.VONAGE_FROM_NUMBER) {
    throw new Error("VONAGE_FROM_NUMBER is required for Vonage SMS.");
  }

  const response = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      api_key: env.VONAGE_API_KEY,
      api_secret: env.VONAGE_API_SECRET,
      to: phone,
      from: env.VONAGE_FROM_NUMBER,
      text: buildMessageBody(code)
    })
  });

  if (!response.ok) {
    throw new Error(`Vonage request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as VonageSmsResponse;
  const failed = payload.messages?.find((message) => message.status !== "0");
  if (failed) {
    throw new Error(failed["error-text"] ?? `Vonage delivery failed with status ${failed.status ?? "unknown"}.`);
  }
}

function isProviderConfigured(provider: OtpProvider): boolean {
  if (provider === "twilio_whatsapp") {
    return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_WHATSAPP_FROM_NUMBER ?? env.TWILIO_FROM_NUMBER));
  }

  if (provider === "twilio") {
    const hasBase = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
    const hasSender = Boolean(env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER);
    return hasBase && hasSender;
  }

  return Boolean(env.VONAGE_API_KEY && env.VONAGE_API_SECRET && env.VONAGE_FROM_NUMBER);
}

async function sendWithProvider(provider: OtpProvider, phone: string, code: string): Promise<void> {
  if (provider === "twilio_whatsapp") {
    await sendViaTwilioWhatsApp(phone, code);
    return;
  }

  if (provider === "vonage") {
    await sendViaVonage(phone, code);
    return;
  }

  await sendViaTwilio(phone, code);
}

async function sendOtpCode(phone: string, code: string): Promise<OtpProvider> {
  const primary = env.OTP_SMS_PROVIDER as OtpProvider;
  const candidates: OtpProvider[] = [primary, "twilio_whatsapp", "twilio", "vonage"].filter(
    (value, index, array): value is OtpProvider => array.indexOf(value as OtpProvider) === index
  );

  const failures: string[] = [];
  for (const provider of candidates) {
    if (!isProviderConfigured(provider)) {
      continue;
    }

    try {
      await sendWithProvider(provider, phone, code);
      return provider;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${provider}: ${message}`);
    }
  }

  const detail = failures.length ? failures.join(" | ") : "No OTP providers are configured.";
  throw new Error(detail);
}

export async function requestResidentOtp(phoneInput: string, houseCodeInput: string): Promise<OtpRequestResult> {
  const phoneNormalized = normalizePhone(phoneInput);
  const houseCode = normalizeHouseCode(houseCodeInput);

  if (!phoneNormalized || !houseCode) {
    return { ok: false, status: 400, message: "Phone and house code are required." };
  }

  const resident = await prisma.resident.findFirst({
    where: {
      phoneNormalized,
      status: ResidentStatus.ACTIVE,
      house: {
        code: houseCode
      }
    },
    include: {
      house: true
    }
  });

  if (!resident) {
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.otp.request.denied",
      metadata: { phoneNormalized, houseCode }
    });

    return { ok: false, status: 404, message: "No active resident record matches this phone and house." };
  }

  const latestChallenge = await prisma.otpChallenge.findFirst({
    where: {
      phoneNormalized,
      houseId: resident.houseId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (latestChallenge) {
    const remaining = remainingCooldownSeconds(latestChallenge.createdAt, OTP_RESEND_COOLDOWN_SECONDS);
    if (remaining > 0) {
      return {
        ok: false,
        status: 429,
        message: "Please wait before requesting another code.",
        retryAfterSeconds: remaining
      };
    }
  }

  const code = createCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  try {
    let provider: OtpProvider | "dev-fallback" = "dev-fallback";
    if (isProduction) {
      provider = await sendOtpCode(phoneNormalized, code);
    }

    await prisma.otpChallenge.create({
      data: {
        phoneNormalized,
        houseId: resident.houseId,
        codeHash: hashCode(code),
        provider,
        expiresAt
      }
    });

    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.otp.request.accepted",
      residentId: resident.id,
      metadata: { houseId: resident.houseId }
    });

    return {
      ok: true,
      residentId: resident.id,
      houseId: resident.houseId,
      phoneNormalized,
      devCode: isProduction ? undefined : code
    };
  } catch (error) {
    console.error("OTP delivery failed:", error);
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.otp.request.failed",
      residentId: resident.id,
      metadata: { houseId: resident.houseId }
    });

    return { ok: false, status: 500, message: "Failed to send verification code." };
  }
}

export async function verifyResidentOtp(phoneInput: string, houseCodeInput: string, code: string): Promise<OtpVerifyResult> {
  const phoneNormalized = normalizePhone(phoneInput);
  const houseCode = normalizeHouseCode(houseCodeInput);

  if (!phoneNormalized || !houseCode || code.trim().length !== 6) {
    return { ok: false, status: 400, message: "Invalid OTP payload." };
  }

  const resident = await prisma.resident.findFirst({
    where: {
      phoneNormalized,
      status: ResidentStatus.ACTIVE,
      house: {
        code: houseCode
      }
    }
  });

  if (!resident) {
    return { ok: false, status: 404, message: "No active resident record matches this phone and house." };
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phoneNormalized,
      houseId: resident.houseId,
      verifiedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!challenge) {
    return { ok: false, status: 400, message: "No active OTP challenge found." };
  }

  if (isOtpExpired(challenge.expiresAt)) {
    return { ok: false, status: 400, message: "Verification code expired." };
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: "Too many incorrect attempts." };
  }

  if (challenge.codeHash !== hashCode(code.trim())) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } }
    });

    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.otp.verify.failed",
      residentId: resident.id,
      metadata: { houseId: resident.houseId }
    });

    return { ok: false, status: 400, message: "Incorrect verification code." };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: {
      verifiedAt: new Date(),
      attempts: { increment: 1 }
    }
  });

  await writeAuditLog({
    actorType: ActorType.RESIDENT,
    action: "resident.otp.verify.accepted",
    residentId: resident.id,
    metadata: { houseId: resident.houseId }
  });

  return {
    ok: true,
    residentId: resident.id,
    houseId: resident.houseId,
    phoneNormalized,
    houseCode
  };
}
