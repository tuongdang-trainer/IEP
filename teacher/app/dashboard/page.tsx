"use client";

import { useEffect, useState } from "react";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import { supabase } from "@/lib/supabase";

type RecentResult = {
  id: string;
  status: string;
  percentage: number | null;
  submitted_at: string | null;
  candidates:
    | {
        full_name: string;
        email: string;
        team: string | null;
      }
    | null;
  campaigns:
    | {
        name: string;
        code: string;
      }
    | null;
};

type DashboardData = {
  teacher?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  candidates: number;
  completed: number;
  inProgress: number;
  suspicious: number;
  recentResults: RecentResult[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setError("Your session has expired. Please sign in again.");
            setLoading(false);
          }
          return;
        }

        const response = await fetch("/api/dashboard", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load dashboard data.");
        }

        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        console.error("Dashboard loading error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard data."
          );
          setLoading(false);
        }
      }
    }

    loadDashboard();

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
    if (value === null || value === undefined) return "—";

    return `${Math.round(value)}%`;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Monitor your English placement testing activity.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Candidates"
                value={loading ? "—" : String(data?.candidates ?? 0)}
                description="Total registered candidates"
              />

              <StatCard
                label="Completed"
                value={loading ? "—" : String(data?.completed ?? 0)}
                description="Tests successfully submitted"
              />

              <StatCard
                label="In Progress"
                value={loading ? "—" : String(data?.inProgress ?? 0)}
                description="Tests currently in progress"
              />

              <StatCard
                label="Suspicious"
                value={loading ? "—" : String(data?.suspicious ?? 0)}
                description="Attempts requiring review"
              />
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h3 className="font-semibold text-slate-900">
                  Recent Results
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  The latest completed placement tests will appear here.
                </p>
              </div>

              {loading ? (
                <div className="flex min-h-64 items-center justify-center px-6">
                  <p className="text-sm text-slate-400">
                    Loading results...
                  </p>
                </div>
              ) : data?.recentResults?.length ? (
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
                          Result
                        </th>
                        <th className="px-6 py-3 font-medium text-slate-500">
                          Submitted
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {data.recentResults.map((result) => (
                        <tr key={result.id}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {result.candidates?.full_name ?? "Unknown"}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {result.candidates?.email ?? "—"}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {result.candidates?.team ?? "—"}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {result.campaigns?.name ?? "—"}
                          </td>

                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900">
                              {formatPercentage(result.percentage)}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-slate-500">
                            {formatDate(result.submitted_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center px-6">
                  <p className="text-sm text-slate-400">
                    No results available yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}