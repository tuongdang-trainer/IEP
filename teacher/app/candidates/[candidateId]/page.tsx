"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Campaign = {
  id: string;
  code: string;
  name: string;
};

type Attempt = {
  id: string;
  campaign_id: string | null;
  test_id: string | null;
  login_method: string | null;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  duration_seconds: number | null;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  diagnosis: string | null;
  is_suspicious: boolean;
  tab_switch_count: number;
  blur_count: number;
  paste_count: number;
  copy_count: number;
  fullscreen_exit_count: number;
  created_at: string;
  updated_at: string;
  campaign: Campaign | null;
};

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  team: string | null;
  created_at: string;
  updated_at: string;
};

type CandidateDetailResponse = {
  candidate: Candidate;
  summary: {
    total_attempts: number;
    completed_attempts: number;
    in_progress: number;
    suspicious_attempts: number;
    latest_percentage: number | null;
    latest_diagnosis: string | null;
  };
  attempts: Attempt[];
};

export default function CandidateDetailPage() {
  const params = useParams();

  const candidateId =
    typeof params.candidateId === "string"
      ? params.candidateId
      : "";

  const [data, setData] =
    useState<CandidateDetailResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadCandidate = useCallback(async () => {
    if (!candidateId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response = await fetch(
        `/api/candidates/${candidateId}`,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load candidate."
        );
      }

      setData(result);
    } catch (err) {
      console.error(
        "Candidate detail loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load candidate."
      );
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    // This effect intentionally loads external API data
    // and synchronizes the response into component state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCandidate();
  }, [loadCandidate]);

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(date));
  }

  function formatPercentage(
    percentage: number | null
  ) {
    if (percentage === null) {
      return "—";
    }

    return `${Math.round(percentage)}%`;
  }

  function getAttemptStatus(
    attempt: Attempt
  ) {
    if (attempt.is_suspicious) {
      return {
        label: "Suspicious",
        className:
          "bg-red-50 text-red-700",
      };
    }

    if (
      attempt.status === "submitted"
    ) {
      return {
        label: "Completed",
        className:
          "bg-emerald-50 text-emerald-700",
      };
    }

    return {
      label: "In Progress",
      className:
        "bg-amber-50 text-amber-700",
    };
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          <main className="flex-1 p-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex min-h-64 items-center justify-center">
                <p className="text-sm text-slate-400">
                  Loading candidate...
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          <main className="flex-1 p-8">
            <div className="mx-auto max-w-7xl">
              <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5">
                <p className="font-medium text-red-800">
                  Unable to load candidate
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error ||
                    "Candidate data is unavailable."}
                </p>

                <Link
                  href="/candidates"
                  className="mt-4 inline-block text-sm font-medium text-red-800 underline"
                >
                  Back to Candidates
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">

            <div className="mb-6">
              <Link
                href="/candidates"
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                ← Back to Candidates
              </Link>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {data.candidate.full_name}
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    {data.candidate.email}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Team:{" "}
                      {data.candidate.team ||
                        "—"}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Registered{" "}
                      {formatDate(
                        data.candidate.created_at
                      )}
                    </span>

                  </div>
                </div>

                {data.summary.latest_percentage !==
                  null && (
                  <div className="text-left md:text-right">

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Latest Result
                    </p>

                    <p className="mt-1 text-4xl font-semibold text-slate-900">
                      {formatPercentage(
                        data.summary.latest_percentage
                      )}
                    </p>

                    {data.summary.latest_diagnosis && (
                      <p className="mt-1 text-sm text-slate-500">
                        {
                          data.summary
                            .latest_diagnosis
                        }
                      </p>
                    )}

                  </div>
                )}

              </div>
            </div>

            <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">
                  Total Attempts
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.summary.total_attempts}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">
                  Completed
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.summary.completed_attempts}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">
                  In Progress
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.summary.in_progress}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">
                  Suspicious
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.summary.suspicious_attempts}
                </p>
              </div>

            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">

              <div className="border-b border-slate-200 px-6 py-5">

                <h2 className="font-semibold text-slate-900">
                  Test History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  All placement test attempts for this candidate.
                </p>

              </div>

              {data.attempts.length === 0 ? (

                <div className="flex min-h-56 items-center justify-center">

                  <div className="text-center">

                    <p className="font-medium text-slate-700">
                      No test attempts
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      This candidate has not taken a test yet.
                    </p>

                  </div>

                </div>

              ) : (

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[1000px]">

                    <thead>

                      <tr className="border-b border-slate-200 bg-slate-50">

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Campaign
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Date
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Score
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Level
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Status
                        </th>

                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                          Action
                        </th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {data.attempts.map(
                        (attempt) => {

                          const status =
                            getAttemptStatus(
                              attempt
                            );

                          return (
                            <tr
                              key={attempt.id}
                              className="transition hover:bg-slate-50"
                            >

                              <td className="px-6 py-4">

                                <div>

                                  <p className="text-sm font-medium text-slate-900">
                                    {attempt.campaign
                                      ?.name ||
                                      "Placement Test"}
                                  </p>

                                  {attempt.campaign
                                    ?.code && (
                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {
                                        attempt
                                          .campaign
                                          .code
                                      }
                                    </p>
                                  )}

                                </div>

                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {formatDate(
                                  attempt.submitted_at ||
                                    attempt.started_at
                                )}
                              </td>

                              <td className="px-6 py-4">

                                <span className="text-sm font-medium text-slate-900">
                                  {formatPercentage(
                                    attempt.percentage
                                  )}
                                </span>

                              </td>

                              <td className="px-6 py-4">

                                <span className="text-sm text-slate-700">
                                  {attempt.diagnosis ||
                                    "—"}
                                </span>

                              </td>

                              <td className="px-6 py-4">

                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                                >
                                  {status.label}
                                </span>

                              </td>

                              <td className="px-6 py-4 text-right">

                                {attempt.status ===
                                "submitted" ? (

                                  <Link
                                    href={`/results/${attempt.id}`}
                                    className="text-sm font-medium text-slate-700 hover:text-slate-900"
                                  >
                                    View Result
                                  </Link>

                                ) : (

                                  <span className="text-sm text-slate-400">
                                    —
                                  </span>

                                )}

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </div>
        </main>
      </div>
    </div>
  );
}