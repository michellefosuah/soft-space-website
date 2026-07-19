/* =========================================================
   TODAYLY · JOURNAL
   A digital diary: write today's entry (auto-saved as you type), browse
   past entries, open any day to edit, and delete entries.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, UI } = window.SS;

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "journal", title: "Journal", subtitle: "A quiet place for your thoughts." });

    // `current` is the date being edited (defaults to today).
    let current = fmt.today();

    view.innerHTML = `
      <section class="grid grid--wide">
        <div class="card span-2">
          <div class="between">
            <h3 style="margin:0">📖 <span id="entryTitle">Today</span></h3>
            <div class="row">
              <input type="date" id="datePick" style="max-width:170px" value="${current}" max="${fmt.today()}" />
              <span class="chip" id="saveState">Saved</span>
            </div>
          </div>
          <textarea id="entryBox" style="min-height:280px;margin-top:12px" placeholder="How are you feeling today? What happened worth remembering?"></textarea>
          <div class="row" style="margin-top:10px">
            <span class="muted" id="wordCount">0 words</span>
          </div>
        </div>

        <div class="card">
          <h3>🗂 Past Entries</h3>
          <div class="list" id="history" style="margin-top:8px"></div>
        </div>
      </section>`;

    const box = view.querySelector("#entryBox");
    const saveState = view.querySelector("#saveState");
    const datePick = view.querySelector("#datePick");
    let saveTimer = null;

    function loadEntry(date) {
      current = date;
      datePick.value = date;
      view.querySelector("#entryTitle").textContent =
        date === fmt.today() ? "Today" : fmt.longDate(date);
      const entry = db.Journal.get(date);
      box.value = entry ? entry.text : "";
      updateWordCount();
      saveState.textContent = "Saved";
    }

    function updateWordCount() {
      const words = box.value.trim() ? box.value.trim().split(/\s+/).length : 0;
      view.querySelector("#wordCount").textContent = `${words} word${words === 1 ? "" : "s"}`;
    }

    // Debounced auto-save (draft persists ~500ms after you stop typing).
    box.addEventListener("input", () => {
      saveState.textContent = "Saving…";
      updateWordCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        db.Journal.save(current, box.value);
        saveState.textContent = "Saved";
      }, 500);
    });

    datePick.addEventListener("change", () => {
      // Flush any pending save before switching days.
      clearTimeout(saveTimer);
      db.Journal.save(current, box.value);
      loadEntry(datePick.value || fmt.today());
    });

    function renderHistory() {
      const host = view.querySelector("#history");
      const entries = db.Journal.entries();
      if (!entries.length) {
        host.innerHTML = `<p class="empty">No entries yet. Today's the perfect day to start.</p>`;
        return;
      }
      host.innerHTML = "";
      entries.forEach((e) => {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div class="item__main" style="cursor:pointer">
            <div class="item__title">${e.date === fmt.today() ? "Today" : fmt.shortDate(e.date)}</div>
            <div class="item__meta">${escapeHtml(e.text.slice(0, 60))}${e.text.length > 60 ? "…" : ""}</div>
          </div>
          <div class="item__actions"><button class="icon-btn danger" aria-label="Delete">🗑</button></div>`;
        row.querySelector(".item__main").addEventListener("click", () => loadEntry(e.date));
        row.querySelector(".icon-btn").addEventListener("click", async () => {
          if (await UI.confirm(`Delete the entry for ${fmt.shortDate(e.date)}?`, { danger: true })) {
            db.Journal.remove(e.date);
            if (current === e.date) loadEntry(fmt.today());
          }
        });
        host.appendChild(row);
      });
    }

    db.Journal.on(renderHistory);
    loadEntry(current);
    renderHistory();
  });
})();
