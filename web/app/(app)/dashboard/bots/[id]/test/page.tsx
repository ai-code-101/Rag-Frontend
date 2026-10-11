"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBot } from "@/components/dashboard/BotContext";
import { Button, Card, Spinner } from "@/components/ui";
import { ChatView, type SendFn } from "@/components/widget/ChatView";
import { apiFetch, api } from "@/lib/api";
import { consumeChatStream } from "@/lib/chat-client";
import type { WidgetConfig } from "@/lib/types";

export default function TestChatPage() {
  const { bot } = useBot();
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [session, setSession] = useState(0);
  const conversationId = useRef<string>("");

  useEffect(() => {
    api<WidgetConfig>(`/bots/${bot.id}/widget`).then(setConfig);
  }, [bot.id]);

  const send: SendFn = useCallback(
    async (text, h, signal) => {
      const res = await apiFetch(`/bots/${bot.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, conversation_id: conversationId.current }),
        signal,
      });
      await consumeChatStream(
        res,
        {
          onMeta: (m) => (conversationId.current = m.conversation_id),
          onSources: h.onSources,
          onToken: h.onToken,
          onDone: h.onDone,
          onError: h.onError,
        },
        signal,
      );
    },
    [bot.id],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="h-[640px] overflow-hidden p-0 lg:col-span-2">
        {config ? (
          <ChatView
            key={session}
            theme={config.theme}
            content={config.content}
            features={{ ...config.features, show_sources: true, branding: false }}
            send={send}
            showUsage
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Spinner />
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card className="space-y-3 p-5 text-sm text-slate-600">
          <h2 className="font-medium text-slate-900">Try your bot</h2>
          <p>This uses the same knowledge, instructions and model as the embedded widget. Sources and token usage are shown under each answer.</p>
          <p>
            Ask something that isn&apos;t in your documents to check that the bot answers with its fallback message instead of making things up.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              conversationId.current = "";
              setSession((s) => s + 1);
            }}
          >
            New conversation
          </Button>
        </Card>
      </div>
    </div>
  );
}
