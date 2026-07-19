/* =========================================================
   SOFT SPACE · REMINDERS
   An in-app reminder scheduler. While any Soft Space tab is open it checks
   every minute for things that are due and surfaces them as a browser
   Notification (when granted) + an in-app toast.

   Reminders are derived live from existing data — planner tasks, exams,
   goal deadlines, timetable blocks, and a daily habit nudge — so there's no
   separate "reminders" list to maintain. Each reminder fires once (tracked
   in the per-account `remindersFired` store key), so you're never spammed.

   ⚠️ Being client-side, reminders only fire while the app is open in a tab.
   True background/push reminders would need a backend + Web Push.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, UI, Store } = window.SS;
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const EXAM_LEAD_DAYS = [7, 3, 1]; // notify this many days before an exam

  function daysUntil(dateStr) {
    return Math.round((new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }

  const Reminders = {
    _timer: null,

    init() {
      // One immediate pass, then poll every minute.
      this.check();
      clearInterval(this._timer);
      this._timer = setInterval(() => this.check(), 60000);
      // Re-check when the tab regains focus (covers laptops waking from sleep).
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.check(); });
    },

    _fired() { return Store.get("remindersFired", {}); },
    _markFired(key) {
      const f = this._fired();
      f[key] = Date.now();
      // Prune entries older than 30 days so the map can't grow forever.
      const cutoff = Date.now() - 30 * 86400000;
      Object.keys(f).forEach((k) => { if (f[k] < cutoff) delete f[k]; });
      Store.set("remindersFired", f);
    },

    // Build the list of currently-due reminders.
    _due() {
      const s = db.Settings.get();
      const r = s.reminders || {};
      const now = new Date();
      const today = fmt.today();
      const out = [];

      // Planner tasks due today or overdue.
      if (r.tasks) {
        db.Tasks.all().filter((t) => !t.done && t.due && t.due <= today).forEach((t) => {
          const overdue = t.due < today;
          out.push({ key: `task:${t.id}:${today}`, title: overdue ? "Overdue task" : "Task due today", body: t.title });
        });
      }

      // Exams at the configured lead days (and on the day).
      if (r.exams) {
        db.Exams.upcoming().forEach((e) => {
          const d = daysUntil(e.date);
          if (d === 0 || EXAM_LEAD_DAYS.includes(d)) {
            out.push({
              key: `exam:${e.id}:${d}`,
              title: d === 0 ? "Exam today" : `Exam in ${d} day${d === 1 ? "" : "s"}`,
              body: `${e.subject} · ${fmt.shortDate(e.date)}`,
            });
          }
        });
      }

      // Goal deadlines within 3 days.
      if (r.goals) {
        db.Goals.all().filter((g) => !g.done && g.deadline).forEach((g) => {
          const d = daysUntil(g.deadline);
          if (d >= 0 && d <= 3) {
            out.push({ key: `goal:${g.id}:${today}`, title: "Goal deadline near", body: `${g.title} · ${d === 0 ? "today" : d + "d left"}` });
          }
        });
      }

      // Timetable blocks starting now (within the first 2 minutes of the block).
      if (r.timetable) {
        const day = DOW[now.getDay()];
        const nowMin = now.getHours() * 60 + now.getMinutes();
        db.Timetable.all().filter((b) => b.day === day).forEach((b) => {
          const [h, m] = (b.start || "").split(":").map(Number);
          const startMin = h * 60 + m;
          if (nowMin >= startMin && nowMin <= startMin + 2) {
            out.push({ key: `tt:${b.id}:${today}`, title: "Class starting", body: `${b.subject}${b.location ? " · " + b.location : ""}` });
          }
        });
      }

      // Daily habit nudge once the daily time has passed and not all habits are done.
      if (r.habits && r.dailyTime) {
        const [h, m] = r.dailyTime.split(":").map(Number);
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (nowMin >= h * 60 + m && db.Habits.all().length && !db.Habits.allDoneOn(today)) {
          out.push({ key: `habits:${today}`, title: "Habit check-in", body: "You still have habits to complete today 🌸" });
        }
      }

      return out;
    },

    check() {
      if (!db.Settings.get().notifications) return; // master switch off
      const fired = this._fired();
      this._due().filter((x) => !fired[x.key]).forEach((x) => {
        this._notify(x.title, x.body);
        this._markFired(x.key);
      });
    },

    _notify(title, body) {
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification(title, { body, icon: "assets/icons/icon-192.png" }); } catch (_) {}
      }
      UI.toast(`${title} — ${body}`, "info");
    },
  };

  window.SS.Reminders = Reminders;
})();
