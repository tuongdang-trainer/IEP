
"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type AccessResponse = {
  success: boolean;
  access: "granted" | "resume";
  candidate: {
    id: string;
    fullName: string;
    email: string;
    team: string | null;
  };
  campaign: {
    id: string;
    code: string;
    name: string;
  };
  test: {
    id: string;
    title: string;
    description?: string | null;
    durationMinutes: number;
    totalQuestions: number;
    passingScore?: number | null;
  };
  attempt?: {
    id: string;
    status: string;
  };
};

type TestOption = {
  id: string;
  key: string;
  text: string;
  orderNumber: number;
};

type WritingTask = {
  id: string;
  title: string;
  prompt: string;
  instructions: string | null;
  wordLimitMin: number | null;
  wordLimitMax: number | null;
  timeLimitMinutes: number | null;
};

type TestQuestion = {
  attemptQuestionId: string;
  questionId: string | null;
  writingTaskId: string | null;
  questionNumber: number;
  skill: string;
  cefrLevel: string | null;
  questionType: string;
  questionText: string;
  instruction: string | null;
  points: number;
  writingTask: WritingTask | null;
  options: TestOption[];
};

type TestStartResponse = {
  success: boolean;
  mode: "new" | "resume";
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    expiresAt: string | null;
  };
  questions: TestQuestion[];
};

type AntiCheatEventType =
  | "copy"
  | "paste"
  | "cut"
  | "contextmenu"
  | "tab_switch"
  | "blur"
  | "fullscreen_exit";

function TestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const submitted =
    searchParams.get("submitted") === "true";

const [fullName, setFullName] =
  useState("");

const [email, setEmail] =
  useState("");

const [team, setTeam] =
  useState("");

const [campaignCode, setCampaignCode] =
  useState("");

const [access, setAccess] =
  useState<AccessResponse | null>(null);

const [test, setTest] =
  useState<TestStartResponse | null>(null);

const [currentQuestion, setCurrentQuestion] =
  useState(0);

const [selectedAnswer, setSelectedAnswer] =
  useState<string | null>(null);

const [writingAnswer, setWritingAnswer] =
  useState("");

const [error, setError] =
  useState("");

const [loading, setLoading] =
  useState(false);

const [starting, setStarting] =
  useState(false);

const [saving, setSaving] =
  useState(false);

const [remainingSeconds, setRemainingSeconds] =
  useState<number | null>(null);

const currentQuestionRef = useRef(0);

const writingAnswerRef = useRef("");

const selectedAnswerRef =
  useRef<string | null>(null);

const autoSubmitRef =
  useRef(false);

useEffect(() => {
  currentQuestionRef.current = currentQuestion;
}, [currentQuestion]);

useEffect(() => {
  writingAnswerRef.current = writingAnswer;
}, [writingAnswer]);

useEffect(() => {
  selectedAnswerRef.current = selectedAnswer;
}, [selectedAnswer]);

/*
 * Keep the current attempt ID in a ref so
 * anti-cheating event listeners can always
 * access the latest attempt without causing
 * unnecessary re-renders.
 */
const attemptIdRef =
  useRef<string | null>(null);
  /*
   * Prevent duplicate fullscreen_exit events
   * caused by multiple browser events firing
   * together.
   */
  const lastFullscreenEventRef =
    useRef<number>(0);

  /*
   * Record an anti-cheating event.
   *
   * This request is intentionally best-effort.
   * If event logging fails, the candidate's
   * test should not be interrupted.
   */
  async function recordAntiCheatEvent(
    eventType: AntiCheatEventType,
    metadata?: Record<string, unknown>
  ) {
    const attemptId =
      attemptIdRef.current;

    if (!attemptId) {
      return;
    }

    try {
      await fetch(
        "/api/candidate/event",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            attemptId,
            eventType,
            metadata:
              metadata ?? {},
          }),
          keepalive: true,
        }
      );
    } catch (eventError) {
      /*
       * Anti-cheating logging must never
       * block the test.
       */
      console.error(
        "Anti-cheating event logging error:",
        eventError
      );
    }
  }

 
  /*
   * Anti-cheating listeners.
   *
   * These are active only while an attempt
   * is running.
   */
  useEffect(() => {
    if (!test?.attempt.id) {
      return;
    }

    attemptIdRef.current =
      test.attempt.id;

    function handleCopy(
      event: ClipboardEvent
    ) {
      event.preventDefault();

      void recordAntiCheatEvent(
        "copy",
        {
          source: "clipboard",
        }
      );
    }

    function handlePaste(
      event: ClipboardEvent
    ) {
      event.preventDefault();

      void recordAntiCheatEvent(
        "paste",
        {
          source: "clipboard",
        }
      );
    }

    function handleCut(
      event: ClipboardEvent
    ) {
      event.preventDefault();

      void recordAntiCheatEvent(
        "cut",
        {
          source: "clipboard",
        }
      );
    }

    function handleContextMenu(
      event: MouseEvent
    ) {
      event.preventDefault();

      void recordAntiCheatEvent(
        "contextmenu",
        {
          source: "mouse",
        }
      );
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      const key =
        event.key.toLowerCase();

      const modifier =
        event.ctrlKey ||
        event.metaKey;

      /*
       * Ctrl/Cmd + C
       * Ctrl/Cmd + V
       * Ctrl/Cmd + X
       */
      if (
        modifier &&
        (key === "c" ||
          key === "v" ||
          key === "x")
      ) {
        event.preventDefault();

        const eventType =
          key === "c"
            ? "copy"
            : key === "v"
              ? "paste"
              : "cut";

        void recordAntiCheatEvent(
          eventType,
          {
            source:
              "keyboard",
            key,
          }
        );

        return;
      }

      /*
       * F12
       *
       * This does not guarantee that
       * developer tools cannot be opened,
       * but it prevents the common shortcut.
       */
      if (event.key === "F12") {
        event.preventDefault();

        void recordAntiCheatEvent(
          "contextmenu",
          {
            source:
              "keyboard",
            key: "F12",
          }
        );

        return;
      }

      /*
       * Ctrl/Cmd + Shift + I
       * Ctrl/Cmd + Shift + J
       * Ctrl/Cmd + Shift + C
       *
       * Common browser developer-tool
       * shortcuts.
       */
      if (
        modifier &&
        event.shiftKey &&
        (key === "i" ||
          key === "j" ||
          key === "c")
      ) {
        event.preventDefault();

        void recordAntiCheatEvent(
          "contextmenu",
          {
            source:
              "keyboard",
            key,
            shiftKey: true,
          }
        );
      }
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        void recordAntiCheatEvent(
          "tab_switch",
          {
            visibilityState:
              document.visibilityState,
          }
        );
      }
    }

    function handleWindowBlur() {
      void recordAntiCheatEvent(
        "blur",
        {
          source: "window",
        }
      );
    }

    function handleFullscreenChange() {
      if (
        document.fullscreenElement ===
        null
      ) {
        const now = Date.now();

        /*
         * Avoid logging the same fullscreen
         * exit twice within 500ms.
         */
        if (
          now -
            lastFullscreenEventRef.current <
          500
        ) {
          return;
        }

        lastFullscreenEventRef.current =
          now;

        void recordAntiCheatEvent(
          "fullscreen_exit",
          {
            source:
              "fullscreenchange",
          }
        );
      }
    }

    document.addEventListener(
      "copy",
      handleCopy
    );

    document.addEventListener(
      "paste",
      handlePaste
    );

    document.addEventListener(
      "cut",
      handleCut
    );

    document.addEventListener(
      "contextmenu",
      handleContextMenu
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "blur",
      handleWindowBlur
    );

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "copy",
        handleCopy
      );

      document.removeEventListener(
        "paste",
        handlePaste
      );

      document.removeEventListener(
        "cut",
        handleCut
      );

      document.removeEventListener(
        "contextmenu",
        handleContextMenu
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "blur",
        handleWindowBlur
      );

      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, [test?.attempt.id]);

  async function handleVerify(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setAccess(null);
    setTest(null);
    attemptIdRef.current = null;

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/candidate/test-access",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              fullName,
              email,
              team,
              campaignCode,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to verify test access."
        );
        return;
      }

      setAccess(data);
    } catch (requestError) {
      console.error(
        "Test access request error:",
        requestError
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStartTest() {
    if (!access) {
      return;
    }

    setError("");
    setStarting(true);

    try {
      const response =
        await fetch(
          "/api/candidate/test-start",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              candidateId:
                access.candidate.id,
              campaignId:
                access.campaign.id,
              testId:
                access.test.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to start the test."
        );
        return;
      }

      setTest(data);

      attemptIdRef.current =
        data.attempt?.id ?? null;

      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setWritingAnswer("");

      /*
       * Try to enter fullscreen.
       *
       * Some browsers may reject this request.
       * That is okay — the test itself still
       * continues and fullscreen_exit is only
       * logged when fullscreen was actually active.
       */
      try {
        if (
          document.fullscreenEnabled &&
          !document.fullscreenElement
        ) {
          await document.documentElement.requestFullscreen();
        }
      } catch (fullscreenError) {
        console.warn(
          "Fullscreen request was not allowed:",
          fullscreenError
        );
      }
    } catch (requestError) {
      console.error(
        "Test start request error:",
        requestError
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setStarting(false);
    }
  }

    useEffect(() => {
    const attemptId = test?.attempt.id;
    const expiresAtValue = test?.attempt.expiresAt;

    if (!attemptId || !expiresAtValue) {
      return;
    }

    const expiresAt = new Date(
      expiresAtValue
    ).getTime();

    if (Number.isNaN(expiresAt)) {
      console.error(
        "Invalid test expiration time:",
        expiresAtValue
      );
      return;
    }

    autoSubmitRef.current = false;

    function calculateRemainingSeconds() {
      return Math.max(
        0,
        Math.ceil(
          (expiresAt - Date.now()) / 1000
        )
      );
    }

    async function autoSubmitTest() {
  if (autoSubmitRef.current) {
    return;
  }

  autoSubmitRef.current = true;

  setError("");
  setSaving(true);

  try {
    /*
     * IMPORTANT:
     * Save the answer currently displayed on screen first.
     *
     * If the candidate has not answered the current question,
     * we simply skip saving it.
     *
     * The test must still be submitted when time reaches 0.
     */

    if (test) {
  const question =
    test.questions[currentQuestionRef.current];

  if (question) {
        const isWriting =
          question.questionType === "writing";

        const currentWritingAnswer =
  writingAnswerRef.current;

const currentSelectedAnswer =
  selectedAnswerRef.current;

const hasAnswer = isWriting
  ? currentWritingAnswer.trim().length > 0
  : Boolean(currentSelectedAnswer);

        if (hasAnswer) {
          try {
            const saveResponse = await fetch(
              "/api/candidate/save-answer",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  attemptId:
                    test.attempt.id,

                 attemptQuestionId:
  question.attemptQuestionId,

selectedOptionId:
  isWriting
    ? null
    : currentSelectedAnswer,

answerText:
  isWriting
    ? currentWritingAnswer
    : null,
                }),
                keepalive: true,
              }
            );

            const saveData =
              await saveResponse.json();

            if (!saveResponse.ok) {
  console.error(
    "Auto-save current answer failed:",
    saveData.error
  );

  autoSubmitRef.current = false;

  setError(
    "Unable to save your last answer before the test ended. Please contact your teacher."
  );

  return;
}
          } catch (saveError) {
  console.error(
    "Auto-save current answer request error:",
    saveError
  );

  autoSubmitRef.current = false;

  setError(
    "Unable to save your last answer before the test ended. Please contact your teacher."
  );

  return;
}
        }
      }
    }

    /*
     * IMPORTANT:
     * Submit the attempt regardless of whether
     * the current question was answered.
     */

    const response = await fetch(
      "/api/candidate/test-submit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId,
          autoSubmit: true,
        }),
        keepalive: true,
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Auto-submit failed:",
        data.error
      );

      autoSubmitRef.current = false;

      setError(
        data.error ||
          "Unable to automatically submit the test."
      );

      return;
    }

    /*
     * Exit fullscreen after submission.
     */

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (fullscreenError) {
      console.warn(
        "Unable to exit fullscreen:",
        fullscreenError
      );
    }

    router.push(
      "/test?submitted=true"
    );
  } catch (requestError) {
    console.error(
      "Auto-submit request error:",
      requestError
    );

    autoSubmitRef.current = false;

    setError(
      "Unable to automatically submit the test. Please contact your teacher."
    );
  } finally {
    setSaving(false);
  }
}

    const timer = window.setInterval(() => {
      const seconds =
        calculateRemainingSeconds();

      setRemainingSeconds(seconds);

      if (seconds <= 0) {
        window.clearInterval(timer);
        void autoSubmitTest();
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    test?.attempt.id,
    test?.attempt.expiresAt,
    router,
  ]);

  async function saveCurrentAnswer() {
    if (!test) {
      return false;
    }

    const question =
      test.questions[currentQuestion];

    if (!question) {
      return false;
    }

    const isWriting =
      question.questionType ===
      "writing";

    if (
      isWriting &&
      !writingAnswer.trim()
    ) {
      setError(
        "Please enter your writing answer before continuing."
      );

      return false;
    }

    if (
      !isWriting &&
      !selectedAnswer
    ) {
      setError(
        "Please select an answer before continuing."
      );

      return false;
    }

    setError("");
    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/candidate/save-answer",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              attemptId:
                test.attempt.id,
              attemptQuestionId:
                question.attemptQuestionId,
              selectedOptionId:
                isWriting
                  ? null
                  : selectedAnswer,
              answerText:
                isWriting
                  ? writingAnswer
                  : null,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to save answer."
        );

        return false;
      }

      return true;
    } catch (requestError) {
      console.error(
        "Save answer request error:",
        requestError
      );

      setError(
        "Unable to connect to the server. Please try again."
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (!test) {
      return;
    }

    const saved =
      await saveCurrentAnswer();

    if (!saved) {
      return;
    }

    const isLastQuestion =
      currentQuestion ===
      test.questions.length - 1;

    if (isLastQuestion) {
      setError("");
      setSaving(true);

      try {
        const response =
          await fetch(
            "/api/candidate/test-submit",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                attemptId:
                  test.attempt.id,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setError(
            data.error ||
              "Unable to submit test."
          );

          return;
        }

        /*
         * Exit fullscreen after submission.
         */
        try {
          if (
            document.fullscreenElement
          ) {
            await document.exitFullscreen();
          }
        } catch (fullscreenError) {
          console.warn(
            "Unable to exit fullscreen:",
            fullscreenError
          );
        }

        /*
         * Use Next.js router instead of
         * window.location.href.
         */
        router.push(
          "/test?submitted=true"
        );
      } catch (requestError) {
        console.error(
          "Submit test request error:",
          requestError
        );

        setError(
          "Unable to connect to the server. Please try again."
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    setCurrentQuestion(
      (value) => value + 1
    );

    setSelectedAnswer(null);
    setWritingAnswer("");
    setError("");
  }

  function handlePrevious() {
    if (currentQuestion === 0) {
      return;
    }

    setCurrentQuestion(
      (value) => value - 1
    );

    setSelectedAnswer(null);
    setWritingAnswer("");
    setError("");
  }

if (submitted) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
        <div className="w-full rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m5 12 4 4L19 6"
              />
            </svg>
          </div>

          <h1 className="mt-6 text-3xl font-semibold text-zinc-900">
            Test Submitted Successfully
          </h1>

          <p className="mt-4 text-base leading-7 text-zinc-600">
            Thank you for completing the English Placement Test.
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Your responses have been recorded successfully.
            Your teacher will review your results and writing
            response.
          </p>

          <div className="mt-8 rounded-xl bg-zinc-50 p-5 text-left">
            <p className="text-sm font-medium text-zinc-800">
              What happens next?
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Your test will now be reviewed by the teaching team.
              You do not need to take any further action.
            </p>
          </div>

          <p className="mt-8 text-xs text-zinc-400">
            You may now close this page.
          </p>
        </div>
      </div>
    </main>
  );
} 

  if (test) {
    const question =
      test.questions[currentQuestion];

    if (!question) {
      return (
        <main className="min-h-screen bg-zinc-50 px-6 py-12">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-zinc-900">
              Test data unavailable
            </h1>

            <p className="mt-3 text-zinc-600">
              No question was returned for this test.
            </p>
          </div>
        </main>
      );
    }

    const isWriting =
      question.questionType ===
      "writing";

    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                English Placement Test
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Question{" "}
                {question.questionNumber}{" "}
                of{" "}
                {test.questions.length}
              </p>
            </div>

            <div className="flex items-center gap-3">
  {remainingSeconds !== null && (
    <div className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm">
      Time left:{" "}
      {Math.floor(
        remainingSeconds / 60
      )
        .toString()
        .padStart(2, "0")}
      :
      {(remainingSeconds % 60)
        .toString()
        .padStart(2, "0")}
    </div>
  )}

  <div className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm">
    {question.cefrLevel ||
      question.skill}
  </div>
</div>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-sm">

            <div className="mb-8">

              <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                {question.skill}
              </p>

              {question.instruction && (
                <p className="mt-3 text-sm text-zinc-600">
                  {question.instruction}
                </p>
              )}

              {isWriting &&
                question.writingTask
                  ?.title && (
                  <p className="mt-4 text-lg font-semibold text-zinc-800">
                    {
                      question
                        .writingTask
                        .title
                    }
                  </p>
                )}

              <h1 className="mt-5 text-2xl font-semibold leading-relaxed text-zinc-900">
                {question.questionText}
              </h1>

            </div>

            {!isWriting && (
              <div className="space-y-3">
                {question.options.map(
                  (option) => {
                    const isSelected =
                      selectedAnswer ===
                      option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedAnswer(
                            option.id
                          );
                          setError("");
                        }}
                        className={
                          "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition " +
                          (isSelected
                            ? " border-zinc-900 bg-zinc-100"
                            : " border-zinc-200 bg-white hover:border-zinc-400")
                        }
                      >
                        <span
                          className={
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold " +
                            (isSelected
                              ? " border-zinc-900 bg-zinc-900 text-white"
                              : " border-zinc-300 text-zinc-700")
                          }
                        >
                          {option.key}
                        </span>

                        <span className="text-zinc-800">
                          {option.text}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {isWriting && (
              <div className="space-y-4">

                {question
                  .writingTask
                  ?.instructions && (
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
                    {
                      question
                        .writingTask
                        .instructions
                    }
                  </div>
                )}

                {(question
                  .writingTask
                  ?.wordLimitMin !==
                  null ||
                  question
                    .writingTask
                    ?.wordLimitMax !==
                    null) && (
                  <div className="text-sm text-zinc-500">
                    Word limit:{" "}
                    {question
                      .writingTask
                      ?.wordLimitMin ??
                      "—"}{" "}
                    –{" "}
                    {question
                      .writingTask
                      ?.wordLimitMax ??
                      "—"}{" "}
                    words
                  </div>
                )}

                <textarea
                  value={writingAnswer}
                  onChange={(event) => {
                    setWritingAnswer(
                      event.target.value
                    );
                    setError("");
                  }}
                  placeholder="Write your answer here..."
                  rows={14}
                  className="w-full resize-y rounded-xl border border-zinc-300 px-4 py-4 text-base leading-relaxed text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                />

                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <span>
                    {writingAnswer.trim()
                      ? writingAnswer
                          .trim()
                          .split(/\s+/)
                          .length
                      : 0}{" "}
                    words
                  </span>

                  {question
                    .writingTask
                    ?.wordLimitMax && (
                    <span>
                      Maximum:{" "}
                      {
                        question
                          .writingTask
                          .wordLimitMax
                      }{" "}
                      words
                    </span>
                  )}
                </div>

              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
              <button
                type="button"
                disabled={
                  currentQuestion ===
                    0 || saving
                }
                onClick={
                  handlePrevious
                }
                className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={
                  handleNext
                }
                disabled={saving}
                className="rounded-xl bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : currentQuestion ===
                      test.questions
                        .length -
                        1
                    ? "Submit Test"
                    : "Next"}
              </button>
            </div>

          </div>
        </div>
      </main>
    );
  }

    if (access) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">
            English Placement Test
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
            Access verified
          </h1>

          <p className="mt-3 text-zinc-600">
            Your information has been verified successfully.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-zinc-50 p-5">
              <p className="font-medium text-zinc-900">
                Candidate
              </p>

              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                <p>
                  <strong>Name:</strong>{" "}
                  {access.candidate.fullName}
                </p>

                <p>
                  <strong>Email:</strong>{" "}
                  {access.candidate.email}
                </p>

                <p>
                  <strong>Team:</strong>{" "}
                  {access.candidate.team || "—"}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-50 p-5">
              <p className="font-medium text-zinc-900">
                Campaign
              </p>

              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                <p>
                  <strong>Campaign:</strong>{" "}
                  {access.campaign.name}
                </p>

                <p>
                  <strong>Code:</strong>{" "}
                  {access.campaign.code}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-5">
              <p className="font-medium text-zinc-900">
                {access.test.title}
              </p>

              {access.test.description && (
                <p className="mt-2 text-sm text-zinc-600">
                  {access.test.description}
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">
                    Duration
                  </p>

                  <p className="mt-1 font-medium">
                    {access.test.durationMinutes} minutes
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">
                    Questions
                  </p>

                  <p className="mt-1 font-medium">
                    {access.test.totalQuestions}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {access.access === "resume" &&
            access.attempt && (
              <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="font-medium text-zinc-900">
                  You have an active test attempt.
                </p>

                <p className="mt-1 text-sm text-zinc-600">
                  Current status:{" "}
                  {access.attempt.status}
                </p>
              </div>
            )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleStartTest}
            disabled={starting}
            className="mt-8 w-full rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting
              ? "Starting Test..."
              : access.access === "resume"
                ? "Resume Test"
                : "Start Test"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">
          English Placement Test
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Access Your Test
        </h1>

        <p className="mt-3 text-zinc-600">
          Enter the information you used during registration and your
          campaign code to access the test.
        </p>

        <form
          onSubmit={handleVerify}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Full Name
            </label>

            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              required
              autoComplete="name"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-900"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              autoComplete="email"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-900"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label
              htmlFor="team"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Team
            </label>

            <input
              id="team"
              type="text"
              value={team}
              onChange={(event) =>
                setTeam(event.target.value)
              }
              required
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-900"
              placeholder="Enter your team"
            />
          </div>

          <div>
            <label
              htmlFor="campaignCode"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Campaign Code
            </label>

            <input
              id="campaignCode"
              type="text"
              value={campaignCode}
              onChange={(event) =>
                setCampaignCode(
                  event.target.value.toUpperCase()
                )
              }
              required
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 uppercase outline-none transition focus:border-zinc-900"
              placeholder="Enter your campaign code"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Verifying..."
              : "Verify & Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
export default function TestPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-50 px-6 py-12">
          <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
            <p className="text-sm text-zinc-500">
              Loading test...
            </p>
          </div>
        </main>
      }
    >
      <TestPageContent />
    </Suspense>
  );
}