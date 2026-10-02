import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/reminders", () => ({ updateReminderSettings: mockUpdate }));

import ReminderPreferences from "@/components/profile/ReminderPreferences";
import type { ReminderSettings } from "@/lib/reminderSettings";

const t = messages.profile.notifications;
const INITIAL: ReminderSettings = { reminderMinutesBefore: null, digestEnabled: false, digestTime: "07:00" };

function renderPreferences(initial = INITIAL) {
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <ReminderPreferences initial={initial} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("ReminderPreferences", () => {
  test("offers the lead times and saves the chosen one", async () => {
    renderPreferences();
    const select = screen.getByLabelText(t.remindersLabel);

    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      "No",
      "A la hora",
      "10 min antes",
      "15 min antes",
      "30 min antes",
      "1 hora antes",
    ]);

    await act(async () => {
      fireEvent.change(select, { target: { value: "15" } });
    });

    expect(mockUpdate).toHaveBeenCalledWith({ ...INITIAL, reminderMinutesBefore: 15 });
    expect(screen.getByText(t.settingsSaved)).toBeTruthy();
  });

  test("clears the saved message after a moment", async () => {
    vi.useFakeTimers();
    renderPreferences();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(t.remindersLabel), { target: { value: "15" } });
    });
    expect(screen.getByText(t.settingsSaved)).toBeTruthy();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText(t.settingsSaved)).toBeNull();
    vi.useRealTimers();
  });

  test("turns the digest on and saves its time when done editing it", async () => {
    renderPreferences();

    await act(async () => {
      fireEvent.click(screen.getByLabelText(t.digestLabel));
    });
    expect(mockUpdate).toHaveBeenLastCalledWith({ ...INITIAL, digestEnabled: true });

    const time = screen.getByLabelText(t.digestTimeLabel);
    fireEvent.change(time, { target: { value: "08:30" } });
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.blur(time);
    });
    expect(mockUpdate).toHaveBeenLastCalledWith({ ...INITIAL, digestEnabled: true, digestTime: "08:30" });
  });

  test("goes back to what was saved when saving fails", async () => {
    mockUpdate.mockRejectedValue(new Error("INVALID_REMINDER_SETTINGS"));
    renderPreferences({ ...INITIAL, reminderMinutesBefore: 10 });
    const select = screen.getByLabelText(t.remindersLabel) as HTMLSelectElement;

    await act(async () => {
      fireEvent.change(select, { target: { value: "30" } });
    });

    expect(select.value).toBe("10");
    expect(screen.getByText(messages.errors.INVALID_REMINDER_SETTINGS)).toBeTruthy();
  });
});
