import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Section = {
  id: string;
  title: string;
  order_number: number;
  question_count: number;
};

type Question = {
  id: string;
  skill: string;
  cefr_level: string;
  question_type: string;
  question_text: string;
  instruction: string | null;
  points: number;
  passage_id: string | null;
};

type Option = {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  order_number: number;
};
type AttemptQuestion = {
  id: string;
  question_id: string | null;
  writing_task_id: string | null;
  question_number: number;
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
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const candidateId = String(body.candidateId ?? "").trim();
    const campaignId = String(body.campaignId ?? "").trim();
    const testId = String(body.testId ?? "").trim();

    if (!candidateId || !campaignId || !testId) {
      return NextResponse.json(
        {
          error: "Candidate, campaign, and test information are required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Check existing attempts
    // ---------------------------------------------------------

    const { data: existingAttempts, error: existingAttemptError } =
      await supabaseAdmin
        .from("test_attempts")
        .select(
          `
          id,
          candidate_id,
          campaign_id,
          test_id,
          status,
          started_at,
          expires_at
        `
        )
        .eq("candidate_id", candidateId)
        .eq("campaign_id", campaignId)
        .eq("test_id", testId)
        .order("created_at", { ascending: false });

    if (existingAttemptError) {
      console.error(
        "Existing attempt lookup error:",
        existingAttemptError
      );

      return NextResponse.json(
        { error: "Unable to check existing test attempt." },
        { status: 500 }
      );
    }

    const activeAttempt = existingAttempts?.find(
      (attempt) =>
        attempt.status === "started" ||
        attempt.status === "in_progress"
    );

    // ---------------------------------------------------------
    // 2. Resume existing attempt
    // ---------------------------------------------------------

    if (activeAttempt) {
      const { data: existingQuestions, error: existingQuestionsError } =
        await supabaseAdmin
          .from("attempt_questions")
          .select(
            `
            id,
            question_id,
            writing_task_id,
            question_number
          `
          )
          .eq("attempt_id", activeAttempt.id)
          .order("question_number", { ascending: true });

      if (existingQuestionsError) {
        console.error(
          "Existing attempt questions error:",
          existingQuestionsError
        );

        return NextResponse.json(
          { error: "Unable to load your existing test questions." },
          { status: 500 }
        );
      }

      if (!existingQuestions || existingQuestions.length === 0) {
        return NextResponse.json(
          {
            error:
              "Your active attempt has no questions. Please contact the administrator.",
          },
          { status: 500 }
        );
      }

      const questionIds = existingQuestions
  .map((question) => question.question_id)
  .filter((id): id is string => Boolean(id));

const writingTaskId = existingQuestions.find(
  (question) => question.writing_task_id
)?.writing_task_id;

const questions = await loadQuestions(questionIds);
const options = await loadOptions(questionIds);

let writingTask: WritingTask | null = null;

if (writingTaskId) {
  const { data: writingTaskData, error: writingTaskError } =
    await supabaseAdmin
      .from("writing_tasks")
      .select(
        `
        id,
        title,
        prompt,
        instructions,
        word_limit_min,
        word_limit_max,
        time_limit_minutes,
        points
      `
      )
      .eq("id", writingTaskId)
      .maybeSingle();

  if (writingTaskError) {
    console.error(
      "Writing task resume lookup error:",
      writingTaskError
    );

    return NextResponse.json(
      { error: "Unable to load the writing task." },
      { status: 500 }
    );
  }

  writingTask = writingTaskData as WritingTask | null;
}

if (writingTaskId) {
  const { data, error } = await supabaseAdmin
    .from("writing_tasks")
    .select(
      `
      id,
      title,
      prompt,
      instructions,
      word_limit_min,
      word_limit_max,
      time_limit_minutes,
      points
    `
    )
    .eq("id", writingTaskId)
    .single();

  if (error) {
    console.error("Writing task resume lookup error:", error);

    return NextResponse.json(
      { error: "Unable to load your writing task." },
      { status: 500 }
    );
  }

  writingTask = data as WritingTask;
}

      return NextResponse.json({
        success: true,
        mode: "resume",
        attempt: {
          id: activeAttempt.id,
          status: activeAttempt.status,
          startedAt: activeAttempt.started_at,
          expiresAt: activeAttempt.expires_at,
        },
        questions: buildQuestionResponse(
          existingQuestions,
          questions,
          options,
          writingTask
        ),
      });
    }

    // ---------------------------------------------------------
    // 3. Check submitted attempt
    // ---------------------------------------------------------

    const submittedAttempt = existingAttempts?.find(
      (attempt) => attempt.status === "submitted"
    );

    if (submittedAttempt) {
      return NextResponse.json(
        {
          error: "You have already completed this test.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 4. Verify test
    // ---------------------------------------------------------

    const { data: test, error: testError } = await supabaseAdmin
      .from("tests")
      .select(
        `
        id,
        title,
        duration_minutes,
        total_questions,
        is_active
      `
      )
      .eq("id", testId)
      .eq("is_active", true)
      .maybeSingle();

    if (testError) {
      console.error("Test lookup error:", testError);

      return NextResponse.json(
        { error: "Unable to load the test." },
        { status: 500 }
      );
    }

    if (!test) {
      return NextResponse.json(
        { error: "Test not found or inactive." },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 5. Load test sections
    // ---------------------------------------------------------

    const { data: sections, error: sectionsError } =
      await supabaseAdmin
        .from("test_sections")
        .select(
          `
          id,
          title,
          order_number,
          question_count
        `
        )
        .eq("test_id", testId)
        .order("order_number", { ascending: true });

    if (sectionsError) {
      console.error("Sections lookup error:", sectionsError);

      return NextResponse.json(
        { error: "Unable to load test sections." },
        { status: 500 }
      );
    }

    if (!sections || sections.length === 0) {
      return NextResponse.json(
        { error: "This test has no sections configured." },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 6. Select questions for A1 / A2 / B1 / B2
    // ---------------------------------------------------------

   const selectedQuestions: Question[] = [];
let selectedWritingTask: WritingTask | null = null;

for (const section of sections as Section[]) {
  if (section.title.toLowerCase() === "writing") {
    const { data: writingTasks, error: writingTaskError } =
      await supabaseAdmin
        .from("writing_tasks")
        .select(
          `
          id,
          title,
          prompt,
          instructions,
          word_limit_min,
          word_limit_max,
          time_limit_minutes,
          points
        `
        )
        .eq("is_active", true);

    if (writingTaskError) {
      console.error("Writing task lookup error:", writingTaskError);

      return NextResponse.json(
        { error: "Unable to load writing task." },
        { status: 500 }
      );
    }

    if (!writingTasks || writingTasks.length === 0) {
      return NextResponse.json(
        { error: "No active writing task is available." },
        { status: 500 }
      );
    }

    const shuffledWritingTasks = [...writingTasks].sort(
      () => Math.random() - 0.5
    );

    selectedWritingTask =
      shuffledWritingTasks[0] as WritingTask;

    continue;
  }

  const { data: questionPool, error: questionError } =
        await supabaseAdmin
          .from("question_bank")
          .select(
            `
            id,
            skill,
            cefr_level,
            question_type,
            question_text,
            instruction,
            points,
            passage_id
          `
          )
          .eq("cefr_level", section.title)
          .eq("is_active", true)
          .order("created_at", { ascending: true });

      if (questionError) {
        console.error(
          `Question pool error for ${section.title}:`,
          questionError
        );

        return NextResponse.json(
          {
            error: `Unable to load questions for section ${section.title}.`,
          },
          { status: 500 }
        );
      }

      if (!questionPool || questionPool.length < section.question_count) {
        return NextResponse.json(
          {
            error: `Not enough questions available for section ${section.title}.`,
          },
          { status: 500 }
        );
      }

      const shuffled = [...questionPool].sort(
        () => Math.random() - 0.5
      );

      selectedQuestions.push(
        ...(shuffled.slice(0, section.question_count) as Question[])
      );
    }

    // ---------------------------------------------------------
    // 7. Validate MCQ count
    // ---------------------------------------------------------

    if (selectedQuestions.length !== 45) {
      return NextResponse.json(
        {
          error: `Expected 45 multiple-choice questions, but selected ${selectedQuestions.length}.`,
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 8. Shuffle final order
    // ---------------------------------------------------------

    const finalQuestions = [...selectedQuestions].sort(
      () => Math.random() - 0.5
    );

    // ---------------------------------------------------------
    // 9. Create test attempt
    // ---------------------------------------------------------

    const startedAt = new Date();

    const expiresAt = new Date(
      startedAt.getTime() + test.duration_minutes * 60 * 1000
    );

    const { data: attempt, error: attemptCreateError } =
      await supabaseAdmin
        .from("test_attempts")
        .insert({
          candidate_id: candidateId,
          campaign_id: campaignId,
          test_id: testId,
          login_method: "candidate_test_access",
          status: "in_progress",
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          duration_seconds: test.duration_minutes * 60,
        })
        .select(
          `
          id,
          candidate_id,
          campaign_id,
          test_id,
          status,
          started_at,
          expires_at
        `
        )
        .single();

    if (attemptCreateError || !attempt) {
      console.error("Attempt creation error:", {
        message: attemptCreateError?.message,
        details: attemptCreateError?.details,
        hint: attemptCreateError?.hint,
        code: attemptCreateError?.code,
      });

      return NextResponse.json(
        { error: "Unable to start the test." },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 10. Create attempt_questions
    // ---------------------------------------------------------

    const attemptQuestionRows: {
  attempt_id: string;
  question_id: string | null;
  writing_task_id: string | null;
  question_number: number;
}[] = finalQuestions.map((question, index) => ({
  attempt_id: attempt.id,
  question_id: question.id,
  writing_task_id: null,
  question_number: index + 1,
}));

if (selectedWritingTask) {
  attemptQuestionRows.push({
    attempt_id: attempt.id,
    question_id: null,
    writing_task_id: selectedWritingTask.id,
    question_number: finalQuestions.length + 1,
  });
}

   const { data: attemptQuestions, error: attemptQuestionsError } =
  await supabaseAdmin
    .from("attempt_questions")
    .insert(attemptQuestionRows)
    .select(
      `
      id,
      question_id,
      writing_task_id,
      question_number
    `
    )
    .order("question_number", { ascending: true });

    if (attemptQuestionsError || !attemptQuestions) {
      console.error(
        "Attempt questions creation error:",
        attemptQuestionsError
      );

      await supabaseAdmin
        .from("test_attempts")
        .delete()
        .eq("id", attempt.id);

      return NextResponse.json(
        { error: "Unable to create the test question set." },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 11. Load options
    // ---------------------------------------------------------

    const questionIds = finalQuestions.map(
      (question) => question.id
    );

    const options = await loadOptions(questionIds);

    // ---------------------------------------------------------
    // 12. Return questions
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      mode: "new",
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
      },
      questions: buildQuestionResponse(
        attemptQuestions,
        finalQuestions,
        options,
        selectedWritingTask
      ),
    });
  } catch (error) {
    console.error("Test start error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

// =============================================================
// Load questions
// =============================================================

async function loadQuestions(questionIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from("question_bank")
    .select(
      `
      id,
      skill,
      cefr_level,
      question_type,
      question_text,
      instruction,
      points,
      passage_id
    `
    )
    .in("id", questionIds);

  if (error) {
    throw new Error(
      `Unable to load existing questions: ${error.message}`
    );
  }

  return (data ?? []) as Question[];
}

// =============================================================
// Load options
// =============================================================

async function loadOptions(questionIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from("question_options")
    .select(
      `
      id,
      question_id,
      option_key,
      option_text,
      order_number
    `
    )
    .in("question_id", questionIds)
    .order("order_number", { ascending: true });

  if (error) {
    throw new Error(
      `Unable to load question options: ${error.message}`
    );
  }

  return (data ?? []) as Option[];
}

// =============================================================
// Build frontend-safe response
// =============================================================

function buildQuestionResponse(
  attemptQuestions: AttemptQuestion[],
  questions: Question[],
  options: Option[],
  writingTask: WritingTask | null
) {
  const questionMap = new Map(
    questions.map((question) => [question.id, question])
  );

  const optionsMap = new Map<string, Option[]>();

  for (const option of options) {
    const existing = optionsMap.get(option.question_id) ?? [];
    existing.push(option);
    optionsMap.set(option.question_id, existing);
  }

  return attemptQuestions
    .map((attemptQuestion) => {
      // ---------------------------------------------------------
      // Writing question
      // ---------------------------------------------------------

      if (attemptQuestion.writing_task_id) {
        if (
          !writingTask ||
          attemptQuestion.writing_task_id !== writingTask.id
        ) {
          return null;
        }

    return {
  attemptQuestionId: attemptQuestion.id,
  questionId: null,
  writingTaskId: writingTask.id,
  questionNumber: attemptQuestion.question_number,
  skill: "Writing",
  cefrLevel: null,
  questionType: "writing",
  questionText: writingTask.prompt,
  instruction: writingTask.instructions,
  points: writingTask.points,
  writingTask: {
    id: writingTask.id,
    title: writingTask.title,
    prompt: writingTask.prompt,
    instructions: writingTask.instructions,
    wordLimitMin: writingTask.word_limit_min,
    wordLimitMax: writingTask.word_limit_max,
    timeLimitMinutes: writingTask.time_limit_minutes,
  },
  options: [],
};
      }

      // ---------------------------------------------------------
      // Multiple-choice question
      // ---------------------------------------------------------

      if (!attemptQuestion.question_id) {
        return null;
      }

      const question = questionMap.get(
        attemptQuestion.question_id
      );

      if (!question) {
        return null;
      }

      return {
        attemptQuestionId: attemptQuestion.id,
        questionId: question.id,
        writingTaskId: null,
        questionNumber: attemptQuestion.question_number,
        skill: question.skill,
        cefrLevel: question.cefr_level,
        questionType: question.question_type,
        questionText: question.question_text,
        instruction: question.instruction,
        points: question.points,
        writingTask: null,
        options: (optionsMap.get(question.id) ?? []).map(
          (option) => ({
            id: option.id,
            key: option.option_key,
            text: option.option_text,
            orderNumber: option.order_number,
          })
        ),
      };
    })
    .filter(
      (
        question
      ): question is NonNullable<typeof question> =>
        question !== null
    );
}
