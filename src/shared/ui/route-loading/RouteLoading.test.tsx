// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { i18n } from "@/shared/i18n";

import { RouteLoading } from "./RouteLoading";

afterEach(cleanup);

it("names the pending route in the currently selected language", async () => {
  await i18n.changeLanguage("en");
  render(<RouteLoading />);
  expect(screen.getByLabelText(i18n.t("loading"))).toBeDefined();
  await act(async () => {
    await i18n.changeLanguage("fa");
  });
  expect(screen.getByLabelText(i18n.t("loading"))).toBeDefined();
});
