import type { CSSProperties } from "react";
import type { Theme } from "@/lib/types";

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const FONTS: Record<Theme["font_family"], string> = {
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  roboto: "Roboto, ui-sans-serif, system-ui, sans-serif",
  "open-sans": "'Open Sans', ui-sans-serif, system-ui, sans-serif",
  lato: "Lato, ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

function color(v: string | undefined, fallback: string) {
  return v && COLOR.test(v) ? v : fallback;
}

/** Black or white, whichever reads better on the given background. */
export function contrastText(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#111827" : "#ffffff";
}

/** All theming is CSS variables, derived from validated config values. */
export function themeVars(t: Partial<Theme>): CSSProperties {
  const primary = color(t.primary_color, "#4f46e5");
  const user = color(t.user_bubble_color, primary);
  return {
    "--hv-primary": primary,
    "--hv-on-primary": contrastText(primary),
    "--hv-bg": color(t.background_color, "#ffffff"),
    "--hv-text": color(t.text_color, "#111827"),
    "--hv-user": user,
    "--hv-on-user": contrastText(user),
    "--hv-bot": color(t.bot_bubble_color, "#f3f4f6"),
    "--hv-radius": `${Math.min(32, Math.max(0, Number(t.radius ?? 16)))}px`,
    fontFamily: FONTS[t.font_family ?? "system"] ?? FONTS.system,
  } as CSSProperties;
}
