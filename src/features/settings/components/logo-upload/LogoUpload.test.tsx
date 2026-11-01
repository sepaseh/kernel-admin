// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { clearAccessToken, setAccessToken } from "@/shared/api";
import { i18nInstance } from "@/shared/i18n";
import { render, screen } from "@/test/render";
import { StoryShell } from "@/test/storybook/StoryShell";

import { uploadFile } from "./api";
import { LogoUpload } from "./LogoUpload";

vi.mock("./api", () => ({ uploadFile: vi.fn() }));

const response = (id: string) => ({
  contentType: "image/png",
  id,
  url: `/${id}.png`,
  visibility: "public" as const,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
};

const setup = (props: ComponentProps<typeof LogoUpload> = {}) => {
  const frame = (value: ComponentProps<typeof LogoUpload>) => (
    <StoryShell>
      <LogoUpload {...value} />
    </StoryShell>
  );
  const result = render(frame(props));
  const input =
    result.container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  return {
    ...result,
    input: input!,
    rerenderProps: (value: ComponentProps<typeof LogoUpload>) =>
      result.rerender(frame(value)),
  };
};

beforeEach(async () => {
  vi.mocked(uploadFile).mockReset();
  clearAccessToken();
  await i18nInstance.changeLanguage("en");
});

afterEach(async () => {
  await i18nInstance.changeLanguage("fa");
});

it("uploads a selected public logo and reports its identifier", async () => {
  const onChange = vi.fn();
  vi.mocked(uploadFile).mockResolvedValue({
    contentType: "image/png",
    id: "logo-1",
    url: "/logo.png",
    visibility: "public",
  });
  const { container, user } = render(
    <StoryShell>
      <LogoUpload onChange={onChange} />
    </StoryShell>,
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  const file = new File(["logo"], "logo.png", { type: "image/png" });

  expect(input).not.toBeNull();
  await user.upload(input!, file);

  expect(uploadFile).toHaveBeenCalledWith(
    file,
    "public",
    expect.any(AbortSignal),
  );
  expect(onChange).toHaveBeenCalledWith("logo-1");
});

it("invalidates a removed pending upload even when the adapter ignores cancellation", async () => {
  const pending = deferred<Awaited<ReturnType<typeof uploadFile>>>();
  vi.mocked(uploadFile).mockReturnValue(pending.promise);
  const onChange = vi.fn();
  const { input, user } = setup({ onChange });
  await user.upload(input, new File(["old"], "old.png", { type: "image/png" }));
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  await act(async () => pending.resolve(response("removed")));
  expect(onChange).not.toHaveBeenCalledWith("removed");
  expect(vi.mocked(uploadFile).mock.calls[0][2]?.aborted).toBe(true);
});

it("accepts only the replacement when two logo uploads complete in reverse order", async () => {
  const first = deferred<Awaited<ReturnType<typeof uploadFile>>>();
  const second = deferred<Awaited<ReturnType<typeof uploadFile>>>();
  vi.mocked(uploadFile)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const onChange = vi.fn();
  const { container, input, user } = setup({ onChange });
  await user.upload(input, new File(["old"], "old.png", { type: "image/png" }));
  const nextInput =
    container.querySelector<HTMLInputElement>('input[type="file"]');
  await user.upload(
    nextInput!,
    new File(["new"], "new.png", { type: "image/png" }),
  );
  await act(async () => second.resolve(response("replacement")));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("replacement"));
  await act(async () => first.resolve(response("obsolete")));
  expect(onChange).not.toHaveBeenCalledWith("obsolete");
  expect(vi.mocked(uploadFile).mock.calls[0][2]?.aborted).toBe(true);
});

it.each(["unmount", "session change"])(
  "ignores a late upload after %s",
  async (reason) => {
    const pending = deferred<Awaited<ReturnType<typeof uploadFile>>>();
    vi.mocked(uploadFile).mockReturnValue(pending.promise);
    const onChange = vi.fn();
    const { input, user, unmount, rerenderProps } = setup({ onChange });
    await user.upload(
      input,
      new File(["old"], "old.png", { type: "image/png" }),
    );
    if (reason === "unmount") unmount();
    else {
      setAccessToken("synthetic-next-session");
      rerenderProps({ onChange });
    }
    await act(async () => pending.resolve(response("obsolete")));
    expect(onChange).not.toHaveBeenCalled();
    expect(vi.mocked(uploadFile).mock.calls[0][2]?.aborted).toBe(true);
  },
);

it("names the empty upload trigger and opens its file selector from the keyboard", async () => {
  const { input, user } = setup();
  const trigger = screen.getByRole("button", { name: "Logo" });
  const chooseFile = vi.spyOn(input, "click");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(chooseFile).toHaveBeenCalledOnce();
});

it("disables file selection without settings-update permission", async () => {
  const { container, user } = render(
    <StoryShell withUser={false}>
      <LogoUpload onChange={vi.fn()} />
    </StoryShell>,
  );
  expect(screen.getByRole("button", { name: "Logo" })).toBeDisabled();
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  await user.upload(
    input!,
    new File(["logo"], "logo.png", { type: "image/png" }),
  );
  expect(uploadFile).not.toHaveBeenCalled();
});

it("restores the previous identifier when a completed replacement is removed", async () => {
  vi.mocked(uploadFile).mockResolvedValue(response("replacement"));
  const onChange = vi.fn();
  const ControlledLogo = () => {
    const [value, setValue] = useState<string | undefined>("original");
    return (
      <StoryShell>
        <LogoUpload
          onChange={(id) => {
            setValue(id);
            onChange(id);
          }}
          url="/original.png"
          value={value}
        />
      </StoryShell>
    );
  };
  const { container, user } = render(<ControlledLogo />);
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  await user.upload(
    input!,
    new File(["new"], "new.png", { type: "image/png" }),
  );
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("replacement"));
  await user.click(await screen.findByRole("button", { name: /remove file/i }));
  expect(onChange).toHaveBeenLastCalledWith("original");
});

it("keeps the current upload failure visible and offers removal", async () => {
  vi.mocked(uploadFile).mockRejectedValue(new Error("Upload failed"));
  const onChange = vi.fn();
  const { input, user } = setup({ onChange });
  await user.upload(input, new File(["bad"], "bad.png", { type: "image/png" }));
  await user.hover(await screen.findByText("bad.png"));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Upload failed");
  await user.click(screen.getByRole("button", { name: /remove file/i }));
  expect(onChange).not.toHaveBeenCalledWith(expect.any(String));
});
