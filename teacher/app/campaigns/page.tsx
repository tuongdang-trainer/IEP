"use client";

import {
  FormEvent,
  useCallback,
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

type CampaignTest = {
  id?: string;
  title: string;
  duration_minutes: number | null;
  total_questions: number | null;
};

type Campaign = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  test_id: string;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  tests?: CampaignTest | null;
};

type CampaignResponse = {
  campaigns?: Campaign[];
  error?: string;
  details?: string;
};

type TestsResponse = {
  tests?: Test[];
  error?: string;
  details?: string;
};

type SaveResponse = {
  campaign?: Campaign;
  error?: string;
  details?: string;
};

type FormData = {
  name: string;
  code: string;
  description: string;
  test_id: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
};

const EMPTY_FORM: FormData = {
  name: "",
  code: "",
  description: "",
  test_id: "",
  start_at: "",
  end_at: "",
  is_active: false,
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tests, setTests] = useState<Test[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingTests, setLoadingTests] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<Campaign | null>(null);

  const [form, setForm] = useState<FormData>({
    ...EMPTY_FORM,
  });

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    return session.access_token;
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const accessToken = await getAccessToken();

      const response = await fetch("/api/campaigns", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const result: CampaignResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Unable to load campaigns."
        );
      }

      setCampaigns(result.campaigns ?? []);
    } catch (err) {
      console.error("Campaign loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load campaigns."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const loadTests = useCallback(async () => {
    try {
      setLoadingTests(true);

      const accessToken = await getAccessToken();

      const response = await fetch("/api/tests", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const result: TestsResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Unable to load tests."
        );
      }

      const availableTests = (result.tests ?? []).filter(
        (test) => test.is_active
      );

      setTests(availableTests);
    } catch (err) {
      console.error("Test loading error:", err);

      setTests([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tests."
      );
    } finally {
      setLoadingTests(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCampaigns();
      void loadTests();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadCampaigns, loadTests]);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
    });

    setEditingCampaign(null);
    setShowForm(false);
  }

  function openCreateForm() {
    setError("");
    setSuccess("");
    setEditingCampaign(null);

    const firstTest = tests[0];

    setForm({
      ...EMPTY_FORM,
      test_id: firstTest ? firstTest.id : "",
    });

    setShowForm(true);
  }

  function toLocalDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const hours = String(
      date.getHours()
    ).padStart(2, "0");

    const minutes = String(
      date.getMinutes()
    ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function openEditForm(campaign: Campaign) {
    setError("");
    setSuccess("");
    setEditingCampaign(campaign);

    setForm({
      name: campaign.name,
      code: campaign.code,
      description: campaign.description ?? "",
      test_id: campaign.test_id,
      start_at: campaign.start_at
        ? toLocalDateTime(campaign.start_at)
        : "",
      end_at: campaign.end_at
        ? toLocalDateTime(campaign.end_at)
        : "",
      is_active: campaign.is_active,
    });

    setShowForm(true);
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function getCampaignStatus(campaign: Campaign) {
    const now = new Date();

    if (!campaign.is_active) {
      return "Inactive";
    }

    if (
      campaign.start_at &&
      new Date(campaign.start_at) > now
    ) {
      return "Scheduled";
    }

    if (
      campaign.end_at &&
      new Date(campaign.end_at) < now
    ) {
      return "Closed";
    }

    return "Open";
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "Open":
        return "bg-emerald-50 text-emerald-700";

      case "Scheduled":
        return "bg-sky-50 text-sky-700";

      case "Closed":
        return "bg-amber-50 text-amber-700";

      default:
        return "bg-slate-100 text-slate-600";
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const campaignName = form.name.trim();
    const campaignCode = form.code.trim().toUpperCase();

    if (!campaignName) {
      setError("Campaign name is required.");
      return;
    }

    if (!campaignCode) {
      setError("Campaign code is required.");
      return;
    }

    if (!form.test_id) {
      setError("Please select a test.");
      return;
    }

    const selectedTest = tests.find(
      (test) => test.id === form.test_id
    );

    if (!selectedTest && !editingCampaign) {
      setError(
        "The selected test is no longer available. Please refresh the page and select the test again."
      );
      return;
    }

    if (form.start_at && form.end_at) {
      const startDate = new Date(form.start_at);
      const endDate = new Date(form.end_at);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        setError("Please enter valid dates.");
        return;
      }

      if (startDate >= endDate) {
        setError(
          "End time must be later than start time."
        );
        return;
      }
    }

    try {
      setSaving(true);

      const accessToken = await getAccessToken();

      const payload = {
  name: campaignName,
  code: campaignCode,
  description:
    form.description.trim() || null,
  test_id: form.test_id,
  start_at: form.start_at
    ? new Date(form.start_at).toISOString()
    : null,
  end_at: form.end_at
    ? new Date(form.end_at).toISOString()
    : null,
  is_active: form.is_active,
};

      const url = editingCampaign
        ? `/api/campaigns/${editingCampaign.id}`
        : "/api/campaigns";

      const method = editingCampaign
        ? "PATCH"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result: SaveResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Unable to save campaign."
        );
      }

      setSuccess(
        editingCampaign
          ? "Campaign updated successfully."
          : "Campaign created successfully."
      );

      resetForm();

      await loadCampaigns();
      await loadTests();
    } catch (err) {
      console.error("Campaign save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save campaign."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaign(
    campaign: Campaign
  ) {
    try {
      setError("");
      setSuccess("");

      const accessToken = await getAccessToken();

      const response = await fetch(
        `/api/campaigns/${campaign.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !campaign.is_active,
          }),
        }
      );

      const result: SaveResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Unable to update campaign."
        );
      }

      setSuccess(
        campaign.is_active
          ? "Campaign deactivated."
          : "Campaign activated."
      );

      await loadCampaigns();
    } catch (err) {
      console.error(
        "Campaign toggle error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update campaign."
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-6 py-8">

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Campaign Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create, activate, schedule, and manage placement test campaigns.
            </p>
          </div>

          <button
            type="button"
            onClick={
              showForm
                ? resetForm
                : openCreateForm
            }
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {showForm
              ? "Close"
              : "Create Campaign"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="font-medium text-red-800">
              Something went wrong
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="font-medium text-emerald-800">
              Success
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              {success}
            </p>
          </div>
        )}

        {showForm && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">

            <div className="mb-6">
              <h2 className="font-semibold text-slate-900">
                {editingCampaign
                  ? "Edit Campaign"
                  : "Create Campaign"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure campaign code, test, availability window, and activation status.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              <div className="grid gap-5 md:grid-cols-2">

                <div>
                  <label
                    htmlFor="campaign-name"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Campaign Name
                  </label>

                  <input
                    id="campaign-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                    }}
                    placeholder="e.g. August 2026 Placement Test"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="campaign-code"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Campaign Code
                  </label>

                  <input
                    id="campaign-code"
                    type="text"
                    value={form.code}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase(),
                      }));
                    }}
                    placeholder="e.g. AUG2026"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-400"
                  />

                  <p className="mt-1 text-xs text-slate-400">
                    Candidates will use this code to access the test.
                  </p>
                </div>

              </div>

              <div>
                <label
                  htmlFor="campaign-description"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="campaign-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }));
                  }}
                  placeholder="Optional campaign description..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="campaign-test"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Test
                </label>

                {loadingTests ? (
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                    Loading tests...
                  </div>
                ) : tests.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-sm font-medium text-amber-800">
                      No active tests available.
                    </p>

                    <p className="mt-1 text-xs text-amber-700">
                      Create and enable a test before creating a campaign.
                    </p>
                  </div>
                ) : (
                  <select
                    id="campaign-test"
                    value={form.test_id}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        test_id: event.target.value,
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">
                      Select a test
                    </option>

                    {tests.map((test) => (
                      <option
                        key={test.id}
                        value={test.id}
                      >
                        {test.title}
                        {test.total_questions
                          ? ` — ${test.total_questions} questions`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">

                <div>
                  <label
                    htmlFor="campaign-start"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Open Time
                  </label>

                  <input
                    id="campaign-start"
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        start_at: event.target.value,
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />

                  <p className="mt-1 text-xs text-slate-400">
                    Leave empty for immediate access when active.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="campaign-end"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Close Time
                  </label>

                  <input
                    id="campaign-end"
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        end_at: event.target.value,
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />

                  <p className="mt-1 text-xs text-slate-400">
                    Leave empty for no automatic closing time.
                  </p>
                </div>

              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }));
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span>
                  <span className="block text-sm font-medium text-slate-700">
                    Campaign active
                  </span>

                  <span className="block text-xs text-slate-400">
                    Candidates can access the campaign only when it is active and within the availability window.
                  </span>
                </span>
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loadingTests ||
                    tests.length === 0
                  }
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingCampaign
                      ? "Save Changes"
                      : "Create Campaign"}
                </button>

              </div>

            </form>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold text-slate-900">
              Campaigns
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage your test campaigns and their availability.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <p className="text-sm text-slate-400">
                Loading campaigns...
              </p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center px-6">
              <div className="text-center">

                <p className="font-medium text-slate-700">
                  No campaigns yet
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Create your first campaign to open a placement test.
                </p>

                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  Create Campaign
                </button>

              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1100px]">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Campaign
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Code
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Test
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Open
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Close
                    </th>

                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Status
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {campaigns.map((campaign) => {
                    const status =
                      getCampaignStatus(campaign);

                    return (
                      <tr
                        key={campaign.id}
                        className="hover:bg-slate-50"
                      >

                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {campaign.name}
                          </p>

                          {campaign.description && (
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                              {campaign.description}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                            {campaign.code}
                          </span>
                        </td>

                        <td className="px-4 py-4">

                          <p className="text-sm text-slate-700">
                            {campaign.tests?.title ??
                              "Unknown test"}
                          </p>

                          {campaign.tests?.total_questions ? (
                            <p className="mt-1 text-xs text-slate-400">
                              {campaign.tests.total_questions} questions
                            </p>
                          ) : null}

                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDate(campaign.start_at)}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDate(campaign.end_at)}
                        </td>

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                              status
                            )}`}
                          >
                            {status}
                          </span>

                        </td>

                        <td className="px-4 py-4">

                          <div className="flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(campaign)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void toggleCampaign(
                                  campaign
                                )
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                                campaign.is_active
                                  ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                                  : "bg-slate-900 text-white hover:bg-slate-800"
                              }`}
                            >
                              {campaign.is_active
                                ? "Disable"
                                : "Enable"}
                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </main>
    </div>
  );
}