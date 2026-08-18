import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const attemptId = String(body.attemptId ?? "").trim();

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required." },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Verify attempt
    // ---------------------------------------------------------

    const { data: attempt, error: attemptError } =
      await supabaseAdmin
        .from("test_attempts")
        .select(`
          id,
          status,
          expires_at
        `)
        .eq("id", attemptId)
        .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Test attempt not found." },
        { status: 404 }
      );
    }

    if (
      attempt.status !== "in_progress" &&
      attempt.status !== "started"
    ) {
      return NextResponse.json(
        { error: "This test attempt cannot be submitted." },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 2. Check that all questions have answers
    // ---------------------------------------------------------

    const { data: attemptQuestions, error: questionsError } =
      await supabaseAdmin
        .from("attempt_questions")
        .select(`
          id
        `)
        .eq("attempt_id", attemptId);

    if (questionsError) {
      console.error(
        "Attempt questions lookup error:",
        questionsError
      );

      return NextResponse.json(
        { error: "Unable to verify test answers." },
        { status: 500 }
      );
    }

    const { data: answers, error: answersError } =
      await supabaseAdmin
        .from("attempt_answers")
        .select(`
          attempt_question_id,
          selected_option_id,
          answer_text
        `)
        .in(
          "attempt_question_id",
          (attemptQuestions ?? []).map((question) => question.id)
        );

    if (answersError) {
      console.error(
        "Attempt answers lookup error:",
        answersError
      );

      return NextResponse.json(
        { error: "Unable to verify test answers." },
        { status: 500 }
      );
    }

    const answeredQuestionIds = new Set(
      (answers ?? [])
        .filter(
          (answer) =>
            answer.selected_option_id ||
            answer.answer_text?.trim()
        )
        .map((answer) => answer.attempt_question_id)
    );

    const unansweredQuestions = (
      attemptQuestions ?? []
    ).filter(
      (question) => !answeredQuestionIds.has(question.id)
    );

    if (unansweredQuestions.length > 0) {
      return NextResponse.json(
        {
          error: "Please answer all questions before submitting the test.",
          unansweredCount: unansweredQuestions.length,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 3. Submit attempt
    // ---------------------------------------------------------

    const { data: submittedAttempt, error: updateError } =
      await supabaseAdmin
        .from("test_attempts")
        .update({
          status: "submitted",
        })
        .eq("id", attemptId)
        .select(`
          id,
          status
        `)
        .single();

    if (updateError || !submittedAttempt) {
      console.error(
        "Test submit update error:",
        updateError
      );

      return NextResponse.json(
        { error: "Unable to submit the test." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test submitted successfully.",
      attempt: submittedAttempt,
    });
  } catch (error) {
    console.error("Test submit error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}