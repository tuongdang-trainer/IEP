import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

const PAGE_SIZE = 1000;

export async function GET(request: Request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error:
            "Supabase environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
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

    /*
     * ---------------------------------------------------------
     * 2. VERIFY USER
     * ---------------------------------------------------------
     */

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. VERIFY TEACHER / ADMIN
     * ---------------------------------------------------------
     */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: "Teacher profile not found.",
        },
        { status: 403 }
      );
    }

    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error: "Teacher access required.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. READ FILTERS
     * ---------------------------------------------------------
     */

    const { searchParams } =
      new URL(request.url);

    const level =
      searchParams.get("level")?.trim() || "";

    const skill =
      searchParams.get("skill")?.trim() || "";

    const questionType =
      searchParams
        .get("question_type")
        ?.trim() || "";

    const search =
      searchParams.get("search")?.trim() || "";

    /*
     * ---------------------------------------------------------
     * 5. GET FILTER OPTIONS
     * ---------------------------------------------------------
     *
     * We fetch the filter metadata separately.
     * CEFR levels are explicitly defined because the placement
     * test uses A1, A2, B1 and B2.
     *
     * ---------------------------------------------------------
     */

    const {
      data: filterRows,
      error: filterError,
    } = await supabase
      .from("question_bank")
      .select("skill, question_type")
      .limit(1000);

    if (filterError) {
      console.error(
        "Test bank filter query error:",
        filterError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load test bank filters.",
          details:
            filterError.message,
        },
        { status: 500 }
      );
    }

    const skills = Array.from(
      new Set(
        (filterRows ?? [])
          .map((row) => row.skill)
          .filter(Boolean)
      )
    ).sort();

    const questionTypes = Array.from(
      new Set(
        (filterRows ?? [])
          .map((row) => row.question_type)
          .filter(Boolean)
      )
    ).sort();

    /*
     * ---------------------------------------------------------
     * 6. BUILD BASE QUERY
     * ---------------------------------------------------------
     */

    function applyFilters(query: any) {
  let filteredQuery = query;

  if (level) {
    filteredQuery = filteredQuery.eq(
      "cefr_level",
      level
    );
  }

  if (skill) {
    filteredQuery = filteredQuery.eq(
      "skill",
      skill
    );
  }

  if (questionType) {
    filteredQuery = filteredQuery.eq(
      "question_type",
      questionType
    );
  }

  if (search) {
    filteredQuery = filteredQuery.ilike(
      "question_text",
      `%${search}%`
    );
  }

  return filteredQuery;
}

    /*
     * ---------------------------------------------------------
     * 7. GET EXACT COUNTS
     * ---------------------------------------------------------
     *
     * These counts are independent from the 1,000-row API limit.
     * Therefore Active + Inactive will represent the real database
     * totals.
     * ---------------------------------------------------------
     */

    const totalCountQuery =
      applyFilters(
        supabase
          .from("question_bank")
          .select("id", {
            count: "exact",
            head: true,
          })
      );

    const activeCountQuery =
      applyFilters(
        supabase
          .from("question_bank")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_active", true)
      );

    const inactiveCountQuery =
      applyFilters(
        supabase
          .from("question_bank")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_active", false)
      );

    const [
      totalCountResult,
      activeCountResult,
      inactiveCountResult,
    ] = await Promise.all([
      totalCountQuery,
      activeCountQuery,
      inactiveCountQuery,
    ]);

    if (totalCountResult.error) {
      console.error(
        "Total count error:",
        totalCountResult.error
      );

      return NextResponse.json(
        {
          error:
            "Unable to count test bank questions.",
          details:
            totalCountResult.error.message,
        },
        { status: 500 }
      );
    }

    if (activeCountResult.error) {
      console.error(
        "Active count error:",
        activeCountResult.error
      );

      return NextResponse.json(
        {
          error:
            "Unable to count active questions.",
          details:
            activeCountResult.error.message,
        },
        { status: 500 }
      );
    }

    if (inactiveCountResult.error) {
      console.error(
        "Inactive count error:",
        inactiveCountResult.error
      );

      return NextResponse.json(
        {
          error:
            "Unable to count inactive questions.",
          details:
            inactiveCountResult.error.message,
        },
        { status: 500 }
      );
    }

    const total =
      totalCountResult.count ?? 0;

    const active =
      activeCountResult.count ?? 0;

    const inactive =
      inactiveCountResult.count ?? 0;

    /*
     * ---------------------------------------------------------
     * 8. LOAD ALL QUESTIONS
     * ---------------------------------------------------------
     *
     * Supabase REST responses are limited to 1,000 rows.
     *
     * Your current database contains 1,874 questions, so we
     * fetch them in batches:
     *
     * 0 - 999
     * 1000 - 1999
     *
     * This means the frontend will receive all questions instead
     * of only the first 1,000.
     * ---------------------------------------------------------
     */

    const allQuestions: Array<{
      id: string;
      skill: string;
      cefr_level: string;
      question_type: string;
      question_text: string;
      instruction: string | null;
      points: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      passage_id: string | null;
      question_options: Array<{
        id: string;
        option_key: string;
        option_text: string;
        order_number: number;
      }>;
      question_answers: Array<{
        id: string;
        correct_option_id: string;
      }>;
    }> = [];

    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;

      let query =
        supabase
          .from("question_bank")
          .select(
            `
            id,
            skill,
            cefr_level,
            question_type,
            question_text,
            instruction,
            points,
            is_active,
            created_at,
            updated_at,
            passage_id,
            question_options (
              id,
              option_key,
              option_text,
              order_number
            ),
            question_answers (
              id,
              correct_option_id
            )
            `
          )
          .order("created_at", {
            ascending: false,
          })
          .range(from, to);

      /*
       * Apply filters
       */

      if (level) {
        query = query.eq(
          "cefr_level",
          level
        );
      }

      if (skill) {
        query = query.eq(
          "skill",
          skill
        );
      }

      if (questionType) {
        query = query.eq(
          "question_type",
          questionType
        );
      }

      if (search) {
        query = query.ilike(
          "question_text",
          `%${search}%`
        );
      }

      const {
        data: batch,
        error: batchError,
      } = await query;

      if (batchError) {
        console.error(
          "Test bank batch query error:",
          batchError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load test bank.",
            details:
              batchError.message,
          },
          { status: 500 }
        );
      }

      if (!batch || batch.length === 0) {
        break;
      }

      allQuestions.push(
        ...batch
      );

      /*
       * If fewer than PAGE_SIZE were returned,
       * we have reached the end.
       */

      if (
        batch.length <
        PAGE_SIZE
      ) {
        break;
      }

      from += PAGE_SIZE;
    }

    /*
     * ---------------------------------------------------------
     * 9. NORMALIZE QUESTIONS
     * ---------------------------------------------------------
     */

    const normalizedQuestions =
      allQuestions.map(
        (question) => {
          const options =
            Array.isArray(
              question.question_options
            )
              ? question.question_options
              : [];

          const answer = Array.isArray(
  question.question_answers
)
  ? question.question_answers[0] ?? null
  : question.question_answers ?? null;

          return {
            id:
              question.id,

            skill:
              question.skill,

            cefr_level:
              question.cefr_level,

            question_type:
              question.question_type,

            question_text:
              question.question_text,

            instruction:
              question.instruction,

            points:
              question.points,

            is_active:
              question.is_active,

            created_at:
              question.created_at,

            updated_at:
              question.updated_at,

            passage_id:
              question.passage_id,

            options:
              [...options].sort(
                (a, b) =>
                  a.order_number -
                  b.order_number
              ),

            correct_option_id:
              answer?.correct_option_id ??
              null,
          };
        }
      );

    /*
     * ---------------------------------------------------------
     * 10. RETURN RESPONSE
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      questions:
        normalizedQuestions,

      total,

      active,

      inactive,

      filters: {
        levels: CEFR_LEVELS,
        skills,
        questionTypes,
      },
    });
  } catch (error) {
    console.error(
      "Test bank API error:",
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
      { status: 500 }
    );
  }
}