// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { ErrorBoundary } from "./ErrorBoundary";

const BrokenView = () => {
  throw new Error("Synthetic render failure");
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("render failure recovery", () => {
  it("renders healthy children", () => {
    render(
      <ErrorBoundary>
        <p>Ready</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Ready")).toBeDefined();
  });

  it("contains a render failure and offers reload", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <BrokenView />
      </ErrorBoundary>,
    );
    expect(screen.getByText(i18n.t("unexpectedError"))).toBeDefined();
    expect(
      screen.getByRole("button", { name: i18n.t("reload") }),
    ).toBeDefined();
  });
});
