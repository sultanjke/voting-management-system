import { ActorType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { getResidentResults, getResidentSurveyDetail, listResidentSurveys, submitResidentVote } from "@/lib/surveys";
import { requireResidentSession } from "@/src/middleware/auth";

const voteSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().optional(),
      scaleValue: z.number().int().optional(),
      textValue: z.string().optional()
    })
  )
});

export const residentSurveysRouter = Router();

residentSurveysRouter.get("/surveys", requireResidentSession, async (request, response) => {
  const surveys = await listResidentSurveys(request.residentSession!.resident.houseId);
  response.json({ surveys });
});

residentSurveysRouter.get("/surveys/:surveyId", requireResidentSession, async (request, response) => {
  const survey = await getResidentSurveyDetail(request.params.surveyId, request.residentSession!.resident.houseId);

  if (!survey) {
    response.status(404).json({ error: "Survey not found." });
    return;
  }

  response.json({ survey });
});

residentSurveysRouter.post("/surveys/:surveyId/vote", requireResidentSession, async (request, response) => {
  const payload = voteSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ error: "Invalid vote payload." });
    return;
  }

  const surveyId = request.params.surveyId;
  const submission = await submitResidentVote({
    surveyId,
    houseId: request.residentSession!.resident.houseId,
    residentId: request.residentSession!.resident.id,
    answers: payload.data.answers
  });

  if (!submission.ok) {
    await writeAuditLog({
      actorType: ActorType.RESIDENT,
      action: "resident.vote.rejected",
      residentId: request.residentSession!.resident.id,
      metadata: { surveyId, reason: submission.message }
    });

    response.status(400).json({ error: submission.message ?? "Vote rejected." });
    return;
  }

  await writeAuditLog({
    actorType: ActorType.RESIDENT,
    action: submission.alreadySubmitted ? "resident.vote.duplicate" : "resident.vote.accepted",
    residentId: request.residentSession!.resident.id,
    metadata: { surveyId }
  });

  response.json({ success: true, alreadySubmitted: submission.alreadySubmitted ?? false });
});

residentSurveysRouter.get("/results", requireResidentSession, async (_request, response) => {
  const results = await getResidentResults();
  response.json({ results });
});
