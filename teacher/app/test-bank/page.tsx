"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Option = {
  id: string;
  option_key: string;
  option_text: string;
  order_number: number;
};

type Question = {
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
  options: Option[];
  correct_option_id: string | null;
};

type TestBankResponse = {
  questions: Question[];
  total: number;
  active: number;
  inactive: number;
  filters: {
    levels: string[];
    skills: string[];
    questionTypes: string[];
  };
};

type UploadResponse = {
  success?: boolean;
  error?: string;
  details?: string;
  file_name?: string;
  total_rows?: number;
  imported?: number;
  valid_rows?: number;
  invalid_rows?: number;
  errors?: Array<{
    row: number;
    error: string;
  }>;
};

export default function TestBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [levels, setLevels] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [questionTypes, setQuestionTypes] = useState<string[]>(
    []
  );

  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] =
    useState<UploadResponse | null>(null);

  const [showUpload, setShowUpload] = useState(false);

  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(
    null
  );

  const [page, setPage] = useState(1);

  const pageSize = 20;

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    return session.access_token;
  }

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");

      const accessToken = await getAccessToken();

      const params = new URLSearchParams();

      if (selectedLevel) {
        params.set("level", selectedLevel);
      }

      if (selectedSkill) {
        params.set("skill", selectedSkill);
      }

      if (selectedType) {
        params.set("question_type", selectedType);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const queryString = params.toString();

      const response = await fetch(
        `/api/test-bank${
          queryString ? `?${queryString}` : ""
        }`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      const result: TestBankResponse & {
        error?: string;
        details?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load test bank."
        );
      }

      setQuestions(result.questions ?? []);
      setTotalQuestions(result.total ?? 0);

      setLevels(result.filters?.levels ?? []);
      setSkills(result.filters?.skills ?? []);
      setQuestionTypes(
        result.filters?.questionTypes ?? []
      );

      setPage(1);
    } catch (err) {
      console.error(
        "Test bank loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load test bank."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuestions();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };

    // Filters intentionally trigger a new API request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedLevel,
    selectedSkill,
    selectedType,
    search,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(questions.length / pageSize)
  );

  const visibleQuestions = useMemo(() => {
    const start = (page - 1) * pageSize;

    return questions.slice(
      start,
      start + pageSize
    );
  }, [questions, page]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);
    setFileName(file?.name ?? "");
    setUploadResult(null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setUploadResult({
        error: "Please select an Excel file first.",
      });

      return;
    }

    try {
      setUploading(true);
      setUploadResult(null);

      const accessToken = await getAccessToken();

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(
        "/api/test-bank/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      const result: UploadResponse =
        await response.json();

      if (!response.ok) {
        setUploadResult(result);
        return;
      }

      setUploadResult(result);

      setSelectedFile(null);
      setFileName("");

      const input =
        document.getElementById(
          "test-bank-file"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await loadQuestions();
    } catch (err) {
      console.error(
        "Test bank upload error:",
        err
      );

      setUploadResult({
        error:
          err instanceof Error
            ? err.message
            : "Unable to upload file.",
      });
    } finally {
      setUploading(false);
    }
  }

  function resetFilters() {
    setSelectedLevel("");
    setSelectedSkill("");
    setSelectedType("");
    setSearch("");
  }

  function isCorrectOption(
  question: Question,
  option: Option
) {
  const correctAnswer =
    getCorrectAnswer(question);

  return (
    correctAnswer !== "—" &&
    option.option_key === correctAnswer
  );
}

  function getCorrectAnswer(
    question: Question
  ) {
    if (!question.correct_option_id) {
      return "—";
    }

    const correctOption =
      question.options.find(
        (option) =>
          option.id ===
          question.correct_option_id
      );

    return correctOption?.option_key ?? "—";
  }

  function formatQuestionType(
    type: string
  ) {
    if (type === "multiple_choice") {
      return "Multiple Choice";
    }

    return type
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (letter) => letter.toUpperCase()
      );
  }

  function levelBadgeClass(
    level: string
  ) {
    if (level === "A1") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (level === "A2") {
      return "bg-sky-50 text-sky-700";
    }

    if (level === "B1") {
      return "bg-amber-50 text-amber-700";
    }

    if (level === "B2") {
      return "bg-violet-50 text-violet-700";
    }

    return "bg-slate-100 text-slate-700";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* HEADER */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Test Bank
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage placement test questions by CEFR level and skill.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowUpload((current) => !current)
            }
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {showUpload
              ? "Close Upload"
              : "Upload Excel"}
          </button>
        </div>

        {/* UPLOAD */}
        {showUpload && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-900">
                Upload Test Bank
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Upload an Excel file containing your question bank.
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
              <label
                htmlFor="test-bank-file"
                className="block cursor-pointer"
              >
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Select Excel file
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    .xlsx or .xls
                  </p>
                </div>

                <input
                  id="test-bank-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mt-4 block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:shadow-sm"
                />
              </label>

              {fileName && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm text-slate-700">
                    Selected file:
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {fileName}
                  </p>
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={
                    uploading ||
                    !selectedFile
                  }
                  onClick={handleUpload}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading
                    ? "Uploading..."
                    : "Import Test Bank"}
                </button>
              </div>
            </div>

            {uploadResult && (
              <div
                className={`mt-5 rounded-lg border px-4 py-4 ${
                  uploadResult.success
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                {uploadResult.success ? (
                  <>
                    <p className="font-medium text-emerald-800">
                      Upload successful
                    </p>

                    <p className="mt-1 text-sm text-emerald-700">
                      {uploadResult.imported ?? 0}{" "}
                      questions imported from{" "}
                      {uploadResult.file_name}.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-red-800">
                      Upload failed
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      {uploadResult.error ||
                        uploadResult.details ||
                        "Unable to upload the file."}
                    </p>

                    {uploadResult.errors &&
                      uploadResult.errors.length > 0 && (
                        <div className="mt-4 max-h-48 overflow-y-auto rounded-md border border-red-200 bg-white">
                          {uploadResult.errors.map(
                            (item) => (
                              <div
                                key={`${item.row}-${item.error}`}
                                className="border-b border-red-100 px-3 py-2 text-xs text-red-700 last:border-0"
                              >
                                Row {item.row}:{" "}
                                {item.error}
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="font-medium text-red-800">
              Unable to load Test Bank
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadQuestions()}
              className="mt-3 text-sm font-medium text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Total Questions
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading
                ? "—"
                : totalQuestions}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Active
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading
                ? "—"
                : questions.filter(
                    (question) =>
                      question.is_active
                  ).length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Inactive
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading
                ? "—"
                : questions.filter(
                    (question) =>
                      !question.is_active
                  ).length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Showing
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {loading
                ? "—"
                : questions.length}
            </p>
          </div>

        </div>

        {/* QUESTION SECTION */}
        <section className="rounded-xl border border-slate-200 bg-white">

          {/* FILTER HEADER */}
          <div className="border-b border-slate-200 px-6 py-5">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Questions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Search and filter your question bank.
                </p>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Reset filters
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">

              {/* SEARCH */}
              <div className="lg:col-span-2">
                <label
                  htmlFor="question-search"
                  className="mb-1.5 block text-xs font-medium text-slate-500"
                >
                  Search
                </label>

                <input
                  id="question-search"
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search question..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>

              {/* LEVEL */}
              <div>
                <label
                  htmlFor="level-filter"
                  className="mb-1.5 block text-xs font-medium text-slate-500"
                >
                  CEFR Level
                </label>

                <select
                  id="level-filter"
                  value={selectedLevel}
                  onChange={(event) =>
                    setSelectedLevel(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">
                    All levels
                  </option>

                  {levels.map((level) => (
                    <option
                      key={level}
                      value={level}
                    >
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* SKILL */}
              <div>
                <label
                  htmlFor="skill-filter"
                  className="mb-1.5 block text-xs font-medium text-slate-500"
                >
                  Skill
                </label>

                <select
                  id="skill-filter"
                  value={selectedSkill}
                  onChange={(event) =>
                    setSelectedSkill(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">
                    All skills
                  </option>

                  {skills.map((skill) => (
                    <option
                      key={skill}
                      value={skill}
                    >
                      {skill}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* QUESTION TYPE */}
            <div className="mt-3 max-w-xs">
              <label
                htmlFor="type-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Question Type
              </label>

              <select
                id="type-filter"
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              >
                <option value="">
                  All types
                </option>

                {questionTypes.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {formatQuestionType(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* LOADING */}
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <p className="text-sm text-slate-400">
                Loading questions...
              </p>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center px-6">
              <div className="text-center">
                <p className="font-medium text-slate-700">
                  No questions found
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Try changing your filters or upload a test bank.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1300px]">

                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">

                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Question
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Level
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Skill
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Type
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Options
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Answer
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                        Status
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {visibleQuestions.map(
                      (question) => (
                        <tr
                          key={question.id}
                          className="align-top transition hover:bg-slate-50"
                        >

                          {/* QUESTION */}
                          <td className="max-w-[400px] px-6 py-5">

                            <p className="text-sm font-medium leading-6 text-slate-900">
                              {question.question_text}
                            </p>

                            {question.instruction && (
                              <p className="mt-2 text-xs text-slate-400">
                                {question.instruction}
                              </p>
                            )}

                            <p className="mt-2 text-xs text-slate-400">
                              {question.options.length}{" "}
                              options
                            </p>

                          </td>

                          {/* LEVEL */}
                          <td className="px-4 py-5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${levelBadgeClass(
                                question.cefr_level
                              )}`}
                            >
                              {question.cefr_level}
                            </span>
                          </td>

                          {/* SKILL */}
                          <td className="px-4 py-5 text-sm text-slate-600">
                            {question.skill}
                          </td>

                          {/* TYPE */}
                          <td className="px-4 py-5 text-sm text-slate-600">
                            {formatQuestionType(
                              question.question_type
                            )}
                          </td>

                          {/* OPTIONS */}
                          <td className="px-4 py-5">
                            <div className="min-w-[360px] space-y-2">

                              {question.options.length === 0 ? (
                                <span className="text-sm text-slate-400">
                                  No options
                                </span>
                              ) : (
                                question.options.map(
                                  (option) => {
                                    const correct =
                                      isCorrectOption(
                                        question,
                                        option
                                      );

                                    return (
                                      <div
                                        key={option.id}
                                        className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                                          correct
                                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                            : "bg-slate-50 text-slate-700"
                                        }`}
                                      >

                                        <span
                                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                            correct
                                              ? "bg-emerald-600 text-white"
                                              : "bg-white text-slate-500 ring-1 ring-slate-200"
                                          }`}
                                        >
                                          {option.option_key}
                                        </span>

                                        <span className="leading-5">
                                          {option.option_text}
                                        </span>

                                        {correct && (
                                          <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                            Correct
                                          </span>
                                        )}

                                      </div>
                                    );
                                  }
                                )
                              )}

                            </div>
                          </td>

                         {/* ANSWER */}
<td className="px-4 py-5">
  <div className="min-w-[260px]">
    {(() => {
      const correctAnswer =
        question.options.find(
          (option) =>
            option.id ===
            question.correct_option_id
        );

      if (!correctAnswer) {
        return (
          <span className="text-sm text-slate-400">
            No answer
          </span>
        );
      }

      return (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {correctAnswer.option_key}
            </span>

            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {correctAnswer.option_text}
              </p>

              <p className="mt-1 text-xs font-medium text-emerald-600">
                Correct answer
              </p>
            </div>
          </div>
        </div>
      );
    })()}
  </div>
</td>

                          {/* STATUS */}
                          <td className="px-4 py-5">
                            {question.is_active ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Inactive
                              </span>
                            )}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">

                <p className="text-sm text-slate-500">
                  Showing{" "}
                  {Math.min(
                    (page - 1) * pageSize + 1,
                    questions.length
                  )}
                  –
                  {Math.min(
                    page * pageSize,
                    questions.length
                  )}{" "}
                  of{" "}
                  {questions.length}
                </p>

                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="px-2 text-sm text-slate-500">
                    {page} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      page >= totalPages
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          totalPages,
                          current + 1
                        )
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>

                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}