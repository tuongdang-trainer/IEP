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

    // Save registration directly to candidates.
    // Campaign and test information will be handled later.
    const { data: candidate, error: insertError } =
      await supabaseAdmin
        .from("candidates")
        .insert({
          email,
          full_name: fullName,
          team: team || null,
        })
        .select("id, email, full_name, team")
        .single();

    if (insertError) {
      console.error("Candidate insert error:", insertError);

      return NextResponse.json(
        { error: "Unable to save registration information." },
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
