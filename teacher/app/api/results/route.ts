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

    const { data, error } = await supabase
      .from("test_attempts")
      .select(
        `
        id,
        status,
        percentage,
        total_score,
        max_score,
        diagnosis,
        is_suspicious,
        started_at,
        submitted_at,
        created_at,
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
          code
        )
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Results query error:", error);

      return NextResponse.json(
        {
          error: "Unable to load results.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: data ?? [],
    });
  } catch (error) {
    console.error("Results API error:", error);

    return NextResponse.json(
      {
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}