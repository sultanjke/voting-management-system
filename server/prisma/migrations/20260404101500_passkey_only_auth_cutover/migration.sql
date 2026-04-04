-- CreateEnum
CREATE TYPE "PasskeyChallengeFlow" AS ENUM ('REGISTER', 'LOGIN');

-- DropForeignKey
ALTER TABLE "OtpChallenge" DROP CONSTRAINT "OtpChallenge_houseId_fkey";

-- DropTable
DROP TABLE "OtpChallenge";

-- CreateTable
CREATE TABLE "PasskeyCredential" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" JSONB,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasskeyChallenge" (
    "id" TEXT NOT NULL,
    "flow" "PasskeyChallengeFlow" NOT NULL,
    "residentId" TEXT,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasskeyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX "PasskeyCredential_residentId_createdAt_idx" ON "PasskeyCredential"("residentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyChallenge_challenge_key" ON "PasskeyChallenge"("challenge");

-- CreateIndex
CREATE INDEX "PasskeyChallenge_residentId_flow_createdAt_idx" ON "PasskeyChallenge"("residentId", "flow", "createdAt");

-- AddForeignKey
ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasskeyChallenge" ADD CONSTRAINT "PasskeyChallenge_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
