"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Result = {
  id: string;
  status: string;
  percentage: number | null;
  total_score: number | null;
  max_score: number | null;
  diagnosis: string | null;
  is_suspicious: boolean;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
  candidates:
    | {
        id: string;
        full_name: string;
        email: string;
        team: string | null;
      }
    | null;
  campaigns:
    | {
        id: string;
        name: string;
        code: string;
      }
    | null;
};

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        const response = await fetch("/api/results", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load results."
          );
        }

        if (!cancelled) {
          setResults(data.results ?? []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Results loading error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load results."
          );
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      cancelled = true;
    };
  }, []);

  function formatDate(date: string | null) {
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function formatPercentage(value: number | null) {
    if (value === null || value === undefined) {
      return "—";
    }

    return `${Math.round(value)}%`;
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "submitted":
        return "Completed";
      case "started":
      case "in_progress":
        return "In Progress";
      default:
        return status;
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Results
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Review candidate placement test results.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Test Results
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {loading
                        ? "Loading results..."
                        : `${results.length} attempt${
                            results.length === 1 ? "" : "s"
                          }`}
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <p className="text-sm text-slate-400">
                    Loading results...
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center">
                  <p className="text-sm text-slate-400">
                    No results available yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 font-medium text-slate-500">
                          Candidate
                        </th>

                        <th className="px-6 py-3 font-medium text-slate-500">
                          Team
                        </th>

                        <th className="px-6 py-3 font-medium text-slate-500">
                          Campaign
                        </th>

                        <th className="px-6 py-3 font-medium text-slate-500">
                          Status
                        </th>

                        <th className="px-6 py-3 font-medium text-slate-500">
                          Score
                        </th>

                        <th className="px-6 py-3 font-medium text-slate-500">
                          Submitted
                        </th>

                        <th className="px-6 py-3 text-right font-medium text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {results.map((result) => (
                        <tr
                          key={result.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {result.candidates?.full_name ??
                                "Unknown candidate"}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {result.candidates?.email ?? "—"}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {result.candidates?.team ?? "—"}
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-slate-700">
                              {result.campaigns?.name ?? "—"}
                            </div>

                            {result.campaigns?.code && (
                              <div className="mt-1 text-xs text-slate-400">
                                {result.campaigns.code}
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                result.status === "submitted"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {getStatusLabel(result.status)}
                            </span>

                            {result.is_suspicious && (
                              <div className="mt-1 text-xs font-medium text-red-600">
                                Suspicious
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">
                              {formatPercentage(result.percentage)}
                            </div>

                            {result.total_score !== null &&
                              result.max_score !== null && (
                                <div className="mt-1 text-xs text-slate-400">
                                  {result.total_score} /{" "}
                                  {result.max_score}
                                </div>
                              )}
                          </td>

                          <td className="px-6 py-4 text-slate-500">
                            {formatDate(result.submitted_at)}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/results/${result.id}`}
                              className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              View Result
                            </Link>
                          </td>
                        </tr>
                      ))}
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