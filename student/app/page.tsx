"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Student Test
        </h1>

        <p className="mt-3 text-gray-600">
          Ready to take your test?
        </p>

        <button
          onClick={() => router.push("/test")}
          className="mt-6 rounded-lg bg-black px-6 py-3 font-medium text-white hover:bg-gray-800"
        >
          Làm test
        </button>
      </div>
    </main>
  );
}
