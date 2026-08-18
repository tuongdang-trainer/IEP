"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "▦",
  },
  {
    label: "Results",
    href: "/results",
    icon: "▤",
  },
  {
    label: "Candidates",
    href: "/candidates",
    icon: "♙",
  },
];

const management = [
  {
    label: "Test Bank",
    href: "/test-bank",
    icon: "▣",
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: "◉",
  },
  {
    label: "Anti-Cheating",
    href: "/anti-cheating",
    icon: "⚠",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="text-xl font-bold tracking-tight text-slate-900">
          IEP
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Teacher Portal
        </div>
      </div>

      <nav className="flex-1 px-3 py-5">
        <div className="space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="my-6 border-t border-slate-200" />

        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Management
        </div>

        <div className="space-y-1">
          {management.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            T
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              Teacher
            </div>
            <div className="truncate text-xs text-slate-500">
              IEP Administrator
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}