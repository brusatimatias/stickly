"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ClockIcon } from "@/components/board/icons";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const t = useTranslations("board");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const [hour, minute] = value ? value.split(":") : ["", ""];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function handleScroll(event: Event) {
      // Ignore scrolling inside the popover itself (e.g. spinning the
      // hour/minute columns, or the initial scroll-into-view on open) —
      // only an outside scroll (the page/board moving under the popover)
      // should close it.
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    }
    function close() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const targetHour = hour || "09";
    const targetMinute = minute || "00";
    requestAnimationFrame(() => {
      hourListRef.current
        ?.querySelector<HTMLElement>(`[data-value="${targetHour}"]`)
        ?.scrollIntoView({ block: "center" });
      minuteListRef.current
        ?.querySelector<HTMLElement>(`[data-value="${targetMinute}"]`)
        ?.scrollIntoView({ block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(true);
  }

  function pickHour(nextHour: string) {
    onChange(`${nextHour}:${minute || "00"}`);
  }

  function pickMinute(nextMinute: string) {
    onChange(`${hour || "00"}:${nextMinute}`);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={t("time")}
        className="flex min-w-0 items-center gap-1 rounded outline-none"
      >
        <ClockIcon className="h-3 w-3 shrink-0" />
        <span className={`truncate ${value ? "" : "opacity-60"}`}>{value || t("setTime")}</span>
      </button>
      {value && (
        <button
          type="button"
          aria-label={t("clearTime")}
          onClick={() => onChange("")}
          className="shrink-0 opacity-50 hover:opacity-90"
        >
          ✕
        </button>
      )}
      {open && position
        ? createPortal(
            <div
              ref={popoverRef}
              data-note-popover
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 flex w-28 items-stretch gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <TimeColumn listRef={hourListRef} values={HOURS} selected={hour} onPick={pickHour} />
              <div className="flex items-center text-sm font-medium text-zinc-400 dark:text-zinc-600">:</div>
              <TimeColumn listRef={minuteListRef} values={MINUTES} selected={minute} onPick={pickMinute} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function TimeColumn({
  listRef,
  values,
  selected,
  onPick,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  values: string[];
  selected: string;
  onPick: (value: string) => void;
}) {
  return (
    <div
      ref={listRef}
      className="h-28 flex-1 snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="py-10">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            data-value={v}
            onClick={() => onPick(v)}
            className={`block w-full snap-center rounded px-1 py-1 text-center text-xs tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              v === selected
                ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
