import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockSave = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockSendTest = vi.hoisted(() => vi.fn());
const mockGetState = vi.hoisted(() => vi.fn());
const mockEnable = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/push", () => ({
  savePushSubscription: mockSave,
  deletePushSubscription: mockDelete,
  sendTestNotification: mockSendTest,
}));
vi.mock("@/components/profile/pushDevice", () => ({
  getPushDeviceState: mockGetState,
  enablePush: mockEnable,
}));
vi.mock("@/app/actions/reminders", () => ({ updateReminderSettings: vi.fn() }));

import NotificationSettings from "@/components/profile/NotificationSettings";

const t = messages.profile.notifications;
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

function fakeSubscription() {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

async function renderSettings() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <NotificationSettings vapidPublicKey="vapid-public" reminders={null} />
      </NextIntlClientProvider>
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockSendTest.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("NotificationSettings", () => {
  test("turns notifications on for this device and stores its subscription", async () => {
    const subscription = fakeSubscription();
    mockGetState.mockResolvedValue({ kind: "off" });
    mockEnable.mockResolvedValue({ kind: "on", subscription });
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.enable }));
    });

    expect(mockEnable).toHaveBeenCalledWith("vapid-public");
    expect(mockSave).toHaveBeenCalledWith(subscription.toJSON());
    expect(screen.getByText(t.enabled)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.sendTest })).toBeTruthy();
  });

  test("unsubscribes the browser again when the server can't store the subscription", async () => {
    const subscription = fakeSubscription();
    mockGetState.mockResolvedValue({ kind: "off" });
    mockEnable.mockResolvedValue({ kind: "on", subscription });
    mockSave.mockRejectedValue(new Error("INVALID_PUSH_SUBSCRIPTION"));
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.enable }));
    });

    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(screen.getByText(messages.errors.INVALID_PUSH_SUBSCRIPTION)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.enable })).toBeTruthy();
  });

  test("shows the browser's block when the user denies the permission", async () => {
    mockGetState.mockResolvedValue({ kind: "off" });
    mockEnable.mockResolvedValue({ kind: "denied" });
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.enable }));
    });

    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.getByText(t.deniedHint)).toBeTruthy();
  });

  test("refreshes a subscribed device's stored subscription when the profile opens", async () => {
    const subscription = fakeSubscription();
    mockGetState.mockResolvedValue({ kind: "on", subscription });
    await renderSettings();

    expect(mockSave).toHaveBeenCalledWith(subscription.toJSON());
  });

  test("sends a test to this device", async () => {
    mockGetState.mockResolvedValue({ kind: "on", subscription: fakeSubscription() });
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.sendTest }));
    });

    expect(mockSendTest).toHaveBeenCalledWith(ENDPOINT);
    expect(screen.getByText(t.testSent)).toBeTruthy();
  });

  test("shows the device as off when the server no longer has its subscription", async () => {
    mockGetState.mockResolvedValue({ kind: "on", subscription: fakeSubscription() });
    mockSendTest.mockRejectedValue(new Error("PUSH_SUBSCRIPTION_NOT_FOUND"));
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.sendTest }));
    });

    expect(screen.getByText(messages.errors.PUSH_SUBSCRIPTION_NOT_FOUND)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.enable })).toBeTruthy();
  });

  test("turns notifications off: unsubscribes the browser and forgets the device", async () => {
    const subscription = fakeSubscription();
    mockGetState.mockResolvedValue({ kind: "on", subscription });
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.disable }));
    });

    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(ENDPOINT);
    expect(screen.getByRole("button", { name: t.enable })).toBeTruthy();
  });

  test.each([
    ["needsInstall", t.needsInstallHint],
    ["unsupported", t.unsupportedHint],
  ])("explains why a %s device can't turn them on", async (kind, hint) => {
    mockGetState.mockResolvedValue({ kind });
    await renderSettings();

    expect(screen.getByText(hint)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
