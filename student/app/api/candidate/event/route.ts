import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type EventType =
  | "copy"
  | "paste"
  | "cut"
  | "contextmenu"
  | "tab_switch"
  | "blur"
  | "fullscreen_exit";

type EventRequestBody = {
  attemptId?: unknown;
  eventType?: unknown;
  metadata?: unknown;
};

const ALLOWED_EVENT_TYPES: readonly EventType[] = [
  "copy",
  "paste",
  "cut",
  "contextmenu",
  "tab_switch",
  "blur",
  "fullscreen_exit",
];

function isEventType(value: unknown): value is EventType {
  return (
    typeof value === "string" &&
    ALLOWED_EVENT_TYPES.includes(value as EventType)
  );
}

function isMetadata(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EventRequestBody;

    const attemptId =
      typeof body.attemptId === "string"
        ? body.attemptId.trim()
        : "";

    const eventType =
      typeof body.eventType === "string"
        ? body.eventType.trim()
        : "";

    const metadata = isMetadata(body.metadata)
      ? body.metadata
      : {};

    if (!attemptId) {
      return NextResponse.json(
        {
          error: "Attempt ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!eventType) {
      return NextResponse.json(
        {
          error: "Event type is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isEventType(eventType)) {
      return NextResponse.json(
        {
          error: "Invalid event type.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: attempt,
      error: attemptError,
    } = await supabaseAdmin
      .from("test_attempts")
      .select("id, status")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError) {
      console.error(
        "Attempt lookup error:",
        attemptError
      );

      return NextResponse.json(
        {
          error: "Unable to verify test attempt.",
          details: attemptError.message,
          code: attemptError.code,
        },
        {
          status: 500,
        }
      );
    }

    if (!attempt) {
      return NextResponse.json(
        {
          error: "Test attempt not found.",
        },
        {
          status: 404,
        }
      );
    }

    const closedStatuses = [
      "submitted",
      "completed",
      "expired",
    ];

    if (
      typeof attempt.status === "string" &&
      closedStatuses.includes(attempt.status)
    ) {
      return NextResponse.json(
        {
          error:
            "This test attempt is no longer active.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: event,
      error: eventError,
    } = await supabaseAdmin
      .from("attempt_events")
      .insert({
        attempt_id: attemptId,
        event_type: eventType,
        metadata,
        occurred_at: new Date().toISOString(),
      })
      .select(
        "id, attempt_id, event_type, metadata, occurred_at"
      )
      .single();

    if (eventError) {
      console.error(
        "Attempt event insert error:",
        eventError
      );

      return NextResponse.json(
        {
          error:
            "Unable to record test event.",
          details: eventError.message,
          code: eventError.code,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error(
      "Candidate event API error:",
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