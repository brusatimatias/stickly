import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockUpdateName = vi.hoisted(() => vi.fn());
const mockSetPassword = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/profile", () => ({
  updateProfileName: mockUpdateName,
  updateAvatar: vi.fn(),
  setPassword: mockSetPassword,
}));
vi.mock("@/app/actions/whatsapp", () => ({ createWhatsAppLinkCode: vi.fn(), unlinkWhatsApp: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import ProfileForm from "@/components/profile/ProfileForm";

const t = messages.profile;

function renderForm({ hasPassword = true } = {}) {
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <ProfileForm
        name="Ana"
        email="ana@stickly.test"
        avatarSrc={null}
        hasPassword={hasPassword}
        whatsapp={null}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateName.mockResolvedValue(undefined);
  mockSetPassword.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("ProfileForm", () => {
  test("saves the name with Enter and confirms it", async () => {
    renderForm();
    const input = screen.getByLabelText(t.name);

    fireEvent.change(input, { target: { value: "Ana María" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    expect(mockUpdateName).toHaveBeenCalledWith("Ana María");
    expect(screen.getByText(t.saved)).toBeTruthy();
  });

  test("doesn't save an unchanged name", async () => {
    renderForm();

    await act(async () => {
      fireEvent.submit(screen.getByLabelText(t.name).closest("form")!);
    });

    expect(mockUpdateName).not.toHaveBeenCalled();
  });

  test("keeps the password fields closed until asked, and closes them on cancel", () => {
    renderForm();
    expect(screen.queryByLabelText(t.newPasswordPlaceholder)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.changePassword }));
    fireEvent.change(screen.getByLabelText(t.newPasswordPlaceholder), { target: { value: "secret-123" } });
    fireEvent.click(screen.getByRole("button", { name: t.cancel }));

    expect(screen.queryByLabelText(t.newPasswordPlaceholder)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.changePassword }));
    expect((screen.getByLabelText(t.newPasswordPlaceholder) as HTMLInputElement).value).toBe("");
  });

  test("changes the password and closes the form", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: t.changePassword }));

    fireEvent.change(screen.getByLabelText(t.currentPasswordPlaceholder), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText(t.newPasswordPlaceholder), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText(t.confirmPasswordPlaceholder), { target: { value: "new-password" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.savePassword }));
    });

    expect(mockSetPassword).toHaveBeenCalledWith("new-password", "old-password");
    expect(screen.queryByLabelText(t.newPasswordPlaceholder)).toBeNull();
    expect(screen.getByText(t.saved)).toBeTruthy();
  });

  test("offers to set a first password without asking for a current one", () => {
    renderForm({ hasPassword: false });

    fireEvent.click(screen.getByRole("button", { name: t.setPassword }));

    expect(screen.queryByLabelText(t.currentPasswordPlaceholder)).toBeNull();
    expect(screen.getByLabelText(t.newPasswordPlaceholder)).toBeTruthy();
  });
});
