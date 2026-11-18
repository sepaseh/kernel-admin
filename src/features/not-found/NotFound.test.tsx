// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";

import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { NotFoundPage } from "./NotFound.tsx";

beforeEach(async () => {
  await i18nInstance.changeLanguage("en");
});

afterEach(async () => {
  await i18nInstance.changeLanguage("fa");
});

it.each(["Enter", "Space"])(
  "offers one focusable home control and navigates with %s",
  async (key) => {
    const { container, user } = render(
      <MemoryRouter initialEntries={["/missing"]}>
        <Routes>
          <Route element={<h1>Home destination</h1>} path="/" />
          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </MemoryRouter>,
    );
    const home = screen.getByRole("button", {
      name: i18nInstance.t("backHome"),
    });

    expect(home).toHaveClass("ant-btn-primary");
    expect(container.querySelector("a button, button a")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.tab();
    expect(home).toHaveFocus();
    await user.keyboard(`[${key}]`);

    expect(
      await screen.findByRole("heading", { name: "Home destination" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: i18nInstance.t("backHome") }),
    ).not.toBeInTheDocument();
  },
);
