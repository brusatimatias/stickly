"use client";

import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendChatMessage } from "@/app/actions/chat";
import { ChatIcon, CloseIcon, SendIcon, SpinnerIcon } from "@/components/board/icons";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/webChat";
import { formatWeekParam } from "@/lib/week";

type DisplayMessage = ChatMessage & { notes?: { id: string; day: string }[] };

const EXAMPLE_KEYS = ["exampleCreate", "exampleWeek", "exampleToday"] as const;

/**
 * Floating assistant that creates notes from natural language. The
 * conversation lives only in this component's state (it's mounted outside
 * the board so it survives week navigation) and is sent whole on each turn.
 */
export default function ChatWidget({ weekDays }: { weekDays: string[] }) {
  const t = useTranslations("chat");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const dateFnsLocale = locale === "es" ? es : enUS;
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isPending]);

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
        if (createdNotes.length > 0) {
          router.refresh();
        }
      } catch (caught) {
        // Drop the failed turn and give the text back so it can be retried.
        setMessages((current) => current.slice(0, -1));
        setDraft(content);
        const code = caught instanceof Error ? caught.message : undefined;
        setError(code && tErrors.has(code) ? tErrors(code) : tErrors("GENERIC"));
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <>
      {isOpen ? (
        <section
          aria-label={t("title")}
          className="animate-dialog-in fixed right-4 bottom-20 z-40 flex h-[28rem] max-h-[calc(100dvh-7rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{t("title")}</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t("close")}
              className="cursor-pointer rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm">
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
                    className="cursor-pointer rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
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
                  className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 break-words whitespace-pre-wrap text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {message.content}
                </p>
              ) : (
                <div
                  key={index}
                  className="flex max-w-[85%] -rotate-1 flex-col gap-1.5 self-start rounded-sm border border-yellow-300 bg-yellow-200 px-3 py-2 break-words whitespace-pre-wrap text-yellow-950 shadow-[2px_4px_6px_rgba(0,0,0,0.15)] dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)]"
                >
                  <p>{message.content}</p>
                  {message.notes
                    ?.filter((note) => !weekDays.includes(note.day))
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
              <p className="flex items-center gap-2 self-start text-zinc-500 dark:text-zinc-400">
                <SpinnerIcon className="h-4 w-4 animate-spin" />
                {t("thinking")}
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
            className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={isPending || !draft.trim()}
              aria-label={t("send")}
              className="cursor-pointer rounded-full bg-zinc-900 p-2 text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? t("close") : t("open")}
        aria-expanded={isOpen}
        className="fixed right-4 bottom-4 z-40 cursor-pointer rounded-full bg-zinc-900 p-3.5 text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {isOpen ? <CloseIcon className="h-5 w-5" /> : <ChatIcon className="h-5 w-5" />}
      </button>
    </>
  );
}
