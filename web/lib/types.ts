export type User = { id: string; email: string; email_verified: boolean; created_at: string };

export type Bot = {
  id: string;
  name: string;
  public_key: string;
  system_instructions: string;
  fallback_message: string;
  model: string;
  temperature: number;
  allowed_origins: string[];
  knowledge_version: number;
  created_at: string;
  updated_at: string;
  embed_snippet: string;
};

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export type KnowledgeDocument = {
  id: string;
  bot_id: string;
  filename: string;
  source_type: "pdf" | "docx" | "txt" | "md" | "url" | "text";
  source_url?: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  error?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

export type Theme = {
  primary_color: string;
  background_color: string;
  text_color: string;
  user_bubble_color: string;
  bot_bubble_color: string;
  radius: number;
  font_family: "system" | "inter" | "roboto" | "open-sans" | "lato" | "serif" | "mono";
  logo_url: string;
  launcher_icon: string;
};

export type Content = {
  title: string;
  subtitle: string;
  greeting: string;
  quick_replies: string[];
  offline_message: string;
  input_placeholder: string;
};

export type Behavior = {
  position: "bottom-right" | "bottom-left";
  auto_open: boolean;
  auto_open_delay_ms: number;
  hide_on_paths: string[];
  offset_x: number;
  offset_y: number;
};

export type Features = {
  lead_capture: { enabled: boolean; fields: ("name" | "email" | "phone")[]; prompt: string };
  show_sources: boolean;
  branding: boolean;
};

export type WidgetSettings = { theme: Theme; content: Content; behavior: Behavior; features: Features };

export type WidgetConfig = WidgetSettings & { config_version: number; updated_at?: string };

export type PublicWidgetConfig = WidgetSettings & {
  public_key: string;
  name: string;
  config_version: number;
  allowed_origins: string[];
};

export type Source = { document_id: string; title: string; filename: string; url?: string | null; page?: number | null; score: number };

export type ApiErrorBody = { error: { code: string; message: string; field?: string } };
