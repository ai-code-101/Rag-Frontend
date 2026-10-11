"use client";

import { createContext, useContext } from "react";
import type { Bot } from "@/lib/types";

export type BotCtx = { bot: Bot; setBot: (b: Bot) => void };

export const BotContext = createContext<BotCtx | null>(null);

export function useBot(): BotCtx {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error("useBot outside BotContext");
  return ctx;
}
