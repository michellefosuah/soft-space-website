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

  /* =========================================================
     REAL PROVIDER · Anthropic Messages API (bring-your-own-key)
     Enabled from Settings → AI. Because this is a static app with no
     backend, the call goes straight from the browser to Anthropic using
     the user's own key (or a custom proxy endpoint). Quizzes & flashcards
     become content-aware: a PDF/image library resource is sent as a
     document/image block so questions come from the actual file.
     Only quiz + flashcards route here; the study plan stays local
     (deterministic and offline). Any failure falls back to the heuristics.
     ========================================================= */

  const DEFAULT_MODEL = "claude-opus-4-8";

  function aiConfig() {
    return Object.assign(
      { enabled: false, apiKey: "", model: DEFAULT_MODEL, endpoint: "" },
      window.SS.Store ? window.SS.Store.get("aiConfig", {}) : {}
    );
  }

  // base64 (no data: prefix) of a Blob, for document/image content blocks.
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  // Turn a library resource into a Claude content block (PDF or image only).
  async function resourceBlock(resource) {
    if (!resource || !resource.fileId || !window.SS.FileDB) return null;
    let blob;
    try { blob = await window.SS.FileDB.get(resource.fileId); } catch (_) { return null; }
    if (!blob) return null;
    const type = resource.fileType || blob.type || "";
    const data = await blobToBase64(blob);
    if (type.includes("pdf")) {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    if (type.includes("image")) {
      return { type: "image", source: { type: "base64", media_type: type, data } };
    }
    return null; // DOCX/PPT aren't accepted as document blocks — metadata only
  }

  // One Messages API call. Returns parsed JSON when a schema is given.
  async function callClaude({ system, content, schema, maxTokens = 4096 }) {
    const cfg = aiConfig();
    const endpoint = cfg.endpoint || "https://api.anthropic.com/v1/messages";
    const headers = { "content-type": "application/json" };
    if (cfg.endpoint) {
      // Custom proxy: send the key as a bearer token (proxy adds the real key).
      if (cfg.apiKey) headers["authorization"] = "Bearer " + cfg.apiKey;
    } else {
      headers["x-api-key"] = cfg.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    const body = {
      model: cfg.model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    };
    if (system) body.system = system;
    if (schema) body.output_config = { format: { type: "json_schema", schema } };

    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("AI request failed (" + res.status + ")");
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return schema ? JSON.parse(text) : text;
  }

  const QUIZ_SCHEMA = {
    type: "object", additionalProperties: false,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["mcq", "truefalse", "short"] },
            q: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
          },
          required: ["type", "q", "options", "answer"],
        },
      },
    },
    required: ["questions"],
  };

  const FLASHCARD_SCHEMA = {
    type: "object", additionalProperties: false,
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: { front: { type: "string" }, back: { type: "string" } },
          required: ["front", "back"],
        },
      },
    },
    required: ["cards"],
  };

  async function providerQuiz(p) {
    const count = p.count || 5;
    const content = [];
    const block = await resourceBlock(p.resource);
    if (block) content.push(block);
    content.push({ type: "text", text:
      `Create ${count} quiz questions about "${p.title || p.subject || "the topic"}"` +
      (p.subject ? ` (subject: ${p.subject})` : "") + ".\n" +
      (p.description ? `Context: ${p.description}\n` : "") +
      (block ? "Base the questions on the attached document/image.\n" : "") +
      `Mix multiple-choice, true/false, and short-answer. For MCQ give 4 options and set "answer" to the exact correct option text. For true/false set "answer" to "true" or "false". For short answer set "answer" to "".` });

    const result = await callClaude({
      system: "You are a precise study-quiz generator. Base questions only on the given material; keep them accurate and clear.",
      content, schema: QUIZ_SCHEMA,
    });

    const questions = (result.questions || []).map((qq) => {
      if (qq.type === "mcq") {
        const options = qq.options && qq.options.length ? qq.options : ["A", "B", "C", "D"];
        return { type: "mcq", q: qq.q, options, answer: Math.max(0, options.indexOf(qq.answer)) };
      }
      if (qq.type === "truefalse") return { type: "truefalse", q: qq.q, answer: String(qq.answer).toLowerCase() === "true" };
      return { type: "short", q: qq.q, answer: "" };
    });
    return { title: p.title || p.subject || "Quiz", subject: p.subject || "General", description: p.description || "", questions };
  }

  async function providerFlashcards(p) {
    const count = p.count || 10;
    const content = [];
    const block = await resourceBlock(p.resource);
    if (block) content.push(block);
    content.push({ type: "text", text:
      `Create ${count} study flashcards for deck "${p.deck || "Notes"}"` +
      (p.subject ? ` (subject ${p.subject})` : "") + ".\n" +
      (p.notes ? `Notes:\n${p.notes}\n` : "") +
      (block ? "Base the cards on the attached document/image.\n" : "") +
      `Each card: "front" is a short prompt or term, "back" is a concise answer.` });

    const result = await callClaude({
      system: "You generate concise, accurate study flashcards from the given material.",
      content, schema: FLASHCARD_SCHEMA,
    });
    return { deck: p.deck || "Notes", subject: p.subject || "Other", cards: (result.cards || []).slice(0, count) };
  }

  // Wire the provider based on saved settings. Called on load and after
  // Settings changes. Study-plan stays local, so the provider throws for it
  // and _run's catch falls back to the heuristic.
  AI.configure = function () {
    const cfg = aiConfig();
    if (cfg.enabled && (cfg.apiKey || cfg.endpoint)) {
      AI.provider = async ({ task, payload }) => {
        if (task === "quiz") return providerQuiz(payload);
        if (task === "flashcards") return providerFlashcards(payload);
        throw new Error("local"); // study-plan -> heuristic fallback
      };
    } else {
      AI.provider = null;
    }
  };

  AI.configure();
  if (window.SS.Store) window.SS.Store.on("aiConfig", () => AI.configure());

  window.SS.AI = AI;
})();
