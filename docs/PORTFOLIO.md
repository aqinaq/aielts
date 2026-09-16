# AIELTS portfolio case study

**Problem.** IELTS learners need specific feedback on a response, but generic AI feedback often lacks the task context and can present a plausible band without the official four-criterion calculation.

**Solution.** AIELTS accepts a Writing answer or a Speaking response, including uploaded or recorded audio. It gives bilingual, inline corrections, criterion feedback, practice prompts, timed interview turns, and a progress history. Academic Writing Task 1 charts are rendered from structured data, and that same data is supplied to the evaluator so it can check claims against actual values.

**Engineering decisions.** The browser records audio; Gemini transcribes and assesses pronunciation; Gemini or DeepSeek evaluates text. Both API routes validate structured model output before displaying it. Writing requires the task prompt and scores the four official criteria equally. Speaking can display provisional text feedback before audio arrives, but a full overall band is only shown once all four criteria, including pronunciation, are present. A task-specific Speaking note stays separate from the score. Public AI requests use shared Redis counters and return an error if the counter is unavailable.

**Architecture.** React/Vite provides the interface. Vercel functions keep model keys server-side. Guest history lives locally; optional Google login stores attempts in Supabase with row-level security. The same API handlers run under the Vite development server.

**Verification.** `npm test`, `npm run lint`, and `npm run build` are automated in CI. Unit and render tests cover score normalization, API validation, recording state, interview flow, history, and rate limiting. `npm run eval` computes agreement and correction-quote metrics from human-labelled Writing answers, but no labelled dataset has been collected yet; [the evaluation status](../evals/report.md) contains no invented accuracy figures.

**60-second demo outline.** Open the key-free sample result and point out the four criteria and inline corrections. Choose a Writing Task 1 chart, show that its data is visible, write an answer, and explain that the exact task is supplied to the evaluator. Switch to Speaking and start one interview part; show the cue card or follow-up question and the recording fallback. Finish with history, bilingual feedback, and the evaluation command. Live AI portions require configured server-side credentials.

**Limits.** These are estimated AI bands, not examiner-certified IELTS results. Pronunciation needs audio and Gemini. Browser speech recognition varies by browser, so unsupported browsers send the recorded audio for server transcription. Real human-labelled evaluation and a public deployment still depend on credentials and collected data.
