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
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function verifyTeacher(
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
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      user: null,
      error: "Unauthorized.",
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      user: null,
      error: "Teacher profile not found.",
    };
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    return {
      user: null,
      error: "Teacher access required.",
    };
  }

  return {
    user,
    error: null,
  };
}

/*
 * =========================================================
 * GET /api/campaigns/[id]
 * =========================================================
 */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await verifyTeacher(request);

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

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Campaign ID is required.",
        },
        {
          status: 400,
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
      .eq("id", id)
      .single();

    if (error) {
      console.error(
        "Campaign GET by ID error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load campaign.",
          details: error.message,
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      campaign: data,
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

/*
 * =========================================================
 * PATCH /api/campaigns/[id]
 * =========================================================
 *
 * Used mainly to enable / disable a campaign.
 * =========================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await verifyTeacher(request);

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

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Campaign ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const body: unknown =
      await request.json();

    if (
      typeof body !== "object" ||
      body === null
    ) {
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

    const payload =
      body as Record<string, unknown>;

    const updates: Record<
      string,
      unknown
    > = {};

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "is_active"
      )
    ) {
      if (
        typeof payload.is_active !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "is_active must be a boolean.",
          },
          {
            status: 400,
          }
        );
      }

      updates.is_active =
        payload.is_active;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "name"
      )
    ) {
      if (
        typeof payload.name !==
        "string"
      ) {
        return NextResponse.json(
          {
            error:
              "name must be a string.",
          },
          {
            status: 400,
          }
        );
      }

      const name =
        payload.name.trim();

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Campaign name cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      updates.name = name;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "description"
      )
    ) {
      if (
        payload.description !== null &&
        typeof payload.description !==
          "string"
      ) {
        return NextResponse.json(
          {
            error:
              "description must be a string or null.",
          },
          {
            status: 400,
          }
        );
      }

      updates.description =
        typeof payload.description ===
        "string"
          ? payload.description.trim() ||
            null
          : null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "start_at"
      )
    ) {
      if (
        payload.start_at !== null &&
        typeof payload.start_at !==
          "string"
      ) {
        return NextResponse.json(
          {
            error:
              "start_at must be a string or null.",
          },
          {
            status: 400,
          }
        );
      }

      updates.start_at =
        payload.start_at;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "end_at"
      )
    ) {
      if (
        payload.end_at !== null &&
        typeof payload.end_at !==
          "string"
      ) {
        return NextResponse.json(
          {
            error:
              "end_at must be a string or null.",
          },
          {
            status: 400,
          }
        );
      }

      updates.end_at =
        payload.end_at;
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid fields to update.",
        },
        {
          status: 400,
        }
      );
    }

    updates.updated_at =
      new Date().toISOString();

    const supabase =
      getAdminClient();

    const {
      data,
      error,
    } = await supabase
      .from("campaigns")
      .update(updates)
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
          title,
          duration_minutes,
          total_questions
        )
        `
      )
      .single();

    if (error) {
      console.error(
        "Campaign PATCH error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to update campaign.",
          details: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      campaign: data,
    });
  } catch (error) {
    console.error(
      "Campaign PATCH API error:",
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