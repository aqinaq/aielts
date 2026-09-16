# AIELTS Writing evaluation

This evaluation compares AI feedback with independently assigned human IELTS Writing bands. The [official Writing descriptors](https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf) define the four criteria. IELTS also publishes [sample responses with examiner comments](https://ielts.org/cdn/computer-delivered-sample-tests-academic-writing/ielts-academic-writing-example-responses-to-parts-1-and-2-with-band-scores-and-examiner-comments.pdf) for an initial sanity check.

The dataset is **not yet collected**, so no model-accuracy claim is published. A useful first report should include at least 20 answers from more than one task and band level. Record the actual prompt, the answer, the four human criterion bands, and the human overall band. Obtain permission before storing a learner's answer in the repository. Use the current rubric; keep model outputs out of the human rating process.

Dataset format (`answers.json`):

```json
[
  {
    "id": "answer-001",
    "mode": "writing",
    "task": "The exact task prompt",
    "text": "The candidate's full answer",
    "human": {
      "overall_band": 6.0,
      "criteria": {
        "task_achievement": 6.0,
        "coherence_cohesion": 6.0,
        "lexical_resource": 6.0,
        "grammatical_range": 6.0
      }
    }
  }
]
```

Run the app with real server-side AI credentials, then run:

```bash
RATE_LIMIT_PER_HOUR=40 npm run dev
npm run eval -- --dataset evals/answers.json --base-url http://localhost:5173 --output evals/report.json
```

For previously saved AI outputs, pass `--predictions predictions.json` instead of `--base-url`. The predictions file is an array of `{ "id": "answer-001", "ai": { ...the API response... } }` entries. This permits recalculating metrics without new paid requests.

The report includes overall mean absolute band error, signed error (bias), the share within half a band, error for each criterion, failed requests, and the share of suggested corrections whose quoted originals occur verbatim in the answer. Publish the dataset size, task mix, model versions, date, and limitations with any result. These measures indicate agreement on this sample; they do not certify an official IELTS score.
