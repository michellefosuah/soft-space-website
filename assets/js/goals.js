/* =========================================================
   TODAYLY · GOALS
   Create goals with a target, track progress toward it, set a deadline,
   and mark complete. Progress is editable with +/- steppers.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, UI } = window.SS;

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "goals", title: "Goals", subtitle: "Where you're headed, one step at a time." });

    view.innerHTML = `
      <section class="grid grid--wide">
        <div class="card span-2">
          <h3>New goal</h3>
          <div class="form-row" style="margin-bottom:12px">
            <div class="field"><label>Goal</label><input id="gTitle" placeholder="e.g. Read 12 books" /></div>
            <div class="field"><label>Target</label><input id="gTarget" type="number" min="1" value="100" /></div>
          </div>
          <div class="form-row" style="margin-bottom:12px">
            <div class="field"><label>Deadline (optional)</label><input id="gDeadline" type="date" /></div>
            <div class="field" style="justify-content:flex-end"><button class="btn btn--primary btn--block" id="addBtn"><i class="ri-add-line"></i> Add goal</button></div>
          </div>
        </div>
      </section>

      <section class="grid grid--wide" id="goalGrid" style="margin-top:18px"></section>`;

    function addGoal() {
      const title = view.querySelector("#gTitle").value.trim();
      if (!title) return;
      const target = Math.max(1, +view.querySelector("#gTarget").value || 100);
      db.Goals.add({ title, target, progress: 0, deadline: view.querySelector("#gDeadline").value || "" });
      view.querySelector("#gTitle").value = "";
      view.querySelector("#gDeadline").value = "";
      UI.toast("Goal added", "success");
    }

    function render() {
      const grid = view.querySelector("#goalGrid");
      const goals = db.Goals.all();
      if (!goals.length) {
        grid.innerHTML = `<div class="card"><p class="empty">No goals yet. Dream one up above 🌷</p></div>`;
        return;
      }
      grid.innerHTML = "";
      goals.forEach((g) => {
        const pct = Math.min(100, Math.round((g.progress / g.target) * 100));
        const complete = g.done || pct >= 100;
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="between">
            <h3 style="margin:0">${complete ? "✅ " : "🎯 "}${escapeHtml(g.title)}</h3>
            <button class="icon-btn danger" data-act="del" aria-label="Delete">🗑</button>
          </div>
          <p class="muted" style="font-size:13px;margin:2px 0 12px">
            ${g.progress} / ${g.target} ${g.deadline ? `· ⏳ ${fmt.relativeDays(g.deadline)}` : ""}
          </p>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="between" style="margin-top:14px">
            <div class="row">
              <button class="btn btn--ghost btn--sm" data-act="minus">−</button>
              <button class="btn btn--ghost btn--sm" data-act="plus">+</button>
              <button class="btn btn--ghost btn--sm" data-act="set">Set…</button>
            </div>
            <span class="chip">${pct}%</span>
          </div>`;

        const step = Math.max(1, Math.round(g.target / 20));
        card.querySelector('[data-act="plus"]').addEventListener("click", () => bump(g, step));
        card.querySelector('[data-act="minus"]').addEventListener("click", () => bump(g, -step));
        card.querySelector('[data-act="set"]').addEventListener("click", () => setProgress(g));
        card.querySelector('[data-act="del"]').addEventListener("click", async () => {
          if (await UI.confirm(`Delete "${g.title}"?`, { danger: true })) db.Goals.remove(g.id);
        });
        grid.appendChild(card);
      });
    }

    function bump(g, delta) {
      const progress = Math.max(0, Math.min(g.target, g.progress + delta));
      db.Goals.update(g.id, { progress, done: progress >= g.target });
      if (progress >= g.target) UI.toast("Goal reached! 🎉", "success");
    }

    function setProgress(g) {
      const body = `<div class="field"><label>Progress (0–${g.target})</label><input id="val" type="number" min="0" max="${g.target}" value="${g.progress}" /></div>`;
      const m = UI.modal("Update progress", body, {
        footer: `<button class="btn btn--ghost" data-act="cancel">Cancel</button><button class="btn btn--primary" data-act="save">Save</button>`,
      });
      m.querySelector('[data-act="cancel"]').addEventListener("click", () => m.close());
      m.querySelector('[data-act="save"]').addEventListener("click", () => {
        const val = Math.max(0, Math.min(g.target, +m.querySelector("#val").value || 0));
        db.Goals.update(g.id, { progress: val, done: val >= g.target });
        m.close();
      });
    }

    view.querySelector("#addBtn").addEventListener("click", addGoal);
    db.Goals.on(render);
    render();
  });
})();
