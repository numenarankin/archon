"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, Send } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgentStore } from "@/store/agent-store";
import { useEmailDraftStore } from "@/store/email-draft-store";
import { useKBStore } from "@/lib/kb/store";
import type { KBFile } from "@/lib/kb/types";
import {
  buildAttachmentBlock,
  buildMentionToken,
  detectMentionAtCursor,
  extractMentions,
  resolveMentions,
  stripMentionMarkers,
} from "@/lib/kb/mentions";
import {
  DEFAULT_HERMES_SETTINGS,
  HERMES_EFFORTS,
  HERMES_MODELS,
  HERMES_PERMISSIONS,
  supportsEffort,
  type HermesEffort,
  type HermesModel,
  type HermesSettings,
} from "@/lib/agent/settings";

export interface ChatProps {
  conversation: {
    id: string;
    messages: UIMessage[];
    linkedMailId?: string;
  };
}

/**
 * Single-conversation chat surface. No conversation-management chrome —
 * the parent (drawer / dedicated /hermes page) owns picking, naming,
 * deleting. This component just runs one useChat instance keyed to
 * its `conversation.id`.
 */
export function Chat({ conversation }: ChatProps) {
  const setMessages = useAgentStore((s) => s.setMessages);
  const pendingPrompt = useAgentStore((s) => s.pendingPrompt);
  const clearPendingPrompt = useAgentStore((s) => s.clearPendingPrompt);
  const updateSettings = useAgentStore((s) => s.updateSettings);
  const settings = useAgentStore(
    (s) =>
      s.conversations.find((c) => c.id === conversation.id)?.settings ??
      DEFAULT_HERMES_SETTINGS
  );
  const setEmailDraft = useEmailDraftStore((s) => s.setDraft);
  const reloadKBTree = useKBStore((s) => s.loadTree);
  const kbFiles = useKBStore((s) => s.tree?.files);
  const kbTreeLoaded = useKBStore((s) => s.tree !== null);
  const lastKBToolSigRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastDraftSigRef = useRef<string | null>(null);
  const lastHermesDraftRef = useRef<string>("");
  const [mention, setMention] = useState<{
    start: number;
    query: string;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [resolvingMentions, setResolvingMentions] = useState(false);

  // Settings can change mid-conversation. The transport is created once
  // (stable reference for useChat), so it reads from a ref to pick up the
  // user's latest selection on every send.
  const settingsRef = useRef<HermesSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id, trigger, messageId }) => ({
          body: {
            messages,
            id,
            trigger,
            messageId,
            ...settingsRef.current,
          },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    id: conversation.id,
    messages: conversation.messages,
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    setMessages(conversation.id, messages);
  }, [messages, conversation.id, setMessages]);

  // Auto-consume queued prompts exactly once per (conv, text) tuple.
  const consumedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingPrompt) return;
    if (pendingPrompt.conversationId !== conversation.id) return;
    if (isBusy) return;
    const sig = `${pendingPrompt.conversationId}::${pendingPrompt.text}`;
    if (consumedPromptRef.current === sig) return;
    consumedPromptRef.current = sig;
    sendMessage({ text: pendingPrompt.text });
    clearPendingPrompt();
  }, [
    pendingPrompt,
    conversation.id,
    isBusy,
    sendMessage,
    clearPendingPrompt,
  ]);

  // Mirror draftEmailReply tool outputs into the email draft store
  // when this conversation is linked to a specific email.
  useEffect(() => {
    const linked = conversation.linkedMailId;
    if (!linked) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      for (let j = m.parts.length - 1; j >= 0; j--) {
        const p = m.parts[j];
        if (p.type !== "tool-draftEmailReply") continue;
        const output = (p as { output?: { body?: string } }).output;
        if (!output?.body) continue;
        const sig = `${m.id}:${j}:${output.body.length}`;
        if (sig === lastDraftSigRef.current) return;
        lastDraftSigRef.current = sig;
        lastHermesDraftRef.current = output.body;
        setEmailDraft(linked, output.body);
        return;
      }
    }
  }, [messages, conversation.linkedMailId, setEmailDraft]);

  // When Hermes creates or edits a KB file, refetch the tree so the file
  // appears (or its renamed/edited metadata refreshes) in the sidebar
  // without requiring a manual reload.
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      for (let j = m.parts.length - 1; j >= 0; j--) {
        const p = m.parts[j];
        if (
          p.type !== "tool-create_kb_file" &&
          p.type !== "tool-write_kb_file"
        ) {
          continue;
        }
        const output = (p as { output?: { id?: string; commitSha?: string } })
          .output;
        if (!output?.commitSha) continue;
        const sig = `${m.id}:${j}:${output.commitSha}`;
        if (sig === lastKBToolSigRef.current) return;
        lastKBToolSigRef.current = sig;
        // Drop the cached body/sha for the affected id so the next open
        // refetches fresh content, then reload the tree.
        if (output.id) {
          useKBStore.setState((s) => {
            const { [output.id!]: _b, ...restBodies } = s.fileCache;
            const { [output.id!]: _f, ...restFm } = s.fileFrontmatter;
            return { fileCache: restBodies, fileFrontmatter: restFm };
          });
        }
        reloadKBTree();
        return;
      }
    }
  }, [messages, reloadKBTree]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isBusy]);

  // Load the KB tree once so @-mentions have something to filter against.
  // The /knowledge-base page loads it too; this just makes Hermes self-
  // sufficient when the user hasn't visited that route yet.
  useEffect(() => {
    if (!kbTreeLoaded) reloadKBTree();
  }, [kbTreeLoaded, reloadKBTree]);

  const mentionMatches = useMemo<KBFile[]>(() => {
    if (!mention || !kbFiles || kbFiles.length === 0) return [];
    const q = mention.query.trim().toLowerCase();
    const scored = kbFiles
      .map((f) => {
        const name = f.name.toLowerCase();
        const path = f.path.toLowerCase();
        if (q === "") return { file: f, score: 0 };
        if (name.startsWith(q)) return { file: f, score: 3 };
        if (name.includes(q)) return { file: f, score: 2 };
        if (path.includes(q)) return { file: f, score: 1 };
        return { file: f, score: -1 };
      })
      .filter((s) => s.score >= 0)
      .sort((a, b) =>
        b.score === a.score
          ? a.file.name.localeCompare(b.file.name)
          : b.score - a.score,
      )
      .slice(0, 8);
    return scored.map((s) => s.file);
  }, [kbFiles, mention]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mention]);

  function updateMentionFromCursor(value: string, cursor: number) {
    const next = detectMentionAtCursor(value, cursor);
    setMention((prev) => {
      if (!next && !prev) return prev;
      if (next && prev && next.start === prev.start && next.query === prev.query) {
        return prev;
      }
      return next;
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setInput(value);
    updateMentionFromCursor(value, e.target.selectionStart ?? value.length);
  }

  function handleInputSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    updateMentionFromCursor(ta.value, ta.selectionStart ?? ta.value.length);
  }

  function insertMention(file: KBFile) {
    if (!mention) return;
    const token = buildMentionToken({
      id: file.id,
      name: file.name,
      path: file.path,
    });
    const before = input.slice(0, mention.start);
    const after = input.slice(mention.start + 1 + mention.query.length);
    const insertion = `${token} `;
    const next = `${before}${insertion}${after}`;
    setInput(next);
    setMention(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = before.length + insertion.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const target = mentionMatches[mentionIndex];
        if (target) insertMention(target);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy || resolvingMentions) return;

    let userText = text;
    const refs = extractMentions(text);
    if (refs.length > 0) {
      setResolvingMentions(true);
      try {
        const resolved = await resolveMentions(refs);
        const cleaned = stripMentionMarkers(text);
        const block = buildAttachmentBlock(resolved);
        userText = block ? `${cleaned}\n\n${block}` : cleaned;
      } finally {
        setResolvingMentions(false);
      }
    }

    let payload = userText;
    const linked = conversation.linkedMailId;
    if (linked) {
      const current =
        useEmailDraftStore.getState().drafts[linked]?.trim() ?? "";
      const lastHis = lastHermesDraftRef.current.trim();
      if (current && current !== lastHis) {
        const quoted = current
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        payload =
          `Current draft in the editor (I've edited it since your last version):\n\n` +
          `${quoted}\n\n---\n\n${userText}`;
      }
    }

    sendMessage({ text: payload });
    setInput("");
    setMention(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background-surface">
      <div
        ref={scrollerRef}
        className="show-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <EmptyState onPick={(text) => sendMessage({ text })} />
        )}
        <ul className="flex flex-col gap-5">
          {messages.map((m) => (
            <li key={m.id} className="flex flex-col gap-1.5">
              <span className="ty-overline text-tertiary-text">
                {m.role === "user" ? "you" : "hermes"}
              </span>
              <div className="flex flex-col gap-1 text-sm text-primary-text">
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <Markdown
                        key={i}
                        text={part.text}
                        isUser={m.role === "user"}
                      />
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const toolName = part.type.replace(/^tool-/, "");
                    return (
                      <p
                        key={i}
                        className="ty-caption inline-flex items-center gap-1.5 text-tertiary-text"
                      >
                        <span className="size-1 rounded-full bg-tertiary-text" />
                        called {toolName}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </li>
          ))}
          {isBusy && (
            <li className="ty-caption text-tertiary-text">thinking…</li>
          )}
          {error && (
            <li className="ty-caption text-[#ff4444]">
              {error.message ?? "Something went wrong."}
            </li>
          )}
        </ul>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-end gap-2 border-t-[0.5px] border-[#1a1a1c] bg-background-surface p-3"
      >
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onSelect={handleInputSelect}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Defer so a click on a mention item still fires before we
              // close. The mousedown handler on items uses preventDefault
              // to keep focus on the textarea, so this blur is rare.
              setTimeout(() => setMention(null), 100);
            }}
            placeholder="Ask Hermes… (@ to attach a KB doc)"
            rows={2}
            className={cn(
              "w-full resize-none rounded-[4px] border-[0.5px] border-[#1a1a1c] bg-background-surface px-3 py-2 text-sm text-primary-text",
              "placeholder:text-tertiary-text focus:border-[#0072f5] focus:outline-none"
            )}
            disabled={isBusy}
          />
          {mention && mentionMatches.length > 0 && (
            <MentionList
              files={mentionMatches}
              activeIndex={mentionIndex}
              onHover={setMentionIndex}
              onPick={insertMention}
            />
          )}
          {mention && mentionMatches.length === 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-[4px] border-[0.5px] border-[#1a1a1c] bg-background-elevated px-3 py-2 text-xs text-tertiary-text shadow-lg">
              {kbFiles === undefined
                ? "Loading knowledge base…"
                : `No docs match "${mention.query}"`}
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="icon-sm"
          disabled={!input.trim() || isBusy || resolvingMentions}
          aria-label="Send"
        >
          <Send />
        </Button>
      </form>

      <SettingsBar
        settings={settings}
        onChange={(patch) => updateSettings(conversation.id, patch)}
      />
    </div>
  );
}

interface MentionListProps {
  files: KBFile[];
  activeIndex: number;
  onHover: (i: number) => void;
  onPick: (file: KBFile) => void;
}

function MentionList({
  files,
  activeIndex,
  onHover,
  onPick,
}: MentionListProps) {
  return (
    <ul
      role="listbox"
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-[4px] border-[0.5px] border-[#1a1a1c] bg-background-elevated py-1 text-sm shadow-lg"
    >
      {files.map((f, i) => {
        const folder = f.folder_id || "/";
        const active = i === activeIndex;
        return (
          <li
            key={f.id}
            role="option"
            aria-selected={active}
            onMouseEnter={() => onHover(i)}
            // mousedown (not click) + preventDefault keeps the textarea
            // focused so the cursor position survives the selection.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(f);
            }}
            className={cn(
              "flex cursor-pointer items-baseline gap-2 px-3 py-1.5",
              active
                ? "bg-background-subtle text-primary-text"
                : "text-secondary-text hover:text-primary-text",
            )}
          >
            <span className="truncate">{f.name}</span>
            <span className="ty-caption ml-auto truncate text-tertiary-text">
              {folder}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface SettingsBarProps {
  settings: HermesSettings;
  onChange: (patch: Partial<HermesSettings>) => void;
}

function SettingsBar({ settings, onChange }: SettingsBarProps) {
  const effortOk = supportsEffort(settings.model);
  const opusOnly = "Opus only";
  return (
    <div className="flex shrink-0 items-center gap-2 border-t-[0.5px] border-[#1a1a1c] bg-background-surface px-3 py-1.5">
      <SettingSelect
        label="Model"
        value={settings.model}
        options={HERMES_MODELS}
        onChange={(v) => onChange({ model: v as HermesModel })}
      />
      <SettingSelect
        label="Effort"
        value={settings.effort}
        options={HERMES_EFFORTS}
        onChange={(v) => onChange({ effort: v as HermesEffort })}
        disabled={!effortOk}
        title={effortOk ? undefined : opusOnly}
      />
      <PermissionsMenu settings={settings} onChange={onChange} />
    </div>
  );
}

interface PermissionsMenuProps {
  settings: HermesSettings;
  onChange: (patch: Partial<HermesSettings>) => void;
}

function PermissionsMenu({ settings, onChange }: PermissionsMenuProps) {
  const enabledCount = HERMES_PERMISSIONS.reduce(
    (n, p) => n + (settings[p.key] ? 1 : 0),
    0
  );
  const summary =
    enabledCount === 0
      ? "None"
      : enabledCount === HERMES_PERMISSIONS.length
        ? "All"
        : `${enabledCount} on`;
  return (
    <label className="ml-auto flex items-center gap-1.5">
      <span className="ty-overline text-tertiary-text">Permissions</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-[2px] border-[0.5px] border-[#1a1a1c] bg-background-surface px-1.5 text-xs text-secondary-text outline-none transition-colors",
            "hover:text-primary-text data-[state=open]:text-primary-text"
          )}
          aria-label="Permissions"
        >
          {summary}
          <ChevronDownIcon className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-tertiary-text">
              Auto-approve tools
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {HERMES_PERMISSIONS.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.key}
                checked={Boolean(settings[p.key])}
                onCheckedChange={(v) => onChange({ [p.key]: v === true })}
                onSelect={(e) => e.preventDefault()}
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </label>
  );
}

interface SettingSelectProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  title,
}: SettingSelectProps) {
  return (
    <label
      className={cn("flex items-center gap-1.5", disabled && "opacity-50")}
      title={title}
    >
      <span className="ty-overline text-tertiary-text">{label}</span>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as string)}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          className="h-6 rounded-[2px] border-[#1a1a1c] bg-background-surface px-1.5 py-0 text-xs text-secondary-text hover:text-primary-text"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Markdown({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }
  return (
    <div className="leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          h1: ({ children }) => (
            <h1 className="ty-h6 my-2 text-primary-text">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="my-2 text-sm font-semibold text-primary-text">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="my-2 text-sm font-medium text-primary-text">
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-primary-text">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#0072f5] underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.startsWith("language-");
            return isBlock ? (
              <code
                className={cn(
                  "block whitespace-pre text-xs text-primary-text",
                  className
                )}
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {children}
              </code>
            ) : (
              <code
                className="rounded-[2px] bg-background-elevated px-1 py-0.5 text-[0.85em] text-primary-text"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-[4px] border-[0.5px] border-[#1a1a1c] bg-background-subtle p-3">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[#1a1a1c] pl-3 text-secondary-text">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b-[0.5px] border-[#1a1a1c] px-2 py-1 text-left font-medium text-secondary-text">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b-[0.5px] border-[#1a1a1c] px-2 py-1 tabular-nums">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-t-[0.5px] border-[#1a1a1c]" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const prompts = [
    "How much cash do I have on hand right now?",
    "What was my burn rate last month?",
    "Show me everything I spent on Anthropic this quarter.",
    "Give me a digest of today's emails.",
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="ty-caption text-secondary-text">Try asking…</p>
      <ul className="flex flex-col gap-1.5">
        {prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="ty-caption w-full rounded-[4px] border-[0.5px] border-[#1a1a1c] px-3 py-2 text-left text-secondary-text transition-colors hover:border-[#2a2a2c] hover:bg-background-subtle hover:text-primary-text"
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
