import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const attemptId = String(body.attemptId ?? "").trim();
    const attemptQuestionId = String(
      body.attemptQuestionId ?? ""
    ).trim();

    const selectedOptionId =
      body.selectedOptionId
        ? String(body.selectedOptionId).trim()
        : null;

    const answerText =
      typeof body.answerText === "string"
        ? body.answerText
        : null;

    if (!attemptId || !attemptQuestionId) {
      return NextResponse.json(
        {
          error:
            "Attempt ID and attempt question ID are required.",
        },
        { status: 400 }
      );
    }

    if (!selectedOptionId && !answerText?.trim()) {
      return NextResponse.json(
        {
          error: "An answer is required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Verify attempt
    // ---------------------------------------------------------

    const { data: attempt, error: attemptError } =
      await supabaseAdmin
        .from("test_attempts")
        .select(
          `
          id,
          status,
          expires_at
        `
        )
        .eq("id", attemptId)
        .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        {
          error: "Test attempt not found.",
        },
        { status: 404 }
      );
    }

    if (
      attempt.status !== "in_progress" &&
      attempt.status !== "started"
    ) {
      return NextResponse.json(
        {
          error: "This test attempt is no longer active.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 2. Verify attempt question
    // ---------------------------------------------------------

    const { data: attemptQuestion, error: attemptQuestionError } =
      await supabaseAdmin
        .from("attempt_questions")
        .select(
          `
          id,
          attempt_id,
          question_id,
          writing_task_id
        `
        )
        .eq("id", attemptQuestionId)
        .eq("attempt_id", attemptId)
        .single();

    if (attemptQuestionError || !attemptQuestion) {
      return NextResponse.json(
        {
          error: "Test question not found.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 3. Validate answer type
    // ---------------------------------------------------------

    if (
      attemptQuestion.writing_task_id &&
      !answerText?.trim()
    ) {
      return NextResponse.json(
        {
          error: "Writing answer cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (
      attemptQuestion.question_id &&
      !selectedOptionId
    ) {
      return NextResponse.json(
        {
          error: "Please select an answer.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 4. Verify selected option belongs to this question
    // ---------------------------------------------------------

    if (
      attemptQuestion.question_id &&
      selectedOptionId
    ) {
      const { data: option, error: optionError } =
        await supabaseAdmin
          .from("question_options")
          .select("id")
          .eq("id", selectedOptionId)
          .eq(
            "question_id",
            attemptQuestion.question_id
          )
          .single();

      if (optionError || !option) {
        return NextResponse.json(
          {
            error: "Invalid answer option.",
          },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------------------
    // 5. Check existing answer
    // ---------------------------------------------------------

    const { data: existingAnswer, error: existingAnswerError } =
      await supabaseAdmin
        .from("attempt_answers")
        .select(
          `
          id
        `
        )
        .eq("attempt_question_id", attemptQuestionId)
        .maybeSingle();

    if (existingAnswerError) {
      console.error(
        "Existing answer lookup error:",
        existingAnswerError
      );

      return NextResponse.json(
        {
          error: "Unable to check existing answer.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 6. Update existing answer
    // ---------------------------------------------------------

    if (existingAnswer) {
      const { data: updatedAnswer, error: updateError } =
        await supabaseAdmin
          .from("attempt_answers")
          .update({
            selected_option_id: selectedOptionId,
            answer_text:
              answerText?.trim() || null,
            answered_at: new Date().toISOString(),
          })
          .eq("id", existingAnswer.id)
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
          .single();

      if (updateError || !updatedAnswer) {
        console.error(
          "Answer update error:",
          updateError
        );

        return NextResponse.json(
          {
            error: "Unable to save answer.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "updated",
        answer: updatedAnswer,
      });
    }

    // ---------------------------------------------------------
    // 7. Create new answer
    // ---------------------------------------------------------

    const { data: newAnswer, error: insertError } =
      await supabaseAdmin
        .from("attempt_answers")
        .insert({
          attempt_question_id: attemptQuestionId,
          selected_option_id: selectedOptionId,
          answer_text:
            answerText?.trim() || null,
          answered_at: new Date().toISOString(),
        })
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
        .single();

    if (insertError || !newAnswer) {
      console.error(
        "Answer insert error:",
        insertError
      );

      return NextResponse.json(
        {
          error: "Unable to save answer.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "created",
      answer: newAnswer,
    });
  } catch (error) {
    console.error("Save answer error:", error);

    return NextResponse.json(
      {
        error: "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
