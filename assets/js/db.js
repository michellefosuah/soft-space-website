/* =========================================================
   TODAYLY · DATA MODEL
   Thin repositories over Store. Every feature reads/writes here so the
   dashboard (and any other page) can pull consistent, live data.
   Each collection repo exposes: all / get / add / update / remove.
   ========================================================= */

(function () {
  "use strict";
  const { Store, uid, fmt } = window.SS;

  // Factory for a simple id-keyed collection stored under one key.
  function collection(key, defaults = () => ({})) {
    return {
      key,
      all() {
        return Store.get(key, []);
      },
      get(id) {
        return this.all().find((x) => x.id === id) || null;
      },
      add(data) {
        const item = Object.assign({ id: uid(), createdAt: Date.now() }, defaults(), data);
        const list = this.all();
        list.push(item);
        Store.set(key, list);
        return item;
      },
      update(id, patch) {
        const list = this.all();
        const i = list.findIndex((x) => x.id === id);
        if (i === -1) return null;
        list[i] = Object.assign({}, list[i], typeof patch === "function" ? patch(list[i]) : patch);
        Store.set(key, list);
        return list[i];
      },
      remove(id) {
        Store.set(key, this.all().filter((x) => x.id !== id));
      },
      replace(list) {
        Store.set(key, list);
      },
      on(fn) {
        return Store.on(key, fn);
      },
    };
  }

  /* ---------- Planner tasks ---------- */
  const Tasks = collection("tasks", () => ({
    title: "", notes: "", priority: "B", due: "", done: false, completedAt: null,
  }));

  /* ---------- Journal (one entry per day, keyed by date) ---------- */
  const Journal = {
    key: "journal",
    all() { return Store.get("journal", {}); }, // { "YYYY-MM-DD": {text, updatedAt} }
    get(date) { return this.all()[date] || null; },
    today() { return this.get(fmt.today()); },
    save(date, text) {
      const map = this.all();
      if (!text || !text.trim()) {
        delete map[date];
      } else {
        map[date] = { text, updatedAt: Date.now() };
      }
      Store.set("journal", map);
    },
    // Newest-first list of {date, text, updatedAt}
    entries() {
      const map = this.all();
      return Object.keys(map).sort().reverse().map((date) => ({ date, ...map[date] }));
    },
    remove(date) {
      const map = this.all();
      delete map[date];
      Store.set("journal", map);
    },
    on(fn) { return Store.on("journal", fn); },
  };

  /* ---------- Habits ---------- */
  // Each habit: {id, name, emoji, log:{ "YYYY-MM-DD": true }}
  const Habits = Object.assign(collection("habits", () => ({ name: "", emoji: "🌸", log: {} })), {
    toggle(id, date) {
      return this.update(id, (h) => {
        const log = Object.assign({}, h.log);
        if (log[date]) delete log[date];
        else log[date] = true;
        return { log };
      });
    },
    // True when every habit is checked for a given date (and at least one exists).
    allDoneOn(date) {
      const list = this.all();
      return list.length > 0 && list.every((h) => h.log && h.log[date]);
    },
    // Consecutive days (ending today) where all habits were completed.
    streak() {
      const list = this.all();
      if (!list.length) return 0;
      let streak = 0;
      const d = new Date();
      for (;;) {
        const key = fmt.dateKey(d);
        if (list.every((h) => h.log && h.log[key])) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      return streak;
    },
    // Completion % over the last `days` days across all habits.
    completionRate(days = 7) {
      const list = this.all();
      if (!list.length) return 0;
      let done = 0, total = 0;
      const d = new Date();
      for (let i = 0; i < days; i++) {
        const key = fmt.dateKey(d);
        list.forEach((h) => { total++; if (h.log && h.log[key]) done++; });
        d.setDate(d.getDate() - 1);
      }
      return total ? Math.round((done / total) * 100) : 0;
    },
  });

  /* ---------- Goals ---------- */
  const Goals = collection("goals", () => ({
    title: "", target: 100, progress: 0, deadline: "", done: false,
  }));

  /* ---------- Finance ---------- */
  // transactions: {id, type:'income'|'expense', amount, category, note, date}
  const Finance = Object.assign(collection("finance", () => ({
    type: "expense", amount: 0, category: "Other", note: "", date: fmt.today(),
  })), {
    inMonth(monthStr) {
      // monthStr = "YYYY-MM"; default current month
      const m = monthStr || fmt.today().slice(0, 7);
      return this.all().filter((t) => (t.date || "").startsWith(m));
    },
    totals(list) {
      const income = list.filter((t) => t.type === "income").reduce((s, t) => s + (+t.amount || 0), 0);
      const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + (+t.amount || 0), 0);
      return { income, expense, balance: income - expense };
    },
    byCategory(list) {
      const map = {};
      list.filter((t) => t.type === "expense").forEach((t) => {
        map[t.category] = (map[t.category] || 0) + (+t.amount || 0);
      });
      return map;
    },
  });

  // Budget settings live separately (single object).
  const Budget = {
    get() { return Store.get("budget", { monthly: 0, savingGoal: 0 }); },
    set(v) { Store.set("budget", v); },
    on(fn) { return Store.on("budget", fn); },
  };

  /* ---------- Study Hub collections ---------- */
  const Subjects = collection("subjects", () => ({ name: "", color: "#D8A7B1", difficulty: 3 }));

  // Study sessions completed via Pomodoro: {id, subject, minutes, date, ts}
  const Sessions = Object.assign(collection("sessions", () => ({
    subject: "General", minutes: 25, date: fmt.today(),
  })), {
    onDate(date) { return this.all().filter((s) => s.date === date); },
    totalMinutes(list) { return (list || this.all()).reduce((s, x) => s + (+x.minutes || 0), 0); },
    // minutes studied per day for the last `days` days -> [{label,value,date}]
    perDay(days = 7) {
      const out = [];
      const d = new Date();
      d.setDate(d.getDate() - (days - 1));
      for (let i = 0; i < days; i++) {
        const key = fmt.dateKey(d);
        const mins = this.onDate(key).reduce((s, x) => s + (+x.minutes || 0), 0);
        out.push({ date: key, value: mins, label: new Date(d).toLocaleDateString("en-US", { weekday: "short" })[0] });
        d.setDate(d.getDate() + 1);
      }
      return out;
    },
  });

  // Study tasks (checklist inside Study Hub): {id, text, priority, subject, done}
  const StudyTasks = collection("studyTasks", () => ({ text: "", priority: "B", subject: "General", done: false }));

  // Library metadata (the blob lives in FileDB keyed by fileId).
  const Library = collection("library", () => ({
    title: "", subject: "Other", description: "", fileId: null,
    fileName: "", fileType: "", size: 0, date: fmt.today(),
  }));

  // Timetable blocks: {id, day, subject, start, end, location}
  const Timetable = collection("timetable", () => ({
    day: "Mon", subject: "", start: "08:00", end: "09:00", location: "",
  }));

  // Exams: {id, subject, date, notes}
  const Exams = Object.assign(collection("exams", () => ({ subject: "", date: "", notes: "" })), {
    upcoming() {
      const today = fmt.today();
      return this.all().filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  // AI-generated study plan (single current plan object).
  const StudyPlan = {
    get() { return Store.get("studyPlan", null); },
    set(v) { Store.set("studyPlan", v); },
    clear() { Store.remove("studyPlan"); },
    on(fn) { return Store.on("studyPlan", fn); },
  };

  const Quizzes = collection("quizzes", () => ({ title: "", questions: [], results: [] }));
  const Flashcards = collection("flashcards", () => ({ deck: "", front: "", back: "", mastered: false, subject: "Other" }));

  /* ---------- Settings ---------- */
  const DEFAULT_SETTINGS = {
    name: "Michelle",
    avatar: "🌸",
    theme: "system",        // light | dark | system
    accent: "#D8A7B1",
    background: "aurora",   // id from Layout.BACKGROUNDS (the animated hero gradient)
    currency: "₵",
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    notifications: true,
    location: { name: "Kumasi", lat: 6.6885, lon: -1.6244 },
    // In-app reminders (checked while a Todayly tab is open).
    reminders: {
      tasks: true,        // planner tasks due today / overdue
      exams: true,        // exams at 7/3/1 days out and on the day
      goals: true,        // goal deadlines within 3 days
      timetable: true,    // class blocks as they start
      habits: true,       // daily nudge if habits aren't all done
      dailyTime: "18:00", // when the daily habit nudge may fire
    },
  };
  const Settings = {
    get() { return Object.assign({}, DEFAULT_SETTINGS, Store.get("settings", {})); },
    set(patch) { Store.set("settings", Object.assign(this.get(), patch)); },
    on(fn) { return Store.on("settings", fn); },
  };
  // convenience accessor used by fmt.money
  window.SS.settings = () => Settings.get();

  /* ---------- Aggregate: Today's progress ---------- */
  function todayProgress() {
    const today = fmt.today();
    const tasks = Tasks.all();
    const doneTasks = tasks.filter((t) => t.done).length;
    const sessions = Sessions.onDate(today).length;
    const habitsTotal = Habits.all().length;
    const habitsDone = Habits.all().filter((h) => h.log && h.log[today]).length;

    // Weighted composite: tasks 40%, habits 40%, study 20% (cap study at 4 sessions).
    const taskPct = tasks.length ? doneTasks / tasks.length : 0;
    const habitPct = habitsTotal ? habitsDone / habitsTotal : 0;
    const studyPct = Math.min(sessions / 4, 1);
    const overall = Math.round((taskPct * 0.4 + habitPct * 0.4 + studyPct * 0.2) * 100);

    return {
      overall,
      tasks: { done: doneTasks, total: tasks.length },
      habits: { done: habitsDone, total: habitsTotal },
      sessions,
      studyMinutes: Sessions.totalMinutes(Sessions.onDate(today)),
    };
  }

  window.SS.db = {
    Tasks, Journal, Habits, Goals, Finance, Budget,
    Subjects, Sessions, StudyTasks, Library, Timetable, Exams, StudyPlan,
    Quizzes, Flashcards, Settings, todayProgress,
  };
})();
