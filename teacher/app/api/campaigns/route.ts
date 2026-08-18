import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CampaignPayload = {
  code?: string;
  name?: string;
  description?: string;
  test_id?: string;
  is_active?: boolean;
  start_at?: string | null;
  end_at?: string | null;
};

function getSupabaseClient(
  accessToken: string
) {
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
      error: NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const accessToken =
    authHeader.replace(
      "Bearer ",
      ""
    );

  let supabase;

  try {
    supabase =
      getSupabaseClient(
        accessToken
      );
  } catch (error) {
    return {
      error: NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Supabase configuration error.",
        },
        {
          status: 500,
        }
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
      error: NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
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
      error: NextResponse.json(
        {
          error:
            "Teacher profile not found.",
        },
        {
          status: 403,
        }
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
        {
          status: 403,
        }
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
| GET /api/campaigns
|--------------------------------------------------------------------------
| Returns all campaigns with their associated test.
*/
export async function GET(
  request: Request
) {
  try {
    const auth =
      await authenticateTeacher(
        request
      );

    if (auth.error) {
      return auth.error;
    }

    const {
      supabase,
    } = auth;

    const { data, error } =
      await supabase
        .from("campaigns")
        .select(
          `
          id,
          code,
          name,
          description,
          test_id,
          is_active,
          start_at,
          end_at,
          created_at,
          updated_at,
          tests (
            id,
            title,
            duration_minutes,
            total_questions,
            is_active
          )
          `
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (error) {
      console.error(
        "Campaign query error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load campaigns.",
          details:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      campaigns: data ?? [],
    });
  } catch (error) {
    console.error(
      "Campaign GET error:",
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
|--------------------------------------------------------------------------
| POST /api/campaigns
|--------------------------------------------------------------------------
| Creates a new campaign.
*/
export async function POST(
  request: Request
) {
  try {
    const auth =
      await authenticateTeacher(
        request
      );

    if (auth.error) {
      return auth.error;
    }

    const {
      supabase,
    } = auth;

    let body: CampaignPayload;

    try {
      body =
        (await request.json()) as CampaignPayload;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const code =
      body.code?.trim() ?? "";

    const name =
      body.name?.trim() ?? "";

    const description =
      body.description?.trim() || null;

    const testId =
      body.test_id?.trim() ?? "";

    console.log("========== CAMPAIGN DEBUG ==========");
    console.log("Campaign body:", body);
    console.log("Selected test ID:", testId);
    console.log("====================================");  

    const isActive =
      body.is_active ?? false;

    const startAt =
      body.start_at || null;

    const endAt =
      body.end_at || null;

    /*
     * ----------------------------------------------------------
     * VALIDATION
     * ----------------------------------------------------------
     */

    if (!code) {
      return NextResponse.json(
        {
          error:
            "Campaign code is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Campaign name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!testId) {
      return NextResponse.json(
        {
          error:
            "Test is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Campaign code normalization.
     *
     * Example:
     * aug2026
     * AUG2026
     *
     * are treated as the same code.
     */

    const normalizedCode =
      code.toUpperCase();

    /*
     * ----------------------------------------------------------
     * CHECK DUPLICATE CODE
     * ----------------------------------------------------------
     */

    const {
      data: existingCampaign,
      error:
        existingCampaignError,
    } =
      await supabase
        .from("campaigns")
        .select("id")
        .ilike(
          "code",
          normalizedCode
        )
        .maybeSingle();

    if (
      existingCampaignError
    ) {
      console.error(
        "Campaign duplicate check error:",
        existingCampaignError
      );

      return NextResponse.json(
        {
          error:
            "Unable to validate campaign code.",
          details:
            existingCampaignError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (existingCampaign) {
      return NextResponse.json(
        {
          error:
            "Campaign code already exists.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * CHECK TEST
     * ----------------------------------------------------------
     */

 const {
  data: test,
  error: testError,
} = await supabase
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

console.log("========== TEST LOOKUP DEBUG ==========");
console.log("Looking for test ID:", testId);
console.log("Test result:", test);
console.log("Test error:", testError);
console.log("========================================");

if (testError) {
  console.error(
    "TEST LOOKUP ERROR:",
    testError
  );

  return NextResponse.json(
    {
      error: "Unable to look up selected test.",
      details: testError.message,
      code: testError.code,
    },
    {
      status: 500,
    }
  );
}

if (!test) {
  console.error(
    "TEST NOT FOUND:",
    testId
  );

  return NextResponse.json(
    {
      error: "Selected test was not found.",
      details: `No test exists with id: ${testId}`,
    },
    {
      status: 400,
    }
  );
}

    /*
     * ----------------------------------------------------------
     * CHECK DATE RANGE
     * ----------------------------------------------------------
     */

    if (
      startAt &&
      endAt
    ) {
      const start =
        new Date(startAt);

      const end =
        new Date(endAt);

      if (
        Number.isNaN(
          start.getTime()
        ) ||
        Number.isNaN(
          end.getTime()
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid campaign date/time.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        start >= end
      ) {
        return NextResponse.json(
          {
            error:
              "Start time must be earlier than end time.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * ----------------------------------------------------------
     * CREATE CAMPAIGN
     * ----------------------------------------------------------
     */

    const {
  data: campaign,
  error: insertError,
} = await supabase
  .from("campaigns")
  .insert({
    code: normalizedCode,
    name,
    description,
    test_id: testId,
    is_active: isActive,
    start_at: startAt,
    end_at: endAt,
  })
  .select(
    `
      id,
      code,
      name,
      description,
      test_id,
      is_active,
      start_at,
      end_at,
      created_at,
      updated_at,
      tests (
        id,
        title,
        duration_minutes,
        total_questions,
        is_active
      )
    `
  )
  .single();

if (insertError) {
  console.error(
    "Campaign insert error:",
    insertError
  );

  return NextResponse.json(
    {
      error: "Unable to create campaign.",
      details: insertError.message,
      code: insertError.code,
    },
    {
      status: 500,
    }
  );
}

return NextResponse.json(
  {
    success: true,
    campaign,
  },
  {
    status: 201,
  }
);
  } catch (error) {
    console.error(
      "Campaign POST error:",
      error
    );

    return NextResponse.json(
      {
        error: "Internal server error.",
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