import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeName } from "@/lib/normalize";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const team = String(body.team ?? "").trim();
    const campaignCode = String(body.campaignCode ?? "")
      .trim()
      .toUpperCase();

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 } 
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!team) {
      return NextResponse.json(
        { error: "Team is required." },
        { status: 400 }
      );
    }

    if (!campaignCode) {
      return NextResponse.json(
        { error: "Campaign code is required." },
        { status: 400 }
      );
    }

    // Find candidate
    const { data: candidate, error: candidateError } =
      await supabaseAdmin
        .from("candidates")
        .select("id, email, full_name, team")
        .eq("email", email)
        .maybeSingle();

    if (candidateError) {
  console.error("Candidate lookup error:", candidateError);

  return NextResponse.json(
    {
      error: "Unable to verify candidate information.",
      details: candidateError.message,
      code: candidateError.code,
      hint: candidateError.hint,
    },
    { status: 500 }
  );
}

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found. Please register first." },
        { status: 404 }
      );
    }

    // Verify candidate information
    if (normalizeName(candidate.full_name) !== normalizeName(fullName)) {
  return NextResponse.json(
    { error: "Full name does not match the registered information." },
    { status: 401 }
  );
}

    if (
      (candidate.team ?? "").trim().toLowerCase() !==
      team.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Team does not match the registered information." },
        { status: 401 }
      );
    }

    // Find active campaign
    const { data: campaign, error: campaignError } =
      await supabaseAdmin
        .from("campaigns")
        .select(
          `
          id,
          code,
          name,
          test_id,
          is_active,
          start_at,
          end_at
        `
        )
        .eq("code", campaignCode)
        .eq("is_active", true)
        .maybeSingle();

    if (campaignError) {
      console.error("Campaign lookup error:", campaignError);

      return NextResponse.json(
        { error: "Unable to verify campaign." },
        { status: 500 }
      );
    }

    if (!campaign) {
      return NextResponse.json(
        { error: "Invalid or inactive campaign code." },
        { status: 404 }
      );
    }

    // Check campaign schedule when dates are provided
    const now = new Date();

    if (campaign.start_at && new Date(campaign.start_at) > now) {
      return NextResponse.json(
        { error: "This campaign has not started yet." },
        { status: 403 }
      );
    }

    if (campaign.end_at && new Date(campaign.end_at) < now) {
      return NextResponse.json(
        { error: "This campaign has ended." },
        { status: 403 }
      );
    }

    // Find test
    const { data: test, error: testError } = await supabaseAdmin
      .from("tests")
      .select(
        `
        id,
        title,
        description,
        duration_minutes,
        total_questions,
        passing_score,
        is_active
      `
      )
      .eq("id", campaign.test_id)
      .eq("is_active", true)
      .maybeSingle();

    if (testError) {
      console.error("Test lookup error:", testError);

      return NextResponse.json(
        { error: "Unable to verify test." },
        { status: 500 }
      );
    }

    if (!test) {
      return NextResponse.json(
        { error: "The test assigned to this campaign is unavailable." },
        { status: 404 }
      );
    }

    // Check existing attempts
    const { data: existingAttempts, error: attemptError } =
      await supabaseAdmin
        .from("test_attempts")
        .select(
          `
          id,
          status,
          started_at,
          submitted_at
        `
        )
        .eq("candidate_id", candidate.id)
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });

    if (attemptError) {
      console.error("Attempt lookup error:", attemptError);

      return NextResponse.json(
        { error: "Unable to verify test attempt status." },
        { status: 500 }
      );
    }

    const activeAttempt = existingAttempts?.find(
      (attempt) =>
        attempt.status === "started" ||
        attempt.status === "in_progress"
    );

    if (activeAttempt) {
      return NextResponse.json({
        success: true,
        access: "resume",
        candidate: {
          id: candidate.id,
          fullName: candidate.full_name,
          email: candidate.email,
          team: candidate.team,
        },
        campaign: {
          id: campaign.id,
          code: campaign.code,
          name: campaign.name,
        },
        test: {
          id: test.id,
          title: test.title,
          durationMinutes: test.duration_minutes,
          totalQuestions: test.total_questions,
        },
        attempt: {
          id: activeAttempt.id,
          status: activeAttempt.status,
        },
      });
    }

    const submittedAttempt = existingAttempts?.find(
      (attempt) =>
        attempt.status === "submitted" ||
        attempt.submitted_at !== null
    );

    if (submittedAttempt) {
      return NextResponse.json(
        {
          error: "You have already completed this test.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      access: "granted",
      candidate: {
        id: candidate.id,
        fullName: candidate.full_name,
        email: candidate.email,
        team: candidate.team,
      },
      campaign: {
        id: campaign.id,
        code: campaign.code,
        name: campaign.name,
      },
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        durationMinutes: test.duration_minutes,
        totalQuestions: test.total_questions,
        passingScore: test.passing_score,
      },
    });
  } catch (error) {
    console.error("Test access error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
