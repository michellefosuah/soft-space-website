/* =========================================================
   SOFT SPACE · STUDY HUB (core feature)
   Tabs: Focus · Plan · Stats · Library · Learn
     Focus   – Pomodoro timer (settings-driven), study checklist
     Plan    – Subjects, Timetable, Exams + countdowns, AI Study Planner
     Stats   – Total time/sessions, daily/weekly/monthly, trend chart
     Library – Upload materials (IndexedDB), search/filter/view/download
     Learn   – Quiz generator + Flashcards (pluggable AI)
   All panels are rendered once and toggled, so the timer keeps running
   while you move between tabs.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, UI, Charts, FileDB, AI, uid } = window.SS;
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const SUBJECT_COLORS = ["#D8A7B1", "#C9A7E8", "#A7C7E7", "#8FD3B6", "#E8B87A", "#E79DB0"];

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "studyhub", title: "Study Hub", subtitle: "Your calm, focused study companion." });

    view.innerHTML = `
      <div class="seg" id="tabs" style="margin-bottom:18px;overflow:auto;max-width:100%">
        <button data-tab="focus" class="on">🍅 Focus</button>
        <button data-tab="plan">🗓 Plan</button>
        <button data-tab="stats">📊 Stats</button>
        <button data-tab="library">📚 Library</button>
        <button data-tab="learn">🧠 Learn</button>
      </div>
      <div id="panel-focus" class="tab-panel"></div>
      <div id="panel-plan" class="tab-panel" hidden></div>
      <div id="panel-stats" class="tab-panel" hidden></div>
      <div id="panel-library" class="tab-panel" hidden></div>
      <div id="panel-learn" class="tab-panel" hidden></div>`;

    view.querySelector("#tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tab]"); if (!b) return;
      view.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
      view.querySelectorAll(".tab-panel").forEach((p) => p.hidden = p.id !== "panel-" + b.dataset.tab);
    });

    buildFocus(view.querySelector("#panel-focus"));
    buildPlan(view.querySelector("#panel-plan"));
    buildStats(view.querySelector("#panel-stats"));
    buildLibrary(view.querySelector("#panel-library"));
    buildLearn(view.querySelector("#panel-learn"));
  });

  /* ============================================================
     FOCUS · Pomodoro + study checklist
     ============================================================ */
  function buildFocus(panel) {
    panel.innerHTML = `
      <section class="grid grid--wide">
        <div class="card" style="text-align:center">
          <h3 style="justify-content:center">Pomodoro</h3>
          <div class="row" style="justify-content:center;margin-bottom:6px">
            <select id="pomoSubject" style="max-width:200px"></select>
          </div>
          <div class="timer-wrap">
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle class="ring-bg" cx="110" cy="110" r="95"></circle>
              <circle class="ring-fg" id="ring" cx="110" cy="110" r="95"></circle>
            </svg>
            <div class="timer-center">
              <h1 id="clock">25:00</h1>
              <p id="mode">🍅 Focus session</p>
            </div>
          </div>
          <div class="pomo-btns">
            <button class="btn btn--primary" id="startPause">Start</button>
            <button class="btn btn--ghost" id="reset">Reset</button>
          </div>
        </div>

        <div class="card stat">
          <h3 style="justify-content:center">Today</h3>
          <div class="stat-row" style="margin-top:6px">
            <div class="stat"><div class="stat__num" id="todaySessions">0</div><div class="stat__label">Sessions</div></div>
            <div class="stat"><div class="stat__num" id="todayTime">0m</div><div class="stat__label">Focused</div></div>
          </div>
          <p class="muted" id="cycleHint" style="margin-top:14px;font-size:13px"></p>
        </div>

        <div class="card" id="musicCard"></div>

        <div class="card span-2">
          <h3>✅ Study checklist</h3>
          <div class="add-row">
            <input id="stText" placeholder="Add a study task…" />
            <select id="stPriority" style="max-width:90px"><option>A</option><option selected>B</option><option>C</option></select>
            <button class="btn btn--primary btn--icon" id="stAdd">+</button>
          </div>
          <ul class="list" id="stList"></ul>
        </div>
      </section>`;

    // Focus music panel (offline sounds + streaming embeds).
    if (window.SS.Music) SS.Music.render(panel.querySelector("#musicCard"));

    const S = db.Settings.get();
    let mode = "focus";               // focus | break | long
    let remaining = S.focusMinutes * 60;
    let total = remaining;
    let running = false;
    let ticker = null;
    let completedFocus = 0;           // focus sessions since load (for long-break cadence)

    const clock = panel.querySelector("#clock");
    const modeEl = panel.querySelector("#mode");
    const ring = panel.querySelector("#ring");
    const CIRC = 2 * Math.PI * 95;
    ring.style.strokeDasharray = CIRC;

    function paint() {
      const m = Math.floor(remaining / 60), s = remaining % 60;
      clock.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
      ring.style.strokeDashoffset = CIRC - (remaining / total) * CIRC;
    }
    function setMode(next) {
      const cfg = db.Settings.get();
      mode = next;
      total = remaining =
        (next === "focus" ? cfg.focusMinutes : next === "long" ? cfg.longBreakMinutes : cfg.breakMinutes) * 60;
      modeEl.textContent = next === "focus" ? "🍅 Focus session" : next === "long" ? "🌿 Long break" : "☕ Short break";
      paint();
    }
    function tick() {
      remaining--;
      if (remaining <= 0) { complete(); return; }
      paint();
    }
    function complete() {
      clearInterval(ticker); running = false;
      panel.querySelector("#startPause").textContent = "Start";

      if (mode === "focus") {
        // A completed focus session counts as one study session.
        const subject = panel.querySelector("#pomoSubject").value || "General";
        db.Sessions.add({ subject, minutes: db.Settings.get().focusMinutes });
        completedFocus++;
        notify("Focus complete 🌸", "Time for a break.");
        setMode(completedFocus % 4 === 0 ? "long" : "break");
      } else {
        notify("Break over ☕", "Ready for another focus session?");
        setMode("focus");
      }
      renderTodayStats();
      // Auto-start the next interval for a smooth flow.
      start();
    }
    function start() {
      if (running) return;
      running = true;
      panel.querySelector("#startPause").textContent = "Pause";
      // Optionally fade in the selected focus sound alongside the timer.
      if (window.SS.Music && !SS.Music.Sound.isPlaying()) SS.Music.startWithTimer();
      ticker = setInterval(tick, 1000);
    }
    function pause() {
      running = false;
      clearInterval(ticker);
      panel.querySelector("#startPause").textContent = remaining < total ? "Resume" : "Start";
    }

    panel.querySelector("#startPause").addEventListener("click", () => (running ? pause() : start()));
    panel.querySelector("#reset").addEventListener("click", () => {
      pause(); setMode("focus"); panel.querySelector("#startPause").textContent = "Start";
      if (window.SS.Music) SS.Music.stop();
    });

    function notify(title, body) {
      UI.toast(title, "success");
      const st = db.Settings.get();
      if (st.notifications && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(title, { body }); } catch (_) {}
      }
    }

    // subject dropdown (kept in sync with Subjects)
    function fillSubjects() {
      const sel = panel.querySelector("#pomoSubject");
      const prev = sel.value;
      const subs = db.Subjects.all();
      sel.innerHTML = `<option value="General">General</option>` +
        subs.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("");
      if (prev) sel.value = prev;
    }

    function renderTodayStats() {
      const list = db.Sessions.onDate(fmt.today());
      panel.querySelector("#todaySessions").textContent = list.length;
      panel.querySelector("#todayTime").textContent = fmt.duration(db.Sessions.totalMinutes(list));
      panel.querySelector("#cycleHint").textContent =
        `${completedFocus % 4}/4 focus sessions until a long break.`;
    }

    // study checklist
    function renderChecklist() {
      const ul = panel.querySelector("#stList");
      const tasks = db.StudyTasks.all().slice().sort((a, b) => (a.done - b.done) || ("ABC".indexOf(a.priority) - "ABC".indexOf(b.priority)));
      if (!tasks.length) { ul.innerHTML = `<li class="empty">No study tasks yet.</li>`; return; }
      ul.innerHTML = "";
      tasks.forEach((t) => {
        const li = document.createElement("li");
        li.className = "item" + (t.done ? " done" : "");
        li.innerHTML = `
          <button class="check ${t.done ? "on" : ""}">${t.done ? "✓" : ""}</button>
          <span class="badge badge--${t.priority}">${t.priority}</span>
          <div class="item__main"><div class="item__title">${escapeHtml(t.text)}</div></div>
          <button class="icon-btn danger">🗑</button>`;
        li.querySelector(".check").addEventListener("click", () => db.StudyTasks.update(t.id, (x) => ({ done: !x.done })));
        li.querySelector(".icon-btn").addEventListener("click", () => db.StudyTasks.remove(t.id));
        ul.appendChild(li);
      });
    }
    function addStudyTask() {
      const val = panel.querySelector("#stText").value.trim();
      if (!val) return;
      db.StudyTasks.add({ text: val, priority: panel.querySelector("#stPriority").value });
      panel.querySelector("#stText").value = "";
    }
    panel.querySelector("#stAdd").addEventListener("click", addStudyTask);
    panel.querySelector("#stText").addEventListener("keypress", (e) => { if (e.key === "Enter") addStudyTask(); });

    db.StudyTasks.on(renderChecklist);
    db.Subjects.on(fillSubjects);
    db.Sessions.on(renderTodayStats);

    fillSubjects();
    setMode("focus");
    renderTodayStats();
    renderChecklist();
  }

  /* ============================================================
     PLAN · Subjects, Timetable, Exams, AI Study Planner
     ============================================================ */
  function buildPlan(panel) {
    panel.innerHTML = `
      <section class="grid grid--wide">
        <div class="card">
          <h3>📘 Subjects</h3>
          <div class="add-row">
            <input id="subjName" placeholder="Subject name…" />
            <select id="subjDiff" style="max-width:130px" title="Difficulty">
              <option value="1">Easy</option><option value="2">Light</option>
              <option value="3" selected>Medium</option><option value="4">Hard</option><option value="5">Very hard</option>
            </select>
            <button class="btn btn--primary btn--icon" id="subjAdd">+</button>
          </div>
          <div class="list" id="subjList"></div>
        </div>

        <div class="card">
          <h3>📅 Exams</h3>
          <div class="add-row">
            <input id="examSubject" placeholder="Subject…" />
            <input id="examDate" type="date" style="max-width:170px" />
            <button class="btn btn--primary btn--icon" id="examAdd">+</button>
          </div>
          <div class="list" id="examList"></div>
        </div>

        <div class="card span-2">
          <h3>🕐 Timetable</h3>
          <div class="row" style="gap:8px;margin-bottom:12px">
            <select id="ttDay" style="max-width:110px">${DAYS.map((d) => `<option>${d}</option>`).join("")}</select>
            <input id="ttSubject" placeholder="Subject" style="flex:1;min-width:120px" />
            <input id="ttStart" type="time" value="08:00" style="max-width:130px" />
            <input id="ttEnd" type="time" value="09:00" style="max-width:130px" />
            <input id="ttLoc" placeholder="Location" style="max-width:150px" />
            <button class="btn btn--primary" id="ttAdd"><i class="ri-add-line"></i></button>
          </div>
          <div class="tt-grid" id="ttGrid"></div>
        </div>

        <div class="card span-2">
          <div class="between">
            <h3 style="margin:0">🧠 AI Study Planner</h3>
            <div class="row">
              <label class="muted" style="font-size:13px">Sessions/day</label>
              <input id="aiPerDay" type="number" min="1" max="10" value="4" style="width:70px" />
              <button class="btn btn--primary btn--sm" id="aiGen"><i class="ri-sparkling-line"></i> Generate</button>
            </div>
          </div>
          <p class="muted" style="font-size:13px;margin:6px 0 0" id="aiStrategy"></p>
          <div id="aiPlan" style="margin-top:12px"></div>
        </div>
      </section>`;

    // subjects
    function renderSubjects() {
      const host = panel.querySelector("#subjList");
      const subs = db.Subjects.all();
      if (!subs.length) { host.innerHTML = `<p class="empty">Add the subjects you're studying.</p>`; return; }
      host.innerHTML = "";
      subs.forEach((s) => {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <span class="legend-dot" style="background:${s.color};width:16px;height:16px"></span>
          <div class="item__main"><div class="item__title">${escapeHtml(s.name)}</div>
            <div class="item__meta">Difficulty ${s.difficulty}/5</div></div>
          <button class="icon-btn danger">🗑</button>`;
        row.querySelector(".icon-btn").addEventListener("click", () => db.Subjects.remove(s.id));
        host.appendChild(row);
      });
    }
    panel.querySelector("#subjAdd").addEventListener("click", () => {
      const name = panel.querySelector("#subjName").value.trim();
      if (!name) return;
      const n = db.Subjects.all().length;
      db.Subjects.add({ name, difficulty: +panel.querySelector("#subjDiff").value, color: SUBJECT_COLORS[n % SUBJECT_COLORS.length] });
      panel.querySelector("#subjName").value = "";
    });

    // exams
    function renderExams() {
      const host = panel.querySelector("#examList");
      const exams = db.Exams.upcoming();
      if (!exams.length) { host.innerHTML = `<p class="empty">No upcoming exams.</p>`; return; }
      host.innerHTML = "";
      exams.forEach((e) => {
        const days = Math.max(0, Math.round((new Date(e.date) - new Date().setHours(0,0,0,0)) / 86400000));
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div class="item__main"><div class="item__title">${escapeHtml(e.subject)}</div>
            <div class="item__meta">${fmt.shortDate(e.date)} · ${fmt.relativeDays(e.date)}</div></div>
          <span class="chip" style="color:${days <= 3 ? "var(--danger)" : "var(--text-soft)"}">${days}d</span>
          <button class="icon-btn danger">🗑</button>`;
        row.querySelector(".icon-btn").addEventListener("click", () => db.Exams.remove(e.id));
        host.appendChild(row);
      });
    }
    panel.querySelector("#examAdd").addEventListener("click", () => {
      const subject = panel.querySelector("#examSubject").value.trim();
      const date = panel.querySelector("#examDate").value;
      if (!subject || !date) { UI.toast("Subject and date needed", "error"); return; }
      db.Exams.add({ subject, date });
      panel.querySelector("#examSubject").value = "";
      panel.querySelector("#examDate").value = "";
    });

    // timetable
    function renderTimetable() {
      const grid = panel.querySelector("#ttGrid");
      const blocks = db.Timetable.all();
      grid.innerHTML = DAYS.map((day) => {
        const dayBlocks = blocks.filter((b) => b.day === day).sort((a, b) => a.start.localeCompare(b.start));
        return `
          <div class="tt-day">
            <h4>${day}</h4>
            ${dayBlocks.length ? dayBlocks.map((b) => `
              <div class="tt-block" data-id="${b.id}">
                <strong>${escapeHtml(b.subject)}</strong>
                <small>${b.start}–${b.end}${b.location ? " · " + escapeHtml(b.location) : ""}</small>
                <button class="icon-btn danger" data-del="${b.id}" style="float:right;margin-top:-22px">🗑</button>
              </div>`).join("") : `<p class="muted" style="font-size:12px">—</p>`}
          </div>`;
      }).join("");
      grid.querySelectorAll("[data-del]").forEach((btn) =>
        btn.addEventListener("click", () => db.Timetable.remove(btn.dataset.del)));
    }
    panel.querySelector("#ttAdd").addEventListener("click", () => {
      const subject = panel.querySelector("#ttSubject").value.trim();
      if (!subject) { UI.toast("Enter a subject", "error"); return; }
      db.Timetable.add({
        day: panel.querySelector("#ttDay").value,
        subject,
        start: panel.querySelector("#ttStart").value,
        end: panel.querySelector("#ttEnd").value,
        location: panel.querySelector("#ttLoc").value.trim(),
      });
      panel.querySelector("#ttSubject").value = "";
      panel.querySelector("#ttLoc").value = "";
    });

    // AI planner
    async function generatePlan() {
      const subjects = db.Subjects.all();
      if (!subjects.length) { UI.toast("Add subjects first", "error"); return; }
      const btn = panel.querySelector("#aiGen");
      btn.disabled = true; btn.innerHTML = "Thinking…";
      const plan = await AI.generateStudyPlan({
        subjects,
        exams: db.Exams.upcoming(),
        sessionsPerDay: +panel.querySelector("#aiPerDay").value || 4,
        days: 7,
        focusMinutes: db.Settings.get().focusMinutes,
      });
      btn.disabled = false; btn.innerHTML = `<i class="ri-sparkling-line"></i> Regenerate`;
      db.StudyPlan.set(plan);
    }
    function renderPlan() {
      const plan = db.StudyPlan.get();
      const host = panel.querySelector("#aiPlan");
      panel.querySelector("#aiStrategy").textContent = plan ? plan.strategy : "";
      if (!plan) { host.innerHTML = `<p class="empty">Generate a personalised weekly plan from your subjects & exams.</p>`; return; }
      host.innerHTML = `
        <div class="tt-grid">
          ${plan.days.map((d) => `
            <div class="tt-day">
              <h4>${escapeHtml(d.label)}</h4>
              ${d.blocks.map((b) => `
                <div class="tt-block" style="border-left-color:${b.color || "var(--accent)"}">
                  <strong>${escapeHtml(b.subject)}</strong>
                  <small>${b.minutes}m · ${b.type}</small>
                </div>`).join("")}
            </div>`).join("")}
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn btn--primary btn--sm" id="acceptPlan">✔ Accept</button>
          <button class="btn btn--ghost btn--sm" id="modifyPlan">✎ Modify</button>
          <button class="btn btn--ghost btn--sm" id="rejectPlan">✖ Reject</button>
        </div>`;
      host.querySelector("#acceptPlan").addEventListener("click", () => UI.toast("Plan accepted — happy studying! 🌸", "success"));
      host.querySelector("#rejectPlan").addEventListener("click", () => db.StudyPlan.clear());
      host.querySelector("#modifyPlan").addEventListener("click", () => {
        panel.querySelector("#aiPerDay").focus();
        UI.toast("Adjust sessions/day, then Regenerate", "info");
      });
    }
    panel.querySelector("#aiGen").addEventListener("click", generatePlan);

    db.Subjects.on(renderSubjects);
    db.Exams.on(renderExams);
    db.Timetable.on(renderTimetable);
    db.StudyPlan.on(renderPlan);

    renderSubjects();
    renderExams();
    renderTimetable();
    renderPlan();
  }

  /* ============================================================
     STATS · daily / weekly / monthly totals + trend
     ============================================================ */
  function buildStats(panel) {
    panel.innerHTML = `
      <section class="grid grid--wide">
        <div class="card span-2">
          <div class="between">
            <h3 style="margin:0">📊 Study statistics</h3>
            <div class="seg" id="range">
              <button data-d="7" class="on">Week</button>
              <button data-d="30">Month</button>
              <button data-d="1">Today</button>
            </div>
          </div>
          <div class="stat-row" style="margin:16px 0">
            <div class="stat"><div class="stat__num" id="sTotalTime">0m</div><div class="stat__label">Total time</div></div>
            <div class="stat"><div class="stat__num" id="sTotalSessions">0</div><div class="stat__label">Sessions</div></div>
            <div class="stat"><div class="stat__num" id="sAvg">0m</div><div class="stat__label">Daily avg</div></div>
            <div class="stat"><div class="stat__num" id="sTrend">—</div><div class="stat__label">Trend</div></div>
          </div>
          <div id="chart"></div>
        </div>

        <div class="card">
          <h3>🏆 By subject</h3>
          <div id="bySubject" class="legend"></div>
        </div>
      </section>`;

    let days = 7;

    function render() {
      const per = db.Sessions.perDay(days === 1 ? 1 : days);
      const totalMins = per.reduce((s, d) => s + d.value, 0);
      const sessions = db.Sessions.all().filter((x) => withinDays(x.date, days)).length;
      panel.querySelector("#sTotalTime").textContent = fmt.duration(totalMins);
      panel.querySelector("#sTotalSessions").textContent = sessions;
      panel.querySelector("#sAvg").textContent = fmt.duration(totalMins / Math.max(1, days === 1 ? 1 : days));

      // Trend: compare first half vs second half of the window.
      const half = Math.floor(per.length / 2);
      const early = per.slice(0, half).reduce((s, d) => s + d.value, 0);
      const late = per.slice(half).reduce((s, d) => s + d.value, 0);
      const trendEl = panel.querySelector("#sTrend");
      trendEl.textContent = late > early ? "↑ Up" : late < early ? "↓ Down" : "→ Flat";
      trendEl.style.color = late > early ? "var(--ok)" : late < early ? "var(--danger)" : "var(--text-soft)";

      panel.querySelector("#chart").innerHTML = per.length > 1
        ? Charts.bars(per.map((d) => ({ label: d.label, value: d.value, color: "var(--accent)" })), { height: 170 })
        : `<p class="muted" style="text-align:center">${fmt.duration(totalMins)} studied today.</p>`;

      // by subject
      const bySub = {};
      db.Sessions.all().filter((x) => withinDays(x.date, days)).forEach((x) => {
        bySub[x.subject] = (bySub[x.subject] || 0) + x.minutes;
      });
      const subs = Object.keys(bySub).sort((a, b) => bySub[b] - bySub[a]);
      panel.querySelector("#bySubject").innerHTML = subs.length
        ? subs.map((s, i) => `<div class="legend-item"><span class="legend-dot" style="background:${SUBJECT_COLORS[i % SUBJECT_COLORS.length]}"></span>${escapeHtml(s)} · ${fmt.duration(bySub[s])}</div>`).join("")
        : `<p class="empty">No sessions in this range.</p>`;
    }

    function withinDays(dateStr, n) {
      const diff = (new Date().setHours(0,0,0,0) - new Date(dateStr).setHours(0,0,0,0)) / 86400000;
      return diff >= 0 && diff < n;
    }

    panel.querySelector("#range").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-d]"); if (!b) return;
      days = +b.dataset.d;
      panel.querySelectorAll("#range button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    });

    db.Sessions.on(render);
    render();
  }

  /* ============================================================
     LIBRARY · upload (IndexedDB) + search/filter/view/download/delete
     ============================================================ */
  function buildLibrary(panel) {
    const SUBJECTS = ["Physics", "Mathematics", "Programming", "Chemistry", "Biology", "Economics", "Other"];
    panel.innerHTML = `
      <section class="grid grid--wide">
        <div class="card">
          <h3>⬆️ Upload material</h3>
          <div class="stack">
            <div class="field"><label>Title</label><input id="libTitle" placeholder="e.g. EM Theory — Week 4" /></div>
            <div class="form-row">
              <div class="field"><label>Subject</label><select id="libSubject">${SUBJECTS.map((s) => `<option>${s}</option>`).join("")}</select></div>
              <div class="field"><label>File</label><input type="file" id="libFile" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" /></div>
            </div>
            <div class="field"><label>Description</label><textarea id="libDesc" placeholder="Optional notes…" style="min-height:70px"></textarea></div>
            <button class="btn btn--primary btn--block" id="libUpload"><i class="ri-upload-cloud-2-line"></i> Upload</button>
          </div>
        </div>

        <div class="card span-2">
          <div class="between">
            <h3 style="margin:0">📂 My Library</h3>
            <span class="muted" id="libCount" style="font-size:13px"></span>
          </div>
          <div class="row" style="gap:8px;margin:10px 0">
            <input id="libSearch" placeholder="Search…" style="flex:1" />
            <select id="libFilter" style="max-width:150px"><option value="">All subjects</option>${SUBJECTS.map((s) => `<option>${s}</option>`).join("")}</select>
          </div>
          <div class="lib-list" id="libList"></div>
        </div>
      </section>`;

    async function upload() {
      const fileInput = panel.querySelector("#libFile");
      const file = fileInput.files[0];
      if (!file) { UI.toast("Choose a file", "error"); return; }
      const fileId = uid();
      try {
        await FileDB.put(fileId, file);              // blob -> IndexedDB
      } catch (e) { UI.toast("Couldn't store file", "error"); return; }
      db.Library.add({                               // metadata -> localStorage
        title: panel.querySelector("#libTitle").value.trim() || file.name,
        subject: panel.querySelector("#libSubject").value,
        description: panel.querySelector("#libDesc").value.trim(),
        fileId, fileName: file.name, fileType: file.type, size: file.size,
      });
      fileInput.value = "";
      panel.querySelector("#libTitle").value = "";
      panel.querySelector("#libDesc").value = "";
      UI.toast("Uploaded", "success");
    }

    async function openFile(item, download) {
      const blob = await FileDB.get(item.fileId);
      if (!blob) { UI.toast("File missing", "error"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      if (download) a.download = item.fileName; else a.target = "_blank";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function render() {
      const q = panel.querySelector("#libSearch").value.toLowerCase();
      const filter = panel.querySelector("#libFilter").value;
      let items = db.Library.all().slice().reverse();
      if (filter) items = items.filter((i) => i.subject === filter);
      if (q) items = items.filter((i) => (i.title + i.fileName + i.description + i.subject).toLowerCase().includes(q));

      panel.querySelector("#libCount").textContent = `${db.Library.all().length} item${db.Library.all().length === 1 ? "" : "s"}`;
      const host = panel.querySelector("#libList");
      if (!items.length) { host.innerHTML = `<p class="empty">Nothing here yet.</p>`; return; }
      host.innerHTML = "";
      items.forEach((i) => {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div style="font-size:22px">${fileIcon(i.fileType, i.fileName)}</div>
          <div class="item__main">
            <div class="item__title">${escapeHtml(i.title)}</div>
            <div class="item__meta"><span class="chip">${escapeHtml(i.subject)}</span> ${fmt.shortDate(i.date)} · ${(i.size / 1024).toFixed(0)} KB</div>
            ${i.description ? `<div class="item__meta">${escapeHtml(i.description)}</div>` : ""}
          </div>
          <div class="item__actions">
            <button class="icon-btn" data-act="view" title="View">👁</button>
            <button class="icon-btn" data-act="dl" title="Download">⬇️</button>
            <button class="icon-btn danger" data-act="del" title="Delete">🗑</button>
          </div>`;
        row.querySelector('[data-act="view"]').addEventListener("click", () => openFile(i, false));
        row.querySelector('[data-act="dl"]').addEventListener("click", () => openFile(i, true));
        row.querySelector('[data-act="del"]').addEventListener("click", async () => {
          if (!(await UI.confirm(`Delete "${i.title}"?`, { danger: true }))) return;
          await FileDB.delete(i.fileId);
          db.Library.remove(i.id);
        });
        host.appendChild(row);
      });
    }

    panel.querySelector("#libUpload").addEventListener("click", upload);
    panel.querySelector("#libSearch").addEventListener("input", render);
    panel.querySelector("#libFilter").addEventListener("change", render);
    db.Library.on(render);
    render();
  }

  function fileIcon(type, name) {
    const n = (name || "").toLowerCase();
    if ((type || "").includes("image")) return "🖼";
    if (n.endsWith(".pdf")) return "📕";
    if (n.endsWith(".doc") || n.endsWith(".docx")) return "📘";
    if (n.endsWith(".ppt") || n.endsWith(".pptx")) return "📙";
    return "📄";
  }

  /* ============================================================
     LEARN · Quiz generator + Flashcards
     ============================================================ */
  function buildLearn(panel) {
    panel.innerHTML = `
      <section class="grid grid--wide">
        <div class="card span-2">
          <h3>❓ Quiz generator</h3>
          <div class="row" style="gap:8px;margin-bottom:10px">
            <input id="qzTitle" placeholder="Topic or resource title…" style="flex:1;min-width:160px" />
            <input id="qzSubject" placeholder="Subject" style="max-width:150px" />
            <input id="qzCount" type="number" min="3" max="10" value="5" style="width:70px" title="Questions" />
            <button class="btn btn--primary" id="qzGen"><i class="ri-sparkling-line"></i> Generate</button>
          </div>
          <div class="row" style="gap:8px;margin-bottom:6px">
            <label class="muted" style="font-size:13px">From library</label>
            <select id="qzResource" style="flex:1"></select>
          </div>
          <p class="muted" id="qzAiHint" style="font-size:12px;margin-bottom:8px"></p>
          <div id="qzArea"></div>
          <div id="qzHistory" style="margin-top:16px"></div>
        </div>

        <div class="card span-2">
          <h3>🎴 Flashcards</h3>
          <div class="row" style="gap:8px;margin-bottom:8px">
            <input id="fcDeck" placeholder="Deck name…" style="max-width:180px" />
            <input id="fcSubject" placeholder="Subject" style="max-width:150px" />
            <button class="btn btn--primary btn--sm" id="fcGen"><i class="ri-sparkling-line"></i> Make cards</button>
          </div>
          <div class="row" style="gap:8px;margin-bottom:8px">
            <label class="muted" style="font-size:13px">From library</label>
            <select id="fcResource" style="flex:1"></select>
          </div>
          <textarea id="fcNotes" placeholder="Paste notes — lines like 'Term: definition' become cards." style="min-height:90px"></textarea>
          <div class="row" style="margin:12px 0">
            <div class="seg" id="fcFilter"><button data-f="all" class="on">All</button><button data-f="due">To review</button><button data-f="mastered">Mastered</button></div>
          </div>
          <div class="grid" id="fcList"></div>
        </div>
      </section>`;

    // Populate the library resource pickers (shared by quiz + flashcards).
    function fillResourcePickers() {
      const items = db.Library.all();
      const opts = `<option value="">— none —</option>` +
        items.map((i) => `<option value="${i.id}">${escapeHtml(i.title)} (${escapeHtml(i.subject)})</option>`).join("");
      ["#qzResource", "#fcResource"].forEach((sel) => {
        const el = panel.querySelector(sel);
        const prev = el.value;
        el.innerHTML = opts;
        el.value = prev;
      });
      // Note whether AI is on (content-aware) or falling back to templates.
      const aiOn = window.SS.db.Settings ? (SS.Store.get("aiConfig", {}) || {}).enabled : false;
      panel.querySelector("#qzAiHint").textContent = aiOn
        ? "AI is on — questions are generated from the selected file/topic."
        : "Using offline templates. Turn on AI in Settings for content-aware questions.";
    }
    const resourceById = (id) => db.Library.all().find((i) => i.id === id) || null;
    db.Library.on(fillResourcePickers);
    fillResourcePickers();

    /* ---- Quiz ---- */
    panel.querySelector("#qzGen").addEventListener("click", async () => {
      const resource = resourceById(panel.querySelector("#qzResource").value);
      const title = panel.querySelector("#qzTitle").value.trim() || (resource && resource.title);
      if (!title) { UI.toast("Enter a topic or pick a resource", "error"); return; }
      const btn = panel.querySelector("#qzGen");
      btn.disabled = true; btn.innerHTML = "Generating…";
      try {
        const quiz = await AI.generateQuiz({
          title,
          subject: panel.querySelector("#qzSubject").value.trim() || (resource && resource.subject) || "General",
          description: resource ? resource.description : "",
          count: +panel.querySelector("#qzCount").value || 5,
          resource,
        });
        renderQuizForm(quiz);
      } catch (e) { UI.toast("Couldn't generate quiz", "error"); }
      btn.disabled = false; btn.innerHTML = `<i class="ri-sparkling-line"></i> Generate`;
    });

    function renderQuizForm(quiz) {
      const area = panel.querySelector("#qzArea");
      area.innerHTML = `
        <div class="card" style="background:var(--surface-2)">
          <div class="between"><strong>${escapeHtml(quiz.title)}</strong><span class="chip">${quiz.subject}</span></div>
          <form id="qzForm" style="margin-top:12px">
            ${quiz.questions.map((q, i) => `
              <div class="field" style="margin-bottom:14px">
                <label>${i + 1}. ${escapeHtml(q.q)}</label>
                ${quizInput(q, i)}
              </div>`).join("")}
            <button type="submit" class="btn btn--primary btn--sm">Submit answers</button>
          </form>
        </div>`;
      area.querySelector("#qzForm").addEventListener("submit", (e) => {
        e.preventDefault();
        let score = 0, gradable = 0;
        quiz.questions.forEach((q, i) => {
          if (q.type === "short") return; // not auto-graded
          gradable++;
          const val = area.querySelector(`[name="q${i}"]:checked`)?.value;
          if (q.type === "mcq" && +val === q.answer) score++;
          if (q.type === "truefalse" && val === String(q.answer)) score++;
        });
        db.Quizzes.add({ title: quiz.title, subject: quiz.subject, questions: quiz.questions,
          results: [{ score, gradable, at: Date.now() }] });
        UI.toast(`Scored ${score}/${gradable}`, "success");
        area.innerHTML = `<p class="muted">Saved — you scored ${score}/${gradable}. See history below.</p>`;
        renderQuizHistory();
      });
    }
    function quizInput(q, i) {
      if (q.type === "mcq") return q.options.map((o, k) =>
        `<label class="row" style="gap:8px;font-weight:400"><input type="radio" name="q${i}" value="${k}" style="width:auto"> ${escapeHtml(o)}</label>`).join("");
      if (q.type === "truefalse") return ["true", "false"].map((v) =>
        `<label class="row" style="gap:8px;font-weight:400"><input type="radio" name="q${i}" value="${v}" style="width:auto"> ${v[0].toUpperCase() + v.slice(1)}</label>`).join("");
      return `<input name="q${i}" placeholder="Your answer…" />`;
    }
    function renderQuizHistory() {
      const host = panel.querySelector("#qzHistory");
      const quizzes = db.Quizzes.all().slice().reverse();
      if (!quizzes.length) { host.innerHTML = ""; return; }
      host.innerHTML = `<h4 style="margin-bottom:8px">Past quizzes</h4>` + quizzes.map((qz) => {
        const r = qz.results[qz.results.length - 1] || {};
        return `<div class="item"><div class="item__main"><div class="item__title">${escapeHtml(qz.title)}</div>
          <div class="item__meta"><span class="chip">${escapeHtml(qz.subject)}</span> ${qz.questions.length} Qs · scored ${r.score ?? "—"}/${r.gradable ?? "—"}</div></div>
          <button class="icon-btn danger" data-del="${qz.id}">🗑</button></div>`;
      }).join("");
      host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => db.Quizzes.remove(b.dataset.del)));
    }

    /* ---- Flashcards ---- */
    let fcFilter = "all";
    panel.querySelector("#fcGen").addEventListener("click", async () => {
      const deck = panel.querySelector("#fcDeck").value.trim() || "Untitled deck";
      const notes = panel.querySelector("#fcNotes").value;
      const resource = resourceById(panel.querySelector("#fcResource").value);
      if (!notes.trim() && !resource) { UI.toast("Paste notes or pick a resource", "error"); return; }
      const btn = panel.querySelector("#fcGen");
      btn.disabled = true; btn.innerHTML = "Making…";
      try {
        const result = await AI.generateFlashcards({
          deck, notes, resource,
          subject: panel.querySelector("#fcSubject").value.trim() || (resource && resource.subject) || "Other",
          count: 12,
        });
        result.cards.forEach((c) => db.Flashcards.add({ deck: result.deck, subject: result.subject, front: c.front, back: c.back }));
        panel.querySelector("#fcNotes").value = "";
        UI.toast(`${result.cards.length} cards created`, "success");
      } catch (e) { UI.toast("Couldn't generate flashcards", "error"); }
      btn.disabled = false; btn.innerHTML = `<i class="ri-sparkling-line"></i> Make cards`;
    });

    panel.querySelector("#fcFilter").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]"); if (!b) return;
      fcFilter = b.dataset.f;
      panel.querySelectorAll("#fcFilter button").forEach((x) => x.classList.toggle("on", x === b));
      renderCards();
    });

    function renderCards() {
      const host = panel.querySelector("#fcList");
      let cards = db.Flashcards.all();
      if (fcFilter === "due") cards = cards.filter((c) => !c.mastered);
      if (fcFilter === "mastered") cards = cards.filter((c) => c.mastered);
      if (!cards.length) { host.innerHTML = `<p class="empty">No flashcards ${fcFilter === "all" ? "yet" : "in this view"}.</p>`; return; }
      host.innerHTML = "";
      cards.forEach((c) => {
        const wrap = document.createElement("div");
        wrap.innerHTML = `
          <div class="flashcard" tabindex="0">
            <div class="flashcard__inner">
              <div class="flashcard__face front">${escapeHtml(c.front)}</div>
              <div class="flashcard__face back">${escapeHtml(c.back)}</div>
            </div>
          </div>
          <div class="row" style="justify-content:space-between;margin-top:6px">
            <span class="chip">${escapeHtml(c.deck)}</span>
            <div class="row">
              <button class="icon-btn" data-act="master" title="Toggle mastered">${c.mastered ? "🌟" : "⭐"}</button>
              <button class="icon-btn danger" data-act="del">🗑</button>
            </div>
          </div>`;
        const fc = wrap.querySelector(".flashcard");
        fc.addEventListener("click", () => fc.classList.toggle("flip"));
        wrap.querySelector('[data-act="master"]').addEventListener("click", () => db.Flashcards.update(c.id, (x) => ({ mastered: !x.mastered })));
        wrap.querySelector('[data-act="del"]').addEventListener("click", () => db.Flashcards.remove(c.id));
        host.appendChild(wrap);
      });
    }

    db.Quizzes.on(renderQuizHistory);
    db.Flashcards.on(renderCards);
    renderQuizHistory();
    renderCards();
  }
})();
