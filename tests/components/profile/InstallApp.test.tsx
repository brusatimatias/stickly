import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockDevice = vi.hoisted(() => ({
  isIOS: vi.fn(),
  isAndroid: vi.fn(),
  isStandalone: vi.fn(),
}));

vi.mock("@/components/device", () => mockDevice);

const t = messages.profile.install;

// The install state lives in a module-level store; reload it for each test.
async function renderInstallApp() {
  vi.resetModules();
  const { InstallPromptListener } = await import("@/components/installPrompt");
  const { default: InstallApp } = await import("@/components/profile/InstallApp");
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <InstallPromptListener />
      <InstallApp />
    </NextIntlClientProvider>
  );
}

function offerInstall(outcome: "accepted" | "dismissed") {
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function onDevice(device: "android" | "ios" | "desktop", { standalone = false } = {}) {
  mockDevice.isAndroid.mockReturnValue(device === "android");
  mockDevice.isIOS.mockReturnValue(device === "ios");
  mockDevice.isStandalone.mockReturnValue(standalone);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("InstallApp", () => {
  test("opens the browser's install dialog on Android and confirms the install", async () => {
    onDevice("android");
    await renderInstallApp();
    const event = offerInstall("accepted");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.install }));
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(screen.getByText(t.installed)).toBeTruthy();
  });

  test("shows the menu steps on Android until the browser offers its dialog", async () => {
    onDevice("android");
    await renderInstallApp();

    expect(screen.getByText(t.androidStep2)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("goes back to the steps when the user dismisses the dialog (it can't be reused)", async () => {
    onDevice("android");
    await renderInstallApp();
    offerInstall("dismissed");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.install }));
    });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(t.androidStep1)).toBeTruthy();
  });

  test("shows the Share menu steps on iOS", async () => {
    onDevice("ios");
    await renderInstallApp();

    expect(screen.getByText(t.iosStep2)).toBeTruthy();
  });

  test("hides itself once installed from the browser's menu", async () => {
    onDevice("android");
    await renderInstallApp();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(screen.getByText(t.installed)).toBeTruthy();
  });

  test.each([
    ["on desktop", "desktop" as const, false],
    ["inside the installed app", "android" as const, true],
  ])("shows nothing %s", async (_case, device, standalone) => {
    onDevice(device, { standalone });
    await renderInstallApp();

    expect(screen.queryByText(t.title)).toBeNull();
  });
});
