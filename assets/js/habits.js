/* =========================================================
   TODAYLY · HABITS
   Create habits, tick them per day, see streaks + weekly/monthly rates.
   Completing all habits for the day feeds the dashboard streak.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, UI } = window.SS;
  const EMOJIS = ["🌸", "💧", "📚", "🏃", "🧘", "🥗", "😴", "🎧", "✍️", "🙏"];

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "habits", title: "Habits", subtitle: "Small rituals, gently repeated." });

    view.innerHTML = `
      <section class="grid grid--wide">
        <div class="card span-2">
          <h3>Add a habit</h3>
          <div class="add-row">
            <select id="hEmoji" style="max-width:80px">${EMOJIS.map((e) => `<option>${e}</option>`).join("")}</select>
            <input id="hName" placeholder="e.g. Drink water, Read 10 pages…" />
            <button class="btn btn--primary" id="addBtn"><i class="ri-add-line"></i> Add</button>
          </div>
          <ul class="list" id="habitList" style="margin-top:14px"></ul>
        </div>

        <div class="card stat">
          <h3 style="justify-content:center">🔥 Current Streak</h3>
          <div class="stat__num" id="streakNum">0</div>
          <div class="stat__label">days with everything done</div>
        </div>

        <div class="card">
          <h3>📈 Completion</h3>
          <div class="stat-row">
            <div class="stat"><div class="stat__num" id="week">0%</div><div class="stat__label">This week</div></div>
            <div class="stat"><div class="stat__num" id="month">0%</div><div class="stat__label">This month</div></div>
          </div>
          <p class="muted" style="margin-top:12px;font-size:13px">Last 7 days</p>
          <div id="weekGrid" class="row" style="gap:6px;margin-top:8px"></div>
        </div>
      </section>`;

    function addHabit() {
      const name = view.querySelector("#hName").value.trim();
      if (!name) return;
      db.Habits.add({ name, emoji: view.querySelector("#hEmoji").value });
      view.querySelector("#hName").value = "";
    }

    function render() {
      const today = fmt.today();
      const habits = db.Habits.all();
      const ul = view.querySelector("#habitList");

      if (!habits.length) {
        ul.innerHTML = `<li class="empty">No habits yet. Add one above to begin.</li>`;
      } else {
        ul.innerHTML = "";
        habits.forEach((h) => {
          const doneToday = !!(h.log && h.log[today]);
          const rate = habitRate(h, 30);
          const li = document.createElement("li");
          li.className = "item" + (doneToday ? " done" : "");
          li.innerHTML = `
            <button class="check ${doneToday ? "on" : ""}" aria-label="Toggle today">${doneToday ? "✓" : ""}</button>
            <div class="item__main">
              <div class="item__title">${escapeHtml(h.emoji)} ${escapeHtml(h.name)}</div>
              <div class="item__meta">🔥 ${habitStreak(h)} day streak · ${rate}% this month</div>
            </div>
            <div class="item__actions"><button class="icon-btn danger" aria-label="Delete">🗑</button></div>`;
          li.querySelector(".check").addEventListener("click", () => db.Habits.toggle(h.id, today));
          li.querySelector(".icon-btn").addEventListener("click", async () => {
            if (await UI.confirm(`Delete "${h.name}"?`, { danger: true })) db.Habits.remove(h.id);
          });
          ul.appendChild(li);
        });
      }

      view.querySelector("#streakNum").textContent = db.Habits.streak();
      view.querySelector("#week").textContent = db.Habits.completionRate(7) + "%";
      view.querySelector("#month").textContent = db.Habits.completionRate(30) + "%";

      // Last-7-days "all habits done?" dots
      const grid = view.querySelector("#weekGrid");
      grid.innerHTML = "";
      const d = new Date();
      d.setDate(d.getDate() - 6);
      for (let i = 0; i < 7; i++) {
        const key = fmt.dateKey(d);
        const all = db.Habits.allDoneOn(key);
        const label = new Date(d).toLocaleDateString("en-US", { weekday: "short" })[0];
        grid.innerHTML += `
          <div style="text-align:center;flex:1">
            <div style="width:26px;height:26px;margin:0 auto;border-radius:8px;background:${all ? "var(--accent)" : "var(--line)"}"></div>
            <small class="muted">${label}</small>
          </div>`;
        d.setDate(d.getDate() + 1);
      }
    }

    // Per-habit streak (consecutive days ending today).
    function habitStreak(h) {
      let s = 0; const d = new Date();
      while (h.log && h.log[fmt.dateKey(d)]) { s++; d.setDate(d.getDate() - 1); }
      return s;
    }
    function habitRate(h, days) {
      let done = 0; const d = new Date();
      for (let i = 0; i < days; i++) { if (h.log && h.log[fmt.dateKey(d)]) done++; d.setDate(d.getDate() - 1); }
      return Math.round((done / days) * 100);
    }

    view.querySelector("#addBtn").addEventListener("click", addHabit);
    view.querySelector("#hName").addEventListener("keypress", (e) => { if (e.key === "Enter") addHabit(); });

    db.Habits.on(render);
    render();
  });
})();
