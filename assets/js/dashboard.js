/* =========================================================
   SOFT SPACE · DASHBOARD
   The central overview. Pulls live data from every module and re-renders
   the relevant card whenever its underlying data changes.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, Store } = window.SS;

  const QUOTES = [
    "You don’t have to bloom overnight.",
    "Softness is still strength.",
    "One small step is still progress.",
    "Be proud of how far you’ve come.",
    "Discipline creates freedom.",
    "Your pace is still valid.",
    "Rest is part of growth.",
    "You are becoming everything you want.",
    "Small consistent effort beats rare intensity.",
    "Today is a good day to begin again.",
  ];

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({
      page: "dashboard",
      greet: true,
      subtitle: fmt.longDate(),
    });

    view.innerHTML = `
      <section class="hero glass">
        <h1>Welcome back.</h1>
        <p>You don't have to do everything today. Just do the next beautiful thing.</p>
        <div class="row" style="margin-top:16px">
          <a class="btn btn--primary btn--sm" href="planner.html"><i class="ri-add-line"></i> Plan today</a>
          <a class="btn btn--ghost btn--sm" href="studyhub.html"><i class="ri-timer-line"></i> Start studying</a>
          <a class="btn btn--ghost btn--sm" href="journal.html"><i class="ri-quill-pen-line"></i> Journal</a>
        </div>
      </section>

      <section class="grid">
        <div class="card quote-card">
          <h3>✨ Daily Quote</h3>
          <p id="quote" style="font-family:'Cormorant Garamond',serif;font-size:20px;line-height:1.4"></p>
        </div>

        <div class="card">
          <div class="between"><h3 style="margin:0">📌 Planner Preview</h3><a class="chip" href="planner.html">Open</a></div>
          <ul class="list" id="plannerPreview" style="margin-top:12px"></ul>
        </div>

        <div class="card">
          <h3>🌼 Today's Focus</h3>
          <div class="add-row">
            <input id="taskInput" placeholder="Quick add a task…" />
            <button class="btn btn--primary btn--icon" id="addTask" aria-label="Add task">+</button>
          </div>
          <ul class="list" id="focusList"></ul>
        </div>

        <div class="card">
          <h3>🌤 Weather</h3>
          <div id="weather" class="stack"><p class="muted">Fetching weather…</p></div>
        </div>

        <div class="card stat">
          <h3 style="justify-content:center">🔥 Habit Streak</h3>
          <div class="stat__num" id="streakNum">0</div>
          <div class="stat__label" id="streakLabel">Complete your habits to start a streak</div>
          <a class="btn btn--ghost btn--sm" href="habits.html" style="margin-top:12px">Track habits</a>
        </div>

        <div class="card">
          <div class="between"><h3 style="margin:0">📖 Today's Journal</h3><a class="chip" href="journal.html">Write</a></div>
          <p class="muted" id="journalDate" style="font-size:12px;margin:6px 0"></p>
          <p id="journalPreview" style="line-height:1.5"></p>
        </div>

        <div class="card span-2">
          <h3>🌱 Today's Progress</h3>
          <p id="progressText" class="muted" style="margin-bottom:10px"></p>
          <div class="bar"><div class="fill" id="progressBar"></div></div>
          <div class="stat-row" style="margin-top:16px" id="progressStats"></div>
        </div>
      </section>`;

    /* ---- daily quote (rotates by date) ---- */
    view.querySelector("#quote").textContent = QUOTES[new Date().getDate() % QUOTES.length];

    /* ---- planner preview ---- */
    function renderPlanner() {
      const ul = view.querySelector("#plannerPreview");
      const tasks = db.Tasks.all().filter((t) => !t.done).sort(byPriority).slice(0, 5);
      if (!tasks.length) {
        ul.innerHTML = `<li class="empty">No open tasks. Add some in the Planner.</li>`;
        return;
      }
      ul.innerHTML = tasks.map((t) => `
        <li class="item">
          <span class="badge badge--${t.priority}">${t.priority}</span>
          <div class="item__main">
            <div class="item__title">${escapeHtml(t.title)}</div>
            ${t.due ? `<div class="item__meta">${fmt.relativeDays(t.due)}</div>` : ""}
          </div>
        </li>`).join("");
    }

    /* ---- today's focus (quick task add, shares the Planner data) ---- */
    function renderFocus() {
      const ul = view.querySelector("#focusList");
      const tasks = db.Tasks.all().slice().sort(byPriority);
      if (!tasks.length) {
        ul.innerHTML = `<li class="empty">Nothing yet — add your first task above.</li>`;
        return;
      }
      ul.innerHTML = "";
      tasks.forEach((t) => {
        const li = document.createElement("li");
        li.className = "item" + (t.done ? " done" : "");
        li.innerHTML = `
          <button class="check ${t.done ? "on" : ""}" aria-label="Toggle">${t.done ? "✓" : ""}</button>
          <div class="item__main"><div class="item__title">${escapeHtml(t.title)}</div></div>
          <div class="item__actions"><button class="icon-btn danger" aria-label="Delete">🗑</button></div>`;
        li.querySelector(".check").addEventListener("click", () => {
          db.Tasks.update(t.id, (x) => ({ done: !x.done, completedAt: !x.done ? Date.now() : null }));
        });
        li.querySelector(".icon-btn").addEventListener("click", () => db.Tasks.remove(t.id));
        ul.appendChild(li);
      });
    }

    function addTask() {
      const input = view.querySelector("#taskInput");
      const val = input.value.trim();
      if (!val) return;
      db.Tasks.add({ title: val, priority: "B" });
      input.value = "";
    }
    view.querySelector("#addTask").addEventListener("click", addTask);
    view.querySelector("#taskInput").addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

    /* ---- habit streak ---- */
    function renderStreak() {
      const streak = db.Habits.streak();
      view.querySelector("#streakNum").textContent = streak;
      const label = view.querySelector("#streakLabel");
      label.textContent = streak > 0
        ? `${streak} day${streak === 1 ? "" : "s"} blooming — keep going!`
        : "Complete all habits today to begin a streak";
    }

    /* ---- journal preview ---- */
    function renderJournal() {
      const entry = db.Journal.today();
      view.querySelector("#journalDate").textContent = fmt.longDate();
      const p = view.querySelector("#journalPreview");
      if (entry && entry.text.trim()) {
        p.textContent = entry.text.slice(0, 180) + (entry.text.length > 180 ? "…" : "");
        p.classList.remove("muted");
      } else {
        p.textContent = "No entry yet. Tap “Write” to capture today.";
        p.classList.add("muted");
      }
    }

    /* ---- today's progress ---- */
    function renderProgress() {
      const p = db.todayProgress();
      view.querySelector("#progressBar").style.width = p.overall + "%";
      view.querySelector("#progressText").textContent = `${p.overall}% of today complete`;
      view.querySelector("#progressStats").innerHTML = `
        ${statTile(p.tasks.done + "/" + p.tasks.total, "Tasks")}
        ${statTile(p.habits.done + "/" + p.habits.total, "Habits")}
        ${statTile(p.sessions, "Study sessions")}
        ${statTile(fmt.duration(p.studyMinutes), "Focused")}`;
    }
    function statTile(num, label) {
      return `<div class="stat"><div class="stat__num">${escapeHtml(String(num))}</div><div class="stat__label">${label}</div></div>`;
    }

    /* ---- weather (open-meteo, location from settings) ---- */
    async function loadWeather() {
      const el = view.querySelector("#weather");
      const loc = db.Settings.get().location;
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        const w = data.current_weather;
        el.innerHTML = `
          <div class="row" style="gap:14px">
            <div style="font-size:44px">${weatherEmoji(w.weathercode)}</div>
            <div>
              <div style="font-size:26px;font-family:'Cormorant Garamond',serif">${Math.round(w.temperature)}°C</div>
              <div class="muted" style="font-size:13px">${weatherText(w.weathercode)} · ${escapeHtml(loc.name)}</div>
              <div class="muted" style="font-size:12px">Wind ${Math.round(w.windspeed)} km/h</div>
            </div>
          </div>`;
      } catch (e) {
        el.innerHTML = `<p class="muted">Weather unavailable right now.</p>`;
      }
    }

    // Re-render individual cards when their data changes (live sync).
    db.Tasks.on(() => { renderPlanner(); renderFocus(); renderProgress(); });
    db.Habits.on(() => { renderStreak(); renderProgress(); });
    Store.on("journal", renderJournal);
    db.Sessions.on(renderProgress);

    renderPlanner();
    renderFocus();
    renderStreak();
    renderJournal();
    renderProgress();
    loadWeather();
  });

  function byPriority(a, b) {
    const order = { A: 1, B: 2, C: 3 };
    return (order[a.priority] || 2) - (order[b.priority] || 2);
  }

  /* WMO weather codes -> text/emoji (open-meteo) */
  function weatherText(code) {
    const map = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
      61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
      80: "Rain showers", 81: "Rain showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm",
    };
    return map[code] || "—";
  }
  function weatherEmoji(code) {
    if (code === 0) return "☀️";
    if ([1, 2].includes(code)) return "🌤";
    if (code === 3) return "☁️";
    if ([45, 48].includes(code)) return "🌫";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧";
    if ([71, 73, 75].includes(code)) return "❄️";
    if ([95, 96, 99].includes(code)) return "⛈";
    return "🌸";
  }
})();
