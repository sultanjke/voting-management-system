export type Lang = "kk" | "ru";

export type SurveyStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
export type ResidentStatus = "ACTIVE" | "PENDING" | "DISABLED";
export type QuestionType = "SINGLE" | "SCALE" | "TEXT";

export type ResidentPasskeyOptionsResponse = {
  challengeId: string;
  options: Record<string, unknown>;
};

export type ResidentPasskeyVerifyResponse = {
  success: true;
};

export type ResidentSessionResponse =
  | { authenticated: false }
  | { authenticated: true; resident: { id: string; houseCode: string } };

export type AdminSessionResponse =
  | { authenticated: false }
  | { authenticated: true; admin: { id: string; login: string } };

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

export type ResidentResultsPayload = {
  id: string;
  title: string;
  status: SurveyStatus;
  participation: {
    responded: number;
    totalEligible: number;
    percentage: number;
  };
  questions: Array<{
    id: string;
    type: QuestionType;
    text: string;
    data:
      | Array<{ optionId: string; label: string; count: number }>
      | Array<{ value: number; count: number }>
      | string[];
  }>;
};

export type AdminResidentRow = {
  id: string;
  houseCode: string;
  phoneNormalized: string;
  status: ResidentStatus;
  votes: number;
  passkeyCount: number;
};

export type AdminSurveyRow = {
  id: string;
  title: string;
  status: SurveyStatus;
  deadline: string | null;
  voteCount: number;
  totalEligible: number;
};

export type ParticipationRow = {
  surveyId: string;
  surveyTitle: string;
  responded: number;
  totalEligible: number;
  percentage: number;
};

export type AdminSurveyResultsPayload = {
  id: string;
  title: string;
  status: SurveyStatus;
  deadline: string | null;
  voteCount: number;
  totalEligible: number;
  questions: Array<{
    id: string;
    text: string;
  }>;
  votes: Array<{
    id: string;
    houseCode: string;
    submittedAt: string;
    answers: Array<{
      questionId: string;
      optionLabel: string | null;
      scaleValue: number | null;
      textValue: string | null;
    }>;
  }>;
};
