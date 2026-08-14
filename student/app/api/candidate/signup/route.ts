import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const team = String(body.team ?? "").trim();

    // Validate required fields
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

    // Check whether candidate already exists
    const { data: existingCandidate, error: candidateLookupError } =
      await supabaseAdmin
        .from("candidates")
        .select("id, email, full_name, team")
        .eq("email", email)
        .maybeSingle();

    if (candidateLookupError) {
      console.error(
        "Candidate lookup error:",
        candidateLookupError
      );

      return NextResponse.json(
        { error: "Unable to check candidate information." },
        { status: 500 }
      );
    }

    let candidate;

    if (existingCandidate) {
      // Update information if the candidate registers again
      const { data: updatedCandidate, error: updateError } =
        await supabaseAdmin
          .from("candidates")
          .update({
            full_name: fullName,
            team: team || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCandidate.id)
          .select("id, email, full_name, team")
          .single();

      if (updateError) {
        console.error("Candidate update error:", updateError);

        return NextResponse.json(
          { error: "Unable to update candidate information." },
          { status: 500 }
        );
      }

      candidate = updatedCandidate;
    } else {
      // Create new candidate
      const { data: newCandidate, error: insertError } =
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
          { error: "Unable to create candidate." },
          { status: 500 }
        );
      }

      candidate = newCandidate;
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
