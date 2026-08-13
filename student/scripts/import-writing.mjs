import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import xlsx from "xlsx";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node scripts/import-writing.mjs <xlsx-file>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const rows = xlsx.utils.sheet_to_json(sheet, {
  defval: null,
});

console.log(`Loaded ${rows.length} writing tasks`);

let imported = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const title = String(row.title ?? "").trim();
  const prompt = String(row.prompt ?? "").trim();

  if (!title || !prompt) {
    console.log(`SKIP — missing title or prompt`);
    skipped++;
    continue;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("writing_tasks")
    .select("id")
    .eq("title", title)
    .maybeSingle();

  if (lookupError) {
    console.error(`FAILED ${title}: ${lookupError.message}`);
    failed++;
    continue;
  }

  if (existing) {
    console.log(`SKIP ${title} — already exists`);
    skipped++;
    continue;
  }

  const payload = {
    title,
    prompt,
    instructions:
      row.instructions === null || row.instructions === undefined
        ? null
        : String(row.instructions).trim(),
    word_limit_min:
      row.word_limit_min === null || row.word_limit_min === undefined
        ? null
        : Number(row.word_limit_min),
    word_limit_max:
      row.word_limit_max === null || row.word_limit_max === undefined
        ? null
        : Number(row.word_limit_max),
    time_limit_minutes:
      row.time_limit_minutes === null ||
      row.time_limit_minutes === undefined
        ? null
        : Number(row.time_limit_minutes),
    points: Number(row.points ?? 1),
    is_active:
      row.is_active === true ||
      String(row.is_active).toLowerCase() === "true",
  };

  const { error: insertError } = await supabase
    .from("writing_tasks")
    .insert(payload);

  if (insertError) {
    console.error(`FAILED ${title}: ${insertError.message}`);
    failed++;
    continue;
  }

  imported++;

  if (imported % 25 === 0) {
    console.log(`Imported: ${imported}/${rows.length}`);
  }
}

console.log("");
console.log("========== WRITING IMPORT SUMMARY ==========");
console.log(`Total:     ${rows.length}`);
console.log(`Imported:  ${imported}`);
console.log(`Skipped:   ${skipped}`);
console.log(`Failed:    ${failed}`);
console.log("============================================");
