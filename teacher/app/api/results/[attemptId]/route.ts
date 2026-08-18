import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error: "Supabase environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Teacher profile not found." },
        { status: 403 }
      );
    }

    if (profile.role !== "teacher" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Teacher access required." },
        { status: 403 }
      );
    }

    const { attemptId } = await context.params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required." },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 1. TEST ATTEMPT
     * ---------------------------------------------------------
     */

    const { data: attempt, error: attemptError } = await supabase
      .from("test_attempts")
      .select(
        `
        id,
        candidate_id,
        campaign_id,
        test_id,
        login_method,
        status,
        started_at,
        submitted_at,
        expires_at,
        duration_seconds,
        total_score,
        max_score,
        percentage,
        diagnosis,
        is_suspicious,
        created_at,
        updated_at,
        tab_switch_count,
        blur_count,
        paste_count,
        copy_count,
        fullscreen_exit_count,
        candidates (
          id,
          full_name,
          email,
          team
        ),
        campaigns (
          id,
          name,
          code,
          description,
          is_active,
          start_at,
          end_at
        )
        `
      )
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      console.error("Attempt query error:", attemptError);

      return NextResponse.json(
        {
          error: "Result not found.",
          details: attemptError?.message,
        },
        { status: 404 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. ATTEMPT QUESTIONS
     * ---------------------------------------------------------
     */

    const { data: attemptQuestions, error: questionsError } =
      await supabase
        .from("attempt_questions")
        .select(
          `
          id,
          attempt_id,
          question_id,
          question_number,
          writing_task_id,
          created_at,
          question_bank (
            id,
            skill,
            cefr_level,
            question_type,
            question_text,
            instruction,
            points,
            passage_id
          )
          `
        )
        .eq("attempt_id", attemptId)
        .order("question_number", {
          ascending: true,
        });

    if (questionsError) {
      console.error(
        "Attempt questions error:",
        questionsError
      );

      return NextResponse.json(
        {
          error: "Unable to load test questions.",
          details: questionsError.message,
        },
        { status: 500 }
      );
    }
/*
 * ---------------------------------------------------------
 * 2B. WRITING TASKS
 * ---------------------------------------------------------
 */

const writingTaskIds = Array.from(
  new Set(
    (attemptQuestions ?? [])
      .map((question) => question.writing_task_id)
      .filter(
        (id): id is string => Boolean(id)
      )
  )
);

let writingTasks: Array<{
  id: string;
  title: string;
  prompt: string;
  instructions: string | null;
  word_limit_min: number | null;
  word_limit_max: number | null;
  time_limit_minutes: number | null;
  points: number;
  is_active: boolean;
}> = [];

if (writingTaskIds.length > 0) {
  const {
    data: writingTaskData,
    error: writingTasksError,
  } = await supabase
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
      points,
      is_active
      `
    )
    .in("id", writingTaskIds);

  if (writingTasksError) {
    console.error(
      "Writing tasks error:",
      writingTasksError
    );

    return NextResponse.json(
      {
        error: "Unable to load writing task.",
        details: writingTasksError.message,
      },
      { status: 500 }
    );
  }

  writingTasks = writingTaskData ?? [];
}
    /*
     * ---------------------------------------------------------
     * /*
 * ---------------------------------------------------------
 *     /*
     * ---------------------------------------------------------
     * 3. ANSWERS
     * ---------------------------------------------------------
     */

    const attemptQuestionIds =
      (attemptQuestions ?? [])
        .map((question) => question.id)
        .filter(Boolean);

    const questionBankIds =
      (attemptQuestions ?? [])
        .map((question) => question.question_id)
        .filter(
          (id): id is string => Boolean(id)
        );

    let answers: unknown[] = [];
    let questionOptions: unknown[] = [];
    let questionAnswers: unknown[] = [];

    /*
     * ---------------------------------------------------------
     * 3A. CANDIDATE ANSWERS
     * ---------------------------------------------------------
     */

    if (attemptQuestionIds.length > 0) {
      const {
        data: answerData,
        error: answersError,
      } = await supabase
        .from("attempt_answers")
        .select(
          `
          id,
          attempt_question_id,
          selected_option_id,
          answer_text,
          is_correct,
          points_earned,
          answered_at
          `
        )
        .in(
          "attempt_question_id",
          attemptQuestionIds
        );

      if (answersError) {
        console.error(
          "Attempt answers error:",
          answersError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load candidate answers.",
            details:
              answersError.message,
          },
          { status: 500 }
        );
      }

      answers = answerData ?? [];
    }

    /*
     * ---------------------------------------------------------
     * 3B. ALL QUESTION OPTIONS
     * ---------------------------------------------------------
     */

    if (questionBankIds.length > 0) {
      const {
        data: optionData,
        error: optionsError,
      } = await supabase
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
        .in(
          "question_id",
          questionBankIds
        )
        .order("order_number", {
          ascending: true,
        });

      if (optionsError) {
        console.error(
          "Question options error:",
          optionsError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load question options.",
            details:
              optionsError.message,
          },
          { status: 500 }
        );
      }

      questionOptions =
        optionData ?? [];
    }

    /*
     * ---------------------------------------------------------
     * 3C. CORRECT ANSWERS
     * ---------------------------------------------------------
     */

    if (questionBankIds.length > 0) {
      const {
        data: correctAnswerData,
        error: correctAnswersError,
      } = await supabase
        .from("question_answers")
        .select(
          `
          id,
          question_id,
          correct_option_id
          `
        )
        .in(
          "question_id",
          questionBankIds
        );

      if (correctAnswersError) {
        console.error(
          "Question answers error:",
          correctAnswersError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load correct answers.",
            details:
              correctAnswersError.message,
          },
          { status: 500 }
        );
      }

      questionAnswers =
        correctAnswerData ?? [];
    }

    /*
     * ---------------------------------------------------------
     * 4. WRITING RESPONSE
     * ---------------------------------------------------------
     */

    const { data: writingResponses, error: writingError } =
      await supabase
        .from("writing_responses")
        .select(
          `
          id,
          attempt_id,
          writing_task_id,
          response_text,
          word_count,
          submitted_at,
          score,
          max_score,
          feedback,
          grading_status,
          graded_by,
          graded_at,
          created_at,
          updated_at
          `
        )
        .eq("attempt_id", attemptId);

    if (writingError) {
      console.error(
        "Writing response error:",
        writingError
      );

      return NextResponse.json(
        {
          error: "Unable to load writing response.",
          details: writingError.message,
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. ANTI-CHEATING EVENTS
     * ---------------------------------------------------------
     */

    const { data: events, error: eventsError } = await supabase
      .from("attempt_events")
      .select(
        `
        id,
        attempt_id,
        event_type,
        occurred_at,
        metadata,
        created_at
        `
      )
      .eq("attempt_id", attemptId)
      .order("occurred_at", {
        ascending: false,
      });

    if (eventsError) {
      console.error(
        "Attempt events error:",
        eventsError
      );

      return NextResponse.json(
        {
          error: "Unable to load anti-cheating events.",
          details: eventsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
  attempt,
  attemptQuestions: attemptQuestions ?? [],
  writingTasks,
  answers,
  questionOptions,
  questionAnswers,
  writingResponses:
    writingResponses ?? [],
  events: events ?? [],
});
  } catch (error) {
    console.error("Result detail API error:", error);

    return NextResponse.json(
      {
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}