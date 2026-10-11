"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { refreshSession, setSessionListener } from "./api";
import type { User } from "./types";

type AuthState = { status: "loading" | "authenticated" | "anonymous"; user: User | null };

const AuthContext = createContext<AuthState>({ status: "loading", user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    setSessionListener((s) => setState(s ? { status: "authenticated", user: s.user } : { status: "anonymous", user: null }));
    // Restore the session from the httpOnly refresh cookie on first load. The readable
    // pc_has_session hint (no secret in it) lets anonymous visitors skip that request.
    const hasSession = () => document.cookie.split("; ").includes("pc_has_session=1");
    if (hasSession()) {
      refreshSession().then((s) => {
        if (!s) setState({ status: "anonymous", user: null });
      });
    } else {
      setState({ status: "anonymous", user: null });
    }
    // Refresh proactively before the 15-minute access token expires.
    const id = setInterval(() => hasSession() && void refreshSession(), 12 * 60 * 1000);
    return () => {
      clearInterval(id);
      setSessionListener(null);
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
