import { ResidentStatus } from "@prisma/client";

import { env } from "../lib/env";
import { hashPassword } from "../lib/password";
import { normalizePhone } from "../lib/phone";
import { prisma } from "../lib/prisma";

const residentSeed = [
  { code: "9", phone: "+7 708 858 5331", status: ResidentStatus.ACTIVE },
  { code: "9", phone: "+7 701 552 6777", status: ResidentStatus.ACTIVE }
];

const legacyDefaultSurveySlugs = [
  "parking-lot-redesign",
  "playground-upgrade",
  "security-cctv-entry"
];

async function seedHousesAndResidents() {
  const houseCodes = [...new Set(residentSeed.map((entry) => entry.code))];

  for (const code of houseCodes) {
    await prisma.house.upsert({
      where: { code },
      update: {},
      create: {
        code,
        label: `House ${code}`
      }
    });
  }

  const houseMap = new Map((await prisma.house.findMany()).map((house) => [house.code, house.id]));

  for (const resident of residentSeed) {
    const houseId = houseMap.get(resident.code);
    if (!houseId) {
      continue;
    }

    await prisma.resident.upsert({
      where: {
        phoneNormalized_houseId: {
          phoneNormalized: normalizePhone(resident.phone),
          houseId
        }
      },
      update: {
        status: resident.status
      },
      create: {
        phoneNormalized: normalizePhone(resident.phone),
        phoneRaw: resident.phone,
        status: resident.status,
        houseId
      }
    });
  }
}

async function seedAdmin() {
  const adminLogin = env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  const passwordHash = await hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD);

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [
        {
          email: {
            equals: adminLogin,
            mode: "insensitive"
          }
        },
        {
          email: {
            startsWith: `${adminLogin}@`,
            mode: "insensitive"
          }
        }
      ]
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (existing) {
    await prisma.adminUser.update({
      where: {
        id: existing.id
      },
      data: {
        passwordHash,
        role: "SUPER_ADMIN"
      }
    });
    return;
  }

  await prisma.adminUser.create({
    data: {
      email: adminLogin,
      passwordHash,
      role: "SUPER_ADMIN",
      mfaEnabled: false
    }
  });
}

async function cleanupLegacySeedSurveys() {
  const legacySurveys = await prisma.survey.findMany({
    where: {
      slug: {
        in: legacyDefaultSurveySlugs
      }
    },
    select: {
      id: true
    }
  });

  if (legacySurveys.length === 0) {
    return;
  }

  const surveyIds = legacySurveys.map((survey) => survey.id);

  await prisma.$transaction(async (tx) => {
    await tx.vote.deleteMany({
      where: {
        surveyId: {
          in: surveyIds
        }
      }
    });
    await tx.survey.deleteMany({
      where: {
        id: {
          in: surveyIds
        }
      }
    });
  });
}

async function main() {
  await cleanupLegacySeedSurveys();
  await seedHousesAndResidents();
  await seedAdmin();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
