import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useVisualViewportBox } from "@/components/chat/useVisualViewportBox";

function fakeViewport(height: number, offsetTop: number) {
  const viewport = Object.assign(new EventTarget(), { height, offsetTop });
  vi.stubGlobal("visualViewport", viewport);
  return viewport;
}

function Panel({ active }: { active: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useVisualViewportBox(ref, active);
  return <section ref={ref} data-testid="panel" />;
}

function panelVar(container: HTMLElement, name: string) {
  return (container.querySelector("section") as HTMLElement).style.getPropertyValue(name);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useVisualViewportBox", () => {
  test("follows the visual viewport as the keyboard opens", () => {
    const viewport = fakeViewport(800, 0);
    const { container } = render(<Panel active />);
    expect(panelVar(container, "--vv-height")).toBe("800px");

    Object.assign(viewport, { height: 450, offsetTop: 120 });
    viewport.dispatchEvent(new Event("resize"));

    expect(panelVar(container, "--vv-height")).toBe("450px");
    expect(panelVar(container, "--vv-top")).toBe("120px");
  });

  test("does nothing while inactive", () => {
    fakeViewport(800, 0);
    const { container } = render(<Panel active={false} />);

    expect(panelVar(container, "--vv-height")).toBe("");
  });

  test("tolerates browsers without the visual viewport API", () => {
    vi.stubGlobal("visualViewport", undefined);
    const { container } = render(<Panel active />);

    expect(panelVar(container, "--vv-height")).toBe("");
  });
});
