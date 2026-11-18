import { act, fireEvent, waitFor, within } from "@testing-library/react";
import {
  Link,
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/account";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { createFaq, fetchFaq, updateFaq } from "../../api";
import type { Faq } from "../../types";
import { FaqForm } from "./FaqForm";

const { messages, onFinish } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({
  createFaq: vi.fn(),
  deleteFaq: vi.fn(),
  fetchFaq: vi.fn(),
  fetchFaqs: vi.fn(),
  sortFaqs: vi.fn(),
  updateFaq: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const existing = {
  id: "faq-1",
  question: "Where are archived items?",
  answer: "Open the archive.",
} satisfies Faq;
const destination = "/faqs?from=admin";

const FormNavigation = () => {
  const { hash, pathname, search } = useLocation();
  return (
    <>
      <Link to={destination}>Leave FAQ form</Link>
      <Link to={`${destination}#create`}>Start another FAQ</Link>
      <output aria-label="FAQ location">{pathname + search + hash}</output>
    </>
  );
};

type RenderFormOptions = {
  hash?: string;
  id?: string;
  permissions?: CurrentUser["permissions"];
};

const RoutedFaqForm = ({ id }: { id?: Faq["id"] }) => {
  const goBack = useGoBack();

  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return <FaqForm id={id} onClose={goBack} onFinish={handleFinish} />;
};

const renderForm = ({
  hash = "#create",
  id,
  permissions = ["faqs.read", "faqs.create", "faqs.update"],
}: RenderFormOptions = {}) => {
  const currentUser: CurrentUser = {
    firstName: "Ada",
    id: "synthetic-editor",
    isSystemAdmin: false,
    lastName: "Lovelace",
    mobile: "09120000000",
    permissions,
    status: "active",
  };

  return render(
    <MemoryRouter initialEntries={[`${destination}${hash}`]}>
      <FormNavigation />
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="/faqs" element={<RoutedFaqForm id={id} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const readyCreateForm = async () => {
  const drawer = within(
    await screen.findByRole("dialog", { name: i18n.t("create") }),
  );
  const question = drawer.getByRole("textbox", { name: i18n.t("question") });
  await waitFor(() => expect(question).toHaveFocus());

  return {
    question,
    answer: drawer.getByRole("textbox", { name: i18n.t("answer") }),
    submit: drawer.getByRole("button", { name: i18n.t("submit") }),
    cancel: drawer.getByRole("button", { name: i18n.t("cancel") }),
  };
};

const expectFormClosed = async () => {
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
    /^\/faqs\?from=admin$/,
  );
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchFaq).mockResolvedValue(existing);
  vi.mocked(createFaq).mockResolvedValue(existing);
  vi.mocked(updateFaq).mockResolvedValue(existing);
  await i18n.changeLanguage("en");
});

describe("FAQ form", () => {
  it("validates both fields and submits a complete new FAQ", async () => {
    const pending = deferred<Faq>();
    vi.mocked(createFaq).mockReturnValueOnce(pending.promise);
    const { user } = renderForm();
    const { answer, question, submit } = await readyCreateForm();

    await user.click(submit);
    await waitFor(() => {
      expect(question).toHaveAttribute("aria-invalid", "true");
      expect(answer).toHaveAttribute("aria-invalid", "true");
    });
    expect(createFaq).not.toHaveBeenCalled();

    await user.type(question, existing.question);
    await user.type(answer, existing.answer);
    await user.click(submit);
    await waitFor(() => {
      expect(createFaq).toHaveBeenCalledExactlyOnceWith(
        { question: existing.question, answer: existing.answer },
        expect.any(AbortSignal),
      );
      expect(submit).toBeDisabled();
    });
    expect(question).toBeDisabled();
    expect(answer).toBeDisabled();
    expect(fetchFaq).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => pending.resolve(existing));
    await expectFormClosed();
    expect(onFinish).toHaveBeenCalledOnce();
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
    expect(updateFaq).not.toHaveBeenCalled();
  });

  it("resets canceled changes when the create drawer opens again", async () => {
    const { user } = renderForm();
    const { answer, question, cancel } = await readyCreateForm();
    await user.type(question, "Draft question");
    await user.type(answer, "Draft answer");

    await user.click(cancel);
    await expectFormClosed();
    await user.click(screen.getByRole("link", { name: "Start another FAQ" }));
    const reopened = await readyCreateForm();
    expect(reopened.question).toHaveValue("");
    expect(reopened.answer).toHaveValue("");
    expect(createFaq).not.toHaveBeenCalled();
  });

  it("prefills the selected FAQ, preserves a rejected edit, and allows a retry", async () => {
    const pending = deferred<Faq>();
    vi.mocked(fetchFaq).mockReturnValueOnce(pending.promise);
    vi.mocked(updateFaq).mockRejectedValueOnce(
      new Error("Synthetic edit failed"),
    );
    const { user } = renderForm({ hash: "#update", id: existing.id });
    const drawer = within(
      await screen.findByRole("dialog", { name: i18n.t("update") }),
    );
    const submit = drawer.getByRole("button", { name: i18n.t("submit") });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(updateFaq).not.toHaveBeenCalled();

    await act(async () => pending.resolve(existing));
    const question = await drawer.findByDisplayValue(existing.question);
    const answer = drawer.getByDisplayValue(existing.answer);
    const revisedAnswer = "Open Archive from the navigation.";
    expect(submit).toBeEnabled();
    fireEvent.change(answer, { target: { value: revisedAnswer } });
    await user.click(submit);

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic edit failed",
      ),
    );
    expect(question).toHaveValue(existing.question);
    expect(answer).toHaveValue(revisedAnswer);
    expect(submit).toBeEnabled();
    expect(onFinish).not.toHaveBeenCalled();

    const values = { question: existing.question, answer: revisedAnswer };
    expect(updateFaq).toHaveBeenNthCalledWith(
      1,
      existing.id,
      values,
      expect.any(AbortSignal),
    );
    await user.click(submit);
    await expectFormClosed();
    expect(updateFaq).toHaveBeenNthCalledWith(
      2,
      existing.id,
      values,
      expect.any(AbortSignal),
    );
    expect(onFinish).toHaveBeenCalledOnce();
    expect(createFaq).not.toHaveBeenCalled();
  });

  it.each([
    {
      hash: "#create",
      name: "creation without permission",
      permissions: ["faqs.read"],
    },
    {
      hash: "#update",
      name: "editing without permission",
      id: existing.id,
      permissions: ["faqs.read"],
    },
    {
      hash: "#update",
      name: "editing without an identity",
      permissions: ["faqs.read", "faqs.update"],
    },
  ] satisfies Array<RenderFormOptions & { name: string }>)(
    "returns to the list for $name",
    async ({ hash, id, permissions }) => {
      renderForm({ hash, id, permissions });
      await expectFormClosed();

      expect(fetchFaq).not.toHaveBeenCalled();
      expect(createFaq).not.toHaveBeenCalled();
      expect(updateFaq).not.toHaveBeenCalled();
    },
  );

  it("leaves another drawer route untouched", async () => {
    renderForm({ hash: "#roles", id: existing.id });
    await act(async () => undefined);
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      "/faqs?from=admin#roles",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchFaq).not.toHaveBeenCalled();
  });

  it("reports a failed edit lookup and returns to the list", async () => {
    vi.mocked(fetchFaq).mockRejectedValueOnce(
      new Error("Synthetic FAQ unavailable"),
    );
    renderForm({ hash: "#update", id: existing.id });
    await expectFormClosed();

    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Synthetic FAQ unavailable",
    );
    expect(updateFaq).not.toHaveBeenCalled();
  });

  it("cancels an abandoned lookup and ignores the late FAQ", async () => {
    const pending = deferred<Faq>();
    vi.mocked(fetchFaq).mockReturnValueOnce(pending.promise);
    const { user } = renderForm({ hash: "#update", id: existing.id });
    const drawer = within(
      await screen.findByRole("dialog", { name: i18n.t("update") }),
    );
    const signal = vi.mocked(fetchFaq).mock.calls[0][1]!;
    await user.click(drawer.getByRole("button", { name: i18n.t("cancel") }));
    expect(signal.aborted).toBe(true);

    await act(async () => pending.resolve(existing));
    await expectFormClosed();
    expect(
      screen.queryByDisplayValue(existing.question),
    ).not.toBeInTheDocument();
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("cancels a pending save when navigation leaves the drawer and ignores a late success", async () => {
    const pending = deferred<Faq>();
    vi.mocked(createFaq).mockReturnValueOnce(pending.promise);
    const { user } = renderForm();
    const { answer, question, submit } = await readyCreateForm();
    fireEvent.change(question, { target: { value: existing.question } });
    fireEvent.change(answer, { target: { value: existing.answer } });
    await user.click(submit);
    await waitFor(() => expect(createFaq).toHaveBeenCalledOnce());
    const signal = vi.mocked(createFaq).mock.calls[0][1]!;

    fireEvent.click(screen.getByText("Leave FAQ form"));
    expect(signal.aborted).toBe(true);

    await act(async () => pending.resolve(existing));
    await expectFormClosed();
    expect(messages.success).not.toHaveBeenCalled();
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
