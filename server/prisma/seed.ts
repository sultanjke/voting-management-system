import { SurveyStatus, QuestionType, ResidentStatus } from "@prisma/client";

import { env } from "../lib/env";
import { hashPassword } from "../lib/password";
import { normalizePhone } from "../lib/phone";
import { prisma } from "../lib/prisma";

type SurveySeed = {
  slug: string;
  title: string;
  description: string;
  status: SurveyStatus;
  deadline: Date | null;
  questions: Array<{
    type: QuestionType;
    text: string;
    description?: string;
    options?: string[];
  }>;
};

const residentSeed = [
  { code: "9", phone: "+7 708 858 5331", status: ResidentStatus.ACTIVE },
  { code: "1", phone: "+7 777 123 4561", status: ResidentStatus.ACTIVE },
  { code: "2", phone: "+7 777 123 4562", status: ResidentStatus.ACTIVE },
  { code: "3", phone: "+7 777 123 4563", status: ResidentStatus.ACTIVE },
  { code: "9", phone: "+7 701 552 6777", status: ResidentStatus.ACTIVE },
  { code: "5", phone: "+7 777 123 4565", status: ResidentStatus.ACTIVE },
  { code: "6", phone: "+7 777 123 4566", status: ResidentStatus.PENDING }
];

const surveys: SurveySeed[] = [
  {
    slug: "parking-lot-redesign",
    title: "Parking Lot Redesign",
    description: "Review proposal to expand parking space availability.",
    status: SurveyStatus.ACTIVE,
    deadline: new Date("2026-04-05T23:59:00.000Z"),
    questions: [
      {
        type: QuestionType.SINGLE,
        text: "Do you support expanding the residential parking area?",
        description: "The proposed plan adds new spots in the east courtyard.",
        options: ["Yes, strongly support", "Yes, with conditions", "No, I have concerns", "No, strongly oppose", "Abstain"]
      },
      {
        type: QuestionType.SINGLE,
        text: "Which area should be converted for new parking spaces?",
        options: ["East courtyard", "Visitor slots", "Old storage area", "Underground expansion", "No conversion"]
      },
      {
        type: QuestionType.SCALE,
        text: "How urgent is parking as an issue?",
        description: "1 = not urgent, 5 = critical"
      },
      {
        type: QuestionType.TEXT,
        text: "Additional notes on parking management"
      }
    ]
  },
  {
    slug: "playground-upgrade",
    title: "Children's Playground Upgrade",
    description: "Vote on playground modernization priorities.",
    status: SurveyStatus.ACTIVE,
    deadline: new Date("2026-04-15T23:59:00.000Z"),
    questions: [
      {
        type: QuestionType.SINGLE,
        text: "Should we invest in new playground equipment?",
        options: ["Yes, high priority", "Yes, but phased", "Maybe, depends on cost", "Not now", "No opinion"]
      },
      {
        type: QuestionType.SCALE,
        text: "How would you rate current playground condition?",
        description: "1 = very poor, 5 = excellent"
      },
      {
        type: QuestionType.TEXT,
        text: "What specific feature should be added first?"
      }
    ]
  },
  {
    slug: "security-cctv-entry",
    title: "CCTV and Entry Security",
    description: "Closed poll about security upgrades.",
    status: SurveyStatus.CLOSED,
    deadline: new Date("2026-03-01T23:59:00.000Z"),
    questions: [
      {
        type: QuestionType.SINGLE,
        text: "Do you support additional CCTV installation?",
        options: ["Fully support", "Support with privacy limits", "Neutral", "Oppose", "Strongly oppose"]
      },
      {
        type: QuestionType.SCALE,
        text: "How safe do you feel currently?",
        description: "1 = unsafe, 5 = very safe"
      }
    ]
  }
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

async function seedSurveys() {
  const totalEligible = await prisma.house.count();

  for (const survey of surveys) {
    const existing = await prisma.survey.findUnique({
      where: { slug: survey.slug }
    });

    if (existing) {
      continue;
    }

    await prisma.survey.create({
      data: {
        slug: survey.slug,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        deadline: survey.deadline,
        totalEligible,
        questions: {
          create: survey.questions.map((question, questionIndex) => ({
            position: questionIndex,
            type: question.type,
            text: question.text,
            description: question.description,
            options:
              question.type === QuestionType.SINGLE
                ? {
                    create:
                      question.options?.map((option, optionIndex) => ({
                        position: optionIndex,
                        label: option
                      })) ?? []
                  }
                : undefined
          }))
        }
      }
    });
  }
}

async function seedVotes() {
  const targetSurvey = await prisma.survey.findUnique({
    where: { slug: "security-cctv-entry" },
    include: {
      questions: {
        orderBy: {
          position: "asc"
        },
        include: {
          options: {
            orderBy: {
              position: "asc"
            }
          }
        }
      }
    }
  });

  if (!targetSurvey) {
    return;
  }

  const activeResidents = await prisma.resident.findMany({
    where: {
      status: ResidentStatus.ACTIVE
    },
    include: {
      house: true
    },
    take: 3
  });

  for (let index = 0; index < activeResidents.length; index += 1) {
    const resident = activeResidents[index];
    const exists = await prisma.vote.findUnique({
      where: {
        surveyId_houseId: {
          surveyId: targetSurvey.id,
          houseId: resident.houseId
        }
      }
    });

    if (exists) {
      continue;
    }

    const firstQuestion = targetSurvey.questions[0];
    const secondQuestion = targetSurvey.questions[1];

    await prisma.vote.create({
      data: {
        surveyId: targetSurvey.id,
        houseId: resident.houseId,
        residentId: resident.id,
        answers: {
          create: [
            {
              questionId: firstQuestion.id,
              optionId: firstQuestion.options[index % firstQuestion.options.length].id
            },
            {
              questionId: secondQuestion.id,
              scaleValue: Math.min(5, index + 3)
            }
          ]
        }
      }
    });
  }
}

async function main() {
  await seedHousesAndResidents();
  await seedAdmin();
  await seedSurveys();
  await seedVotes();
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
