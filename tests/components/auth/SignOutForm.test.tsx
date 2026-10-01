import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockDelete = vi.hoisted(() => vi.fn());
const mockGetSubscription = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/push", () => ({ deletePushSubscription: mockDelete }));
vi.mock("@/components/profile/pushDevice", () => ({ getExistingPushSubscription: mockGetSubscription }));

import SignOutForm from "@/components/auth/SignOutForm";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

async function submit(signOut: () => Promise<void>) {
  render(
    <SignOutForm signOut={signOut}>
      <button type="submit">Salir</button>
    </SignOutForm>
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("SignOutForm", () => {
  test("turns this browser's notifications off, then signs out", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    mockGetSubscription.mockResolvedValue({ endpoint: ENDPOINT, unsubscribe });
    const signOut = vi.fn().mockResolvedValue(undefined);

    await submit(signOut);

    expect(mockDelete).toHaveBeenCalledWith(ENDPOINT);
    expect(unsubscribe).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  test("signs out even when turning notifications off fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSubscription.mockRejectedValue(new Error("no service worker"));
    const signOut = vi.fn().mockResolvedValue(undefined);

    await submit(signOut);

    expect(signOut).toHaveBeenCalled();
  });
});
