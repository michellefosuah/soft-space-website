/* =========================================================
   SOFT SPACE · AI ENGINE (pluggable)
   Everything AI-flavoured routes through SS.AI. Today it runs a local,
   deterministic heuristic so the app works fully offline. To connect a
   real model later, set SS.AI.provider to an async function — the rest of
   the app calls SS.AI.* and never needs to change.

       SS.AI.provider = async ({ task, payload }) => { ...call your API...; return result }

   If provider is null we fall back to the local heuristics below.
   ========================================================= */

(function () {
  "use strict";
  const { fmt } = window.SS;

  const AI = {
    provider: null, // set this to an async fn to use a real API

    async _run(task, payload, localFn) {
      if (typeof this.provider === "function") {
        try {
          return await this.provider({ task, payload });
        } catch (e) {
          console.warn("AI provider failed, using local fallback:", e);
        }
      }
      return localFn(payload);
    },

    /* ---------- Study plan generation ----------
       Balances subjects by difficulty and exam proximity, respects the
       user's available study time, and interleaves breaks + revision.      */
    generateStudyPlan(input) {
      return this._run("study-plan", input, localStudyPlan);
    },

    /* ---------- Quiz generation from a resource description / text ---------- */
    generateQuiz(input) {
      return this._run("quiz", input, localQuiz);
    },

    /* ---------- Flashcard generation ---------- */
    generateFlashcards(input) {
      return this._run("flashcards", input, localFlashcards);
    },
  };

  /* ============ LOCAL HEURISTIC IMPLEMENTATIONS ============ */

  function localStudyPlan({ subjects = [], exams = [], sessionsPerDay = 4, days = 7, focusMinutes = 25 }) {
    const today = new Date();

    // Weight each subject: harder + sooner exam => more weight.
    const scored = subjects.map((s) => {
      const exam = exams.find((e) => e.subject === s.name);
      let urgency = 1;
      if (exam) {
        const daysToExam = Math.max(1, Math.round((new Date(exam.date) - today) / 86400000));
        urgency = Math.max(1, 14 - daysToExam) / 4 + 1; // closer exam => higher
      }
      const difficulty = (s.difficulty || 3) / 3;
      return { name: s.name, color: s.color, weight: difficulty * urgency, exam: exam ? exam.date : null };
    });

    const totalWeight = scored.reduce((a, b) => a + b.weight, 0) || 1;

    // Build a day-by-day schedule.
    const plan = [];
    for (let d = 0; d < days; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const key = fmt.dateKey(date);

      // Distribute the day's sessions across subjects proportional to weight.
      const blocks = [];
      let remaining = sessionsPerDay;
      scored
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .forEach((s, i) => {
          if (remaining <= 0) return;
          let count = Math.round((s.weight / totalWeight) * sessionsPerDay);
          if (i === 0) count = Math.max(1, count); // guarantee the top subject gets time
          count = Math.min(count, remaining);
          for (let c = 0; c < count; c++) {
            // Last day before an exam becomes revision.
            const isRevision = s.exam && daysBetween(key, s.exam) <= 1;
            blocks.push({
              subject: s.name, color: s.color, minutes: focusMinutes,
              type: isRevision ? "Revision" : "Study",
            });
          }
          remaining -= count;
        });

      // Fill any leftover sessions with the highest-weight subject.
      while (remaining-- > 0 && scored.length) {
        const s = scored.slice().sort((a, b) => b.weight - a.weight)[0];
        blocks.push({ subject: s.name, color: s.color, minutes: focusMinutes, type: "Study" });
      }

      plan.push({
        date: key,
        label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        blocks,
        breaks: Math.max(0, blocks.length - 1),
      });
    }

    return {
      generatedAt: Date.now(),
      strategy: "Balanced by difficulty and exam proximity, with short breaks between sessions.",
      days: plan,
    };
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  function localQuiz({ title = "Untitled", description = "", subject = "General", count = 5 }) {
    // Without a real model we generate structured template questions seeded
    // from the resource metadata so the UI/flow is fully exercisable.
    const topic = title || subject;
    const questions = [];
    const templates = [
      { type: "mcq", q: `Which best describes the main idea of "${topic}"?`,
        options: ["The core concept covered in your notes", "An unrelated topic", "A random fact", "None of the above"], answer: 0 },
      { type: "truefalse", q: `"${topic}" relates to ${subject}.`, answer: true },
      { type: "short", q: `In one sentence, summarise a key point from "${topic}".`, answer: "" },
      { type: "mcq", q: `Which is most important to revise first in "${topic}"?`,
        options: ["High-difficulty sections", "Only the easy parts", "Nothing", "The title page"], answer: 0 },
      { type: "truefalse", q: `Spaced revision improves retention of "${topic}".`, answer: true },
    ];
    for (let i = 0; i < count; i++) questions.push(templates[i % templates.length]);
    return { title: topic, subject, description, questions, note: "Template quiz — connect an AI provider for content-aware questions." };
  }

  function localFlashcards({ notes = "", deck = "Notes", subject = "Other", count = 8 }) {
    // Turn lines like "Term: definition" or sentences into Q/A cards.
    const cards = [];
    const lines = String(notes).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (cards.length >= count) break;
      const m = line.match(/^(.{2,60}?)\s*[:\-–]\s*(.+)$/);
      if (m) cards.push({ front: m[1], back: m[2] });
      else if (line.length > 8) cards.push({ front: `Explain: ${line.slice(0, 60)}${line.length > 60 ? "…" : ""}`, back: line });
    }
    // Seed a couple if the user gave nothing useful.
    if (!cards.length) {
      cards.push({ front: `Key term in ${deck}`, back: "Add notes to auto-generate real cards." });
    }
    return { deck, subject, cards: cards.slice(0, count) };
  }

  window.SS.AI = AI;
})();
