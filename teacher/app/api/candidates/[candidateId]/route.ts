import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    candidateId: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const accessToken =
      authHeader.replace("Bearer ", "");

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

    const { candidateId } =
      await context.params;

    if (!candidateId) {
      return NextResponse.json(
        {
          error:
            "Candidate ID is required.",
        },
        { status: 400 }
      );
    }

    const { data: candidate, error: candidateError } =
      await supabase
        .from("candidates")
        .select(
          `
          id,
          full_name,
          email,
          team,
          created_at,
          updated_at
          `
        )
        .eq("id", candidateId)
        .single();

    if (candidateError || !candidate) {
      console.error(
        "Candidate query error:",
        candidateError
      );

      return NextResponse.json(
        {
          error:
            "Candidate not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: attempts,
      error: attemptsError,
    } = await supabase
      .from("test_attempts")
      .select(
        `
        id,
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
        tab_switch_count,
        blur_count,
        paste_count,
        copy_count,
        fullscreen_exit_count,
        created_at,
        updated_at,
        campaigns (
          id,
          code,
          name
        )
        `
      )
      .eq("candidate_id", candidateId)
      .order("created_at", {
        ascending: false,
      });

    if (attemptsError) {
      console.error(
        "Candidate attempts query error:",
        attemptsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load candidate test history.",
          details:
            attemptsError.message,
        },
        { status: 500 }
      );
    }

    const normalizedAttempts =
      (attempts ?? []).map((attempt) => ({
        id: attempt.id,
        campaign_id:
          attempt.campaign_id,
        test_id: attempt.test_id,
        login_method:
          attempt.login_method,
        status: attempt.status,
        started_at:
          attempt.started_at,
        submitted_at:
          attempt.submitted_at,
        expires_at:
          attempt.expires_at,
        duration_seconds:
          attempt.duration_seconds,
        total_score:
          attempt.total_score,
        max_score:
          attempt.max_score,
        percentage:
          attempt.percentage,
        diagnosis:
          attempt.diagnosis,
        is_suspicious:
          attempt.is_suspicious,
        tab_switch_count:
          attempt.tab_switch_count,
        blur_count:
          attempt.blur_count,
        paste_count:
          attempt.paste_count,
        copy_count:
          attempt.copy_count,
        fullscreen_exit_count:
          attempt.fullscreen_exit_count,
        created_at:
          attempt.created_at,
        updated_at:
          attempt.updated_at,
        campaign:
          Array.isArray(attempt.campaigns)
            ? attempt.campaigns[0] ?? null
            : attempt.campaigns ?? null,
      }));

    const completedAttempts =
      normalizedAttempts.filter(
        (attempt) =>
          attempt.status === "submitted"
      );

    const suspiciousAttempts =
      normalizedAttempts.filter(
        (attempt) =>
          attempt.is_suspicious === true
      );

    const inProgressAttempts =
      normalizedAttempts.filter(
        (attempt) =>
          attempt.status !== "submitted"
      );

    const latestCompletedAttempt =
      completedAttempts[0] ?? null;

    return NextResponse.json({
      candidate: {
        id: candidate.id,
        full_name:
          candidate.full_name,
        email: candidate.email,
        team: candidate.team,
        created_at:
          candidate.created_at,
        updated_at:
          candidate.updated_at,
      },

      summary: {
        total_attempts:
          normalizedAttempts.length,

        completed_attempts:
          completedAttempts.length,

        in_progress:
          inProgressAttempts.length,

        suspicious_attempts:
          suspiciousAttempts.length,

        latest_percentage:
          latestCompletedAttempt?.percentage ??
          null,

        latest_diagnosis:
          latestCompletedAttempt?.diagnosis ??
          null,
      },

      attempts:
        normalizedAttempts,
    });
  } catch (error) {
    console.error(
      "Candidate detail API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}