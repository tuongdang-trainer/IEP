import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(
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
}

async function authenticateTeacher(
  request: NextRequest
) {
  const authHeader =
    request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      supabase: null,
      error: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const accessToken =
    authHeader.replace("Bearer ", "").trim();

  let supabase;

  try {
    supabase =
      getSupabaseClient(accessToken);
  } catch (error) {
    return {
      supabase: null,
      error: NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Supabase configuration error.",
        },
        { status: 500 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase: null,
      error: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "id, full_name, email, role"
      )
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    return {
      supabase: null,
      error: NextResponse.json(
        {
          error:
            "Teacher profile not found.",
        },
        { status: 403 }
      ),
    };
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    return {
      supabase: null,
      error: NextResponse.json(
        {
          error:
            "Teacher access required.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    error: null,
  };
}

/*
|--------------------------------------------------------------------------
| PATCH /api/tests/[id]
|--------------------------------------------------------------------------
| Enable / disable a test.
|--------------------------------------------------------------------------
*/

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const auth =
      await authenticateTeacher(request);

    if (auth.error || !auth.supabase) {
      return (
        auth.error ??
        NextResponse.json(
          { error: "Unauthorized." },
          { status: 401 }
        )
      );
    }

    const { supabase } = auth;

    const { id: testId } =
      await context.params;

    if (!testId) {
      return NextResponse.json(
        {
          error: "Test ID is required.",
        },
        { status: 400 }
      );
    }

    let body: {
      is_active?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    if (
      typeof body.is_active !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "is_active must be a boolean.",
        },
        { status: 400 }
      );
    }

    const {
      data: test,
      error: updateError,
    } =
      await supabase
        .from("tests")
        .update({
          is_active: body.is_active,
        })
        .eq("id", testId)
        .select(
          `
          id,
          title,
          description,
          duration_minutes,
          total_questions,
          passing_score,
          is_active,
          created_at,
          updated_at
          `
        )
        .single();

    if (updateError) {
      console.error(
        "Test update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to update test.",
          details:
            updateError.message,
        },
        { status: 500 }
      );
    }

    if (!test) {
      return NextResponse.json(
        {
          error: "Test not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      test,
    });
  } catch (error) {
    console.error(
      "PATCH /api/tests/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}
