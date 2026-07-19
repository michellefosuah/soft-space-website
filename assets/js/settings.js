/* =========================================================
   SOFT SPACE · SETTINGS
   Theme (light/dark/system), accent colour, profile, currency, timer
   preferences, notifications, location for weather, and data reset.
   Changes apply instantly (Settings.on drives Layout re-theme).
   ========================================================= */

(function () {
  "use strict";
  const { db, escapeHtml, UI, Store } = window.SS;
  const ACCENTS = ["#D8A7B1", "#C9A7E8", "#A7C7E7", "#8FD3B6", "#E8B87A", "#E79DB0", "#9AA7E8", "#7BC5B0"];
  const AVATARS = ["🌸", "🌷", "🌻", "🦋", "🌙", "⭐", "🍀", "🐣"];

  document.addEventListener("DOMContentLoaded", () => {
    const view = SS.Layout.mount({ page: "settings", title: "Settings", subtitle: "Make Soft Space yours." });
    const s = db.Settings.get();

    view.innerHTML = `
      <section class="grid grid--wide">
        <div class="card">
          <h3>🎨 Appearance</h3>
          <div class="field" style="margin-bottom:14px">
            <label>Theme</label>
            <div class="seg" id="theme">
              <button data-v="light">Light</button>
              <button data-v="dark">Dark</button>
              <button data-v="system">System</button>
            </div>
          </div>
          <div class="field" style="margin-bottom:14px">
            <label>Accent colour</label>
            <div class="swatches" id="accents">
              ${ACCENTS.map((c) => `<span class="swatch" data-c="${c}" style="background:${c}"></span>`).join("")}
            </div>
          </div>
          <div class="field">
            <label>Background</label>
            <div class="swatches" id="backgrounds">
              ${SS.Layout.BACKGROUNDS.map((b) => `<span class="swatch swatch--bg" data-bg="${b.id}" title="${b.name}" style="background-image:${b.light}"></span>`).join("")}
            </div>
          </div>
        </div>

        <div class="card">
          <h3>🙂 Profile</h3>
          <div class="field" style="margin-bottom:12px"><label>Name</label><input id="name" value="${escapeHtml(s.name)}" /></div>
          <div class="field"><label>Avatar</label>
            <div class="swatches" id="avatars">
              ${AVATARS.map((a) => `<span class="swatch" data-a="${a}" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--surface-2)">${a}</span>`).join("")}
            </div>
          </div>
        </div>

        <div class="card">
          <h3>⏱ Timer preferences</h3>
          <div class="form-row">
            <div class="field"><label>Focus (min)</label><input id="focusMinutes" type="number" min="5" max="90" value="${s.focusMinutes}" /></div>
            <div class="field"><label>Break (min)</label><input id="breakMinutes" type="number" min="1" max="30" value="${s.breakMinutes}" /></div>
          </div>
          <div class="field" style="margin-top:12px"><label>Long break (min)</label><input id="longBreakMinutes" type="number" min="5" max="45" value="${s.longBreakMinutes}" /></div>
        </div>

        <div class="card">
          <h3>💵 Preferences</h3>
          <div class="field" style="margin-bottom:12px"><label>Currency symbol</label><input id="currency" value="${escapeHtml(s.currency)}" style="max-width:120px" /></div>
          <div class="between">
            <div><strong>Notifications</strong><div class="muted" style="font-size:12px">Reminders & session alerts</div></div>
            <label class="seg"><button id="notifBtn">${s.notifications ? "On" : "Off"}</button></label>
          </div>
        </div>

        <div class="card">
          <h3>🔔 Reminders</h3>
          <p class="muted" style="font-size:12px;margin-bottom:12px">Fire while Soft Space is open. Needs notifications on above.</p>
          <div class="stack" id="reminderToggles">
            ${[["tasks", "Task due dates"], ["exams", "Exam countdowns"], ["goals", "Goal deadlines"], ["timetable", "Class times"], ["habits", "Daily habit nudge"]]
              .map(([k, label]) => `
              <label class="between" style="font-weight:400"><span>${label}</span>
                <input type="checkbox" data-r="${k}" style="width:auto" ${s.reminders[k] ? "checked" : ""} /></label>`).join("")}
          </div>
          <div class="field" style="margin-top:12px">
            <label>Daily habit nudge time</label>
            <input id="dailyTime" type="time" value="${s.reminders.dailyTime}" style="max-width:150px" />
          </div>
        </div>

        <div class="card span-2">
          <h3>🤖 AI (bring your own key)</h3>
          <p class="muted" style="font-size:12px;margin-bottom:12px">Powers <strong>content-aware</strong> quizzes & flashcards generated from your uploaded study files. Off by default — the app works fully offline with built-in templates.</p>
          <div class="between" style="margin-bottom:12px">
            <div><strong>Enable AI features</strong><div class="muted" style="font-size:12px">Calls Claude from your browser</div></div>
            <label class="seg"><button id="aiToggle">Off</button></label>
          </div>
          <div class="field" style="margin-bottom:12px"><label>Anthropic API key</label><input id="aiKey" type="password" placeholder="sk-ant-…" autocomplete="off" /></div>
          <div class="form-row">
            <div class="field"><label>Model</label><input id="aiModel" placeholder="claude-opus-4-8" /></div>
            <div class="field"><label>Proxy endpoint (optional)</label><input id="aiEndpoint" placeholder="https://your-proxy…" /></div>
          </div>
          <p class="muted" style="font-size:11px;margin-top:12px;line-height:1.6">⚠️ Your key is stored in this browser and sent directly to Anthropic. Anyone who can use this device/browser can read it — don't enable this on a shared computer. To avoid exposing a raw key, point “Proxy endpoint” at your own server that injects the key instead.</p>
        </div>

        <div class="card">
          <h3>🌤 Weather location</h3>
          <div class="field" style="margin-bottom:12px"><label>City name</label><input id="locName" value="${escapeHtml(s.location.name)}" /></div>
          <div class="form-row">
            <div class="field"><label>Latitude</label><input id="lat" type="number" step="0.0001" value="${s.location.lat}" /></div>
            <div class="field"><label>Longitude</label><input id="lon" type="number" step="0.0001" value="${s.location.lon}" /></div>
          </div>
        </div>

        <div class="card">
          <h3>🗄 Data</h3>
          <p class="muted" style="font-size:13px;margin-bottom:12px">All data lives in your browser. Export a backup or clear everything.</p>
          <div class="stack">
            <button class="btn btn--ghost" id="exportBtn"><i class="ri-download-line"></i> Export backup (JSON)</button>
            <button class="btn btn--ghost" id="importBtn"><i class="ri-upload-line"></i> Import backup</button>
            <input type="file" id="importFile" accept="application/json" hidden />
            <button class="btn btn--danger" id="resetBtn"><i class="ri-delete-bin-line"></i> Reset all data</button>
          </div>
        </div>
      </section>`;

    // theme
    const themeSeg = view.querySelector("#theme");
    themeSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === s.theme));
    themeSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      db.Settings.set({ theme: b.dataset.v });
      themeSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    });

    // accent
    const accents = view.querySelector("#accents");
    const markAccent = () => accents.querySelectorAll(".swatch").forEach((sw) =>
      sw.classList.toggle("on", sw.dataset.c === db.Settings.get().accent));
    accents.addEventListener("click", (e) => {
      const sw = e.target.closest(".swatch"); if (!sw) return;
      db.Settings.set({ accent: sw.dataset.c }); markAccent();
    });
    markAccent();

    // avatar
    const avatars = view.querySelector("#avatars");
    const markAvatar = () => avatars.querySelectorAll(".swatch").forEach((sw) =>
      sw.classList.toggle("on", sw.dataset.a === db.Settings.get().avatar));
    avatars.addEventListener("click", (e) => {
      const sw = e.target.closest(".swatch"); if (!sw) return;
      db.Settings.set({ avatar: sw.dataset.a }); markAvatar();
    });
    markAvatar();

    // background gradient (applies live via Settings.on -> Layout.applyTheme)
    const backgrounds = view.querySelector("#backgrounds");
    const markBg = () => backgrounds.querySelectorAll(".swatch").forEach((sw) =>
      sw.classList.toggle("on", sw.dataset.bg === db.Settings.get().background));
    backgrounds.addEventListener("click", (e) => {
      const sw = e.target.closest(".swatch"); if (!sw) return;
      db.Settings.set({ background: sw.dataset.bg }); markBg();
    });
    markBg();

    // text/number fields save on change
    const bind = (id, key, parse) => view.querySelector("#" + id).addEventListener("change", (e) =>
      db.Settings.set({ [key]: parse ? parse(e.target.value) : e.target.value.trim() }));
    bind("name", "name");
    bind("currency", "currency");
    bind("focusMinutes", "focusMinutes", (v) => +v || 25);
    bind("breakMinutes", "breakMinutes", (v) => +v || 5);
    bind("longBreakMinutes", "longBreakMinutes", (v) => +v || 15);

    const saveLoc = () => db.Settings.set({ location: {
      name: view.querySelector("#locName").value.trim() || "Kumasi",
      lat: +view.querySelector("#lat").value || 6.6885,
      lon: +view.querySelector("#lon").value || -1.6244,
    }});
    ["locName", "lat", "lon"].forEach((id) => view.querySelector("#" + id).addEventListener("change", saveLoc));

    // reminder category toggles + daily nudge time
    view.querySelector("#reminderToggles").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-r]"); if (!cb) return;
      db.Settings.set({ reminders: Object.assign({}, db.Settings.get().reminders, { [cb.dataset.r]: cb.checked }) });
    });
    view.querySelector("#dailyTime").addEventListener("change", (e) => {
      db.Settings.set({ reminders: Object.assign({}, db.Settings.get().reminders, { dailyTime: e.target.value || "18:00" }) });
    });

    // AI (bring-your-own-key) config, stored under "aiConfig"
    const aiCfg = () => Object.assign({ enabled: false, apiKey: "", model: "claude-opus-4-8", endpoint: "" }, Store.get("aiConfig", {}));
    const saveAi = (patch) => Store.set("aiConfig", Object.assign(aiCfg(), patch));
    (function initAi() {
      const c = aiCfg();
      view.querySelector("#aiKey").value = c.apiKey;
      view.querySelector("#aiModel").value = c.model;
      view.querySelector("#aiEndpoint").value = c.endpoint;
      view.querySelector("#aiToggle").textContent = c.enabled ? "On" : "Off";
    })();
    view.querySelector("#aiToggle").addEventListener("click", (e) => {
      e.preventDefault();
      const on = !aiCfg().enabled;
      saveAi({ enabled: on });
      e.target.textContent = on ? "On" : "Off";
      UI.toast(on ? "AI features on" : "AI features off", "info");
    });
    view.querySelector("#aiKey").addEventListener("change", (e) => saveAi({ apiKey: e.target.value.trim() }));
    view.querySelector("#aiModel").addEventListener("change", (e) => saveAi({ model: e.target.value.trim() || "claude-opus-4-8" }));
    view.querySelector("#aiEndpoint").addEventListener("change", (e) => saveAi({ endpoint: e.target.value.trim() }));

    // notifications toggle (also asks for browser permission)
    view.querySelector("#notifBtn").addEventListener("click", async (e) => {
      e.preventDefault();
      const next = !db.Settings.get().notifications;
      if (next && "Notification" in window && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch (_) {}
      }
      db.Settings.set({ notifications: next });
      e.target.textContent = next ? "On" : "Off";
      UI.toast(next ? "Notifications on" : "Notifications off", "info");
    });

    // export / import / reset — scoped to the signed-in account.
    // Backups use logical (unscoped) keys so they can restore into any account.
    const uid = (SS.Auth.currentUser() || {}).uid || "";
    const PREFIX = `ss:u:${uid}:`;

    view.querySelector("#exportBtn").addEventListener("click", () => {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(PREFIX)) dump[k.slice(PREFIX.length)] = localStorage.getItem(k);
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "softspace-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    const importFile = view.querySelector("#importFile");
    view.querySelector("#importBtn").addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        // Re-scope logical keys into the current account.
        Object.keys(data).forEach((k) => localStorage.setItem(PREFIX + k, data[k]));
        UI.toast("Backup restored", "success");
        setTimeout(() => location.reload(), 700);
      } catch (e) { UI.toast("Couldn't read that file", "error"); }
    });

    view.querySelector("#resetBtn").addEventListener("click", async () => {
      if (!(await UI.confirm("This erases this account's Soft Space data. Continue?", { danger: true }))) return;
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      UI.toast("All data cleared", "info");
      setTimeout(() => location.reload(), 700);
    });
  });
})();
