"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type LatestAttempt = {
  id: string;
  status: string;
  percentage: number | null;
  diagnosis: string | null;
  submitted_at: string | null;
  is_suspicious: boolean;
  campaign_id: string | null;
};

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  team: string | null;
  created_at: string;
  total_attempts: number;
  completed_attempts: number;
  in_progress: number;
  suspicious_attempts: number;
  latest_attempt: LatestAttempt | null;
};

type CandidatesResponse = {
  candidates: Candidate[];
  total: number;
  teams: string[];
};

export default function CandidatesPage() {
  const [data, setData] =
    useState<CandidatesResponse | null>(null);

  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCandidates(
    currentSearch = search,
    currentTeam = team
  ) {
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

      const params = new URLSearchParams();

      if (currentSearch.trim()) {
        params.set(
          "search",
          currentSearch.trim()
        );
      }

      if (currentTeam) {
        params.set("team", currentTeam);
      }

      const queryString = params.toString();

      const response = await fetch(
        queryString
          ? `/api/candidates?${queryString}`
          : "/api/candidates",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load candidates."
        );
      }

      setData(result);
    } catch (err) {
      console.error(
        "Candidates loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load candidates."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCandidates("", "");
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  }

  function formatPercentage(
    percentage: number | null
  ) {
    if (percentage === null) {
      return "—";
    }

    return `${Math.round(percentage)}%`;
  }

  function getStatus(candidate: Candidate) {
    if (candidate.suspicious_attempts > 0) {
      return {
        label: "Suspicious",
        className:
          "bg-red-50 text-red-700",
      };
    }

    if (candidate.completed_attempts > 0) {
      return {
        label: "Completed",
        className:
          "bg-emerald-50 text-emerald-700",
      };
    }

    if (candidate.in_progress > 0) {
      return {
        label: "In Progress",
        className:
          "bg-amber-50 text-amber-700",
      };
    }

    return {
      label: "Not Started",
      className:
        "bg-slate-100 text-slate-600",
    };
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            {/* Page header */}

            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Candidates
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                View registered candidates and
                their placement test history.
              </p>
            </div>

            {/* Search and filters */}

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <div>
                  <label
                    htmlFor="candidate-search"
                    className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400"
                  >
                    Search
                  </label>

                  <input
                    id="candidate-search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        loadCandidates(
                          search,
                          team
                        );
                      }
                    }}
                    placeholder="Name or email..."
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="candidate-team"
                    className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400"
                  >
                    Team
                  </label>

                  <select
                    id="candidate-team"
                    value={team}
                    onChange={(event) =>
                      setTeam(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                  >
                    <option value="">
                      All teams
                    </option>

                    {(data?.teams ?? []).map(
                      (teamName) => (
                        <option
                          key={teamName}
                          value={teamName}
                        >
                          {teamName}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      loadCandidates(
                        search,
                        team
                      )
                    }
                    className="w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 md:w-auto"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            {/* Error message */}

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                <p className="text-sm font-medium text-red-800">
                  Unable to load candidates
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Candidate table */}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Candidate List
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {data?.total ?? 0} candidates
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <p className="text-sm text-slate-400">
                    Loading candidates...
                  </p>
                </div>
              ) : data?.candidates.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center px-6">
                  <div className="text-center">
                    <p className="font-medium text-slate-700">
                      No candidates found
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Try changing your search or
                      team filter.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Candidate
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Team
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Tests
                        </th>

                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          Latest Result
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
                      {data?.candidates.map(
                        (candidate) => {
                          const status =
                            getStatus(candidate);

                          return (
                            <tr
                              key={candidate.id}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {
                                      candidate.full_name
                                    }
                                  </p>

                                  <p className="mt-0.5 text-sm text-slate-500">
                                    {
                                      candidate.email
                                    }
                                  </p>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-700">
                                {candidate.team ||
                                  "—"}
                              </td>

                              <td className="px-6 py-4">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {
                                      candidate.total_attempts
                                    }
                                  </p>

                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {
                                      candidate.completed_attempts
                                    }{" "}
                                    completed
                                  </p>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                {candidate.latest_attempt ? (
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">
                                      {formatPercentage(
                                        candidate
                                          .latest_attempt
                                          .percentage
                                      )}
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {candidate
                                        .latest_attempt
                                        .submitted_at
                                        ? formatDate(
                                            candidate
                                              .latest_attempt
                                              .submitted_at
                                          )
                                        : "In progress"}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">
                                    No test
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                                >
                                  {status.label}
                                </span>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <Link
                                  href={`/candidates/${candidate.id}`}
                                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                                >
                                  View
                                </Link>
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