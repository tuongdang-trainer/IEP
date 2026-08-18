import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured."
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

export async function PATCH(
  request: NextRequest,
  context: RouteContext
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

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Campaign ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const code =
      typeof body.code === "string"
        ? body.code.trim().toUpperCase()
        : "";

    const description =
      typeof body.description === "string" &&
      body.description.trim()
        ? body.description.trim()
        : null;

    const testId =
      typeof body.test_id === "string"
        ? body.test_id.trim()
        : "";

    const startAt =
      typeof body.start_at === "string" &&
      body.start_at
        ? body.start_at
        : null;

    const endAt =
      typeof body.end_at === "string" &&
      body.end_at
        ? body.end_at
        : null;

    const isActive =
      typeof body.is_active === "boolean"
        ? body.is_active
        : false;

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

    const supabase =
      getAdminClient();

    /*
     * Verify that the campaign exists.
     */
    const {
      data: existingCampaign,
      error: campaignLookupError,
    } = await supabase
      .from("campaigns")
      .select("id, code")
      .eq("id", id)
      .maybeSingle();

    if (campaignLookupError) {
      console.error(
        "Campaign lookup error:",
        campaignLookupError
      );

      return NextResponse.json(
        {
          error:
            "Unable to find campaign.",
          details:
            campaignLookupError.message,
          code:
            campaignLookupError.code,
        },
        {
          status: 500,
        }
      );
    }

    if (!existingCampaign) {
      return NextResponse.json(
        {
          error:
            "Campaign was not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Verify selected test directly
     * from the tests table.
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
          code:
            testError.code,
        },
        {
          status: 500,
        }
      );
    }

    if (!test) {
      return NextResponse.json(
        {
          error:
            "Selected test was not found.",
          details:
            `No test exists with id: ${testId}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Check whether another campaign
     * already uses the same code.
     */
    const {
      data: duplicateCampaign,
      error: duplicateError,
    } = await supabase
      .from("campaigns")
      .select("id")
      .eq("code", code)
      .neq("id", id)
      .maybeSingle();

    if (duplicateError) {
      console.error(
        "Campaign code lookup error:",
        duplicateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check campaign code.",
          details:
            duplicateError.message,
          code:
            duplicateError.code,
        },
        {
          status: 500,
        }
      );
    }

    if (duplicateCampaign) {
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
     * Update campaign.
     */
    const {
      data: campaign,
      error: updateError,
    } = await supabase
      .from("campaigns")
      .update({
        code,
        name,
        description,
        test_id: testId,
        is_active: isActive,
        start_at: startAt,
        end_at: endAt,
      })
      .eq("id", id)
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

    if (updateError) {
      console.error(
        "Campaign update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to update campaign.",
          details:
            updateError.message,
          code:
            updateError.code,
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
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Campaign PATCH error:",
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

export async function DELETE(
  request: NextRequest,
  context: RouteContext
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

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Campaign ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getAdminClient();

    const {
      data: existingCampaign,
      error: lookupError,
    } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Campaign DELETE lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          error:
            "Unable to find campaign.",
          details:
            lookupError.message,
          code:
            lookupError.code,
        },
        {
          status: 500,
        }
      );
    }

    if (!existingCampaign) {
      return NextResponse.json(
        {
          error:
            "Campaign was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "Campaign DELETE error:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete campaign.",
          details:
            deleteError.message,
          code:
            deleteError.code,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Campaign DELETE API error:",
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