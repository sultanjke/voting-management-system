import { ActorType, Prisma, QuestionType, ResidentStatus, SurveyStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import type { Lang } from "@/lib/i18n";
import { decodeLocalizedText } from "@/lib/localized-text";
import { normalizeHouseCode, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { localizeSurveyContent, localizeSurveyTextPatch } from "@/lib/survey-localization";
import { requireAdminSession } from "@/src/middleware/auth";

const patchResidentSchema = z.object({
  status: z.nativeEnum(ResidentStatus)
});

const createResidentSchema = z.object({
  phone: z.string().min(5),
  houseCode: z.string().min(1),
  status: z.nativeEnum(ResidentStatus).default(ResidentStatus.ACTIVE)
});

const questionSchema = z
  .object({
    type: z.nativeEnum(QuestionType),
    text: z.string().min(3),
    description: z.string().optional(),
    options: z.array(z.string().min(1)).optional()
  })
  .superRefine((question, context) => {
    if (question.type === QuestionType.SINGLE && (!question.options || question.options.length < 2)) {
      context.addIssue({
        code: "custom",
        message: "Single choice questions require at least two options."
      });
    }
  });

const deadlineSchema = z
  .string()
  .refine(
    (value) => {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    },
    { message: "Invalid deadline format." }
  );

const createSurveySchema = z.object({
  sourceLang: z.enum(["kk", "ru"]).default("kk"),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/).optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  status: z.nativeEnum(SurveyStatus).default(SurveyStatus.ACTIVE),
  deadline: deadlineSchema.nullable().optional(),
  totalEligible: z.number().int().positive(),
  questions: z.array(questionSchema).min(1)
});

const patchSurveySchema = z
  .object({
    sourceLang: z.enum(["kk", "ru"]).optional(),
    title: z.string().min(3).optional(),
    description: z.string().nullable().optional(),
    status: z.nativeEnum(SurveyStatus).optional(),
    deadline: deadlineSchema.nullable().optional(),
    totalEligible: z.number().int().positive().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);

  return normalized || "survey";
}

async function createUniqueSlug(input: string): Promise<string> {
  const base = slugify(input);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const exists = await prisma.survey.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!exists) {
      return candidate;
    }

    const suffixText = `-${suffix}`;
    const trimmedBase = base.slice(0, Math.max(1, 80 - suffixText.length));
    candidate = `${trimmedBase}${suffixText}`;
    suffix += 1;
  }
}

function toCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  const escaped = text.replace(/"/g, "\"\"");
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map((cell) => toCsvCell(cell)).join(",")).join("\r\n");
}

export const adminManagementRouter = Router();

adminManagementRouter.get("/residents", requireAdminSession, async (_request, response) => {
  const residents = await prisma.resident.findMany({
    include: {
      house: true,
      _count: {
        select: {
          votes: true,
          passkeyCredentials: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  response.json({
    residents: residents.map((resident) => ({
      id: resident.id,
      phoneNormalized: resident.phoneNormalized,
      status: resident.status,
      houseCode: resident.house.code,
      votes: resident._count.votes,
      passkeyCount: resident._count.passkeyCredentials
    }))
  });
});

adminManagementRouter.post("/residents", requireAdminSession, async (request, response) => {
  const payload = createResidentSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid resident payload." });
    return;
  }

  const phoneNormalized = normalizePhone(payload.data.phone);
  const houseCode = normalizeHouseCode(payload.data.houseCode);

  if (!phoneNormalized || !houseCode) {
    response.status(400).json({ error: "Phone and house code are required." });
    return;
  }

  const house = await prisma.house.upsert({
    where: {
      code: houseCode
    },
    create: {
      code: houseCode,
      label: `House ${houseCode}`
    },
    update: {}
  });

  try {
    const created = await prisma.resident.create({
      data: {
        phoneNormalized,
        phoneRaw: payload.data.phone.trim(),
        status: payload.data.status,
        houseId: house.id
      },
      include: {
        house: true,
        _count: {
          select: {
            votes: true,
            passkeyCredentials: true
          }
        }
      }
    });

    await writeAuditLog({
      actorType: ActorType.ADMIN,
      action: "admin.resident.created",
      adminUserId: request.adminSession!.adminUser.id,
      metadata: { residentId: created.id, houseCode: created.house.code }
    });

    response.status(201).json({
      resident: {
        id: created.id,
        phoneNormalized: created.phoneNormalized,
        status: created.status,
        houseCode: created.house.code,
        votes: created._count.votes,
        passkeyCount: created._count.passkeyCredentials
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "Resident with this phone and house already exists." });
      return;
    }

    throw error;
  }
});

adminManagementRouter.patch("/residents/:residentId", requireAdminSession, async (request, response) => {
  const payload = patchResidentSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid resident update payload." });
    return;
  }

  const residentId = request.params.residentId;

  const updated = await prisma.resident.update({
    where: {
      id: residentId
    },
    data: {
      status: payload.data.status
    },
    include: {
      house: true,
      _count: {
        select: {
          votes: true,
          passkeyCredentials: true
        }
      }
    }
  });

  await writeAuditLog({
    actorType: ActorType.ADMIN,
    action: "admin.resident.status.updated",
    adminUserId: request.adminSession!.adminUser.id,
    metadata: { residentId, status: payload.data.status }
  });

  response.json({
    resident: {
      id: updated.id,
      houseCode: updated.house.code,
      phoneNormalized: updated.phoneNormalized,
      status: updated.status,
      votes: updated._count.votes,
      passkeyCount: updated._count.passkeyCredentials
    }
  });
});

adminManagementRouter.post("/residents/:residentId/passkeys/reset", requireAdminSession, async (request, response) => {
  const residentId = request.params.residentId;

  const resident = await prisma.resident.findUnique({
    where: {
      id: residentId
    },
    include: {
      house: {
        select: {
          code: true
        }
      }
    }
  });

  if (!resident) {
    response.status(404).json({ error: "Resident not found." });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedCredentials = await tx.passkeyCredential.deleteMany({
      where: {
        residentId
      }
    });

    await tx.passkeyChallenge.deleteMany({
      where: {
        residentId
      }
    });

    const revokedSessions = await tx.authSession.deleteMany({
      where: {
        residentId,
        actorType: ActorType.RESIDENT
      }
    });

    return {
      deletedCredentials: deletedCredentials.count,
      revokedSessions: revokedSessions.count
    };
  });

  await writeAuditLog({
    actorType: ActorType.ADMIN,
    action: "admin.resident.passkeys.reset",
    adminUserId: request.adminSession!.adminUser.id,
    residentId,
    metadata: {
      houseCode: resident.house.code,
      deletedCredentials: result.deletedCredentials,
      revokedSessions: result.revokedSessions
    }
  });

  response.json({
    ok: true,
    residentId,
    deletedCredentials: result.deletedCredentials,
    revokedSessions: result.revokedSessions
  });
});

adminManagementRouter.get("/surveys", requireAdminSession, async (_request, response) => {
  const surveys = await prisma.survey.findMany({
    include: {
      _count: {
        select: {
          votes: true,
          questions: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  response.json({
    surveys: surveys.map((survey) => ({
      id: survey.id,
      slug: survey.slug,
      title: survey.title,
      description: survey.description,
      status: survey.status,
      deadline: survey.deadline,
      totalEligible: survey.totalEligible,
      voteCount: survey._count.votes,
      questionCount: survey._count.questions
    }))
  });
});

adminManagementRouter.post("/surveys", requireAdminSession, async (request, response) => {
  const payload = createSurveySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid survey payload.", details: payload.error.issues });
    return;
  }

  try {
    const slug = await createUniqueSlug(payload.data.slug ?? payload.data.title);
    const localized = await localizeSurveyContent({
      sourceLang: payload.data.sourceLang as Lang,
      title: payload.data.title,
      description: payload.data.description,
      questions: payload.data.questions
    });

    const created = await prisma.survey.create({
      data: {
        slug,
        title: localized.title,
        description: localized.description,
        status: payload.data.status,
        deadline: payload.data.deadline ? new Date(payload.data.deadline) : null,
        totalEligible: payload.data.totalEligible,
        questions: {
          create: localized.questions.map((question, questionIndex) => ({
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
      },
      include: {
        _count: {
          select: {
            votes: true
          }
        }
      }
    });

    await writeAuditLog({
      actorType: ActorType.ADMIN,
      action: "admin.survey.created",
      adminUserId: request.adminSession!.adminUser.id,
      metadata: { surveyId: created.id, slug: created.slug }
    });

    response.json({
      survey: {
        id: created.id,
        title: created.title,
        status: created.status,
        deadline: created.deadline ? created.deadline.toISOString() : null,
        voteCount: created._count.votes,
        totalEligible: created.totalEligible
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "Slug already exists." });
      return;
    }

    throw error;
  }
});

adminManagementRouter.patch("/surveys/:surveyId", requireAdminSession, async (request, response) => {
  const payload = patchSurveySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid survey patch payload.", details: payload.error.issues });
    return;
  }

  const surveyId = request.params.surveyId;
  const localizedPatch = await localizeSurveyTextPatch({
    sourceLang: (payload.data.sourceLang as Lang | undefined) ?? "kk",
    title: payload.data.title,
    description: payload.data.description
  });

  try {
    const updated = await prisma.survey.update({
      where: {
        id: surveyId
      },
      data: {
        title: localizedPatch.title,
        description: localizedPatch.description,
        status: payload.data.status,
        deadline:
          payload.data.deadline === undefined
            ? undefined
            : payload.data.deadline === null
              ? null
              : new Date(payload.data.deadline),
        totalEligible: payload.data.totalEligible
      },
      include: {
        _count: {
          select: {
            votes: true,
            questions: true
          }
        }
      }
    });

    await writeAuditLog({
      actorType: ActorType.ADMIN,
      action: "admin.survey.updated",
      adminUserId: request.adminSession!.adminUser.id,
      metadata: { surveyId, keys: Object.keys(payload.data) }
    });

    response.json({
      survey: {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        description: updated.description,
        status: updated.status,
        deadline: updated.deadline,
        totalEligible: updated.totalEligible,
        voteCount: updated._count.votes,
        questionCount: updated._count.questions
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      response.status(404).json({ error: "Survey not found." });
      return;
    }

    const message = error instanceof Error ? error.message : "";
    if (message.includes("SurveyStatus") && message.includes("ARCHIVED")) {
      response
        .status(409)
        .json({ error: "Database schema is outdated. Run prisma migrate to apply ARCHIVED status support." });
      return;
    }

    throw error;
  }
});

adminManagementRouter.delete("/surveys/:surveyId", requireAdminSession, async (request, response) => {
  const surveyId = request.params.surveyId;

  const existing = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      _count: {
        select: {
          votes: true
        }
      }
    }
  });

  if (!existing) {
    response.status(404).json({ error: "Survey not found." });
    return;
  }

  try {
    const voteDeletion = await prisma.$transaction(async (tx) => {
      const deletedVotes = await tx.vote.deleteMany({
        where: {
          surveyId
        }
      });

      await tx.survey.delete({
        where: {
          id: surveyId
        }
      });

      return deletedVotes.count;
    });

    await writeAuditLog({
      actorType: ActorType.ADMIN,
      action: "admin.survey.deleted",
      adminUserId: request.adminSession!.adminUser.id,
      metadata: { surveyId, slug: existing.slug, forced: existing._count.votes > 0, deletedVotes: voteDeletion }
    });

    response.json({ ok: true, surveyId, deletedVotes: voteDeletion });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      response.status(404).json({ error: "Survey not found." });
      return;
    }

    throw error;
  }
});

adminManagementRouter.get("/analytics/participation", requireAdminSession, async (_request, response) => {
  const surveys = await prisma.survey.findMany({
    where: {
      status: {
        not: SurveyStatus.ARCHIVED
      }
    },
    include: {
      _count: {
        select: {
          votes: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  response.json({
    analytics: surveys.map((survey) => {
      const responded = survey._count.votes;
      const totalEligible = survey.totalEligible;
      const percentage = totalEligible ? Math.round((responded / totalEligible) * 100) : 0;

      return {
        surveyId: survey.id,
        surveyTitle: survey.title,
        responded,
        totalEligible,
        percentage
      };
    })
  });
});

adminManagementRouter.get("/surveys/:surveyId/results", requireAdminSession, async (request, response) => {
  const surveyId = request.params.surveyId;
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: {
        orderBy: {
          position: "asc"
        },
        select: {
          id: true,
          text: true
        }
      },
      votes: {
        orderBy: {
          submittedAt: "desc"
        },
        include: {
          house: {
            select: {
              code: true
            }
          },
          answers: {
            select: {
              questionId: true,
              option: {
                select: {
                  label: true
                }
              },
              scaleValue: true,
              textValue: true
            }
          }
        }
      }
    }
  });

  if (!survey) {
    response.status(404).json({ error: "Survey not found." });
    return;
  }

  response.json({
    survey: {
      id: survey.id,
      title: survey.title,
      status: survey.status,
      deadline: survey.deadline ? survey.deadline.toISOString() : null,
      voteCount: survey.votes.length,
      totalEligible: survey.totalEligible,
      questions: survey.questions.map((question) => ({
        id: question.id,
        text: question.text
      })),
      votes: survey.votes.map((vote) => ({
        id: vote.id,
        houseCode: vote.house.code,
        submittedAt: vote.submittedAt.toISOString(),
        answers: vote.answers.map((answer) => ({
          questionId: answer.questionId,
          optionLabel: answer.option?.label ?? null,
          scaleValue: answer.scaleValue,
          textValue: answer.textValue
        }))
      }))
    }
  });
});

adminManagementRouter.get("/surveys/:surveyId/results/csv", requireAdminSession, async (request, response) => {
  const surveyId = request.params.surveyId;
  const requestedLang = Array.isArray(request.query.lang) ? request.query.lang[0] : request.query.lang;
  const lang: Lang = requestedLang === "ru" ? "ru" : "kk";

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: {
        orderBy: {
          position: "asc"
        },
        select: {
          id: true,
          text: true
        }
      },
      votes: {
        orderBy: {
          submittedAt: "desc"
        },
        include: {
          house: {
            select: {
              code: true
            }
          },
          answers: {
            select: {
              questionId: true,
              option: {
                select: {
                  label: true
                }
              },
              scaleValue: true,
              textValue: true
            }
          }
        }
      }
    }
  });

  if (!survey) {
    response.status(404).json({ error: "Survey not found." });
    return;
  }

  const localizedTitle = decodeLocalizedText(survey.title, lang) ?? survey.title;
  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "survey_id",
      "survey_slug",
      "survey_title",
      "survey_status",
      "survey_deadline_utc",
      "vote_id",
      "house_code",
      "submitted_at_utc",
      "question_id",
      "question_text",
      "answer_type",
      "answer_value",
      "option_label",
      "scale_value",
      "text_value"
    ]
  ];

  for (const vote of survey.votes) {
    const answersByQuestion = new Map(vote.answers.map((answer) => [answer.questionId, answer]));

    for (const question of survey.questions) {
      const questionText = decodeLocalizedText(question.text, lang) ?? question.text;
      const answer = answersByQuestion.get(question.id);
      const optionLabel = answer?.option?.label ? (decodeLocalizedText(answer.option.label, lang) ?? answer.option.label) : "";
      const scaleValue = typeof answer?.scaleValue === "number" ? answer.scaleValue : "";
      const textValue = answer?.textValue ?? "";
      const answerType = optionLabel ? "SINGLE" : scaleValue !== "" ? "SCALE" : textValue ? "TEXT" : "EMPTY";
      const answerValue = optionLabel || scaleValue || textValue;

      rows.push([
        survey.id,
        survey.slug,
        localizedTitle,
        survey.status,
        survey.deadline ? survey.deadline.toISOString() : "",
        vote.id,
        vote.house.code,
        vote.submittedAt.toISOString(),
        question.id,
        questionText,
        answerType,
        answerValue,
        optionLabel,
        scaleValue,
        textValue
      ]);
    }
  }

  const csv = `\uFEFF${buildCsv(rows)}`;
  const filename = `survey-${survey.slug}-results-${lang}.csv`;

  await writeAuditLog({
    actorType: ActorType.ADMIN,
    action: "admin.survey.results.csv.exported",
    adminUserId: request.adminSession!.adminUser.id,
    metadata: {
      surveyId: survey.id,
      slug: survey.slug,
      lang,
      rowCount: rows.length - 1
    }
  });

  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.status(200).send(csv);
});
