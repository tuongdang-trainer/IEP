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

    // Verify the logged-in user
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

    // Verify Teacher profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);

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

    const [
      candidatesResult,
      completedResult,
      inProgressResult,
      suspiciousResult,
      recentResultsResult,
    ] = await Promise.all([
      // Total candidates
      supabase
        .from("candidates")
        .select("id", {
          count: "exact",
          head: true,
        }),

      // Completed tests
      supabase
        .from("test_attempts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", "submitted"),

      // Tests currently in progress
      supabase
        .from("test_attempts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .in("status", ["started", "in_progress"]),

      // Suspicious attempts
      supabase
        .from("test_attempts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("is_suspicious", true),

      // Recent completed results
      supabase
        .from("test_attempts")
        .select(
          `
          id,
          status,
          percentage,
          submitted_at,
          candidates (
            full_name,
            email,
            team
          ),
          campaigns (
            name,
            code
          )
        `
        )
        .eq("status", "submitted")
        .order("submitted_at", {
          ascending: false,
        })
        .limit(10),
    ]);

    const errors = [
      candidatesResult.error,
      completedResult.error,
      inProgressResult.error,
      suspiciousResult.error,
      recentResultsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Dashboard query errors:", errors);

      return NextResponse.json(
        {
          error: "Unable to load dashboard data.",
          details: errors.map((error) => error?.message),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      teacher: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
      },

      candidates: candidatesResult.count ?? 0,

      completed: completedResult.count ?? 0,

      inProgress: inProgressResult.count ?? 0,

      suspicious: suspiciousResult.count ?? 0,

      recentResults: recentResultsResult.data ?? [],
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}