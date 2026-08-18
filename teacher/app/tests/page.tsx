"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Test = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  total_questions: number;
  passing_score: number | null;
  is_active: boolean;
  created_at: string;
};

type TestForm = {
  title: string;
  description: string;
  duration_minutes: string;
  total_questions: string;
  passing_score: string;
};

type ApiResponse = {
  tests?: Test[];
  test?: Test;
  error?: string;
  details?: string;
};

const EMPTY_FORM: TestForm = {
  title: "",
  description: "",
  duration_minutes: "45",
  total_questions: "46",
  passing_score: "",
};

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] =
    useState<TestForm>(EMPTY_FORM);

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

  async function loadTests() {
    try {
      setLoading(true);
      setError("");

      const accessToken =
        await getAccessToken();
        console.log("ACCESS TOKEN:", accessToken);

      const response = await fetch(
        "/api/tests",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      const result: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load tests."
        );
      }

      setTests(result.tests ?? []);
    } catch (err) {
      console.error(
        "Load tests error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadTests();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };

  // loadTests intentionally runs once when the page mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  function updateForm(
    field: keyof TestForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleCreateTest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!form.title.trim()) {
        throw new Error(
          "Test title is required."
        );
      }

      const duration = Number(
        form.duration_minutes
      );

      const totalQuestions = Number(
        form.total_questions
      );

      const passingScore =
        form.passing_score.trim()
          ? Number(form.passing_score)
          : null;

      if (
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        throw new Error(
          "Duration must be greater than 0."
        );
      }

      if (
        !Number.isFinite(
          totalQuestions
        ) ||
        totalQuestions <= 0
      ) {
        throw new Error(
          "Total questions must be greater than 0."
        );
      }

      if (
        passingScore !== null &&
        (!Number.isFinite(
          passingScore
        ) ||
          passingScore < 0)
      ) {
        throw new Error(
          "Passing score must be a valid number."
        );
      }

      const accessToken =
        await getAccessToken();

      const response = await fetch(
        "/api/tests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: form.title.trim(),
            description:
              form.description.trim() ||
              null,
            duration_minutes: duration,
            total_questions:
              totalQuestions,
            passing_score:
              passingScore,
            is_active: false,
          }),
        }
      );

      const result: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Unable to create test."
        );
      }

      setSuccess(
        "Test created successfully."
      );

      setForm(EMPTY_FORM);
      setShowForm(false);

      await loadTests();
    } catch (err) {
      console.error(
        "Create test error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create test."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleTest(
    test: Test
  ) {
    try {
      setError("");
      setSuccess("");

      const accessToken =
        await getAccessToken();

      const response = await fetch(
        `/api/tests/${test.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            is_active:
              !test.is_active,
          }),
        }
      );

      const result: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Unable to update test."
        );
      }

      setSuccess(
        test.is_active
          ? "Test disabled."
          : "Test enabled."
      );

      await loadTests();
    } catch (err) {
      console.error(
        "Toggle test error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update test."
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Tests
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create and manage tests that
              can be assigned to campaigns.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setShowForm(
                (current) => !current
              );
            }}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showForm
              ? "Close"
              : "Create Test"}
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">
              {success}
            </p>
          </div>
        )}

        {showForm && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Create Test
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Create a test first. You can
              then select it when creating a
              campaign.
            </p>

            <form
              onSubmit={handleCreateTest}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="test-title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Test Title
                </label>

                <input
                  id="test-title"
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="English Placement Test"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="test-description"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="test-description"
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="English placement assessment"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="duration"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Duration (minutes)
                  </label>

                  <input
                    id="duration"
                    type="number"
                    min="1"
                    value={
                      form.duration_minutes
                    }
                    onChange={(event) =>
                      updateForm(
                        "duration_minutes",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="total-questions"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Total Questions
                  </label>

                  <input
                    id="total-questions"
                    type="number"
                    min="1"
                    value={
                      form.total_questions
                    }
                    onChange={(event) =>
                      updateForm(
                        "total_questions",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="passing-score"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Passing Score
                  </label>

                  <input
                    id="passing-score"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.passing_score
                    }
                    onChange={(event) =>
                      updateForm(
                        "passing_score",
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating..."
                    : "Create Test"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Test Library
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These tests can be selected when
              creating a campaign.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <p className="text-sm text-slate-400">
                Loading tests...
              </p>
            </div>
          ) : tests.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-6">
              <div className="text-center">
                <p className="font-medium text-slate-700">
                  No tests found
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Create your first test
                  above.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Test
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Duration
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Questions
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Passing Score
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Status
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {tests.map((test) => (
                    <tr
                      key={test.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">
                          {test.title}
                        </p>

                        {test.description && (
                          <p className="mt-1 max-w-md text-xs text-slate-400">
                            {
                              test.description
                            }
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {
                          test.duration_minutes
                        }{" "}
                        min
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {
                          test.total_questions
                        }
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {test.passing_score ===
                        null
                          ? "—"
                          : test.passing_score}
                      </td>

                      <td className="px-4 py-4">
                        {test.is_active ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void toggleTest(
                              test
                            )
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          {test.is_active
                            ? "Disable"
                            : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}