import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TestRow = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  total_questions: number | null;
  passing_score: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at?: string | null;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function verifyUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return {
      user: null,
      error: "Missing authorization token.",
    };
  }

  const token = authorization
    .replace("Bearer ", "")
    .trim();

  if (!token) {
    return {
      user: null,
      error: "Missing authorization token.",
    };
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const publishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return {
      user: null,
      error:
        "Supabase environment variables are not configured.",
    };
  }

  const supabase = createClient(
    supabaseUrl,
    publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      error: "Unauthorized.",
    };
  }

  return {
    user,
    error: null,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await verifyUser(request);

    if (!auth.user) {
      return NextResponse.json(
        {
          error:
            auth.error ??
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const supabase =
      getAdminClient();

    const {
      data,
      error,
    } = await supabase
      .from("tests")
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
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Tests GET error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load tests.",
          details:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      tests:
        (data ?? []) as TestRow[],
    });
  } catch (error) {
    console.error(
      "Tests API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      {
        status: 500,
      }
    );
  }
}