import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CampaignTest = {
  title: string;
  duration_minutes: number | null;
  total_questions: number | null;
};

type CampaignRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  test_id: string;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  tests: CampaignTest[] | null;
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

async function verifyUser(request: NextRequest) {
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
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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

/* =========================================================
   GET /api/campaigns
   ========================================================= */

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUser(request);

    if (!auth.user) {
      return NextResponse.json(
        {
          error:
            auth.error ?? "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const supabase = getAdminClient();

    const {
      data,
      error,
    } = await supabase
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
            title,
            duration_minutes,
            total_questions
          )
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Campaign GET error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load campaigns.",
          details: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      campaigns:
        (data ?? []) as CampaignRow[],
    });
  } catch (error) {
    console.error(
      "Campaign GET API error:",
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

/* =========================================================
   POST /api/campaigns
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyUser(request);

    if (!auth.user) {
      return NextResponse.json(
        {
          error:
            auth.error ?? "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const payload =
      body as Record<string, unknown>;

    const name =
      typeof payload.name === "string"
        ? payload.name.trim()
        : "";

    const code =
      typeof payload.code === "string"
        ? payload.code.trim().toUpperCase()
        : "";

    const description =
      typeof payload.description === "string" &&
      payload.description.trim()
        ? payload.description.trim()
        : null;

    const testId =
      typeof payload.test_id === "string"
        ? payload.test_id.trim()
        : "";

    const startAt =
      typeof payload.start_at === "string" &&
      payload.start_at
        ? payload.start_at
        : null;

    const endAt =
      typeof payload.end_at === "string" &&
      payload.end_at
        ? payload.end_at
        : null;

    const isActive =
      typeof payload.is_active === "boolean"
        ? payload.is_active
        : false;

    console.log(
      "========================================"
    );

    console.log(
      "CAMPAIGN CREATE REQUEST"
    );

    console.log(
      "CAMPAIGN TEST ID:",
      testId
    );

    console.log(
      "CAMPAIGN NAME:",
      name
    );

    console.log(
      "CAMPAIGN CODE:",
      code
    );

    console.log(
      "========================================"
    );

    /* -----------------------------------------------------
       Validation
       ----------------------------------------------------- */

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

    if (!testId) {
      return NextResponse.json(
        {
          error:
            "Selected test is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      startAt &&
      endAt &&
      new Date(startAt) >=
        new Date(endAt)
    ) {
      return NextResponse.json(
        {
          error:
            "End time must be later than start time.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = getAdminClient();

    /* -----------------------------------------------------
       Verify selected test
       ----------------------------------------------------- */

    console.log(
      "LOOKING FOR TEST ID:",
      testId
    );

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

    console.log(
      "TEST LOOKUP RESULT:",
      test
    );

    console.log(
      "TEST LOOKUP ERROR:",
      testError
    );

    /* -----------------------------------------------------
       Test lookup error
       ----------------------------------------------------- */

    if (testError) {
      console.error(
        "Selected test lookup error:",
        testError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify selected test.",
          details:
            testError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* -----------------------------------------------------
       Test not found
       ----------------------------------------------------- */

    if (!test) {
      console.error(
        "SELECTED TEST WAS NOT FOUND"
      );

      console.error(
        "Requested test ID:",
        testId
      );

      return NextResponse.json(
        {
          error:
            "Selected test was not found.",
          details:
            `No test exists with id ${testId}.`,
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "SELECTED TEST FOUND:",
      test
    );

    /* -----------------------------------------------------
       Check duplicate campaign code
       ----------------------------------------------------- */

    const {
      data: existingCampaign,
      error: existingError,
    } = await supabase
      .from("campaigns")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Campaign code lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check campaign code.",
          details:
            existingError.message,
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

    /* -----------------------------------------------------
       Create campaign
       ----------------------------------------------------- */

    const {
      data: campaign,
      error: campaignError,
    } = await supabase
      .from("campaigns")
      .insert({
        name,
        code,
        description,
        test_id: testId,
        start_at: startAt,
        end_at: endAt,
        is_active: isActive,
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
            title,
            duration_minutes,
            total_questions
          )
        `
      )
      .single();

    if (campaignError) {
      console.error(
        "Campaign insert error:",
        campaignError
      );

      return NextResponse.json(
        {
          error:
            "Unable to create campaign.",
          details:
            campaignError.message,
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "CAMPAIGN CREATED SUCCESSFULLY:",
      campaign
    );

    return NextResponse.json(
      {
        campaign,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Campaign POST API error:",
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