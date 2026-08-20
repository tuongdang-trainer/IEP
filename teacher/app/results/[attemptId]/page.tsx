"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  team: string | null;
};

type Campaign = {
  id: string;
  name: string;
  code: string;
  description: string | null;
};

type Attempt = {
  id: string;
  status: string;
  percentage: number | null;
  total_score: number | null;
  max_score: number | null;
  diagnosis: string | null;
  is_suspicious: boolean;
  started_at: string | null;
  submitted_at: string | null;
  duration_seconds: number | null;
  tab_switch_count: number;
  blur_count: number;
  paste_count: number;
  copy_count: number;
  fullscreen_exit_count: number;
  candidates: Candidate | null;
  campaigns: Campaign | null;
};

type QuestionBank = {
  id: string;
  skill: string;
  cefr_level: string;
  question_type: string;
  question_text: string;
  instruction: string | null;
  points: number;
};

type AttemptQuestion = {
  id: string;
  question_id: string | null;
  question_number: number;
  writing_task_id: string | null;
  question_bank: QuestionBank | null;
};

type QuestionOption = {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  order_number: number;
};

type Answer = {
  id: string;
  attempt_question_id: string;
  selected_option_id: string | null;
  answer_text: string | null;
  is_correct: boolean | null;
  points_earned: number;
};

type QuestionAnswer = {
  id: string;
  question_id: string;
  correct_option_id: string;
};

type WritingTask = {
  id: string;
  title: string;
  prompt: string;
  instructions: string | null;
  word_limit_min: number | null;
  word_limit_max: number | null;
  time_limit_minutes: number | null;
  points: number;
  is_active: boolean;
};

type WritingResponse = {
  id: string;
  writing_task_id: string;
  response_text: string | null;
  word_count: number | null;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  feedback: string | null;
  grading_status: string;
  graded_at: string | null;
};

type Event = {
  id: string;
  event_type: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

type AntiCheatingIncident = {
  id: string;
  occurred_at: string;
  event_types: string[];
  metadata: Record<string, unknown>[];
};

type ResultData = {
  attempt: Attempt;
  attemptQuestions: AttemptQuestion[];
  writingTasks: WritingTask[];
  answers: Answer[];
  questionOptions: QuestionOption[];
  questionAnswers: QuestionAnswer[];
  writingResponses: WritingResponse[];
  events: Event[];
};

type WritingDraft = {
  score: string;
  feedback: string;
};

const INCIDENT_WINDOW_MS = 3000;

function groupAntiCheatingEvents(
  events: Event[]
): AntiCheatingIncident[] {
  const relevantEvents = events
    .filter(
      (event) =>
        event.event_type !== "focus" &&
        event.event_type !== "test_started" &&
        event.event_type !== "test_submitted"
    )
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() -
        new Date(b.occurred_at).getTime()
    );

  const incidents: AntiCheatingIncident[] = [];

  for (const event of relevantEvents) {
    const eventTime = new Date(event.occurred_at).getTime();
    const lastIncident = incidents[incidents.length - 1];

    if (!lastIncident) {
      incidents.push({
        id: event.id,
        occurred_at: event.occurred_at,
        event_types: [event.event_type],
        metadata: event.metadata ? [event.metadata] : [],
      });
      continue;
    }

    const lastEventTime = new Date(
      lastIncident.occurred_at
    ).getTime();

    const isWithinIncidentWindow =
      eventTime - lastEventTime <= INCIDENT_WINDOW_MS;

    const isWindowSwitchEvent =
      event.event_type === "blur" ||
      event.event_type === "tab_switch";

    const lastIncidentHasWindowSwitch =
      lastIncident.event_types.includes("blur") ||
      lastIncident.event_types.includes("tab_switch");

    if (
      isWithinIncidentWindow &&
      isWindowSwitchEvent &&
      lastIncidentHasWindowSwitch
    ) {
      lastIncident.event_types.push(event.event_type);

      if (event.metadata) {
        lastIncident.metadata.push(event.metadata);
      }

      continue;
    }

    incidents.push({
      id: event.id,
      occurred_at: event.occurred_at,
      event_types: [event.event_type],
      metadata: event.metadata ? [event.metadata] : [],
    });
  }

  return incidents.reverse();
}

export default function ResultDetailPage() {
  const params = useParams<{ attemptId: string }>();

  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [writingDrafts, setWritingDrafts] = useState<
    Record<string, WritingDraft>
  >({});

  const [savingWritingId, setSavingWritingId] = useState<string | null>(
    null
  );

  const [writingSaveMessage, setWritingSaveMessage] = useState<
    Record<string, string>
  >({});

  const [writingSaveError, setWritingSaveError] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        const response = await fetch(
          `/api/results/${params.attemptId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load result."
          );
        }

        if (!cancelled) {
          setData(result);

          const drafts: Record<string, WritingDraft> = {};

          for (const writing of result.writingResponses ?? []) {
            drafts[writing.id] = {
              score:
                writing.score === null ||
                writing.score === undefined
                  ? ""
                  : String(writing.score),
              feedback: writing.feedback ?? "",
            };
          }

          setWritingDrafts(drafts);
          setLoading(false);
        }
      } catch (err) {
        console.error("Result loading error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load result."
          );
          setLoading(false);
        }
      }
    }

    if (params.attemptId) {
      loadResult();
    }

    return () => {
      cancelled = true;
    };
  }, [params.attemptId]);

  function formatDate(date: string | null) {
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }

  const incidents = data
  ? groupAntiCheatingEvents(data.events)
  : [];

const incidentCounts = incidents.reduce(
  (counts, incident) => {
    if (
      incident.event_types.includes("tab_switch") ||
      incident.event_types.includes("blur")
    ) {
      counts.tabSwitch += 1;
    }

    if (incident.event_types.includes("copy")) {
      counts.copy += 1;
    }

    if (incident.event_types.includes("paste")) {
      counts.paste += 1;
    }

    if (incident.event_types.includes("fullscreen_exit")) {
      counts.fullscreenExit += 1;
    }

    return counts;
  },
  {
    tabSwitch: 0,
    copy: 0,
    paste: 0,
    fullscreenExit: 0,
  }
);

  function formatPercentage(value: number | null) {
    if (value === null || value === undefined) {
      return "—";
    }

    return `${Math.round(value)}%`;
  }

  function getAnswer(questionId: string) {
    return data?.answers.find(
      (answer) => answer.attempt_question_id === questionId
    );
  }

  function getOptions(questionId: string) {
    return (
      data?.questionOptions.filter(
        (option) => option.question_id === questionId
      ) ?? []
    );
  }

  function getCorrectOptionId(questionId: string) {
    return (
      data?.questionAnswers.find(
        (answer) => answer.question_id === questionId
      )?.correct_option_id ?? null
    );
  }

  function getQuestionStatus(question: AttemptQuestion) {
    const answer = getAnswer(question.id);

    if (!answer) {
      return "unanswered";
    }

    if (answer.is_correct === true) {
      return "correct";
    }

    if (answer.is_correct === false) {
      return "incorrect";
    }

    return "unanswered";
  }

  function getSectionQuestions(level: string) {
    return (
      data?.attemptQuestions.filter(
        (question) =>
          question.question_bank?.cefr_level?.toUpperCase() === level
      ) ?? []
    );
  }

  function getSectionStats(level: string) {
    const questions = getSectionQuestions(level);

    let correct = 0;
    let answered = 0;
    let points = 0;

    questions.forEach((question) => {
      const answer = getAnswer(question.id);

      if (answer) {
        answered += 1;
        points += Number(answer.points_earned ?? 0);

        if (answer.is_correct === true) {
          correct += 1;
        }
      }
    });

    return {
      total: questions.length,
      answered,
      correct,
      points,
    };
  }

  function updateWritingDraft(
    writingId: string,
    field: keyof WritingDraft,
    value: string
  ) {
    setWritingDrafts((current) => ({
      ...current,
      [writingId]: {
        score: current[writingId]?.score ?? "",
        feedback: current[writingId]?.feedback ?? "",
        [field]: value,
      },
    }));

    setWritingSaveMessage((current) => ({
      ...current,
      [writingId]: "",
    }));

    setWritingSaveError((current) => ({
      ...current,
      [writingId]: "",
    }));
  }

  async function saveWritingGrade(writing: WritingResponse) {
    const draft = writingDrafts[writing.id] ?? {
      score: "",
      feedback: "",
    };

    const scoreText = draft.score.trim();

    let score: number | null = null;

    if (scoreText !== "") {
      score = Number(scoreText);

      if (!Number.isFinite(score) || score < 0) {
        setWritingSaveError((current) => ({
          ...current,
          [writing.id]:
            "Score must be a valid non-negative number.",
        }));
        return;
      }

      if (
        writing.max_score !== null &&
        score > Number(writing.max_score)
      ) {
        setWritingSaveError((current) => ({
          ...current,
          [writing.id]: `Score cannot exceed ${writing.max_score}.`,
        }));
        return;
      }
    }

    try {
      setSavingWritingId(writing.id);

      setWritingSaveMessage((current) => ({
        ...current,
        [writing.id]: "",
      }));

      setWritingSaveError((current) => ({
        ...current,
        [writing.id]: "",
      }));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response = await fetch(
        `/api/results/${params.attemptId}/writing`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            writing_response_id: writing.id,
            score,
            feedback: draft.feedback,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save writing grade."
        );
      }

      const updatedWriting =
        result.writingResponse as WritingResponse;

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          writingResponses: current.writingResponses.map(
            (item) =>
              item.id === updatedWriting.id
                ? updatedWriting
                : item
          ),
        };
      });

      setWritingDrafts((current) => ({
        ...current,
        [writing.id]: {
          score:
            updatedWriting.score === null ||
            updatedWriting.score === undefined
              ? ""
              : String(updatedWriting.score),
          feedback: updatedWriting.feedback ?? "",
        },
      }));

      setWritingSaveMessage((current) => ({
        ...current,
        [writing.id]: "Saved successfully.",
      }));
    } catch (err) {
      console.error("Writing grade save error:", err);

      setWritingSaveError((current) => ({
        ...current,
        [writing.id]:
          err instanceof Error
            ? err.message
            : "Unable to save writing grade.",
      }));
    } finally {
      setSavingWritingId(null);
    }
  }

  function getWritingTask(writingTaskId: string) {
  return (
    data?.writingTasks.find(
      (task) => task.id === writingTaskId
    ) ?? null
  );
}

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          <main className="flex-1 p-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex min-h-64 items-center justify-center">
                <p className="text-sm text-slate-400">
                  Loading result...
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          <main className="flex-1 p-8">
            <div className="mx-auto max-w-7xl">
              <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5">
                <h1 className="font-semibold text-red-800">
                  Unable to load result
                </h1>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const {
  attempt,
  writingTasks,
  writingResponses,
} = data;

  const sections = ["A1", "A2", "B1", "B2"].map((level) => ({
    level,
    stats: getSectionStats(level),
  }));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <Link
                href="/results"
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                ← Back to Results
              </Link>

              <div className="mt-4">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Result Detail
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Review the candidate&apos;s placement test.
                </p>
              </div>
            </div>

            {/* Candidate information */}

            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Candidate
                </h2>
              </div>

              <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Name
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {attempt.candidates?.full_name ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Email
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {attempt.candidates?.email ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Team
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {attempt.candidates?.team ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Campaign
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {attempt.campaigns?.name ?? "—"}
                  </p>
                </div>
              </div>
            </section>

            {/* Overall result */}

            <section className="mt-6 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Overall Result
                </h2>
              </div>

              <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Score
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {attempt.total_score ?? "—"}
                    {attempt.max_score !== null &&
                      ` / ${attempt.max_score}`}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Percentage
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatPercentage(attempt.percentage)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <p className="mt-2 text-lg font-medium capitalize text-slate-900">
                    {attempt.status}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Submitted
                  </p>

                  <p className="mt-2 text-sm text-slate-700">
                    {formatDate(attempt.submitted_at)}
                  </p>
                </div>
              </div>

              {attempt.diagnosis && (
                <div className="border-t border-slate-200 px-6 py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Recorded Level / Diagnosis
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {attempt.diagnosis}
                  </p>
                </div>
              )}
            </section>

            {/* CEFR sections */}

            <section className="mt-6">
              <div className="mb-4">
                <h2 className="font-semibold text-slate-900">
                  Test Sections
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Section performance based on recorded answers.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {sections.map(({ level, stats }) => (
                  <div
                    key={level}
                    className="rounded-xl border border-slate-200 bg-white p-6"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {level}
                      </h3>

                      <span className="text-xs text-slate-400">
                        {stats.total} questions
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-semibold text-slate-900">
                      {stats.correct} / {stats.total}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Correct answers
                    </p>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-400">
                        Points earned
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {stats.points}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Question Review */}

            <section className="mt-8 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Question Review
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review every question, the candidate&apos;s answer,
                  and the correct answer.
                </p>
              </div>

              <div className="divide-y divide-slate-200">
                {data.attemptQuestions.map((question) => {
                  const answer = getAnswer(question.id);

                  const options = getOptions(
                    question.question_id ?? ""
                  );

                  const correctOptionId = getCorrectOptionId(
                    question.question_id ?? ""
                  );

                  const status = getQuestionStatus(question);

                  return (
                    <div key={question.id} className="p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-900">
                            Q{question.question_number}
                          </span>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {question.question_bank?.cefr_level ?? "—"}
                          </span>

                          <span className="text-xs text-slate-400">
                            {question.question_bank?.skill ?? "—"}
                          </span>
                        </div>

                        {status === "correct" && (
                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                            ✓ Correct
                          </span>
                        )}

                        {status === "incorrect" && (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            ✕ Incorrect
                          </span>
                        )}

                        {status === "unanswered" && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            Not answered
                          </span>
                        )}
                      </div>

                      <div className="mt-5">
                        <p className="text-base font-medium leading-7 text-slate-900">
                          {question.question_bank?.question_text ??
                            "Question unavailable."}
                        </p>

                        {question.question_bank?.instruction && (
                          <p className="mt-2 text-sm italic text-slate-500">
                            {question.question_bank.instruction}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 space-y-2">
                        {options.map((option) => {
                          const isSelected =
                            answer?.selected_option_id === option.id;

                          const isCorrect =
                            correctOptionId === option.id;

                          let optionClass =
                            "border-slate-200 bg-white";

                          if (isCorrect) {
                            optionClass =
                              "border-green-300 bg-green-50";
                          } else if (
                            isSelected &&
                            !isCorrect
                          ) {
                            optionClass =
                              "border-red-300 bg-red-50";
                          }

                          return (
                            <div
                              key={option.id}
                              className={`rounded-lg border px-4 py-3 ${optionClass}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="font-semibold text-slate-700">
                                  {option.option_key}.
                                </span>

                                <span className="flex-1 text-sm leading-6 text-slate-700">
                                  {option.option_text}
                                </span>

                                <div className="flex shrink-0 gap-2">
                                  {isSelected && (
                                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                                      Student
                                    </span>
                                  )}

                                  {isCorrect && (
                                    <span className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {answer?.answer_text && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Student Answer
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {answer.answer_text}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs text-slate-400">
                          Points earned
                        </span>

                        <span className="text-sm font-semibold text-slate-700">
                          {answer?.points_earned ?? 0}
                          {" / "}
                          {question.question_bank?.points ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Writing */}

            <section className="mt-8 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Writing
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review the candidate&apos;s writing and enter a score
                  and teacher feedback.
                </p>
              </div>

              {writingResponses.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-slate-400">
                    No writing response recorded.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {writingResponses.map((writing) => {
                    const draft = writingDrafts[writing.id] ?? {
                      score:
                        writing.score === null ||
                        writing.score === undefined
                          ? ""
                          : String(writing.score),
                      feedback: writing.feedback ?? "",
                    };

                    const isSaving =
                      savingWritingId === writing.id;

                    const saveMessage =
                      writingSaveMessage[writing.id];

                    const saveError =
                      writingSaveError[writing.id];

                    return (
                      <div key={writing.id} className="p-6">
                        {/* Writing Task */}

{(() => {
  const writingTask = getWritingTask(
    writing.writing_task_id
  );

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Writing Task
        </p>

        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          {writingTask?.title ?? "Writing task unavailable"}
        </h3>
      </div>

      {writingTask?.prompt && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Prompt
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {writingTask.prompt}
          </p>
        </div>
      )}

      {writingTask?.instructions && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Instructions
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {writingTask.instructions}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-5 border-t border-slate-200 pt-4 text-xs text-slate-500">
        {writingTask?.word_limit_min !== null &&
          writingTask?.word_limit_min !== undefined && (
            <span>
              Minimum:{" "}
              <strong className="text-slate-700">
                {writingTask.word_limit_min} words
              </strong>
            </span>
          )}

        {writingTask?.word_limit_max !== null &&
          writingTask?.word_limit_max !== undefined && (
            <span>
              Maximum:{" "}
              <strong className="text-slate-700">
                {writingTask.word_limit_max} words
              </strong>
            </span>
          )}

        {writingTask?.time_limit_minutes !== null &&
          writingTask?.time_limit_minutes !== undefined && (
            <span>
              Time limit:{" "}
              <strong className="text-slate-700">
                {writingTask.time_limit_minutes} minutes
              </strong>
            </span>
          )}
      </div>
    </div>
  );
})()}
                        {/* Writing metadata */}

                        <div className="grid gap-6 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Word Count
                            </p>

                            <p className="mt-1 font-medium text-slate-900">
                              {writing.word_count ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Current Score
                            </p>

                            <p className="mt-1 font-medium text-slate-900">
                              {writing.score ?? "Not graded"}
                              {writing.max_score !== null &&
                                ` / ${writing.max_score}`}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Grading Status
                            </p>

                            <p className="mt-1 font-medium capitalize text-slate-900">
                              {writing.grading_status}
                            </p>
                          </div>
                        </div>

                        {/* Student response */}

                        <div className="mt-6">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Student Response
                          </p>

                          <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                            {writing.response_text ||
                              "No response recorded."}
                          </div>
                        </div>

                        {/* Grading area */}

                        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                          <div className="mb-5">
                            <h3 className="text-sm font-semibold text-slate-900">
                              Teacher Grading
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Enter the writing score and optional feedback.
                            </p>
                          </div>

                          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                            {/* Score */}

                            <div>
                              <label
                                htmlFor={`writing-score-${writing.id}`}
                                className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                              >
                                Score
                              </label>

                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  id={`writing-score-${writing.id}`}
                                  type="number"
                                  min="0"
                                  max={
                                    writing.max_score !== null
                                      ? writing.max_score
                                      : undefined
                                  }
                                  step="0.5"
                                  value={draft.score}
                                  onChange={(event) =>
                                    updateWritingDraft(
                                      writing.id,
                                      "score",
                                      event.target.value
                                    )
                                  }
                                  placeholder="0"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                />

                                {writing.max_score !== null && (
                                  <span className="shrink-0 text-sm text-slate-500">
                                    / {writing.max_score}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Feedback */}

                            <div>
                              <label
                                htmlFor={`writing-feedback-${writing.id}`}
                                className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                              >
                                Teacher Feedback
                              </label>

                              <textarea
                                id={`writing-feedback-${writing.id}`}
                                rows={5}
                                value={draft.feedback}
                                onChange={(event) =>
                                  updateWritingDraft(
                                    writing.id,
                                    "feedback",
                                    event.target.value
                                  )
                                }
                                placeholder="Enter feedback for the candidate..."
                                className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                              />
                            </div>
                          </div>

                          {/* Save area */}

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                            <div>
                              {saveError && (
                                <p className="text-sm font-medium text-red-600">
                                  {saveError}
                                </p>
                              )}

                              {!saveError && saveMessage && (
                                <p className="text-sm font-medium text-green-600">
                                  ✓ {saveMessage}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                saveWritingGrade(writing)
                              }
                              disabled={isSaving}
                              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSaving
                                ? "Saving..."
                                : writing.grading_status === "graded"
                                  ? "Update Grade"
                                  : "Save Grade"}
                            </button>
                          </div>
                        </div>

                        {/* Existing feedback */}

                        {writing.feedback && (
                          <div className="mt-6">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Saved Teacher Feedback
                            </p>

                            <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                              {writing.feedback}
                            </div>
                          </div>
                        )}

                        {writing.graded_at && (
                          <p className="mt-4 text-xs text-slate-400">
                            Last graded:{" "}
                            {formatDate(writing.graded_at)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

                        {/* Anti-Cheating */}

            <section className="mt-8 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Anti-Cheating
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Review recorded anti-cheating events during the test.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        attempt.is_suspicious
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {attempt.is_suspicious
                        ? "Suspicious activity detected"
                        : "No suspicious activity flagged"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}

              <div className="grid gap-4 border-b border-slate-200 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Tab / Window Switch
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {incidentCounts.tabSwitch}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Recorded incidents
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Copy
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {incidentCounts.copy}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Recorded incidents
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Paste
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {incidentCounts.paste}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Recorded incidents
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Fullscreen Exit
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {incidentCounts.fullscreenExit}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Recorded incidents
                  </p>
                </div>
              </div>

              {/* Event counters from attempt */}

              <div className="grid gap-4 border-b border-slate-200 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Tab Switch Count
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {attempt.tab_switch_count}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Blur Count
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {attempt.blur_count}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Copy Count
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {attempt.copy_count}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Paste Count
                  </p>

                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {attempt.paste_count}
                  </p>
                </div>
              </div>

              {/* Fullscreen */}

              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Fullscreen Exits
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Number of times the candidate exited fullscreen mode.
                    </p>
                  </div>

                  <p className="text-lg font-semibold text-slate-900">
                    {attempt.fullscreen_exit_count}
                  </p>
                </div>
              </div>

              {/* Incident list */}

              <div>
                <div className="border-b border-slate-200 px-6 py-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Incident Log
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Events occurring within a short window are grouped
                    together when appropriate.
                  </p>
                </div>

                {incidents.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                      <span className="text-xl text-green-600">
                        ✓
                      </span>
                    </div>

                    <p className="mt-4 text-sm font-medium text-slate-900">
                      No anti-cheating incidents recorded
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      No tab switches, copy/paste actions, or fullscreen
                      exits were recorded for this attempt.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {incidents.map((incident, index) => {
                      const hasWindowSwitch =
                        incident.event_types.includes("tab_switch") ||
                        incident.event_types.includes("blur");

                      const hasCopy =
                        incident.event_types.includes("copy");

                      const hasPaste =
                        incident.event_types.includes("paste");

                      const hasFullscreenExit =
                        incident.event_types.includes(
                          "fullscreen_exit"
                        );

                      return (
                        <div
                          key={incident.id}
                          className="px-6 py-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-4">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                {incidents.length - index}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap gap-2">
                                  {hasWindowSwitch && (
                                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                      Window / Tab Switch
                                    </span>
                                  )}

                                  {hasCopy && (
                                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                                      Copy
                                    </span>
                                  )}

                                  {hasPaste && (
                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                      Paste
                                    </span>
                                  )}

                                  {hasFullscreenExit && (
                                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                                      Fullscreen Exit
                                    </span>
                                  )}

                                  {incident.event_types
                                    .filter(
                                      (eventType) =>
                                        ![
                                          "tab_switch",
                                          "blur",
                                          "copy",
                                          "paste",
                                          "fullscreen_exit",
                                        ].includes(eventType)
                                    )
                                    .map((eventType) => (
                                      <span
                                        key={eventType}
                                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                                      >
                                        {eventType}
                                      </span>
                                    ))}
                                </div>

                                <p className="mt-2 text-sm text-slate-700">
                                  {incident.event_types
                                    .map((eventType) =>
                                      eventType.replaceAll("_", " ")
                                    )
                                    .join(" + ")}
                                </p>

                                {incident.metadata.length > 0 && (
                                  <details className="mt-3">
                                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                                      View event details
                                    </summary>

                                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                                        {JSON.stringify(
                                          incident.metadata,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-xs font-medium text-slate-400">
                                Recorded
                              </p>

                              <p className="mt-1 text-sm text-slate-700">
                                {formatDate(incident.occurred_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Attempt timing */}

            <section className="mt-8 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Attempt Timing
                </h2>
              </div>

              <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Started
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(attempt.started_at)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Submitted
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(attempt.submitted_at)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Duration
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {attempt.duration_seconds !== null
                      ? `${Math.floor(
                          attempt.duration_seconds / 60
                        )} min ${
                          attempt.duration_seconds % 60
                        } sec`
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Attempt Status
                  </p>

                  <p className="mt-1 text-sm font-medium capitalize text-slate-700">
                    {attempt.status}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}