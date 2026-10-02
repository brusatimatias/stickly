"use client";

import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { sendChatMessage } from "@/app/actions/chat";
import { ChatIcon, CloseIcon, SendIcon } from "@/components/board/icons";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/webChat";
import { formatWeekParam } from "@/lib/week";
import { useErrorMessage } from "@/components/errorMessage";
import { FOCUS_RING } from "@/components/focusRing";
import { animatesExit } from "@/components/motion";

// `day` is null for drafts, which are always in view in the draft panel.
type DisplayMessage = ChatMessage & { notes?: { id: string; day: string | null }[] };

const EXAMPLE_KEYS = ["exampleCreate", "exampleWeek", "exampleToday"] as const;

// The character counter only shows up once the message gets close to the limit.
const COUNTER_THRESHOLD = 0.8;

const TYPING_DOT_DELAYS_MS = [0, 150, 300];

/**
 * Floating assistant that creates notes from natural language. The
 * conversation lives only in this component's state (it's mounted outside
 * the board so it survives week navigation) and is sent whole on each turn.
 */
export default function ChatWidget({ weekDays }: { weekDays: string[] }) {
  const t = useTranslations("chat");
  const errorMessage = useErrorMessage();
  const locale = useLocale();
  const dateFnsLocale = locale === "es" ? es : enUS;
  const [isOpen, setIsOpen] = useState(false);
  // Keeps the panel mounted while its exit animation plays.
  const [isClosing, setIsClosing] = useState(false);
  // Messages from this index on appeared while the panel was open, so they
  // animate in; older ones don't replay their animation on every reopen.
  const [animateFrom, setAnimateFrom] = useState(0);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const counterId = useId();

  const close = useCallback(() => {
    setIsOpen(false);
    setIsClosing(animatesExit());
    launcherRef.current?.focus();
  }, []);

  function open() {
    setIsOpen(true);
    setIsClosing(false);
    setAnimateFrom(messages.length);
  }

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Grow the input with its content, from its two rows up to its max height
  // (five lines), past which it scrolls.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
  }, [draft, isOpen]);

  // Keep the latest turn in view: on new messages, while waiting, and when
  // reopening (the panel unmounts on close, so the list starts at the top).
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isPending, isOpen]);

  function send() {
    const content = draft.trim();
    if (!content || isPending) return;

    const history: ChatMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content },
    ];
    setMessages((current) => [...current, { role: "user", content }]);
    setDraft("");
    setError(null);

    startTransition(async () => {
      try {
        const { reply, createdNotes } = await sendChatMessage({
          messages: history,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        const fallback = createdNotes.length > 0 ? t("noteCreated") : t("noReply");
        setMessages((current) => [
          ...current,
          { role: "assistant", content: reply || fallback, notes: createdNotes },
        ]);
      } catch (caught) {
        // Drop the failed turn and give the text back so it can be retried.
        setMessages((current) => current.slice(0, -1));
        setDraft(content);
        setError(errorMessage(caught));
      }
    });
  }

  const showCounter = draft.length > MAX_MESSAGE_LENGTH * COUNTER_THRESHOLD;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <>
      {isOpen || isClosing ? (
        <>
          {/* Dims the board so the open panel stands out; clicking it closes the chat. */}
          <div
            aria-hidden
            onClick={close}
            className={`fixed inset-0 z-30 bg-black/25 dark:bg-black/50 ${isOpen ? "animate-overlay-in" : "animate-overlay-out pointer-events-none"}`}
          />
          <section
            aria-label={t("title")}
            inert={!isOpen}
            onAnimationEnd={(event) => {
              if (!isOpen && event.target === event.currentTarget) setIsClosing(false);
            }}
            className={`${isOpen ? "animate-dialog-in" : "animate-dialog-out"} fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-[28rem] max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900`}
          >
            <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <h2 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                <ChatIcon className="h-4 w-4" />
                {t("title")}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={t("close")}
                className={`cursor-pointer rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 pointer-coarse:p-2.5 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${FOCUS_RING}`}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={listRef}
              role="log"
              aria-live="polite"
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm"
            >
              {messages.length === 0 ? (
                <div className="m-auto flex max-w-[17rem] flex-col gap-3 text-zinc-500 dark:text-zinc-400">
                  <p className="text-center">{t("emptyHint")}</p>
                  <p className="text-xs font-medium">{t("examplesLabel")}</p>
                  {/* Examples fill the input instead of sending, so they can be edited first. */}
                  {EXAMPLE_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDraft(t(key));
                        inputRef.current?.focus();
                      }}
                      className={`cursor-pointer rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 ${FOCUS_RING}`}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              ) : null}
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <p
                    key={index}
                    className={`${index >= animateFrom ? "animate-message-in" : ""} max-w-[85%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 break-words whitespace-pre-wrap text-white dark:bg-zinc-100 dark:text-zinc-900`}
                  >
                    {message.content}
                  </p>
                ) : (
                  <div
                    key={index}
                    className={`${index >= animateFrom ? "animate-message-in" : ""} flex max-w-[85%] -rotate-1 flex-col gap-1.5 self-start rounded-sm border border-yellow-300 bg-yellow-200 px-3 py-2 break-words whitespace-pre-wrap text-yellow-950 shadow-[2px_4px_6px_rgba(0,0,0,0.15)] dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)]`}
                  >
                    <p>{message.content}</p>
                    {message.notes
                      ?.filter(
                        (note): note is { id: string; day: string } =>
                          note.day !== null && !weekDays.includes(note.day)
                      )
                      .map((note) => (
                        <Link
                          key={note.id}
                          href={`/?week=${formatWeekParam(parseISO(note.day))}`}
                          className="self-start text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                        >
                          {t("viewWeek", {
                            day: format(parseISO(note.day), "EEE d MMM", { locale: dateFnsLocale }),
                          })}
                        </Link>
                      ))}
                  </div>
                )
              )}
              {isPending ? (
                <p className="animate-message-in flex items-center gap-1 self-start rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-3 dark:bg-zinc-800">
                  <span className="sr-only">{t("thinking")}</span>
                  {TYPING_DOT_DELAYS_MS.map((delay) => (
                    <span
                      key={delay}
                      aria-hidden
                      className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </p>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div className="flex flex-1 flex-col gap-1">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("placeholder")}
                  aria-label={t("placeholder")}
                  aria-describedby={showCounter ? counterId : undefined}
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={2}
                  className="max-h-[calc(5lh+1rem+2px)] w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
                />
                {showCounter ? (
                  <p
                    id={counterId}
                    className={`self-end text-xs tabular-nums ${draft.length >= MAX_MESSAGE_LENGTH ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {t("charCount", { count: draft.length, max: MAX_MESSAGE_LENGTH })}
                  </p>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={isPending || !draft.trim()}
                aria-label={t("send")}
                className={`cursor-pointer rounded-full bg-zinc-900 p-2 text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:p-3 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${FOCUS_RING}`}
              >
                <SendIcon className="h-4 w-4" />
              </button>
            </form>
          </section>
        </>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={isOpen ? close : open}
        aria-label={isOpen ? t("close") : t("open")}
        aria-expanded={isOpen}
        className={`fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 cursor-pointer rounded-full bg-zinc-900 p-3.5 text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${FOCUS_RING}`}
      >
        {isOpen ? <CloseIcon className="h-5 w-5" /> : <ChatIcon className="h-5 w-5" />}
      </button>
    </>
  );
}
