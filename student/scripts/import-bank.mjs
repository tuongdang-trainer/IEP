import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const [, , fileArg, levelArg] = process.argv;

if (!fileArg || !levelArg) {
  console.error("Usage: node scripts/import-bank.mjs <file.xlsx> <A1|A2|B1|B2>");
  process.exit(1);
}

const filePath = path.resolve(fileArg);
const level = levelArg.toUpperCase();

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

if (!["A1", "A2", "B1", "B2"].includes(level)) {
  console.error("Level must be A1, A2, B1, or B2.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load XLSX using Python/openpyxl.
// This avoids adding another npm dependency.
const pythonScript = `
import openpyxl
import json
import sys

file_path = sys.argv[1]

wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
ws = wb.active

rows = list(ws.iter_rows(values_only=True))

if not rows:
    print(json.dumps([]))
    sys.exit(0)

headers = [str(x).strip() if x is not None else "" for x in rows[0]]

data = []

for row in rows[1:]:
    item = {}
    for i, header in enumerate(headers):
        item[header] = row[i] if i < len(row) else None
    data.append(item)

print(json.dumps(data, ensure_ascii=False))
`;

const tempScript = path.join("/tmp", `read-bank-${Date.now()}.py`);
fs.writeFileSync(tempScript, pythonScript);

let rows;

try {
  const output = execSync(
    `python3 "${tempScript}" "${filePath}"`,
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );

  rows = JSON.parse(output);
} catch (error) {
  console.error("Could not read Excel file.");
  console.error(error.message);
  process.exit(1);
} finally {
  try {
    fs.unlinkSync(tempScript);
  } catch {}
}

console.log(`Loaded ${rows.length} questions from ${path.basename(filePath)}`);

if (rows.length === 0) {
  console.error("No questions found.");
  process.exit(1);
}

const requiredColumns = [
  "question_code",
  "cefr_level",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "correct_answer",
  "points",
  "is_active",
];

for (const column of requiredColumns) {
  if (!(column in rows[0])) {
    console.error(`Missing required column: ${column}`);
    process.exit(1);
  }
}

let imported = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const questionCode = String(row.question_code ?? "").trim();
  const rowLevel = String(row.cefr_level ?? "").trim().toUpperCase();
  const questionText = String(row.question_text ?? "").trim();
  const correctAnswer = String(row.correct_answer ?? "").trim().toUpperCase();

  if (!questionCode || !questionText) {
    console.error("Skipping row with missing question_code/question_text.");
    failed++;
    continue;
  }

  if (rowLevel !== level) {
    console.error(
      `Skipping ${questionCode}: expected ${level}, got ${rowLevel}`
    );
    failed++;
    continue;
  }

  if (!["A", "B", "C", "D"].includes(correctAnswer)) {
    console.error(
      `Skipping ${questionCode}: invalid correct_answer ${correctAnswer}`
    );
    failed++;
    continue;
  }

  const options = [
    ["A", row.option_a],
    ["B", row.option_b],
    ["C", row.option_c],
    ["D", row.option_d],
  ].filter(([, value]) => value !== null && String(value).trim() !== "");

  const correctOption = options.find(([key]) => key === correctAnswer);

  if (!correctOption) {
    console.error(
      `Skipping ${questionCode}: correct answer ${correctAnswer} has no option text`
    );
    failed++;
    continue;
  }

  // question_bank does not currently have question_code,
  // so we use question_text + CEFR to detect duplicates.
  const { data: existingQuestion, error: existingError } = await supabase
    .from("question_bank")
    .select("id")
    .eq("cefr_level", level)
    .eq("question_text", questionText)
    .maybeSingle();

  if (existingError) {
    console.error(
      `Could not check ${questionCode}: ${existingError.message}`
    );
    failed++;
    continue;
  }

  if (existingQuestion) {
    console.log(`SKIP ${questionCode} — already exists`);
    skipped++;
    continue;
  }

  const points = Number(row.points ?? 1);
  const isActive =
    row.is_active === true ||
    String(row.is_active).toLowerCase() === "true" ||
    String(row.is_active) === "1";

  // Database requires a valid skill.
  // Current test logic is CEFR-based, not skill-based.
  const skill = "grammar";

  const { data: question, error: questionError } = await supabase
    .from("question_bank")
    .insert({
      skill,
      cefr_level: level,
      question_type: "multiple_choice",
      question_text: questionText,
      points,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (questionError) {
    console.error(
      `FAILED ${questionCode}: ${questionError.message}`
    );
    failed++;
    continue;
  }

  const optionRows = options.map(([key, text], index) => ({
    question_id: question.id,
    option_key: key,
    option_text: String(text).trim(),
    order_number: index + 1,
  }));

  const { data: insertedOptions, error: optionError } = await supabase
    .from("question_options")
    .insert(optionRows)
    .select("id, option_key");

  if (optionError) {
    console.error(
      `FAILED options for ${questionCode}: ${optionError.message}`
    );

    await supabase
      .from("question_bank")
      .delete()
      .eq("id", question.id);

    failed++;
    continue;
  }

  const correctInsertedOption = insertedOptions.find(
    (option) => option.option_key === correctAnswer
  );

  if (!correctInsertedOption) {
    console.error(
      `FAILED answer for ${questionCode}: correct option not found`
    );

    await supabase
      .from("question_bank")
      .delete()
      .eq("id", question.id);

    failed++;
    continue;
  }

  const { error: answerError } = await supabase
    .from("question_answers")
    .insert({
      question_id: question.id,
      correct_option_id: correctInsertedOption.id,
    });

  if (answerError) {
    console.error(
      `FAILED answer for ${questionCode}: ${answerError.message}`
    );

    await supabase
      .from("question_bank")
      .delete()
      .eq("id", question.id);

    failed++;
    continue;
  }

  imported++;

  if (imported % 25 === 0) {
    console.log(`Imported: ${imported}/${rows.length}`);
  }
}

console.log("");
console.log("========== IMPORT SUMMARY ==========");
console.log(`Level:     ${level}`);
console.log(`Total:     ${rows.length}`);
console.log(`Imported:  ${imported}`);
console.log(`Skipped:   ${skipped}`);
console.log(`Failed:    ${failed}`);
console.log("====================================");
