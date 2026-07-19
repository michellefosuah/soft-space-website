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

  /* Selectable animated background gradients. Each has a light + dark variant
     so it stays coherent in either theme. `light` also drives the swatch preview. */
  const BACKGROUNDS = [
    { id: "aurora", name: "Aurora",
      light: "linear-gradient(-45deg,#b8a0ea,#ff9ec6,#dccdeb,#bbeba6)",
      dark: "linear-gradient(-45deg,#2a2340,#3d2a44,#26304a,#223a37)" },
    { id: "blush", name: "Blush",
      light: "linear-gradient(-45deg,#ffd6e8,#ffb3c6,#ffdde1,#fce1f0)",
      dark: "linear-gradient(-45deg,#3a2230,#4a2436,#3a2233,#2e1e2a)" },
    { id: "lavender", name: "Lavender",
      light: "linear-gradient(-45deg,#d7c6f5,#b8a0ea,#e6dcff,#cabdf0)",
      dark: "linear-gradient(-45deg,#2a2340,#332a52,#26224a,#2e2648)" },
    { id: "mint", name: "Mint",
      light: "linear-gradient(-45deg,#bdebc9,#a6e3c4,#d6f5e3,#c9f0d8)",
      dark: "linear-gradient(-45deg,#1f3a30,#22443a,#203a34,#1e332e)" },
    { id: "peach", name: "Peach",
      light: "linear-gradient(-45deg,#ffd9b3,#ffc1a6,#ffe8d6,#ffd6c9)",
      dark: "linear-gradient(-45deg,#3a2a22,#4a3226,#3a2e22,#2e241e)" },
    { id: "ocean", name: "Ocean",
      light: "linear-gradient(-45deg,#a6c7e7,#a0c0ea,#c6e0f5,#bdd6f0)",
      dark: "linear-gradient(-45deg,#1f2a40,#223050,#20264a,#1e2a48)" },
    { id: "sunset", name: "Sunset",
      light: "linear-gradient(-45deg,#ffb3a6,#ffc1d6,#ffd6b3,#f5c6e0)",
      dark: "linear-gradient(-45deg,#3a2230,#4a2a2e,#3a2e26,#2e1e2a)" },
    { id: "cloud", name: "Cloud",
      light: "linear-gradient(-45deg,#e8e4f0,#f0e8ee,#e4ecf0,#eee8f0)",
      dark: "linear-gradient(-45deg,#26242e,#2a2632,#24262e,#282630)" },
  ];
  const bgById = (id) => BACKGROUNDS.find((b) => b.id === id) || BACKGROUNDS[0];

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

    // Hero background gradient (theme-aware).
    const bg = bgById(s.background);
    root.style.setProperty("--grad", theme === "dark" ? bg.dark : bg.light);

    // Mirror preferences so the pre-paint <head> script can avoid a flash.
    try {
      localStorage.setItem("ss:boot", JSON.stringify({
        theme: s.theme, accent: s.accent, gradLight: bg.light, gradDark: bg.dark,
      }));
    } catch (_) {}
  }

  function greeting(name) {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const emoji = h < 12 ? "🌸" : h < 18 ? "☀️" : "🌙";
    return `${part}, ${name} ${emoji}`;
  }

  function mount({ page, title, subtitle, greet } = {}) {
    // Gate the whole app: bounce to the login screen if not signed in.
    if (window.SS.Auth && !SS.Auth.guard()) return null;

    applyTheme();
    const s = db.Settings.get();
    const user = (window.SS.Auth && SS.Auth.currentUser()) || null;
    const host = document.getElementById("app");
    if (!host) return null;

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
          <div class="sidebar-foot">
            <div class="side-user">
              <span class="avatar">${escapeHtml(s.avatar)}</span>
              <div class="side-user__meta">
                <strong>${escapeHtml(user ? user.name : s.name)}</strong>
                <small class="muted">${escapeHtml(user ? user.email : "")}</small>
              </div>
            </div>
            <button class="btn btn--ghost btn--sm btn--block" id="logoutBtn"><i class="ri-logout-box-line"></i> Log out</button>
          </div>
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

    // Log out -> back to the auth screen.
    const logoutBtn = host.querySelector("#logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", async () => {
      await SS.Auth.logOut();
      location.replace("auth.html");
    });

    // Start the in-app reminder scheduler (fires while any page is open).
    if (window.SS.Reminders) SS.Reminders.init();

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

  window.SS.Layout = { mount, applyTheme, greeting, NAV, BACKGROUNDS };
})();
