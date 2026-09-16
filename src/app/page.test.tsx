import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

test("renders the starter heading", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { name: /page\.tsx/i })
  ).toBeDefined();
});
