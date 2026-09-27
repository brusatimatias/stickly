import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockUpdateTimeZone = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/profile", () => ({ updateTimeZone: mockUpdateTimeZone }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import TimeZoneSync from "@/components/TimeZoneSync";

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateTimeZone.mockResolvedValue(undefined);
});

describe("TimeZoneSync", () => {
  test("stores the browser's zone and refreshes when it differs", async () => {
    render(<TimeZoneSync storedTimeZone="Not/The_Browser_Zone" />);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockUpdateTimeZone).toHaveBeenCalledWith(browserTimeZone);
  });

  test("does nothing when the stored zone already matches", () => {
    render(<TimeZoneSync storedTimeZone={browserTimeZone} />);

    expect(mockUpdateTimeZone).not.toHaveBeenCalled();
  });
});
