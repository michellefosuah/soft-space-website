/* =========================================================
   TODAYLY · MUSIC
   Two independent ways to have sound while you study:

   1. Focus sounds — generated live with the Web Audio API (white / pink /
      brown noise + a soft "rain"). No files, no network, works offline, and
      can auto-start with the Pomodoro.

   2. Streaming embeds — paste a Spotify / YouTube / Apple Music / SoundCloud
      link and it plays via each service's official embedded player. No login
      or Premium required, and no backend. A pluggable seam (SS.Music.provider)
      is left for a future full OAuth/SDK integration.

   Preferences persist per account under the "music" store key.
   ========================================================= */

(function () {
  "use strict";
  const { Store, escapeHtml, UI } = window.SS;

  const DEFAULTS = { sound: "off", volume: 0.4, playWithTimer: true, provider: "spotify", embeds: {} };
  const prefs = () => Object.assign({}, DEFAULTS, Store.get("music", {}));
  const savePrefs = (patch) => Store.set("music", Object.assign(prefs(), patch));

  /* ---------- Web Audio focus sounds ---------- */
  const Sound = {
    ctx: null, src: null, gain: null, current: "off",

    _ctx() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },

    // Build one second of looping noise of the requested colour.
    _buffer(ctx, type) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      if (type === "brown") {
        let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      } else if (type === "pink" || type === "rain") {
        // Paul Kellet's pink-noise approximation.
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        }
      } else { // white
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return buf;
    },

    play(type, volume) {
      if (type === "off") return this.stop();
      const ctx = this._ctx();
      this.stop();
      const src = ctx.createBufferSource();
      src.buffer = this._buffer(ctx, type);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      // "rain" = pink noise softened through a low-pass filter.
      if (type === "rain") {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 1100;
        src.connect(lp); lp.connect(gain);
      } else {
        src.connect(gain);
      }
      gain.connect(ctx.destination);
      src.start();
      this.src = src; this.gain = gain; this.current = type;
    },

    stop() {
      if (this.src) { try { this.src.stop(); this.src.disconnect(); } catch (_) {} this.src = null; }
      this.current = "off";
    },

    setVolume(v) { if (this.gain) this.gain.gain.value = v; },
    isPlaying() { return this.current !== "off"; },
  };

  /* ---------- Streaming embeds ---------- */
  // Turn a normal share link into that service's embed URL. Returns null if unrecognised.
  function embedUrl(provider, link) {
    link = (link || "").trim();
    if (!link) return null;
    try {
      if (provider === "spotify") {
        let m = link.match(/spotify\.com\/(intl-\w+\/)?(track|playlist|album|artist|episode|show)\/([A-Za-z0-9]+)/);
        if (m) return `https://open.spotify.com/embed/${m[2]}/${m[3]}`;
        m = link.match(/spotify:(track|playlist|album|artist|episode|show):([A-Za-z0-9]+)/);
        if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
      }
      if (provider === "youtube") {
        let m = link.match(/[?&]list=([A-Za-z0-9_-]+)/);
        if (m) return `https://www.youtube.com/embed/videoseries?list=${m[1]}`;
        m = link.match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
      }
      if (provider === "apple") {
        const m = link.match(/music\.apple\.com\/(.+)$/);
        if (m) return `https://embed.music.apple.com/${m[1]}`;
      }
      if (provider === "soundcloud") {
        if (/soundcloud\.com\//.test(link))
          return `https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%23d8a7b1&auto_play=false`;
      }
    } catch (_) {}
    return null;
  }

  const PROVIDERS = [
    { id: "spotify", label: "Spotify", hint: "Paste a Spotify playlist/track link (open.spotify.com/…)", height: 152 },
    { id: "youtube", label: "YouTube", hint: "Paste a YouTube video or playlist link", height: 200 },
    { id: "apple", label: "Apple Music", hint: "Paste a music.apple.com link", height: 175 },
    { id: "soundcloud", label: "SoundCloud", hint: "Paste a SoundCloud track/set link", height: 166 },
  ];

  const SOUNDS = [
    { id: "off", label: "Off", emoji: "🔇" },
    { id: "rain", label: "Rain", emoji: "🌧" },
    { id: "brown", label: "Brown", emoji: "🟤" },
    { id: "pink", label: "Pink", emoji: "🌸" },
    { id: "white", label: "White", emoji: "⚪" },
  ];

  /* ---------- UI ---------- */
  function render(container) {
    const p = prefs();
    container.innerHTML = `
      <h3>🎧 Focus Music</h3>

      <label style="display:block;margin-bottom:6px">Ambient sound</label>
      <div class="seg" id="soundSeg" style="flex-wrap:wrap;margin-bottom:10px">
        ${SOUNDS.map((s) => `<button data-s="${s.id}" class="${p.sound === s.id ? "on" : ""}">${s.emoji} ${s.label}</button>`).join("")}
      </div>
      <div class="row" style="gap:10px;margin-bottom:6px">
        <span class="muted" style="font-size:13px">🔈</span>
        <input type="range" id="vol" min="0" max="100" value="${Math.round(p.volume * 100)}" style="flex:1" />
      </div>
      <label class="row" style="gap:8px;font-size:13px;font-weight:400;margin-bottom:16px">
        <input type="checkbox" id="withTimer" ${p.playWithTimer ? "checked" : ""} style="width:auto" />
        Play automatically with the Pomodoro
      </label>

      <label style="display:block;margin-bottom:6px">Stream from…</label>
      <div class="seg" id="provSeg" style="flex-wrap:wrap;margin-bottom:10px">
        ${PROVIDERS.map((pr) => `<button data-p="${pr.id}" class="${p.provider === pr.id ? "on" : ""}">${pr.label}</button>`).join("")}
      </div>
      <div class="row" style="gap:8px;margin-bottom:8px">
        <input id="link" placeholder="Paste a link…" style="flex:1" />
        <button class="btn btn--primary btn--sm" id="loadBtn">Load</button>
      </div>
      <p class="muted" id="hint" style="font-size:12px;margin-bottom:10px"></p>
      <div id="embed"></div>`;

    // ---- sounds ----
    const soundSeg = container.querySelector("#soundSeg");
    soundSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-s]"); if (!b) return;
      const sound = b.dataset.s;
      savePrefs({ sound });
      soundSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      Sound.play(sound, prefs().volume);
    });
    container.querySelector("#vol").addEventListener("input", (e) => {
      const volume = (+e.target.value) / 100;
      savePrefs({ volume });
      Sound.setVolume(volume);
    });
    container.querySelector("#withTimer").addEventListener("change", (e) => savePrefs({ playWithTimer: e.target.checked }));

    // ---- streaming ----
    let provider = p.provider;
    const provSeg = container.querySelector("#provSeg");
    const linkInput = container.querySelector("#link");
    const hint = container.querySelector("#hint");

    function refreshProvider() {
      const meta = PROVIDERS.find((x) => x.id === provider);
      hint.textContent = meta.hint;
      linkInput.value = prefs().embeds[provider] || "";
      loadEmbed(prefs().embeds[provider], false);
      provSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.p === provider));
    }
    function loadEmbed(link, announce) {
      const host = container.querySelector("#embed");
      const url = embedUrl(provider, link);
      if (!url) {
        host.innerHTML = link ? `<p class="muted" style="font-size:12px">That link wasn't recognised for ${provider}.</p>` : "";
        if (announce && link) UI.toast("Link not recognised", "error");
        return;
      }
      const h = PROVIDERS.find((x) => x.id === provider).height;
      host.innerHTML = `<iframe src="${escapeHtml(url)}" width="100%" height="${h}" frameborder="0"
        style="border-radius:12px" loading="lazy" allow="autoplay; encrypted-media; clipboard-write"
        allowfullscreen></iframe>`;
    }

    provSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]"); if (!b) return;
      provider = b.dataset.p;
      savePrefs({ provider });
      refreshProvider();
    });
    container.querySelector("#loadBtn").addEventListener("click", () => {
      const link = linkInput.value.trim();
      const embeds = Object.assign({}, prefs().embeds, { [provider]: link });
      savePrefs({ embeds });
      loadEmbed(link, true);
    });
    linkInput.addEventListener("keypress", (e) => { if (e.key === "Enter") container.querySelector("#loadBtn").click(); });

    refreshProvider();
  }

  window.SS.Music = {
    render, Sound, prefs, savePrefs, embedUrl,
    provider: null, // reserved for a future OAuth/SDK integration
    // Called by the Pomodoro when a focus session starts.
    startWithTimer() {
      const p = prefs();
      if (p.playWithTimer && p.sound !== "off") Sound.play(p.sound, p.volume);
    },
    stop() { Sound.stop(); },
  };
})();
