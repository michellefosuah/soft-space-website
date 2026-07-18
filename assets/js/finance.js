/* =========================================================
   SOFT SPACE · FINANCE
   Track income + expenses, budget vs. spend, category breakdown (donut),
   a savings goal, and a spending summary with insights.
   ========================================================= */

(function () {
  "use strict";
  const { db, fmt, escapeHtml, UI, Charts } = window.SS;

  const CATEGORIES = ["Food", "Transport", "Books", "Rent", "Fun", "Health", "Savings", "Other"];
  const PALETTE = ["#D8A7B1", "#EADCF8", "#BBEBA6", "#F8DDE8", "#D5B574", "#A7C7E7", "#F4A79D", "#B5EAD7"];

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "finance", title: "Finance", subtitle: "Gentle money, mindful spending." });

    view.innerHTML = `
      <section class="grid grid--wide">
        <div class="card">
          <div class="stat__num" id="balance" style="font-size:34px">—</div>
          <div class="stat__label">Balance this month</div>
          <div class="row" style="margin-top:14px;gap:18px">
            <div><div class="muted" style="font-size:12px">Income</div><strong id="income" style="color:var(--ok)">—</strong></div>
            <div><div class="muted" style="font-size:12px">Expenses</div><strong id="expense" style="color:var(--danger)">—</strong></div>
          </div>
        </div>

        <div class="card">
          <h3>💰 Budget & Savings</h3>
          <div class="form-row">
            <div class="field"><label>Monthly budget</label><input id="budget" type="number" min="0" placeholder="0" /></div>
            <div class="field"><label>Savings goal</label><input id="savingGoal" type="number" min="0" placeholder="0" /></div>
          </div>
          <p class="muted" id="budgetState" style="font-size:13px;margin-top:8px"></p>
          <div class="bar" style="margin-top:6px"><div class="fill" id="budgetBar"></div></div>
        </div>

        <div class="card">
          <h3>➕ Add transaction</h3>
          <div class="seg" id="typeSeg" style="margin-bottom:10px">
            <button data-t="expense" class="on">Expense</button>
            <button data-t="income">Income</button>
          </div>
          <div class="stack">
            <input id="amount" type="number" min="0" step="0.01" placeholder="Amount" />
            <div class="form-row">
              <select id="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
              <input id="date" type="date" value="${fmt.today()}" />
            </div>
            <input id="note" placeholder="Note (optional)" />
            <button class="btn btn--primary btn--block" id="addBtn"><i class="ri-add-line"></i> Add</button>
          </div>
        </div>

        <div class="card">
          <h3>🍩 Spending by category</h3>
          <div class="row" id="donutWrap" style="gap:18px;align-items:center;flex-wrap:wrap"></div>
        </div>

        <div class="card span-2">
          <div class="between"><h3 style="margin:0">🧾 Transactions</h3><span class="muted" id="insight" style="font-size:13px"></span></div>
          <div class="list" id="txList" style="margin-top:12px;max-height:360px;overflow:auto"></div>
        </div>
      </section>`;

    let txType = "expense";

    // --- add transaction ---
    view.querySelector("#typeSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-t]");
      if (!b) return;
      txType = b.dataset.t;
      view.querySelectorAll("#typeSeg button").forEach((x) => x.classList.toggle("on", x === b));
    });

    view.querySelector("#addBtn").addEventListener("click", () => {
      const amount = +view.querySelector("#amount").value;
      if (!amount || amount <= 0) { UI.toast("Enter an amount", "error"); return; }
      db.Finance.add({
        type: txType,
        amount,
        category: txType === "income" ? "Income" : view.querySelector("#category").value,
        note: view.querySelector("#note").value.trim(),
        date: view.querySelector("#date").value || fmt.today(),
      });
      view.querySelector("#amount").value = "";
      view.querySelector("#note").value = "";
      UI.toast("Added", "success");
    });

    // --- budget inputs (debounced save) ---
    let bTimer;
    function saveBudget() {
      clearTimeout(bTimer);
      bTimer = setTimeout(() => db.Budget.set({
        monthly: +view.querySelector("#budget").value || 0,
        savingGoal: +view.querySelector("#savingGoal").value || 0,
      }), 400);
    }
    view.querySelector("#budget").addEventListener("input", saveBudget);
    view.querySelector("#savingGoal").addEventListener("input", saveBudget);

    function render() {
      const monthTx = db.Finance.inMonth();
      const { income, expense, balance } = db.Finance.totals(monthTx);
      const budget = db.Budget.get();

      view.querySelector("#balance").textContent = fmt.money(balance);
      view.querySelector("#income").textContent = fmt.money(income);
      view.querySelector("#expense").textContent = fmt.money(expense);

      // Only fill budget fields if not focused, so typing isn't clobbered.
      const bInput = view.querySelector("#budget"), sInput = view.querySelector("#savingGoal");
      if (document.activeElement !== bInput) bInput.value = budget.monthly || "";
      if (document.activeElement !== sInput) sInput.value = budget.savingGoal || "";

      // budget usage
      const usedPct = budget.monthly ? Math.min(100, Math.round((expense / budget.monthly) * 100)) : 0;
      view.querySelector("#budgetBar").style.width = usedPct + "%";
      view.querySelector("#budgetBar").style.background = usedPct >= 100
        ? "var(--danger)" : usedPct >= 80 ? "linear-gradient(90deg,var(--gold),var(--danger))" : "";
      view.querySelector("#budgetState").textContent = budget.monthly
        ? `${fmt.money(expense)} of ${fmt.money(budget.monthly)} spent (${usedPct}%)`
        : "Set a monthly budget to track spending.";

      // category donut
      const byCat = db.Finance.byCategory(monthTx);
      const cats = Object.keys(byCat);
      const donutWrap = view.querySelector("#donutWrap");
      if (!cats.length) {
        donutWrap.innerHTML = `<p class="empty">No expenses yet this month.</p>`;
      } else {
        const data = cats.map((c, i) => ({ label: c, value: byCat[c], color: PALETTE[i % PALETTE.length] }));
        donutWrap.innerHTML = `
          ${Charts.donut(data, { center: fmt.money(expense) })}
          <div class="legend">${data.map((d) =>
            `<div class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${escapeHtml(d.label)} · ${fmt.money(d.value)}</div>`).join("")}</div>`;
      }

      // transactions list (newest first)
      const list = view.querySelector("#txList");
      const all = db.Finance.all().slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
      if (!all.length) {
        list.innerHTML = `<p class="empty">No transactions yet.</p>`;
      } else {
        list.innerHTML = "";
        all.forEach((t) => {
          const row = document.createElement("div");
          row.className = "item";
          const sign = t.type === "income" ? "+" : "−";
          const color = t.type === "income" ? "var(--ok)" : "var(--danger)";
          row.innerHTML = `
            <div class="item__main">
              <div class="item__title">${escapeHtml(t.note || t.category)}</div>
              <div class="item__meta"><span class="chip">${escapeHtml(t.category)}</span> ${fmt.shortDate(t.date)}</div>
            </div>
            <strong style="color:${color}">${sign}${fmt.money(t.amount)}</strong>
            <button class="icon-btn danger" aria-label="Delete">🗑</button>`;
          row.querySelector(".icon-btn").addEventListener("click", () => db.Finance.remove(t.id));
          list.appendChild(row);
        });
      }

      // insight
      const topCat = cats.sort((a, b) => byCat[b] - byCat[a])[0];
      view.querySelector("#insight").textContent = topCat
        ? `Top category: ${topCat} (${fmt.money(byCat[topCat])})` : "";
    }

    db.Finance.on(render);
    db.Budget.on(render);
    render();
  });
})();
