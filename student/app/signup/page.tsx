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
          fullName: fullName.trim(),
          email: email.trim(),
          team: team.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to register.");
        return;
      }

      sessionStorage.setItem(
        "iep_candidate",
        JSON.stringify(data.candidate)
      );

      setSuccess(true);
    } catch {
      setError("Unable to connect to the registration system.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">
            IEP Assessment
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
            Candidate Registration
          </h1>

          <p className="mt-2 text-sm text-zinc-600">
            Register before accessing the English Placement Test.
          </p>
        </div>

        {success ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-green-50 px-4 py-4 text-sm text-green-700">
              <p className="font-semibold">Registration successful!</p>
              <p className="mt-1">
                Your information has been recorded successfully.
              </p>
            </div>

            <a
              href="/test"
              className="block w-full rounded-xl bg-black px-4 py-3 text-center font-medium text-white transition hover:bg-zinc-800"
            >
              Continue to Test
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-medium text-zinc-800"
              >
                Full name *
              </label>

              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-500"
                placeholder="Enter your full name"
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
                Team *
              </label>

              <input
                id="team"
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-500"
                placeholder="Enter your team"
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
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
