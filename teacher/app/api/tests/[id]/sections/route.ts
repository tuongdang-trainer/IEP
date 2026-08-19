import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SectionUpdate = {
  A1?: number;
  A2?: number;
  B1?: number;
  B2?: number;
  Writing?: number;
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
          Authorization: `Bearer ${accessToken}`,
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
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
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
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    return {
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
    user,
    profile,
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/tests/[id]/sections
|--------------------------------------------------------------------------
| Get question distribution for a test.
*/
export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const auth =
      await authenticateTeacher(request);

    if (auth.error) {
      return auth.error;
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

    const {
      data: test,
      error: testError,
    } =
      await supabase
        .from("tests")
        .select(
          `
          id,
          title,
          duration_minutes,
          total_questions,
          is_active
          `
        )
        .eq("id", testId)
        .maybeSingle();

    if (testError) {
      console.error(
        "Test lookup error:",
        testError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load test.",
          details: testError.message,
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

    const {
      data: sections,
      error: sectionsError,
    } =
      await supabase
        .from("test_sections")
        .select(
          `
          id,
          title,
          order_number,
          question_count
          `
        )
        .eq("test_id", testId)
        .order("order_number", {
          ascending: true,
        });

    if (sectionsError) {
      console.error(
        "Sections lookup error:",
        sectionsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load test sections.",
          details:
            sectionsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      test,
      sections: sections ?? [],
    });
  } catch (error) {
    console.error(
      "Test sections GET error:",
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

/*
|--------------------------------------------------------------------------
| PATCH /api/tests/[id]/sections
|--------------------------------------------------------------------------
| Update question distribution for a test.
*/
export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const auth =
      await authenticateTeacher(request);

    if (auth.error) {
      return auth.error;
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
      sections?: SectionUpdate;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const sectionUpdates =
      body.sections;

    if (!sectionUpdates) {
      return NextResponse.json(
        {
          error:
            "Sections configuration is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Load current sections.
     */
    const {
      data: sections,
      error: sectionsError,
    } =
      await supabase
        .from("test_sections")
        .select(
          `
          id,
          title,
          order_number,
          question_count
          `
        )
        .eq("test_id", testId)
        .order("order_number", {
          ascending: true,
        });

    if (sectionsError) {
      console.error(
        "Sections lookup error:",
        sectionsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load test sections.",
          details:
            sectionsError.message,
        },
        { status: 500 }
      );
    }

    if (!sections || sections.length === 0) {
      return NextResponse.json(
        {
          error:
            "This test has no sections configured.",
        },
        { status: 400 }
      );
    }

    /*
     * Validate all provided values.
     */
    for (const [
      title,
      value,
    ] of Object.entries(sectionUpdates)) {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value)
      ) {
        return NextResponse.json(
          {
            error:
              `${title} question count must be a whole number.`,
          },
          { status: 400 }
        );
      }

      if (value < 0) {
        return NextResponse.json(
          {
            error:
              `${title} question count cannot be negative.`,
          },
          { status: 400 }
        );
      }
    }

    /*
     * Writing is fixed at 1.
     */
    if (
      sectionUpdates.Writing !==
        undefined &&
      sectionUpdates.Writing !== 1
    ) {
      return NextResponse.json(
        {
          error:
            "Writing question count must be 1.",
        },
        { status: 400 }
      );
    }

        /*
     * Validate active question availability.
     *
     * A1 / A2 / B1 / B2 are sourced from question_bank.
     * Writing is fixed at 1 and does not use question_bank.
     */
    const levels = ["A1", "A2", "B1", "B2"] as const;

    for (const level of levels) {
      const requestedCount =
        sectionUpdates[level];

      if (requestedCount === undefined) {
        continue;
      }

      const {
        count: availableCount,
        error: questionCountError,
      } = await supabase
        .from("question_bank")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("level", level)
        .eq("is_active", true);

      if (questionCountError) {
        console.error(
          `Question bank lookup error for ${level}:`,
          questionCountError
        );

        return NextResponse.json(
          {
            error:
              `Unable to check available questions in ${level}.`,
            details:
              questionCountError.message,
          },
          { status: 500 }
        );
      }

      const available =
        availableCount ?? 0;

      if (requestedCount > available) {
        return NextResponse.json(
          {
            error:
              `Not enough active questions in ${level}. Available: ${available}.`,
            level,
            requested: requestedCount,
            available,
          },
          { status: 400 }
        );
      }
    }

    /*
     * Update sections.
     */
    for (const section of sections) {
      const title =
        section.title.trim();

      if (
        !Object.prototype.hasOwnProperty.call(
          sectionUpdates,
          title
        )
      ) {
        continue;
      }

      const newCount =
        sectionUpdates[
          title as keyof SectionUpdate
        ];

      if (newCount === undefined) {
        continue;
      }

      const {
        error: updateError,
      } =
        await supabase
          .from("test_sections")
          .update({
            question_count:
              newCount,
          })
          .eq("id", section.id)
          .eq("test_id", testId);

      if (updateError) {
        console.error(
          `Unable to update ${title}:`,
          updateError
        );

        return NextResponse.json(
          {
            error:
              `Unable to update ${title}.`,
            details:
              updateError.message,
          },
          { status: 500 }
        );
      }
    }

    /*
     * Reload sections after update.
     */
    const {
      data: updatedSections,
      error: reloadError,
    } =
      await supabase
        .from("test_sections")
        .select(
          `
          id,
          title,
          order_number,
          question_count
          `
        )
        .eq("test_id", testId)
        .order("order_number", {
          ascending: true,
        });

    if (reloadError) {
      console.error(
        "Updated sections lookup error:",
        reloadError
      );

      return NextResponse.json(
        {
          error:
            "Unable to reload updated sections.",
        },
        { status: 500 }
      );
    }

    /*
     * Calculate total questions.
     */
    const totalQuestions =
      (updatedSections ?? []).reduce(
        (total, section) =>
          total +
          Number(
            section.question_count ?? 0
          ),
        0
      );

    /*
     * Update tests.total_questions.
     */
    const {
      data: updatedTest,
      error: testUpdateError,
    } =
      await supabase
        .from("tests")
        .update({
          total_questions:
            totalQuestions,
        })
        .eq("id", testId)
        .select(
          `
          id,
          title,
          duration_minutes,
          total_questions,
          is_active
          `
        )
        .single();

    if (testUpdateError) {
      console.error(
        "Test total update error:",
        testUpdateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to update total question count.",
          details:
            testUpdateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      test: updatedTest,
      sections:
        updatedSections ?? [],
    });
  } catch (error) {
    console.error(
      "Test sections PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}
