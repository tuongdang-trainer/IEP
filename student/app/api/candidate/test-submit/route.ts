import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const attemptId =
      String(body.attemptId ?? "").trim();

    const autoSubmit =
      body.autoSubmit === true;

    if (!attemptId) {
      return NextResponse.json(
        {
          error: "Attempt ID is required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Verify attempt
    // ---------------------------------------------------------

    const {
      data: attempt,
      error: attemptError,
    } = await supabaseAdmin
      .from("test_attempts")
      .select(`
        id,
        status,
        expires_at
      `)
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      console.error(
        "Attempt lookup error:",
        attemptError
      );

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
          error:
            "This test attempt cannot be submitted.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 2. Check expiration
    // ---------------------------------------------------------

    const isExpired =
      attempt.expires_at &&
      new Date(attempt.expires_at).getTime() <=
        Date.now();

    /*
     * If the attempt has expired, it can only be
     * submitted as an automatic timeout submission.
     */
    if (isExpired && !autoSubmit) {
      return NextResponse.json(
        {
          error:
            "The test time has expired. The test must be submitted automatically.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 3. Get all attempt questions
    // ---------------------------------------------------------

    const {
      data: attemptQuestions,
      error: questionsError,
    } = await supabaseAdmin
      .from("attempt_questions")
      .select(`
        id,
        question_id,
        writing_task_id,
        question_number
      `)
      .eq("attempt_id", attemptId)
      .order("question_number", {
        ascending: true,
      });

    if (questionsError) {
      console.error(
        "Attempt questions lookup error:",
        questionsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load test questions.",
        },
        { status: 500 }
      );
    }

    if (
      !attemptQuestions ||
      attemptQuestions.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No test questions found for this attempt.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 4. Get all saved answers
    // ---------------------------------------------------------

    const attemptQuestionIds =
      attemptQuestions.map(
        (question) => question.id
      );

    const {
      data: answers,
      error: answersError,
    } = await supabaseAdmin
      .from("attempt_answers")
      .select(`
        id,
        attempt_question_id,
        selected_option_id,
        answer_text,
        is_correct,
        points_earned,
        answered_at
      `)
      .in(
        "attempt_question_id",
        attemptQuestionIds
      );

    if (answersError) {
      console.error(
        "Attempt answers lookup error:",
        answersError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load test answers.",
        },
        { status: 500 }
      );
    }

    const answerMap = new Map(
      (answers ?? []).map((answer) => [
        answer.attempt_question_id,
        answer,
      ])
    );

    
// ---------------------------------------------------------
// 5. Normal submission requires all questions answered
// ---------------------------------------------------------

if (!autoSubmit) {
  const unansweredQuestions =
    attemptQuestions.filter(
      (question) => {
        const answer =
          answerMap.get(question.id);

        if (!answer) {
          return true;
        }

        if (
          question.writing_task_id
        ) {
          return !answer.answer_text?.trim();
        }

        return !answer.selected_option_id;
      }
    );

  if (
    unansweredQuestions.length > 0
  ) {
    return NextResponse.json(
      {
        error:
          "Please answer all questions before submitting the test.",
        unansweredCount:
          unansweredQuestions.length,
      },
      { status: 400 }
    );
  }
}

    // ---------------------------------------------------------
    // 6. Grade MCQ answers
    // ---------------------------------------------------------

    const mcqQuestions =
      attemptQuestions.filter(
        (question) =>
          question.question_id
      );

    let totalScore = 0;

    for (const question of mcqQuestions) {
      const answer =
        answerMap.get(question.id);

      /*
       * During auto-submit, unanswered
       * questions simply receive 0 points.
       */
      if (
        !answer ||
        !answer.selected_option_id
      ) {
        continue;
      }

      const {
        data: questionAnswer,
        error:
          questionAnswerError,
      } = await supabaseAdmin
        .from("question_answers")
        .select(`
          correct_option_id
        `)
        .eq(
          "question_id",
          question.question_id
        )
        .maybeSingle();

      if (questionAnswerError) {
        console.error(
          "Correct answer lookup error:",
          questionAnswerError
        );

        return NextResponse.json(
          {
            error:
              "Unable to grade test answers.",
          },
          { status: 500 }
        );
      }

      if (!questionAnswer) {
        console.error(
          "No correct answer found for question:",
          question.question_id
        );

        return NextResponse.json(
          {
            error:
              "A correct answer is missing from the question bank.",
          },
          { status: 500 }
        );
      }

      const isCorrect =
        answer.selected_option_id ===
        questionAnswer.correct_option_id;

      const pointsEarned =
        isCorrect ? 1 : 0;

      totalScore += pointsEarned;

      const {
        error: answerUpdateError,
      } = await supabaseAdmin
        .from("attempt_answers")
        .update({
          is_correct: isCorrect,
          points_earned:
            pointsEarned,
        })
        .eq("id", answer.id);

      if (answerUpdateError) {
        console.error(
          "Answer grading update error:",
          answerUpdateError
        );

        return NextResponse.json(
          {
            error:
              "Unable to save test score.",
          },
          { status: 500 }
        );
      }
    }

    // ---------------------------------------------------------
    // 7. Save Writing response
    // ---------------------------------------------------------

    const writingQuestion =
      attemptQuestions.find(
        (question) =>
          question.writing_task_id
      );

    if (writingQuestion) {
      const writingAnswer =
        answerMap.get(
          writingQuestion.id
        );

      if (
        writingAnswer &&
        writingAnswer.answer_text?.trim()
      ) {
        const responseText =
          writingAnswer.answer_text.trim();

        const wordCount =
          responseText
            .split(/\s+/)
            .filter(Boolean)
            .length;

        const now =
          new Date().toISOString();

        const {
          data:
            existingWritingResponse,
        } = await supabaseAdmin
          .from("writing_responses")
          .select("id")
          .eq(
            "attempt_id",
            attemptId
          )
          .maybeSingle();

        if (
          existingWritingResponse
        ) {
          const {
            error:
              writingUpdateError,
          } = await supabaseAdmin
            .from(
              "writing_responses"
            )
            .update({
              writing_task_id:
                writingQuestion.writing_task_id,
              response_text:
                responseText,
              word_count:
                wordCount,
              submitted_at: now,
              grading_status:
                "pending",
              updated_at: now,
            })
            .eq(
              "id",
              existingWritingResponse.id
            );

          if (
            writingUpdateError
          ) {
            console.error(
              "Writing response update error:",
              writingUpdateError
            );

            return NextResponse.json(
              {
                error:
                  "Unable to save writing response.",
              },
              { status: 500 }
            );
          }
        } else {
          const {
            error:
              writingInsertError,
          } = await supabaseAdmin
            .from(
              "writing_responses"
            )
            .insert({
              attempt_id:
                attemptId,
              writing_task_id:
                writingQuestion.writing_task_id,
              response_text:
                responseText,
              word_count:
                wordCount,
              submitted_at: now,
              grading_status:
                "pending",
            });

          if (
            writingInsertError
          ) {
            console.error(
              "Writing response insert error:",
              writingInsertError
            );

            return NextResponse.json(
              {
                error:
                  "Unable to save writing response.",
              },
              { status: 500 }
            );
          }
        }
      }
    }

    // ---------------------------------------------------------
    // 8. Calculate final MCQ result
    // ---------------------------------------------------------

    const maxScore =
      mcqQuestions.length;

    const percentage =
      maxScore > 0
        ? Number(
            (
              (totalScore /
                maxScore) *
              100
            ).toFixed(2)
          )
        : 0;

    // ---------------------------------------------------------
    // 9. Finalize attempt
    // ---------------------------------------------------------

    const submittedAt =
      new Date().toISOString();

    const {
      data: submittedAttempt,
      error: updateError,
    } = await supabaseAdmin
      .from("test_attempts")
      .update({
        status: "submitted",
        submitted_at:
          submittedAt,
        total_score:
          totalScore,
        max_score:
          maxScore,
        percentage,
        updated_at:
          submittedAt,
      })
      .eq("id", attemptId)
      .select(`
        id,
        status,
        submitted_at,
        total_score,
        max_score,
        percentage
      `)
      .single();

    if (
      updateError ||
      !submittedAttempt
    ) {
      console.error(
        "Test submit update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to finalize the test.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 10. Return result
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      message:
        autoSubmit
          ? "Test automatically submitted because the time limit was reached."
          : "Test submitted successfully.",
      result: {
        attemptId:
          submittedAttempt.id,
        status:
          submittedAttempt.status,
        submittedAt:
          submittedAttempt.submitted_at,
        totalScore:
          submittedAttempt.total_score,
        maxScore:
          submittedAttempt.max_score,
        percentage:
          submittedAttempt.percentage,
        autoSubmitted:
          autoSubmit,
      },
    });
  } catch (error) {
    console.error(
      "Test submit error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}