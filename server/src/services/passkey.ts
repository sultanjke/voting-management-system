import { ActorType, PasskeyChallengeFlow, ResidentStatus } from "@prisma/client";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { createPasskeyChallengeExpiry } from "@/lib/passkey-policy";
import { normalizeHouseCode, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

type RegistrationOptionsData = {
  challengeId: string;
  options: Record<string, unknown>;
};

type LoginOptionsData = {
  challengeId: string;
  options: Record<string, unknown>;
};

type VerifyPasskeyData = {
  residentId: string;
};

function toBase64Url(value: Uint8Array | string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return isoBase64URL.fromBuffer(Buffer.from(value));
}

function parseExpectedOrigins(): string[] {
  return env.WEBAUTHN_ORIGINS.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function parseStoredTransports(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((entry): entry is string => typeof entry === "string");
  return normalized.length > 0 ? normalized : undefined;
}

async function consumeChallenge(challengeId: string, flow: PasskeyChallengeFlow) {
  const now = new Date();
  const challenge = await prisma.passkeyChallenge.findFirst({
    where: {
      id: challengeId,
      flow,
      usedAt: null,
      expiresAt: {
        gt: now
      }
    },
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

  if (!challenge) {
    return null;
  }

  const consumed = await prisma.passkeyChallenge.updateMany({
    where: {
      id: challenge.id,
      usedAt: null
    },
    data: {
      usedAt: now
    }
  });

  return consumed.count === 1 ? challenge : null;
}

export async function beginResidentPasskeyRegistration(
  phoneInput: string,
  houseCodeInput: string
): Promise<ServiceResult<RegistrationOptionsData>> {
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
      house: true,
      passkeyCredentials: {
        select: {
          credentialId: true,
          transports: true
        }
      }
    }
  });

  if (!resident) {
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.passkey.register.denied",
      metadata: { phoneNormalized, houseCode }
    });
    return { ok: false, status: 404, message: "No active resident record matches this phone and house." };
  }

  const options = await generateRegistrationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    userID: Buffer.from(resident.id, "utf8"),
    userName: resident.phoneNormalized,
    userDisplayName: `House ${resident.house.code}`,
    timeout: 60_000,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required"
    },
    excludeCredentials: resident.passkeyCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: parseStoredTransports(credential.transports) as any
    }))
  });

  const challenge = await prisma.passkeyChallenge.create({
    data: {
      flow: PasskeyChallengeFlow.REGISTER,
      residentId: resident.id,
      challenge: options.challenge,
      expiresAt: createPasskeyChallengeExpiry()
    }
  });

  return {
    ok: true,
    data: {
      challengeId: challenge.id,
      options: options as unknown as Record<string, unknown>
    }
  };
}

export async function completeResidentPasskeyRegistration(
  challengeId: string,
  responsePayload: unknown
): Promise<ServiceResult<VerifyPasskeyData>> {
  const challenge = await consumeChallenge(challengeId, PasskeyChallengeFlow.REGISTER);
  if (!challenge || !challenge.resident) {
    return { ok: false, status: 400, message: "Passkey challenge is missing or expired." };
  }

  if (challenge.resident.status !== ResidentStatus.ACTIVE) {
    return { ok: false, status: 403, message: "Resident is not active." };
  }

  const verification = await verifyRegistrationResponse({
    response: responsePayload as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge: challenge.challenge,
    expectedOrigin: parseExpectedOrigins(),
    expectedRPID: env.WEBAUTHN_RP_ID,
    requireUserVerification: true
  });

  if (!verification.verified || !verification.registrationInfo) {
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.passkey.register.failed",
      residentId: challenge.resident.id
    });
    return { ok: false, status: 400, message: "Passkey registration could not be verified." };
  }

  const registrationInfo = verification.registrationInfo as unknown as {
    credentialID?: Uint8Array | string;
    credentialPublicKey?: Uint8Array | string;
    counter?: number;
    credential?: {
      id?: Uint8Array | string;
      publicKey?: Uint8Array | string;
      counter?: number;
    };
  };

  const credentialId = toBase64Url(registrationInfo.credentialID ?? registrationInfo.credential?.id);
  const credentialPublicKey = toBase64Url(registrationInfo.credentialPublicKey ?? registrationInfo.credential?.publicKey);
  const counter = registrationInfo.counter ?? registrationInfo.credential?.counter ?? 0;
  const transports = (responsePayload as { response?: { transports?: string[] } })?.response?.transports;

  if (!credentialId || !credentialPublicKey) {
    return { ok: false, status: 400, message: "Passkey registration data is incomplete." };
  }

  try {
    await prisma.passkeyCredential.create({
      data: {
        residentId: challenge.resident.id,
        credentialId,
        publicKey: credentialPublicKey,
        counter,
        transports: transports ?? undefined,
        lastUsedAt: new Date()
      }
    });
  } catch {
    return { ok: false, status: 409, message: "Passkey is already registered." };
  }

  await writeAuditLog({
    actorType: ActorType.RESIDENT,
    action: "resident.passkey.register.accepted",
    residentId: challenge.resident.id,
    metadata: { houseCode: challenge.resident.house.code }
  });

  return {
    ok: true,
    data: {
      residentId: challenge.resident.id
    }
  };
}

export async function beginResidentPasskeyLogin(): Promise<ServiceResult<LoginOptionsData>> {
  const passkeyCount = await prisma.passkeyCredential.count();
  if (passkeyCount === 0) {
    return { ok: false, status: 404, message: "No passkeys are registered yet." };
  }

  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    timeout: 60_000,
    userVerification: "required"
  });

  const challenge = await prisma.passkeyChallenge.create({
    data: {
      flow: PasskeyChallengeFlow.LOGIN,
      challenge: options.challenge,
      expiresAt: createPasskeyChallengeExpiry()
    }
  });

  return {
    ok: true,
    data: {
      challengeId: challenge.id,
      options: options as unknown as Record<string, unknown>
    }
  };
}

export async function completeResidentPasskeyLogin(
  challengeId: string,
  responsePayload: unknown
): Promise<ServiceResult<VerifyPasskeyData>> {
  const challenge = await consumeChallenge(challengeId, PasskeyChallengeFlow.LOGIN);
  if (!challenge) {
    return { ok: false, status: 400, message: "Passkey challenge is missing or expired." };
  }

  const credentialId = (responsePayload as { id?: string })?.id;
  if (!credentialId) {
    return { ok: false, status: 400, message: "Passkey credential id is required." };
  }

  const storedCredential = await prisma.passkeyCredential.findUnique({
    where: {
      credentialId
    },
    include: {
      resident: {
        include: {
          house: true
        }
      }
    }
  });

  if (!storedCredential || storedCredential.resident.status !== ResidentStatus.ACTIVE) {
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.passkey.login.failed",
      metadata: { reason: "unknown_or_inactive_credential" }
    });
    return { ok: false, status: 401, message: "Passkey is not recognized for an active resident." };
  }

  const verification = await verifyAuthenticationResponse({
    response: responsePayload as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge: challenge.challenge,
    expectedOrigin: parseExpectedOrigins(),
    expectedRPID: env.WEBAUTHN_RP_ID,
    authenticator: {
      credentialID: storedCredential.credentialId,
      credentialPublicKey: isoBase64URL.toBuffer(storedCredential.publicKey),
      counter: storedCredential.counter,
      transports: parseStoredTransports(storedCredential.transports) as any
    },
    requireUserVerification: true
  });

  if (!verification.verified) {
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.passkey.login.failed",
      residentId: storedCredential.residentId,
      metadata: { reason: "assertion_verification_failed" }
    });
    return { ok: false, status: 401, message: "Passkey assertion could not be verified." };
  }

  const newCounter = verification.authenticationInfo?.newCounter ?? storedCredential.counter;
  await prisma.passkeyCredential.update({
    where: {
      id: storedCredential.id
    },
    data: {
      counter: newCounter,
      lastUsedAt: new Date()
    }
  });

  await writeAuditLog({
    actorType: ActorType.RESIDENT,
    action: "resident.passkey.login.accepted",
    residentId: storedCredential.residentId,
    metadata: { houseCode: storedCredential.resident.house.code }
  });

  return {
    ok: true,
    data: {
      residentId: storedCredential.residentId
    }
  };
}
