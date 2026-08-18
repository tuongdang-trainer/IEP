import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type ExcelRow = {
  question_code?: unknown;
  cefr_level?: unknown;
  question_text?: unknown;
  option_a?: unknown;
  option_b?: unknown;
  option_c?: unknown;
  option_d?: unknown;
  correct_answer?: unknown;
  points?: unknown;
  is_active?: unknown;
};

type ValidRow = {
  rowNumber: number;
  questionCode: string;
  questionText: string;
  cefrLevel: string;
  points: number;
  isActive: boolean;
  options: Array<{
    key: string;
    text: string;
  }>;
  correctAnswer: string;
};

function getString(value: unknown): string {
  return String(value ?? "").trim();
}

function getNumber(value: unknown, fallback = 1): number {
  const number =
    typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeText(value: unknown): string {
  return getString(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeAnswer(value: unknown): string {
  return getString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getBoolean(
  value: unknown,
  fallback = true
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = getString(value).toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getOption(
  row: ExcelRow,
  key: string
): string {
  switch (key) {
    case "A":
      return getString(row.option_a);

    case "B":
      return getString(row.option_b);

    case "C":
      return getString(row.option_c);

    case "D":
      return getString(row.option_d);

    default:
      return "";
  }
}

export async function POST(request: Request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const accessToken =
      authHeader.replace("Bearer ", "");

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
        { error: "Unauthorized." },
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
     * 4. READ FILE
     * ---------------------------------------------------------
     */

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Please upload an Excel file.",
        },
        { status: 400 }
      );
    }

    const fileName =
      file.name.toLowerCase();

    if (
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls")
    ) {
      return NextResponse.json(
        {
          error:
            "Only .xlsx and .xls files are supported.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer =
      await file.arrayBuffer();

    const workbook =
      XLSX.read(arrayBuffer, {
        type: "array",
      });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json(
        {
          error:
            "The Excel file contains no worksheets.",
        },
        { status: 400 }
      );
    }

    const firstSheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    const rows =
      XLSX.utils.sheet_to_json<ExcelRow>(
        firstSheet,
        {
          defval: "",
        }
      );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "The Excel worksheet contains no data.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. VALIDATE ROWS
     * ---------------------------------------------------------
     */

    const errors: Array<{
      row: number;
      error: string;
    }> = [];

    const validRows: ValidRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;

      const questionCode =
        getString(row.question_code);

      const questionText =
        getString(row.question_text);

      const cefrLevel =
        getString(row.cefr_level).toUpperCase();

      const points =
        getNumber(row.points, 1);

      const isActive =
        getBoolean(row.is_active, true);

      const correctAnswer =
        normalizeAnswer(
          row.correct_answer
        );

      const options =
        ["A", "B", "C", "D"]
          .map((key) => ({
            key,
            text: getOption(row, key),
          }))
          .filter(
            (option) => option.text
          );

      /*
       * Required question fields
       */

      if (!questionText) {
        errors.push({
          row: rowNumber,
          error:
            "Missing question_text.",
        });

        return;
      }

      if (!cefrLevel) {
        errors.push({
          row: rowNumber,
          error:
            "Missing cefr_level.",
        });

        return;
      }

      if (options.length < 2) {
        errors.push({
          row: rowNumber,
          error:
            "Question must have at least 2 options.",
        });

        return;
      }

      if (
        !["A", "B", "C", "D"].includes(
          correctAnswer
        )
      ) {
        errors.push({
          row: rowNumber,
          error:
            "correct_answer must be A, B, C, or D.",
        });

        return;
      }

      if (
        !options.some(
          (option) =>
            option.key === correctAnswer
        )
      ) {
        errors.push({
          row: rowNumber,
          error:
            `Correct answer ${correctAnswer} does not have a corresponding option.`,
        });

        return;
      }

      validRows.push({
        rowNumber,
        questionCode,
        questionText,
        cefrLevel,
        points,
        isActive,
        options,
        correctAnswer,
      });
    });

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error:
            "The file contains invalid rows.",
          total_rows: rows.length,
          valid_rows: validRows.length,
          invalid_rows: errors.length,
          errors,
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. IMPORT WITH DUPLICATE DETECTION
     * ---------------------------------------------------------
     */

    const insertedQuestionIds: string[] = [];

    let imported = 0;
    let skipped = 0;

    const skippedRows: Array<{
      row: number;
      question_code: string;
      reason: string;
    }> = [];

    for (const item of validRows) {
      /*
       * -------------------------------------------------------
       * Find existing questions with the same normalized
       * question text + CEFR level.
       * -------------------------------------------------------
       */

      const {
        data: existingQuestions,
        error: existingQuestionError,
      } = await supabase
        .from("question_bank")
        .select(
          `
          id,
          question_text,
          cefr_level,
          question_type,
          points,
          is_active,
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
        .eq("cefr_level", item.cefrLevel)
        .eq("question_type", "multiple_choice")
        .ilike(
          "question_text",
          item.questionText
        );

      if (existingQuestionError) {
        console.error(
          "Existing question lookup error:",
          existingQuestionError
        );

        return NextResponse.json(
          {
            error:
              "Upload failed while checking duplicate questions.",
            row: item.rowNumber,
            details:
              existingQuestionError.message,
          },
          { status: 500 }
        );
      }

      /*
       * -------------------------------------------------------
       * Compare the complete question:
       *
       * question text
       * +
       * options
       * +
       * correct answer
       * -------------------------------------------------------
       */

      let duplicate = false;

      for (
        const existing of existingQuestions ?? []
      ) {
        const existingOptions =
          existing.question_options ?? [];

        const existingAnswers =
          existing.question_answers ?? [];

        if (
          normalizeText(
            existing.question_text
          ) !==
          normalizeText(
            item.questionText
          )
        ) {
          continue;
        }

        if (
          existingOptions.length !==
          item.options.length
        ) {
          continue;
        }

        const optionsMatch =
          item.options.every(
            (newOption) => {
              const existingOption =
                existingOptions.find(
                  (
                    option: {
                      option_key: string;
                      option_text: string;
                    }
                  ) =>
                    option.option_key ===
                    newOption.key
                );

              return (
                !!existingOption &&
                normalizeText(
                  existingOption.option_text
                ) ===
                  normalizeText(
                    newOption.text
                  )
              );
            }
          );

        if (!optionsMatch) {
          continue;
        }

        const correctOption =
          existingOptions.find(
            (
              option: {
                id: string;
                option_key: string;
              }
            ) =>
              option.option_key ===
              item.correctAnswer
          );

        if (!correctOption) {
          continue;
        }

        const answerMatches =
          existingAnswers.some(
            (
              answer: {
                correct_option_id: string;
              }
            ) =>
              answer.correct_option_id ===
              correctOption.id
          );

        if (!answerMatches) {
          continue;
        }

        duplicate = true;
        break;
      }

      if (duplicate) {
        skipped += 1;

        skippedRows.push({
          row: item.rowNumber,
          question_code:
            item.questionCode,
          reason:
            "Question, options, and correct answer already exist.",
        });

        continue;
      }

      /*
       * -------------------------------------------------------
       * INSERT QUESTION
       * -------------------------------------------------------
       *
       * Existing question_bank schema requires skill.
       *
       * Your current Excel files do not contain skill,
       * so existing imported grammar test banks are treated
       * as grammar questions.
       */

      const {
        data: question,
        error: questionError,
      } = await supabase
        .from("question_bank")
        .insert({
          skill: "grammar",
          cefr_level:
            item.cefrLevel,
          question_type:
            "multiple_choice",
          question_text:
            item.questionText,
          instruction: null,
          points:
            item.points,
          is_active:
            item.isActive,
        })
        .select("id")
        .single();

      if (
        questionError ||
        !question
      ) {
        console.error(
          "Question insert error:",
          questionError
        );

        return NextResponse.json(
          {
            error:
              "Upload failed while creating a question.",
            row: item.rowNumber,
            details:
              questionError?.message,
          },
          { status: 500 }
        );
      }

      insertedQuestionIds.push(
        question.id
      );

      /*
       * -------------------------------------------------------
       * INSERT OPTIONS
       * -------------------------------------------------------
       */

      const optionRows =
        item.options.map(
          (option, index) => ({
            question_id:
              question.id,
            option_key:
              option.key,
            option_text:
              option.text,
            order_number:
              index + 1,
          })
        );

      const {
        data: insertedOptions,
        error: optionsError,
      } = await supabase
        .from("question_options")
        .insert(optionRows)
        .select(
          "id, option_key"
        );

      if (
        optionsError ||
        !insertedOptions
      ) {
        console.error(
          "Options insert error:",
          optionsError
        );

        return NextResponse.json(
          {
            error:
              "Upload failed while creating question options.",
            row: item.rowNumber,
            details:
              optionsError?.message,
          },
          { status: 500 }
        );
      }

      /*
       * -------------------------------------------------------
       * FIND CORRECT OPTION
       * -------------------------------------------------------
       */

      const correctOption =
        insertedOptions.find(
          (option) =>
            option.option_key ===
            item.correctAnswer
        );

      if (!correctOption) {
        return NextResponse.json(
          {
            error:
              "Unable to identify the correct option.",
            row: item.rowNumber,
          },
          { status: 500 }
        );
      }

      /*
       * -------------------------------------------------------
       * INSERT ANSWER
       * -------------------------------------------------------
       */

      const {
        error: answerError,
      } = await supabase
        .from("question_answers")
        .insert({
          question_id:
            question.id,
          correct_option_id:
            correctOption.id,
        });

      if (answerError) {
        console.error(
          "Answer insert error:",
          answerError
        );

        return NextResponse.json(
          {
            error:
              "Upload failed while saving the correct answer.",
            row: item.rowNumber,
            details:
              answerError.message,
          },
          { status: 500 }
        );
      }

      imported += 1;
    }

    /*
     * ---------------------------------------------------------
     * 7. RETURN RESULT
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      file_name: file.name,
      total_rows: rows.length,
      valid_rows: validRows.length,
      invalid_rows: 0,
      imported,
      skipped,
      question_ids:
        insertedQuestionIds,
      skipped_rows:
        skippedRows,
    });
  } catch (error) {
    console.error(
      "Test bank upload error:",
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