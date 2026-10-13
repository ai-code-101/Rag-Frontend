/*!
 * Horizon Valley widget loader.
 *   <script src="https://<host>/widget.js" data-bot="<PUBLIC_KEY>" async></script>
 *
 * No framework. Renders a launcher inside a Shadow DOM (so host-page CSS can't leak in or
 * out) and opens the chat UI in an iframe served by the Horizon Valley web app. All messages
 * crossing the frame boundary are origin- and source-checked.
 */
(function () {
  "use strict";

  // Replaced when /widget.js is served (see web/app/widget.js/route.ts).
  var API = "__HV_API__";
  var WEB = "__HV_WEB__";

  var w = window;
  var d = document;
  var prior = w.HorizonValley;
  if (prior && prior.__loaded) return; // included twice

  var script = d.currentScript || d.querySelector("script[data-bot]");
  var key = script && script.getAttribute("data-bot");
  if (!key || !/^pk_[A-Za-z0-9_-]{24}$/.test(key)) {
    if (w.console) console.warn("[Horizon Valley] missing or invalid data-bot attribute");
    return;
  }
  var webOrigin;
  try {
    webOrigin = new URL(WEB).origin;
  } catch (e) {
    return;
  }

  var COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  var DEFAULTS = { primary_color: "#4f46e5", background_color: "#ffffff", radius: 16 };
  var ICONS = {
    chat: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z",
    message: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 1 1 21 11.5z",
    help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6v.01M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4",
    sparkle: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z",
    close: "M6 6l12 12M18 6L6 18",
  };

  var state = {
    config: null,
    open: false,
    ready: false,
    iframe: null,
    user: null,
    pendingOpen: false,
    host: null,
    rootEl: null,
    panel: null,
    launcher: null,
  };

  // ---- public API --------------------------------------------------------------------

  var api = {
    __loaded: true,
    open: function () {
      if (!state.config) {
        state.pendingOpen = true;
        return;
      }
      setOpen(true);
    },
    close: function () {
      state.pendingOpen = false;
      setOpen(false);
    },
    toggle: function () {
      state.open ? api.close() : api.open();
    },
    isOpen: function () {
      return state.open;
    },
    identify: function (user) {
      state.user = sanitizeUser(user);
      post({ type: "hv:identify", user: state.user });
    },
  };
  w.HorizonValley = api;
  // Calls made before the script loaded: window.HorizonValley = { q: [["open"], ["identify", {...}]] }
  if (prior && prior.q && prior.q.length) {
    for (var i = 0; i < prior.q.length; i++) {
      var call = prior.q[i];
      if (call && typeof api[call[0]] === "function" && call[0] !== "__loaded") api[call[0]].apply(null, [].slice.call(call, 1));
    }
  }

  function sanitizeUser(u) {
    var out = {};
    if (!u || typeof u !== "object") return out;
    ["id", "name", "email", "plan", "company"].forEach(function (k) {
      if (typeof u[k] === "string" || typeof u[k] === "number") out[k] = String(u[k]).slice(0, 200);
    });
    return out;
  }

  // ---- messaging -------------------------------------------------------------------------

  function post(msg) {
    if (state.iframe && state.ready && state.iframe.contentWindow) {
      state.iframe.contentWindow.postMessage(msg, webOrigin);
    }
  }

  w.addEventListener("message", function (e) {
    // Only the iframe we created, served from the Horizon Valley origin, may talk to us.
    if (e.origin !== webOrigin || !state.iframe || e.source !== state.iframe.contentWindow) return;
    var data = e.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "hv:ready") {
      state.ready = true;
      post({ type: "hv:init", open: state.open, user: state.user });
    } else if (data.type === "hv:close") {
      setOpen(false);
    }
  });

  // ---- rendering ---------------------------------------------------------------------

  function cssVars(cfg) {
    var t = cfg.theme || {};
    var b = cfg.behavior || {};
    var color = function (v, def) {
      return typeof v === "string" && COLOR.test(v) ? v : def;
    };
    var num = function (v, min, max, def) {
      v = Number(v);
      return isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
    };
    return [
      "--hv-primary:" + color(t.primary_color, DEFAULTS.primary_color),
      "--hv-bg:" + color(t.background_color, DEFAULTS.background_color),
      "--hv-radius:" + num(t.radius, 0, 32, DEFAULTS.radius) + "px",
      "--hv-ox:" + num(b.offset_x, 0, 200, 20) + "px",
      "--hv-oy:" + num(b.offset_y, 0, 200, 20) + "px",
    ].join(";");
  }

  var STYLE =
    ":host{all:initial}" +
    ".hv-root{position:fixed;z-index:2147483000;bottom:var(--hv-oy);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".hv-right{right:var(--hv-ox)}.hv-left{left:var(--hv-ox)}" +
    ".hv-launcher{all:unset;box-sizing:border-box;width:56px;height:56px;border-radius:50%;background:var(--hv-primary);color:#fff;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.2);transition:transform .2s ease}" +
    ".hv-launcher:hover{transform:scale(1.06)}.hv-launcher:focus-visible{outline:3px solid var(--hv-primary);outline-offset:3px}" +
    ".hv-launcher svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".hv-launcher img{width:30px;height:30px;object-fit:contain}" +
    ".hv-panel{position:absolute;bottom:72px;width:380px;height:min(640px,calc(100vh - 110px));border-radius:var(--hv-radius);overflow:hidden;" +
    "background:var(--hv-bg);box-shadow:0 16px 48px rgba(0,0,0,.2);opacity:0;visibility:hidden;transform:translateY(12px) scale(.98);" +
    "transform-origin:bottom right;transition:opacity .2s ease,transform .2s ease,visibility 0s linear .2s}" +
    ".hv-right .hv-panel{right:0}.hv-left .hv-panel{left:0;transform-origin:bottom left}" +
    ".hv-open .hv-panel{opacity:1;visibility:visible;transform:none;transition:opacity .2s ease,transform .2s ease}" +
    ".hv-panel iframe{border:0;width:100%;height:100%;display:block}" +
    "@media (max-width:640px){.hv-panel{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;border-radius:0}" +
    ".hv-open .hv-launcher{display:none}}" +
    // Same, for host pages without a viewport meta tag (where media queries see ~980px).
    ".hv-mobile .hv-panel{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;border-radius:0}" +
    ".hv-mobile.hv-open .hv-launcher{display:none}" +
    "@media (prefers-reduced-motion:reduce){.hv-panel,.hv-launcher{transition:none}}";

  function svg(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  function launcherContent(open) {
    var icon = (state.config.theme || {}).launcher_icon || "chat";
    if (open) return svg(ICONS.close);
    if (ICONS[icon]) return svg(ICONS[icon]);
    if (/^https:\/\//.test(icon)) {
      var img = d.createElement("img");
      img.src = icon;
      img.alt = "";
      return img;
    }
    return svg(ICONS.chat);
  }

  function setLauncher(open) {
    var l = state.launcher;
    if (!l) return;
    var c = launcherContent(open);
    l.innerHTML = "";
    if (typeof c === "string") l.innerHTML = c; // static SVG markup only
    else l.appendChild(c);
    l.setAttribute("aria-expanded", open ? "true" : "false");
    l.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }

  function ensureIframe() {
    if (state.iframe) return;
    var f = d.createElement("iframe");
    // v= busts the iframe's server-side config cache as soon as the config changes.
    f.src = WEB + "/widget/" + encodeURIComponent(key) + "?parent=" + encodeURIComponent(w.location.origin) + "&v=" + (Number(state.config.config_version) || 0);
    f.title = ((state.config.content || {}).title || "Chat") + " — chat";
    f.setAttribute("allow", "clipboard-write");
    f.setAttribute("referrerpolicy", "strict-origin");
    state.iframe = f;
    state.panel.appendChild(f);
  }

  function isSmallScreen() {
    var sw = (w.screen && w.screen.width) || w.innerWidth;
    return Math.min(sw, w.innerWidth) <= 640;
  }

  function rootClass() {
    return "hv-root " + positionClass() + (state.open ? " hv-open" : "") + (isSmallScreen() ? " hv-mobile" : "");
  }

  function setOpen(open) {
    if (!state.rootEl) return;
    if (open) ensureIframe();
    state.open = open;
    state.rootEl.className = rootClass();
    setLauncher(open);
    post({ type: open ? "hv:open" : "hv:hide" });
  }

  function positionClass() {
    return (state.config.behavior || {}).position === "bottom-left" ? "hv-left" : "hv-right";
  }

  function render() {
    var host = d.createElement("div");
    host.id = "horizon-valley-widget";
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = d.createElement("style");
    style.textContent = STYLE;
    var el = d.createElement("div");
    el.className = rootClass();
    el.setAttribute("style", cssVars(state.config));
    var panel = d.createElement("div");
    panel.className = "hv-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", (state.config.content || {}).title || "Chat");
    var launcher = d.createElement("button");
    launcher.type = "button";
    launcher.className = "hv-launcher";
    launcher.addEventListener("click", api.toggle);
    // Warm the iframe up when the visitor shows intent, so opening feels instant.
    launcher.addEventListener("pointerenter", ensureIframe, { once: true });
    launcher.addEventListener("focus", ensureIframe, { once: true });
    el.appendChild(panel);
    el.appendChild(launcher);
    root.appendChild(style);
    root.appendChild(el);
    d.body.appendChild(host);
    state.host = host;
    state.rootEl = el;
    state.panel = panel;
    state.launcher = launcher;
    setLauncher(false);
    w.addEventListener("resize", function () {
      el.className = rootClass();
    });
  }

  // ---- behaviour -----------------------------------------------------------------------

  function pathRegex(p) {
    return new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  }

  function hiddenHere() {
    var paths = (state.config.behavior || {}).hide_on_paths || [];
    for (var i = 0; i < paths.length; i++) {
      if (typeof paths[i] === "string" && pathRegex(paths[i]).test(w.location.pathname)) return true;
    }
    return false;
  }

  function applyVisibility() {
    if (!state.host) return;
    var hide = hiddenHere();
    state.host.style.display = hide ? "none" : "";
    if (hide && state.open) setOpen(false);
  }

  function watchNavigation() {
    // Single-page apps: re-check hide_on_paths on client-side navigation.
    ["pushState", "replaceState"].forEach(function (m) {
      var orig = history[m];
      if (typeof orig !== "function") return;
      history[m] = function () {
        var r = orig.apply(this, arguments);
        setTimeout(applyVisibility, 0);
        return r;
      };
    });
    w.addEventListener("popstate", applyVisibility);
  }

  function shouldAutoOpen() {
    try {
      if (new URLSearchParams(w.location.search).get("chat") === "open") return 0;
    } catch (e) {
      /* ignore */
    }
    var b = state.config.behavior || {};
    if (!b.auto_open) return -1;
    try {
      // Auto-open once per browsing session, not on every page view.
      var k = "hv_auto_" + key;
      if (w.sessionStorage.getItem(k)) return -1;
      w.sessionStorage.setItem(k, "1");
    } catch (e) {
      /* storage blocked: still auto-open */
    }
    return Math.min(60000, Math.max(0, Number(b.auto_open_delay_ms) || 0));
  }

  function init() {
    fetch(API + "/v1/widget/" + encodeURIComponent(key) + "/config", { credentials: "omit", mode: "cors" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (cfg) {
        state.config = cfg;
        render();
        applyVisibility();
        watchNavigation();
        var delay = state.pendingOpen ? 0 : shouldAutoOpen();
        if (delay === 0 && !hiddenHere()) setOpen(true);
        else if (delay > 0)
          setTimeout(function () {
            if (!state.open && !hiddenHere()) setOpen(true);
          }, delay);
      })
      .catch(function (err) {
        if (w.console) console.warn("[Horizon Valley] widget unavailable:", err && err.message);
      });
  }

  // Works from <head> or <body>, with or without async/defer.
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})();
