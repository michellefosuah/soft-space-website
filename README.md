# 🌸 Soft Space

A calm, all-in-one student productivity companion — planner, journal, study hub,
habits, goals, and finance — in one soft, minimal interface. Pure static
HTML/CSS/JS with no build step and no server required.

## Run it

Open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Features

- **Dashboard** — live overview: greeting, daily quote, planner preview, today's
  focus, weather, habit streak, journal preview, and a composite progress meter.
- **Planner** — task CRUD with priorities, due dates, notes, filters; syncs to the dashboard.
- **Journal** — daily diary with auto-saving drafts and a browsable history.
- **Study Hub** — the core:
  - Pomodoro timer (settings-driven focus/break/long-break, auto-cycles, notifications)
  - Study checklist, subjects, weekly timetable, exams + countdowns
  - **AI Study Planner** — generates a balanced weekly plan (accept / modify / regenerate / reject)
  - Statistics — daily/weekly/monthly totals, per-subject breakdown, trend
  - Library — upload PDF/DOC/PPT/images (stored in IndexedDB), search/filter/view/download/delete
  - Quiz generator & Flashcards (flip, master, review)
- **Habits** — streaks, weekly/monthly completion, 7-day grid.
- **Goals** — progress toward a target with deadlines.
- **Finance** — income/expenses, budget & savings, category donut, insights.
- **Settings** — light/dark/system theme, accent colour, profile, timer & currency
  preferences, notifications, weather location, plus data export/import/reset.

## Architecture

```
index.html, planner.html, …   Thin page shells (shared <head>, one page script)
assets/css/style.css          Design system: tokens, components, light/dark, responsive
assets/js/
  core.js     Store (localStorage + change events), FileDB (IndexedDB), UI (toast/modal),
              fmt (formatting), Charts (inline-SVG bars/donut), utilities
  db.js       Domain repositories (Tasks, Journal, Habits, Goals, Finance, Subjects,
              Sessions, Library, Timetable, Exams, StudyPlan, Quizzes, Flashcards, Settings)
  ai.js       Pluggable AI engine (local heuristics now; swap in an API via SS.AI.provider)
  layout.js   Shared sidebar + topbar, theme boot, mobile nav
  <page>.js   One module per page, rendering into #view and subscribing to data changes
```

All state persists in the browser (localStorage for data, IndexedDB for files).
Widgets subscribe to store changes, so the dashboard and every page stay in sync live.

### Connecting a real AI later

The study planner, quiz generator, and flashcard maker all route through `SS.AI`.
To use a real model, set one hook — no other code changes needed:

```js
SS.AI.provider = async ({ task, payload }) => {
  // task is "study-plan" | "quiz" | "flashcards"
  const res = await fetch("/your-endpoint", { method: "POST", body: JSON.stringify({ task, payload }) });
  return res.json(); // must match the shape the local fallback returns
};
```

If `provider` is unset (or throws), Soft Space falls back to its built-in offline heuristics.
