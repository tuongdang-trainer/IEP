import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
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
        { error: "Supabase environment variables are missing." },
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
        .select("id, full_name, email, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Teacher profile not found." },
        { status: 403 }
      );
    }

    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Teacher access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const team = searchParams.get("team")?.trim() || "";

    let query = supabase
      .from("candidates")
      .select(
        `
        id,
        full_name,
        email,
        team,
        created_at,
        updated_at,
        test_attempts (
          id,
          status,
          percentage,
          diagnosis,
          submitted_at,
          is_suspicious,
          campaign_id
        )
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (team) {
      query = query.eq("team", team);
    }

    const { data: candidates, error: candidatesError } =
      await query;

    if (candidatesError) {
      console.error(
        "Candidates query error:",
        candidatesError
      );

      return NextResponse.json(
        {
          error: "Unable to load candidates.",
          details: candidatesError.message,
        },
        { status: 500 }
      );
    }

    const normalizedCandidates = (candidates ?? []).map(
      (candidate) => {
        const attempts = candidate.test_attempts ?? [];

        const completedAttempts = attempts.filter(
          (attempt) => attempt.status === "submitted"
        );

        const suspiciousAttempts = attempts.filter(
          (attempt) => attempt.is_suspicious === true
        );

        const latestAttempt = [...attempts].sort((a, b) => {
          const dateA = a.submitted_at
            ? new Date(a.submitted_at).getTime()
            : 0;

          const dateB = b.submitted_at
            ? new Date(b.submitted_at).getTime()
            : 0;

          return dateB - dateA;
        })[0];

        return {
          id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          team: candidate.team,
          created_at: candidate.created_at,
          updated_at: candidate.updated_at,

          total_attempts: attempts.length,

          completed_attempts:
            completedAttempts.length,

          in_progress:
            attempts.filter(
              (attempt) => attempt.status !== "submitted"
            ).length,

          suspicious_attempts:
            suspiciousAttempts.length,

          latest_attempt: latestAttempt ?? null,
        };
      }
    );

    const teams = Array.from(
      new Set(
        normalizedCandidates
          .map((candidate) => candidate.team)
          .filter(Boolean)
      )
    ).sort();

    return NextResponse.json({
      candidates: normalizedCandidates,
      total: normalizedCandidates.length,
      teams,
    });
  } catch (error) {
    console.error(
      "Candidates API error:",
      error
    );

    return NextResponse.json(
      {
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}