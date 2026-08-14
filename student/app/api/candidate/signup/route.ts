import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const team = String(body.team ?? "").trim();

    // Required fields
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Save candidate registration.
    // If the email already exists, update the existing candidate.
    // Campaign and test information will be handled later.
    const { data: candidate, error: upsertError } =
      await supabaseAdmin
        .from("candidates")
        .upsert(
          {
            email,
            full_name: fullName,
            team: team || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "email",
          }
        )
        .select("id, email, full_name, team")
        .single();

    if (upsertError) {
      console.error("Candidate upsert error:", upsertError);

      return NextResponse.json(
        {
          error: "Unable to save registration information.",
          details: upsertError.message,
          code: upsertError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      candidate: {
        id: candidate.id,
        email: candidate.email,
        fullName: candidate.full_name,
        team: candidate.team,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
