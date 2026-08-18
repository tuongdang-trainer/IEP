import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type TestPayload = {
  title?: string;
  description?: string | null;
  duration_minutes?: number;
  total_questions?: number;
  passing_score?: number | null;
  is_active?: boolean;
};

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
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    }
  );
}

async function authenticateTeacher(
  request: Request
) {
  const authHeader =
    request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: "Unauthorized.",
      status: 401,
      supabase: null,
    };
  }

  const accessToken =
    authHeader.replace("Bearer ", "");

  let supabase;

  try {
    supabase =
      getSupabaseClient(accessToken);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to Supabase.",
      status: 500,
      supabase: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: "Unauthorized.",
      status: 401,
      supabase: null,
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
      error:
        "Teacher profile not found.",
      status: 403,
      supabase: null,
    };
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    return {
      error:
        "Teacher access required.",
      status: 403,
      supabase: null,
    };
  }

  return {
    error: null,
    status: 200,
    supabase,
  };
}

function parseNumber(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

/*
 * GET
 *
 * Load all tests.
 */
export async function GET(
  request: Request
) {
  try {
    const auth =
      await authenticateTeacher(
        request
      );

    if (!auth.supabase) {
      return NextResponse.json(
        {
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const activeParam =
      searchParams
        .get("is_active")
        ?.trim();

    let query =
      auth.supabase
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
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (
      activeParam === "true"
    ) {
      query =
        query.eq(
          "is_active",
          true
        );
    }

    if (
      activeParam === "false"
    ) {
      query =
        query.eq(
          "is_active",
          false
        );
    }

    const {
      data: tests,
      error,
    } = await query;

    if (error) {
      console.error(
        "Tests query error:",
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
      tests: tests ?? [],
      total: tests?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "GET /api/tests error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * POST
 *
 * Create a new test.
 */
export async function POST(
  request: Request
) {
  try {
    const auth =
      await authenticateTeacher(
        request
      );

    if (!auth.supabase) {
      return NextResponse.json(
        {
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    let body: TestPayload;

    try {
      body =
        (await request.json()) as TestPayload;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON request body.",
        },
        {
          status: 400,
        }
      );
    }

    const title =
      body.title?.trim() ?? "";

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Test title is required.",
        },
        {
          status: 400,
        }
      );
    }

    const durationMinutes =
      parseNumber(
        body.duration_minutes
      );

    const totalQuestions =
      parseNumber(
        body.total_questions
      );

    const passingScore =
      parseNumber(
        body.passing_score
      );

    if (
      durationMinutes === null ||
      durationMinutes <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Duration must be greater than 0.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      totalQuestions === null ||
      totalQuestions <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Total questions must be greater than 0.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      passingScore !== null &&
      (passingScore < 0 ||
        passingScore > 100)
    ) {
      return NextResponse.json(
        {
          error:
            "Passing score must be between 0 and 100.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: test,
      error,
    } =
      await auth.supabase
        .from("tests")
        .insert({
          title,
          description:
            body.description?.trim() ||
            null,
          duration_minutes:
            Math.round(
              durationMinutes
            ),
          total_questions:
            Math.round(
              totalQuestions
            ),
          passing_score:
            passingScore,
          is_active:
            body.is_active ?? false,
        })
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

    if (error) {
      console.error(
        "Test creation error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to create test.",
          details:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        test,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/tests error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * PATCH
 *
 * Update an existing test.
 */
export async function PATCH(
  request: Request
) {
  try {
    const auth =
      await authenticateTeacher(
        request
      );

    if (!auth.supabase) {
      return NextResponse.json(
        {
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    let body: TestPayload & {
      id?: string;
    };

    try {
      body =
        (await request.json()) as TestPayload & {
          id?: string;
        };
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON request body.",
        },
        {
          status: 400,
        }
      );
    }

    const id =
      body.id?.trim() ?? "";

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Test id is required.",
        },
        {
          status: 400,
        }
      );
    }

    const updates: Record<
      string,
      unknown
    > = {};

    if (
      body.title !== undefined
    ) {
      const title =
        body.title.trim();

      if (!title) {
        return NextResponse.json(
          {
            error:
              "Test title cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.title = title;
    }

    if (
      body.description !==
      undefined
    ) {
      updates.description =
        body.description?.trim() ||
        null;
    }

    if (
      body.duration_minutes !==
      undefined
    ) {
      const value =
        parseNumber(
          body.duration_minutes
        );

      if (
        value === null ||
        value <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Duration must be greater than 0.",
          },
          {
            status: 400,
          }
        );
      }

      updates.duration_minutes =
        Math.round(value);
    }

    if (
      body.total_questions !==
      undefined
    ) {
      const value =
        parseNumber(
          body.total_questions
        );

      if (
        value === null ||
        value <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Total questions must be greater than 0.",
          },
          {
            status: 400,
          }
        );
      }

      updates.total_questions =
        Math.round(value);
    }

    if (
      body.passing_score !==
      undefined
    ) {
      const value =
        parseNumber(
          body.passing_score
        );

      if (
        value !== null &&
        (value < 0 ||
          value > 100)
      ) {
        return NextResponse.json(
          {
            error:
              "Passing score must be between 0 and 100.",
          },
          {
            status: 400,
          }
        );
      }

      updates.passing_score =
        value;
    }

    if (
      body.is_active !==
      undefined
    ) {
      updates.is_active =
        body.is_active;
    }

    if (
      Object.keys(updates)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No fields to update.",
        },
        {
          status: 400,
        }
      );
    }

    updates.updated_at =
      new Date().toISOString();

    const {
      data: test,
      error,
    } =
      await auth.supabase
        .from("tests")
        .update(updates)
        .eq("id", id)
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

    if (error) {
      console.error(
        "Test update error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to update test.",
          details:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      test,
    });
  } catch (error) {
    console.error(
      "PATCH /api/tests error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * DELETE
 *
 * Delete a test.
 *
 * If the test is already used by a campaign or another
 * database record, Supabase may reject the deletion because
 * of a foreign-key constraint. In that case, the API returns
 * the database error instead of silently deleting anything.
 */
export async function DELETE(
  request: Request
) {
  try {
    const auth =
      await authenticateTeacher(
        request
      );

    if (!auth.supabase) {
      return NextResponse.json(
        {
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const id =
      searchParams.get("id")?.trim() ??
      "";

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Test id is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error,
    } =
      await auth.supabase
        .from("tests")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Test deletion error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete test.",
          details:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/tests error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}