"use client";

import { FormEvent, useState } from "react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/candidate/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          team,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to register.");
        return;
      }

      setSuccess(true);

      setFullName("");
      setEmail("");
      setTeam("");
    } catch {
      setError("Unable to connect to the registration system.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-zinc-900">
              Registration Successful
            </h1>

            <p className="mt-3 text-zinc-600">
              Thank you for registering for the English Placement Test.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Your information has been recorded successfully.
              You will receive further information when the test campaign
              is opened.
            </p>

            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="mt-8 rounded-xl bg-black px-5 py-3 font-medium text-white transition hover:bg-zinc-800"
            >
              Register another candidate
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">
            IEP Assessment
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
            Đăng ký dự thi
          </h1>

          <p className="mt-2 text-sm text-zinc-600">
            Vui lòng điền thông tin để đăng ký tham gia bài kiểm tra
            tiếng Anh.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-zinc-800"
            >
              Họ và tên *
            </label>

            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-500"
              placeholder="Nhập họ và tên"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-zinc-800"
            >
              Email *
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-500"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="team"
              className="mb-2 block text-sm font-medium text-zinc-800"
            >
              Team
            </label>

            <input
              id="team"
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-500"
              placeholder="Nhập team nếu có"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang đăng ký..." : "Đăng ký dự thi"}
          </button>
        </form>
      </div>
    </main>
  );
}
