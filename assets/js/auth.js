/* =========================================================
   SOFT SPACE · AUTH (client-side accounts)
   Gates the app behind sign-up / log-in. Accounts and the active session
   live in localStorage; each account's app data is namespaced separately
   by core.js (ss:u:<uid>:…), so users don't share data on a shared device.

   ⚠️ This is a FRONT-END gate, not real security: everything is stored in
   the browser and can be read/bypassed with dev tools, and nothing syncs
   across devices. To upgrade to real auth (Firebase, Supabase, your API),
   set SS.Auth.provider — signUp/logIn will delegate to it:

       SS.Auth.provider = {
         async signUp({name,email,password}) { ...; return {uid,name,email,token} },
         async logIn({email,password})       { ...; return {uid,name,email,token} },
         async logOut() {}
       };
   ========================================================= */

(function () {
  "use strict";
  const USERS_KEY = "ss:auth:users";   // unscoped: list of accounts
  const SESSION_KEY = "ss:session";    // unscoped: active uid (also read by core.js scoping)

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "u-" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  const readUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (_) { return []; } };
  const writeUsers = (list) => localStorage.setItem(USERS_KEY, JSON.stringify(list));

  /* Hash a password with SHA-256 + per-account salt. Falls back to a weak
     hash only when SubtleCrypto is unavailable (e.g. opened via file://). */
  async function hash(password, salt) {
    if (window.crypto && crypto.subtle) {
      const data = new TextEncoder().encode(salt + ":" + password);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Non-crypto fallback (better than plaintext, still not secure).
    let h = 0; const s = salt + ":" + password;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return "w" + (h >>> 0).toString(16);
  }
  function makeSalt() {
    if (window.crypto && crypto.getRandomValues) {
      return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return String(Date.now());
  }

  const Auth = {
    provider: null, // set to delegate to a real backend

    currentUser() {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const u = readUsers().find((x) => x.uid === id);
      return u ? { uid: u.uid, name: u.name, email: u.email } : null;
    },

    isAuthed() { return !!this.currentUser(); },

    async signUp({ name, email, password }) {
      name = (name || "").trim();
      email = (email || "").trim().toLowerCase();
      if (!name) throw new Error("Please enter your name.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email.");
      if ((password || "").length < 6) throw new Error("Password must be at least 6 characters.");

      if (this.provider) {
        const u = await this.provider.signUp({ name, email, password });
        localStorage.setItem(SESSION_KEY, u.uid);
        return u;
      }

      const users = readUsers();
      if (users.some((u) => u.email === email)) throw new Error("An account with that email already exists.");
      const salt = makeSalt();
      const record = { uid: uid(), name, email, salt, hash: await hash(password, salt), createdAt: Date.now() };
      users.push(record);
      writeUsers(users);
      localStorage.setItem(SESSION_KEY, record.uid);
      // Seed the new account's profile name so the dashboard greets them.
      try { window.SS.db.Settings.set({ name }); } catch (_) {}
      return { uid: record.uid, name, email };
    },

    async logIn({ email, password }) {
      email = (email || "").trim().toLowerCase();
      if (this.provider) {
        const u = await this.provider.logIn({ email, password });
        localStorage.setItem(SESSION_KEY, u.uid);
        return u;
      }
      const user = readUsers().find((u) => u.email === email);
      if (!user) throw new Error("No account found for that email.");
      const attempt = await hash(password, user.salt);
      if (attempt !== user.hash) throw new Error("Incorrect password.");
      localStorage.setItem(SESSION_KEY, user.uid);
      return { uid: user.uid, name: user.name, email: user.email };
    },

    async logOut() {
      if (this.provider && this.provider.logOut) { try { await this.provider.logOut(); } catch (_) {} }
      localStorage.removeItem(SESSION_KEY);
    },

    /* Redirect to the login screen if not signed in. Returns true if authed.
       Pages call this via Layout before rendering. */
    guard() {
      if (this.isAuthed()) return true;
      if (!/auth\.html$/.test(location.pathname)) location.replace("auth.html");
      return false;
    },
  };

  window.SS = window.SS || {};
  window.SS.Auth = Auth;
})();
