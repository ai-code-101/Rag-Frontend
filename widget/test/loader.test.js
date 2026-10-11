import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API = "https://api.peakchat.test";
const WEB = "https://app.peakchat.test";
const KEY = "pk_" + "A".repeat(24);
const SOURCE = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/loader.js"), "utf8")
  .replace('"__PEAKCHAT_API__"', JSON.stringify(API))
  .replace('"__PEAKCHAT_WEB__"', JSON.stringify(WEB));

const baseConfig = {
  public_key: KEY,
  theme: { primary_color: "#ff0000", background_color: "#ffffff", radius: 12, launcher_icon: "chat" },
  content: { title: "Acme help" },
  behavior: { position: "bottom-left", auto_open: false, auto_open_delay_ms: 0, hide_on_paths: [], offset_x: 30, offset_y: 40 },
  features: {},
};

function load({ config = baseConfig, attrs = { "data-bot": KEY }, readyState = "complete" } = {}) {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(config) })));
  Object.defineProperty(document, "readyState", { configurable: true, get: () => readyState });
  const s = document.createElement("script");
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  // currentScript is null for injected code in jsdom, so the loader falls back to script[data-bot].
  new Function(SOURCE)();
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const shadow = () => document.getElementById("peakchat-widget")?.shadowRoot;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete window.PeakChat;
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  vi.useRealTimers();
});

describe("widget loader", () => {
  it("fetches config by public key and renders a themed launcher in a shadow root", async () => {
    load();
    await flush();
    expect(fetch).toHaveBeenCalledWith(`${API}/v1/widget/${KEY}/config`, expect.objectContaining({ credentials: "omit" }));
    const root = shadow().querySelector(".pc-root");
    expect(root.className).toContain("pc-left");
    expect(root.getAttribute("style")).toContain("--pc-primary:#ff0000");
    expect(root.getAttribute("style")).toContain("--pc-ox:30px");
    expect(shadow().querySelector(".pc-launcher").getAttribute("aria-expanded")).toBe("false");
    expect(shadow().querySelector("iframe")).toBeNull(); // lazy
  });

  it("rejects CSS injection in colours", async () => {
    load({ config: { ...baseConfig, theme: { primary_color: "red;background:url(https://evil)" } } });
    await flush();
    const style = shadow().querySelector(".pc-root").getAttribute("style");
    expect(style).toContain("--pc-primary:#4f46e5");
    expect(style).not.toContain("evil");
  });

  it("waits for DOMContentLoaded when included in <head>", async () => {
    load({ readyState: "loading" });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await flush();
    expect(shadow()).toBeTruthy();
  });

  it("does nothing without a valid key", async () => {
    load({ attrs: { "data-bot": "nope" } });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(window.PeakChat).toBeUndefined();
  });

  it("open() creates the iframe for /widget/<key> and close() hides it", async () => {
    load();
    await flush();
    window.PeakChat.open();
    const iframe = shadow().querySelector("iframe");
    expect(iframe.src).toBe(`${WEB}/widget/${KEY}?parent=${encodeURIComponent(location.origin)}&v=0`);
    expect(shadow().querySelector(".pc-root").className).toContain("pc-open");
    expect(window.PeakChat.isOpen()).toBe(true);
    window.PeakChat.close();
    expect(shadow().querySelector(".pc-root").className).not.toContain("pc-open");
  });

  it("only accepts messages from its own iframe on the PeakChat origin", async () => {
    load();
    await flush();
    window.PeakChat.open();
    const iframe = shadow().querySelector("iframe");
    // jsdom gives iframes inside shadow roots no browsing context; provide a stand-in window.
    const frameWindow = { postMessage: vi.fn() };
    Object.defineProperty(iframe, "contentWindow", { configurable: true, get: () => frameWindow });
    const posted = frameWindow.postMessage;

    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.test", source: iframe.contentWindow, data: { type: "pc:close" } }));
    window.dispatchEvent(new MessageEvent("message", { origin: WEB, source: window, data: { type: "pc:close" } }));
    expect(window.PeakChat.isOpen()).toBe(true);

    window.dispatchEvent(new MessageEvent("message", { origin: WEB, source: iframe.contentWindow, data: { type: "pc:ready" } }));
    expect(posted).toHaveBeenCalledWith({ type: "pc:init", open: true, user: null }, WEB);

    window.PeakChat.identify({ name: "Ada", email: "ada@example.com", evil: { x: 1 } });
    expect(posted).toHaveBeenLastCalledWith({ type: "pc:identify", user: { name: "Ada", email: "ada@example.com" } }, WEB);

    window.dispatchEvent(new MessageEvent("message", { origin: WEB, source: iframe.contentWindow, data: { type: "pc:close" } }));
    expect(window.PeakChat.isOpen()).toBe(false);
  });

  it("auto-opens with ?chat=open", async () => {
    history.replaceState(null, "", "/pricing?chat=open");
    load();
    await flush();
    expect(window.PeakChat.isOpen()).toBe(true);
  });

  it("auto-opens after the configured delay, once per session", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    load({ config: { ...baseConfig, behavior: { ...baseConfig.behavior, auto_open: true, auto_open_delay_ms: 3000 } } });
    await vi.waitFor(() => expect(shadow()).toBeTruthy());
    expect(window.PeakChat.isOpen()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(window.PeakChat.isOpen()).toBe(true);
    expect(sessionStorage.getItem(`pc_auto_${KEY}`)).toBe("1");
  });

  it("hides on configured paths, including after SPA navigation", async () => {
    load({ config: { ...baseConfig, behavior: { ...baseConfig.behavior, hide_on_paths: ["/checkout/*"] } } });
    await flush();
    const host = document.getElementById("peakchat-widget");
    expect(host.style.display).toBe("");
    history.pushState(null, "", "/checkout/step-1");
    await flush();
    expect(host.style.display).toBe("none");
    history.pushState(null, "", "/blog");
    await flush();
    expect(host.style.display).toBe("");
  });

  it("replays calls queued before the script loaded", async () => {
    window.PeakChat = { q: [["open"]] };
    load();
    await flush();
    expect(window.PeakChat.isOpen()).toBe(true);
  });
});
