"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { updateReminderSettings } from "@/app/actions/reminders";
import { useErrorMessage } from "@/components/errorMessage";
import { HINT_CLASS, INPUT_CLASS, LABEL_CLASS, StatusMessage, useAutoClearStatus, type Status } from "@/components/profile/ui";
import { REMINDER_LEAD_MINUTES, type ReminderSettings } from "@/lib/reminderSettings";

const OFF = "off";

/**
 * What the user gets notified about, on every device with notifications on:
 * how long before a note with a time, and the daily digest. Saved on change.
 */
export default function ReminderPreferences({ initial }: { initial: ReminderSettings }) {
  const t = useTranslations("profile.notifications");
  const errorMessage = useErrorMessage();
  const ids = { lead: useId(), digest: useId(), digestTime: useId() };
  const [settings, setSettings] = useState(initial);
  // What the server has, to go back to if a save fails.
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Status>(null);
  useAutoClearStatus(status, setStatus);
  const [isPending, startTransition] = useTransition();

  function save(next: ReminderSettings) {
    setSettings(next);
    setStatus(null);
    startTransition(async () => {
      try {
        await updateReminderSettings(next);
        setSaved(next);
        setStatus({ type: "success", text: t("settingsSaved") });
      } catch (error) {
        setSettings(saved);
        setStatus({ type: "error", text: errorMessage(error) });
      }
    });
  }

  function leadLabel(minutes: number) {
    if (minutes === 0) return t("remindersAtTime");
    if (minutes >= 60) return t("remindersHoursBefore", { hours: minutes / 60 });
    return t("remindersMinutesBefore", { minutes });
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.lead} className={LABEL_CLASS}>
          {t("remindersLabel")}
        </label>
        <select
          id={ids.lead}
          value={settings.reminderMinutesBefore ?? OFF}
          disabled={isPending}
          onChange={(event) =>
            save({
              ...settings,
              reminderMinutesBefore: event.target.value === OFF ? null : Number(event.target.value),
            })
          }
          className={INPUT_CLASS}
        >
          <option value={OFF}>{t("remindersOff")}</option>
          {REMINDER_LEAD_MINUTES.map((minutes) => (
            <option key={minutes} value={minutes}>
              {leadLabel(minutes)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={ids.digest} className={`flex items-center gap-2 ${LABEL_CLASS}`}>
          <input
            id={ids.digest}
            type="checkbox"
            checked={settings.digestEnabled}
            disabled={isPending}
            onChange={(event) => save({ ...settings, digestEnabled: event.target.checked })}
            className="h-4 w-4 accent-amber-500"
          />
          {t("digestLabel")}
        </label>
        {settings.digestEnabled && (
          <>
            <label htmlFor={ids.digestTime} className="sr-only">
              {t("digestTimeLabel")}
            </label>
            <input
              id={ids.digestTime}
              type="time"
              required
              value={settings.digestTime}
              disabled={isPending}
              onChange={(event) => setSettings({ ...settings, digestTime: event.target.value })}
              // Saved when done editing, not on every keystroke of the time.
              onBlur={() => {
                if (settings.digestTime && settings.digestTime !== saved.digestTime) save(settings);
              }}
              className={`${INPUT_CLASS} w-auto`}
            />
          </>
        )}
      </div>

      <p className={HINT_CLASS}>{t("settingsHint")}</p>
      <StatusMessage status={status} />
    </div>
  );
}
