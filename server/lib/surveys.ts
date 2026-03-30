import { Prisma, QuestionType, SurveyStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateParticipation, isDuplicateHouseVote } from "@/lib/vote-policy";

export type ResidentSurveyCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  deadline: string | null;
  voteCount: number;
  totalEligible: number;
  alreadyVoted: boolean;
  questionCount: number;
};

export type ResidentSurveyDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  deadline: string | null;
  alreadyVoted: boolean;
  questions: Array<{
    id: string;
    type: QuestionType;
    text: string;
    description: string | null;
    position: number;
    options: Array<{
      id: string;
      label: string;
      position: number;
    }>;
  }>;
};

type VoteAnswerPayload = {
  questionId: string;
  optionId?: string;
  scaleValue?: number;
  textValue?: string;
};

export type VoteSubmissionResult = {
  ok: boolean;
  alreadySubmitted?: boolean;
  message?: string;
};

export async function listResidentSurveys(houseId: string): Promise<ResidentSurveyCard[]> {
  const surveys = await prisma.survey.findMany({
    where: {
      status: {
        in: [SurveyStatus.ACTIVE, SurveyStatus.CLOSED]
      }
    },
    include: {
      questions: true,
      votes: {
        where: {
          houseId
        },
        select: {
          id: true
        }
      },
      _count: {
        select: {
          votes: true
        }
      }
    },
    orderBy: [
      {
        status: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return surveys.map((survey) => ({
    id: survey.id,
    slug: survey.slug,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    deadline: survey.deadline ? survey.deadline.toISOString() : null,
    voteCount: survey._count.votes,
    totalEligible: survey.totalEligible,
    alreadyVoted: survey.votes.length > 0,
    questionCount: survey.questions.length
  }));
}

export async function getResidentSurveyDetail(surveyId: string, houseId: string): Promise<ResidentSurveyDetail | null> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
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
      },
      votes: {
        where: {
          houseId
        },
        select: {
          id: true
        }
      }
    }
  });

  if (!survey || (survey.status !== SurveyStatus.ACTIVE && survey.status !== SurveyStatus.CLOSED)) {
    return null;
  }

  return {
    id: survey.id,
    slug: survey.slug,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    deadline: survey.deadline ? survey.deadline.toISOString() : null,
    alreadyVoted: survey.votes.length > 0,
    questions: survey.questions.map((question) => ({
      id: question.id,
      type: question.type,
      text: question.text,
      description: question.description,
      position: question.position,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position
      }))
    }))
  };
}

function validateAnswers(
  questions: Array<{
    id: string;
    type: QuestionType;
    options: Array<{ id: string }>;
  }>,
  payload: VoteAnswerPayload[]
): { ok: true; answers: Prisma.AnswerCreateWithoutVoteInput[] } | { ok: false; message: string } {
  const map = new Map(payload.map((answer) => [answer.questionId, answer]));
  const prepared: Prisma.AnswerCreateWithoutVoteInput[] = [];

  for (const question of questions) {
    const answer = map.get(question.id);

    if (!answer && question.type !== QuestionType.TEXT) {
      return { ok: false, message: `Missing answer for question ${question.id}.` };
    }

    if (!answer) {
      continue;
    }

    if (question.type === QuestionType.SINGLE) {
      if (!answer.optionId || !question.options.some((option) => option.id === answer.optionId)) {
        return { ok: false, message: `Invalid option for question ${question.id}.` };
      }
      prepared.push({
        question: { connect: { id: question.id } },
        option: { connect: { id: answer.optionId } }
      });
      continue;
    }

    if (question.type === QuestionType.SCALE) {
      if (typeof answer.scaleValue !== "number" || answer.scaleValue < 1 || answer.scaleValue > 5) {
        return { ok: false, message: `Invalid scale value for question ${question.id}.` };
      }
      prepared.push({
        question: { connect: { id: question.id } },
        scaleValue: answer.scaleValue
      });
      continue;
    }

    if (question.type === QuestionType.TEXT) {
      const value = answer.textValue?.trim();
      if (value) {
        prepared.push({
          question: { connect: { id: question.id } },
          textValue: value
        });
      }
    }
  }

  return {
    ok: true,
    answers: prepared
  };
}

export async function submitResidentVote(input: {
  surveyId: string;
  houseId: string;
  residentId: string;
  answers: VoteAnswerPayload[];
}): Promise<VoteSubmissionResult> {
  const survey = await prisma.survey.findUnique({
    where: { id: input.surveyId },
    include: {
      questions: {
        include: {
          options: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  if (!survey) {
    return { ok: false, message: "Survey not found." };
  }

  if (survey.status !== SurveyStatus.ACTIVE) {
    return { ok: false, message: "Survey is not accepting responses." };
  }

  const validation = validateAnswers(
    survey.questions.map((question) => ({
      id: question.id,
      type: question.type,
      options: question.options
    })),
    input.answers
  );

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const existingVote = await prisma.vote.findUnique({
    where: {
      surveyId_houseId: {
        surveyId: input.surveyId,
        houseId: input.houseId
      }
    },
    select: {
      id: true
    }
  });

  if (isDuplicateHouseVote(Boolean(existingVote))) {
    return { ok: true, alreadySubmitted: true };
  }

  try {
    await prisma.vote.create({
      data: {
        surveyId: input.surveyId,
        houseId: input.houseId,
        residentId: input.residentId,
        answers: {
          create: validation.answers
        }
      }
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: true, alreadySubmitted: true };
    }

    throw error;
  }
}

export async function getResidentResults() {
  const surveys = await prisma.survey.findMany({
    where: {
      status: {
        in: [SurveyStatus.ACTIVE, SurveyStatus.CLOSED]
      }
    },
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
          },
          answers: true
        }
      },
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

  return surveys.map((survey) => ({
    id: survey.id,
    title: survey.title,
    status: survey.status,
    participation: {
      responded: survey._count.votes,
      totalEligible: survey.totalEligible,
      percentage: calculateParticipation(survey._count.votes, survey.totalEligible)
    },
    questions: survey.questions.map((question) => {
      if (question.type === QuestionType.SINGLE) {
        const optionCounts = question.options.map((option) => ({
          optionId: option.id,
          label: option.label,
          count: question.answers.filter((answer) => answer.optionId === option.id).length
        }));

        return {
          id: question.id,
          type: question.type,
          text: question.text,
          data: optionCounts
        };
      }

      if (question.type === QuestionType.SCALE) {
        const buckets = [1, 2, 3, 4, 5].map((value) => ({
          value,
          count: question.answers.filter((answer) => answer.scaleValue === value).length
        }));

        return {
          id: question.id,
          type: question.type,
          text: question.text,
          data: buckets
        };
      }

      return {
        id: question.id,
        type: question.type,
        text: question.text,
        data: question.answers
          .map((answer) => answer.textValue)
          .filter((value): value is string => Boolean(value))
          .slice(0, 25)
      };
    })
  }));
}


