"use client";

import Link from "next/link";

const menuItems = [
  {
    name: "Tests",
    href: "/tests",
    description: "Create and manage placement tests",
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    description: "Create, activate and manage campaigns",
  },
  {
    name: "Test Bank",
    href: "/test-bank",
    description: "Manage questions by CEFR level",
  },
  {
    name: "Results",
    href: "/results",
    description: "View candidate test results",
  },
  {
    name: "Anti-Cheating",
    href: "/anti-cheating",
    description: "Review test integrity reports",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Teacher Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              English Placement Test Management
            </p>
          </div>

          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            Teacher
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage tests, campaigns, question banks, results,
            and anti-cheating reports.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-400 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {item.name}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>

                <span className="text-lg text-slate-300 transition group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Quick Actions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Quickly access the main management areas.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/tests"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Create Test
            </Link>

            <Link
              href="/campaigns"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Create Campaign
            </Link>

            <Link
              href="/test-bank"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Manage Test Bank
            </Link>

            <Link
              href="/results"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View Results
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
