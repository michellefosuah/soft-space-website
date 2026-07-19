/* =========================================================
   SOFT SPACE · CORE
   Shared primitives used by every page:
   - Store   : namespaced localStorage with change events
   - FileDB  : IndexedDB blob storage (uploaded files survive reload)
   - UI      : toast / modal / confirm helpers
   - fmt     : formatting helpers (dates, money, duration)
   - Charts  : tiny dependency-free SVG chart helpers
   - uid / escapeHtml : misc utilities
   Everything is attached to window.SS so pages can share it.
   ========================================================= */

(function () {
  "use strict";

  const NS = "ss:"; // localStorage namespace, keeps our keys tidy

  /* ---------- account scoping ----------
     Data is partitioned per signed-in user so accounts don't share tasks,
     journals, etc. Auth bookkeeping (session, accounts) stays unscoped.
       logged in  -> ss:u:<uid>:<key>
       logged out -> ss:<key>   (used by the auth screen only)          */
  function activeUid() {
    return localStorage.getItem("ss:session") || null;
  }
  function scoped(key) {
    const uid = activeUid();
    return uid ? `ss:u:${uid}:${key}` : NS + key;
  }

  /* ---------- utilities ---------- */

  // Reasonably-unique id. crypto.randomUUID isn't available everywhere.
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
  }

  // Escape user text before injecting into innerHTML (prevents broken markup / XSS).
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- Store: localStorage + pub/sub ----------
     A single source of truth. Any page that writes emits a "change:<key>"
     event so on-screen widgets update live without a manual refresh.        */

  const listeners = {}; // key -> Set<fn>

  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(scoped(key));
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        console.warn("Store.get failed for", key, e);
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(scoped(key), JSON.stringify(value));
      } catch (e) {
        // Most common cause: quota exceeded (large library files, etc.)
        console.error("Store.set failed for", key, e);
        UI.toast("Storage is full — some data could not be saved.", "error");
        return value;
      }
      emit(key, value);
      return value;
    },

    remove(key) {
      localStorage.removeItem(scoped(key));
      emit(key, undefined);
    },

    // Subscribe to changes for a key. Returns an unsubscribe function.
    on(key, fn) {
      (listeners[key] || (listeners[key] = new Set())).add(fn);
      return () => listeners[key] && listeners[key].delete(fn);
    },
  };

  function emit(key, value) {
    if (listeners[key]) listeners[key].forEach((fn) => fn(value));
  }

  // Reflect changes made in other tabs/pages into this page's widgets.
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(NS)) return;
    // Map the raw storage key back to its logical (unscoped) name.
    const uid = activeUid();
    let key;
    if (uid && e.key.startsWith(`ss:u:${uid}:`)) key = e.key.slice(`ss:u:${uid}:`.length);
    else if (e.key.startsWith("ss:u:")) return; // belongs to a different account
    else key = e.key.slice(NS.length);
    try {
      emit(key, e.newValue === null ? undefined : JSON.parse(e.newValue));
    } catch (_) {}
  });

  /* ---------- FileDB: IndexedDB blob store ----------
     localStorage can't hold real files, so uploaded study materials are
     stored as Blobs in IndexedDB and referenced by id from the library
     metadata (which lives in Store).                                        */

  const FileDB = {
    _db: null,
    _open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("softspace-files", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("files");
        req.onsuccess = () => resolve((this._db = req.result));
        req.onerror = () => reject(req.error);
      });
    },
    async put(id, blob) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(blob, id);
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(id) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const req = db.transaction("files", "readonly").objectStore("files").get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    async delete(id) {
      const db = await this._open();
      return new Promise((resolve) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(id);
        tx.oncomplete = () => resolve();
      });
    },
  };

  /* ---------- formatting helpers ---------- */

  const fmt = {
    today() {
      return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local-ish, stable key)
    },
    dateKey(d) {
      return new Date(d).toISOString().slice(0, 10);
    },
    longDate(d = new Date()) {
      return new Date(d).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
    },
    shortDate(d) {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    },
    money(n, currency) {
      currency = currency || (window.SS && SS.settings && SS.settings().currency) || "₵";
      const v = Number(n || 0);
      return currency + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    duration(mins) {
      mins = Math.round(mins || 0);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h ? `${h}h ${m}m` : `${m}m`;
    },
    // "in 3 days", "today", "2 days ago"
    relativeDays(dateStr) {
      const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
      const days = Math.round(ms / 86400000);
      if (days === 0) return "Today";
      if (days === 1) return "Tomorrow";
      if (days === -1) return "Yesterday";
      return days > 0 ? `In ${days} days` : `${-days} days ago`;
    },
  };

  /* ---------- UI helpers: toast + modal ---------- */

  const UI = {
    toast(message, type) {
      let host = document.querySelector(".toast-host");
      if (!host) {
        host = document.createElement("div");
        host.className = "toast-host";
        document.body.appendChild(host);
      }
      const el = document.createElement("div");
      el.className = "toast toast--" + (type || "info");
      el.textContent = message;
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 300);
      }, 2600);
    },

    /* Generic modal. `bodyHtml` is trusted markup built by the caller.
       Returns the modal element; caller wires up its own buttons.          */
    modal(title, bodyHtml, { footer, onClose } = {}) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <div class="modal__head">
            <h3>${escapeHtml(title)}</h3>
            <button class="modal__close" aria-label="Close">✕</button>
          </div>
          <div class="modal__body">${bodyHtml}</div>
          ${footer ? `<div class="modal__foot">${footer}</div>` : ""}
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("show"));

      const close = () => {
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 200);
        if (onClose) onClose();
      };
      overlay.querySelector(".modal__close").addEventListener("click", close);
      overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
      document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
      });

      overlay.close = close;
      return overlay;
    },

    // Promise-based confirm dialog styled to match the app.
    confirm(message, { danger } = {}) {
      return new Promise((resolve) => {
        const m = UI.modal("Please confirm", `<p style="margin:4px 0 6px">${escapeHtml(message)}</p>`, {
          footer: `
            <button class="btn btn--ghost" data-act="no">Cancel</button>
            <button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-act="yes">Confirm</button>`,
        });
        m.querySelector('[data-act="no"]').addEventListener("click", () => { m.close(); resolve(false); });
        m.querySelector('[data-act="yes"]').addEventListener("click", () => { m.close(); resolve(true); });
      });
    },
  };

  /* ---------- Charts: minimal inline-SVG rendering ----------
     No external chart library (keeps the app offline + CSP-friendly).      */

  const Charts = {
    // data: [{label, value, color}]
    bars(data, { height = 160, max } = {}) {
      const peak = max || Math.max(1, ...data.map((d) => d.value));
      const bars = data.map((d) => {
        const h = Math.round((d.value / peak) * (height - 34));
        return `
          <div class="chart-bar" title="${escapeHtml(d.label)}: ${escapeHtml(String(d.value))}">
            <div class="chart-bar__col" style="height:${h}px;background:${d.color || "var(--accent)"}"></div>
            <span class="chart-bar__label">${escapeHtml(d.label)}</span>
          </div>`;
      }).join("");
      return `<div class="chart-bars" style="height:${height}px">${bars}</div>`;
    },

    // data: [{label, value, color}] -> donut with center text
    donut(data, { size = 170, thickness = 26, center = "" } = {}) {
      const total = data.reduce((s, d) => s + d.value, 0) || 1;
      const r = (size - thickness) / 2;
      const c = 2 * Math.PI * r;
      let offset = 0;
      const rings = data.map((d) => {
        const frac = d.value / total;
        const seg = `
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
            stroke="${d.color}" stroke-width="${thickness}"
            stroke-dasharray="${(frac * c).toFixed(2)} ${c.toFixed(2)}"
            stroke-dashoffset="${(-offset * c).toFixed(2)}"
            transform="rotate(-90 ${size / 2} ${size / 2})" />`;
        offset += frac;
        return seg;
      }).join("");
      return `
        <svg class="chart-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
            stroke="var(--line)" stroke-width="${thickness}"/>
          ${rings}
          ${center ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
            class="chart-donut__center">${escapeHtml(center)}</text>` : ""}
        </svg>`;
    },
  };

  /* ---------- PWA wiring ----------
     Inject the manifest + theme-color and register the service worker so the
     app is installable and works offline, without editing every page head.   */
  (function pwa() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "manifest.webmanifest";
      document.head.appendChild(link);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#D8A7B1";
      document.head.appendChild(meta);
    }
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  })();

  // Public surface
  window.SS = Object.assign(window.SS || {}, {
    Store, FileDB, UI, fmt, Charts, uid, escapeHtml,
  });
})();
