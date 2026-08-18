import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function PATCH(
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

    const accessToken = authHeader.replace(
      "Bearer ",
      ""
    );

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error:
            "Supabase environment variables are missing.",
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

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "id, full_name, email, role"
        )
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error:
            "Teacher profile not found.",
        },
        { status: 403 }
      );
    }

    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Teacher access required.",
        },
        { status: 403 }
      );
    }

    const { attemptId } =
      await context.params;

    if (!attemptId) {
      return NextResponse.json(
        {
          error:
            "Attempt ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const writingResponseId =
      typeof body.writing_response_id ===
      "string"
        ? body.writing_response_id.trim()
        : "";

    const score =
      body.score === null ||
      body.score === undefined ||
      body.score === ""
        ? null
        : Number(body.score);

    const feedback =
      typeof body.feedback === "string"
        ? body.feedback.trim()
        : null;

    if (!writingResponseId) {
      return NextResponse.json(
        {
          error:
            "Writing response ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      score !== null &&
      (!Number.isFinite(score) ||
        score < 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Score must be a valid non-negative number.",
        },
        { status: 400 }
      );
    }

    /*
     * Find the writing response and make sure
     * it belongs to this attempt.
     */
    const {
      data: writingResponse,
      error: writingError,
    } = await supabase
      .from("writing_responses")
      .select(
        `
        id,
        attempt_id,
        score,
        max_score,
        feedback,
        grading_status,
        graded_by,
        graded_at
        `
      )
      .eq("id", writingResponseId)
      .eq("attempt_id", attemptId)
      .single();

    if (
      writingError ||
      !writingResponse
    ) {
      console.error(
        "Writing response lookup error:",
        writingError
      );

      return NextResponse.json(
        {
          error:
            "Writing response not found.",
          details:
            writingError?.message,
        },
        { status: 404 }
      );
    }

    /*
     * Check maximum writing score.
     */
    if (
      score !== null &&
      writingResponse.max_score !== null &&
      score > Number(
        writingResponse.max_score
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Score cannot exceed ${writingResponse.max_score}.`,
        },
        { status: 400 }
      );
    }

    /*
     * Save grading.
     */
    const {
      data: updatedWriting,
      error: updateError,
    } = await supabase
      .from("writing_responses")
      .update({
        score,
        feedback:
          feedback || null,
        grading_status:
          score === null
            ? "not_graded"
            : "graded",
        graded_by:
          score === null
            ? null
            : user.id,
        graded_at:
          score === null
            ? null
            : new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", writingResponseId)
      .eq("attempt_id", attemptId)
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
      .single();

    if (updateError) {
      console.error(
        "Writing grading update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save writing grade.",
          details:
            updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      writingResponse:
        updatedWriting,
    });
  } catch (error) {
    console.error(
      "Writing grading API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}