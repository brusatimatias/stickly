import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockUpdateName = vi.hoisted(() => vi.fn());
const mockSetPassword = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockConfirmWithGoogle = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/profile", () => ({
  updateProfileName: mockUpdateName,
  updateAvatar: vi.fn(),
  setPassword: mockSetPassword,
  confirmPasswordResetWithGoogle: mockConfirmWithGoogle,
}));
vi.mock("@/app/actions/whatsapp", () => ({ createWhatsAppLinkCode: vi.fn(), unlinkWhatsApp: vi.fn() }));
vi.mock("@/app/actions/push", () => ({
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  sendTestNotification: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
vi.mock("@/app/actions/reminders", () => ({ updateReminderSettings: vi.fn() }));

import ProfileForm from "@/components/profile/ProfileForm";

const t = messages.profile;

function renderForm({
  hasPassword = true,
  canResetWithGoogle = false,
  recentGoogleSignIn = false,
  openPasswordForm = false,
} = {}) {
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <ProfileForm
        name="Ana"
        email="ana@stickly.test"
        avatarSrc={null}
        hasPassword={hasPassword}
        canResetWithGoogle={canResetWithGoogle}
        recentGoogleSignIn={recentGoogleSignIn}
        openPasswordForm={openPasswordForm}
        whatsapp={null}
        notifications={null}
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

  describe("forgotten password", () => {
    test("offers to confirm with Google only when Google is linked", async () => {
      renderForm({ canResetWithGoogle: true });
      fireEvent.click(screen.getByRole("button", { name: t.changePassword }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: t.forgotPasswordConfirmWithGoogle }));
      });

      expect(mockConfirmWithGoogle).toHaveBeenCalled();
    });

    test("doesn't offer it without Google linked", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: t.changePassword }));

      expect(screen.queryByRole("button", { name: t.forgotPasswordConfirmWithGoogle })).toBeNull();
    });

    test("after a recent Google sign in, changes it without the current password", async () => {
      renderForm({ canResetWithGoogle: true, recentGoogleSignIn: true, openPasswordForm: true });

      expect(screen.queryByLabelText(t.currentPasswordPlaceholder)).toBeNull();
      expect(screen.queryByRole("button", { name: t.forgotPasswordConfirmWithGoogle })).toBeNull();
      expect(screen.getByText(t.recentGoogleSignInHint)).toBeTruthy();

      fireEvent.change(screen.getByLabelText(t.newPasswordPlaceholder), { target: { value: "new-password" } });
      fireEvent.change(screen.getByLabelText(t.confirmPasswordPlaceholder), { target: { value: "new-password" } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: t.savePassword }));
      });

      expect(mockSetPassword).toHaveBeenCalledWith("new-password", undefined);
    });

    test("brings the current password back when the sign in is no longer recent", async () => {
      mockSetPassword.mockRejectedValue(new Error("CURRENT_PASSWORD_REQUIRED"));
      renderForm({ recentGoogleSignIn: true, openPasswordForm: true });

      fireEvent.change(screen.getByLabelText(t.newPasswordPlaceholder), { target: { value: "new-password" } });
      fireEvent.change(screen.getByLabelText(t.confirmPasswordPlaceholder), { target: { value: "new-password" } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: t.savePassword }));
      });

      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.getByText(messages.errors.CURRENT_PASSWORD_REQUIRED)).toBeTruthy();
    });
  });
});
