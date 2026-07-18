/* =========================================================
   SOFT SPACE · PLANNER
   Full task CRUD: create / edit / delete, priority, due date, complete.
   Tasks are shared with the dashboard preview automatically (same store).
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, UI } = window.SS;
  const P_ORDER = { A: 1, B: 2, C: 3 };

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "planner", title: "Planner", subtitle: "Plan your day, one beautiful thing at a time." });

    view.innerHTML = `
      <section class="grid grid--wide">
        <div class="card span-2">
          <h3>Add a task</h3>
          <div class="add-row">
            <input id="tTitle" placeholder="What needs doing?" />
            <select id="tPriority" style="max-width:130px">
              <option value="A">A · High</option>
              <option value="B" selected>B · Medium</option>
              <option value="C">C · Low</option>
            </select>
            <input id="tDue" type="date" style="max-width:170px" />
            <button class="btn btn--primary" id="addBtn"><i class="ri-add-line"></i> Add</button>
          </div>

          <div class="between" style="margin:6px 0 12px">
            <div class="seg" id="filter">
              <button data-f="all" class="on">All</button>
              <button data-f="active">Active</button>
              <button data-f="done">Done</button>
            </div>
            <span class="muted" id="counts"></span>
          </div>

          <ul class="list" id="taskList"></ul>
        </div>
      </section>`;

    let filter = "all";

    function addTask() {
      const title = view.querySelector("#tTitle").value.trim();
      if (!title) return;
      db.Tasks.add({
        title,
        priority: view.querySelector("#tPriority").value,
        due: view.querySelector("#tDue").value || "",
      });
      view.querySelector("#tTitle").value = "";
      view.querySelector("#tDue").value = "";
      UI.toast("Task added", "success");
    }

    function render() {
      const ul = view.querySelector("#taskList");
      let tasks = db.Tasks.all().slice();
      const all = tasks.length;
      const done = tasks.filter((t) => t.done).length;
      view.querySelector("#counts").textContent = `${done}/${all} done`;

      if (filter === "active") tasks = tasks.filter((t) => !t.done);
      if (filter === "done") tasks = tasks.filter((t) => t.done);

      // Sort: incomplete first, then by priority, then by due date.
      tasks.sort((a, b) =>
        (a.done - b.done) ||
        (P_ORDER[a.priority] - P_ORDER[b.priority]) ||
        (a.due || "9999").localeCompare(b.due || "9999"));

      if (!tasks.length) {
        ul.innerHTML = `<li class="empty">No tasks here yet.</li>`;
        return;
      }

      ul.innerHTML = "";
      tasks.forEach((t) => {
        const li = document.createElement("li");
        li.className = "item" + (t.done ? " done" : "");
        const overdue = t.due && !t.done && t.due < fmt.today();
        li.innerHTML = `
          <button class="check ${t.done ? "on" : ""}" aria-label="Toggle complete">${t.done ? "✓" : ""}</button>
          <span class="badge badge--${t.priority}">${t.priority}</span>
          <div class="item__main">
            <div class="item__title">${escapeHtml(t.title)}</div>
            <div class="item__meta">
              ${t.due ? `<span style="${overdue ? "color:var(--danger)" : ""}">📅 ${fmt.shortDate(t.due)} · ${fmt.relativeDays(t.due)}</span>` : ""}
              ${t.notes ? `<span>📝 note</span>` : ""}
            </div>
          </div>
          <div class="item__actions">
            <button class="icon-btn" data-act="edit" aria-label="Edit">✏️</button>
            <button class="icon-btn danger" data-act="del" aria-label="Delete">🗑</button>
          </div>`;
        li.querySelector(".check").addEventListener("click", () =>
          db.Tasks.update(t.id, (x) => ({ done: !x.done, completedAt: !x.done ? Date.now() : null })));
        li.querySelector('[data-act="edit"]').addEventListener("click", () => editTask(t));
        li.querySelector('[data-act="del"]').addEventListener("click", async () => {
          if (await UI.confirm("Delete this task?", { danger: true })) db.Tasks.remove(t.id);
        });
        ul.appendChild(li);
      });
    }

    function editTask(t) {
      const body = `
        <div class="field"><label>Title</label><input id="eTitle" value="${escapeHtml(t.title)}" /></div>
        <div class="form-row">
          <div class="field"><label>Priority</label>
            <select id="ePriority">
              <option value="A" ${t.priority === "A" ? "selected" : ""}>A · High</option>
              <option value="B" ${t.priority === "B" ? "selected" : ""}>B · Medium</option>
              <option value="C" ${t.priority === "C" ? "selected" : ""}>C · Low</option>
            </select>
          </div>
          <div class="field"><label>Due date</label><input id="eDue" type="date" value="${t.due || ""}" /></div>
        </div>
        <div class="field"><label>Notes</label><textarea id="eNotes" placeholder="Optional details…">${escapeHtml(t.notes || "")}</textarea></div>`;
      const m = UI.modal("Edit task", body, {
        footer: `<button class="btn btn--ghost" data-act="cancel">Cancel</button><button class="btn btn--primary" data-act="save">Save</button>`,
      });
      m.querySelector('[data-act="cancel"]').addEventListener("click", () => m.close());
      m.querySelector('[data-act="save"]').addEventListener("click", () => {
        const title = m.querySelector("#eTitle").value.trim();
        if (!title) { UI.toast("Title can't be empty", "error"); return; }
        db.Tasks.update(t.id, {
          title,
          priority: m.querySelector("#ePriority").value,
          due: m.querySelector("#eDue").value,
          notes: m.querySelector("#eNotes").value.trim(),
        });
        m.close();
        UI.toast("Saved", "success");
      });
    }

    view.querySelector("#addBtn").addEventListener("click", addTask);
    view.querySelector("#tTitle").addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });
    view.querySelector("#filter").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-f]");
      if (!btn) return;
      filter = btn.dataset.f;
      view.querySelectorAll("#filter button").forEach((b) => b.classList.toggle("on", b === btn));
      render();
    });

    db.Tasks.on(render);
    render();
  });
})();
