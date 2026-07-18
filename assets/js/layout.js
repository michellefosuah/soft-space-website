/* =========================================================
   SOFT SPACE · LAYOUT
   Renders the shared chrome (sidebar + topbar) into every page so nav is
   defined once, stays consistent, and can't drift out of sync. Also boots
   the theme/accent from settings and wires the mobile nav toggle.

   Usage in a page:
     <div id="app" data-page="dashboard" data-title="Dashboard"></div>
     SS.Layout.mount({ page:'dashboard', title:'Dashboard', subtitle:'...' })
   ========================================================= */

(function () {
  "use strict";
  const { db, escapeHtml } = window.SS;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "ri-home-5-line", href: "index.html" },
    { id: "planner", label: "Planner", icon: "ri-calendar-line", href: "planner.html" },
    { id: "journal", label: "Journal", icon: "ri-book-open-line", href: "journal.html" },
    { id: "studyhub", label: "Study Hub", icon: "ri-book-2-line", href: "studyhub.html" },
    { id: "habits", label: "Habits", icon: "ri-heart-line", href: "habits.html" },
    { id: "goals", label: "Goals", icon: "ri-flag-line", href: "goals.html" },
    { id: "finance", label: "Finance", icon: "ri-wallet-3-line", href: "finance.html" },
    { id: "settings", label: "Settings", icon: "ri-settings-3-line", href: "settings.html" },
  ];

  /* Apply theme + accent to <html>. Called early and whenever settings change. */
  function applyTheme() {
    const s = db.Settings.get();
    const root = document.documentElement;
    let theme = s.theme;
    if (theme === "system") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", theme);
    root.style.setProperty("--accent", s.accent);
  }

  function greeting(name) {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const emoji = h < 12 ? "🌸" : h < 18 ? "☀️" : "🌙";
    return `${part}, ${name} ${emoji}`;
  }

  function mount({ page, title, subtitle, greet } = {}) {
    applyTheme();
    const s = db.Settings.get();
    const host = document.getElementById("app");
    if (!host) return;

    const navHtml = NAV.map((n) => `
      <li class="${n.id === page ? "active" : ""}">
        <a href="${n.href}"><i class="${n.icon}"></i><span>${n.label}</span></a>
      </li>`).join("");

    const heading = greet ? greeting(s.name) : (title || "");

    host.innerHTML = `
      <div class="background-gradient"></div>
      <div class="sparkles"></div>

      <button class="nav-toggle" aria-label="Open menu"><i class="ri-menu-line"></i></button>
      <div class="scrim" hidden></div>

      <div class="container">
        <aside class="sidebar" id="sidebar">
          <div class="logo">
            <h1>Soft Space</h1>
            <p>your peaceful corner</p>
          </div>
          <nav><ul>${navHtml}</ul></nav>
        </aside>

        <main class="main">
          <header class="topbar">
            <div>
              <h2 id="pageTitle">${escapeHtml(heading)}</h2>
              <p id="pageSub" class="muted">${escapeHtml(subtitle || "")}</p>
            </div>
            <a class="profile" href="settings.html" title="Settings">
              <span class="avatar">${escapeHtml(s.avatar)}</span>
            </a>
          </header>
          <div id="view"></div>
        </main>
      </div>`;

    // Mobile nav toggle
    const toggle = host.querySelector(".nav-toggle");
    const sidebar = host.querySelector("#sidebar");
    const scrim = host.querySelector(".scrim");
    const openNav = () => { sidebar.classList.add("open"); scrim.hidden = false; };
    const closeNav = () => { sidebar.classList.remove("open"); scrim.hidden = true; };
    toggle.addEventListener("click", openNav);
    scrim.addEventListener("click", closeNav);
    sidebar.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));

    // Keep theme reactive to system + settings changes
    db.Settings.on(applyTheme);
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(applyTheme);
    }

    return document.getElementById("view");
  }

  // Apply theme ASAP (before mount) to reduce flash.
  applyTheme();

  window.SS.Layout = { mount, applyTheme, greeting, NAV };
})();
