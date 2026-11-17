import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SortableTable } from "./SortableTable";

const records = [
  { id: "first", name: "First record" },
  { id: "second", name: "Second record" },
];
const columns = [{ dataIndex: "name", title: "Name" }];
const dragLabel = "Reorder record";
const recordNames = () =>
  screen
    .getAllByText(/^(First|Second) record$/)
    .map((record) => record.textContent);

afterEach(() => vi.restoreAllMocks());

describe("sortable table interactions", () => {
  it("preserves records while sorting becomes disabled, read-only and enabled again", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const props = { columns, data: records, dragLabel, onReorder };
    const { rerender } = render(<SortableTable {...props} />);

    for (const handle of screen.getAllByRole("button", { name: dragLabel }))
      expect(handle).toBeEnabled();
    expect(recordNames()).toEqual(["First record", "Second record"]);

    rerender(<SortableTable {...props} disabled />);
    for (const handle of screen.getAllByRole("button", { name: dragLabel })) {
      expect(handle).toBeDisabled();
      await user.click(handle);
    }
    expect(recordNames()).toEqual(["First record", "Second record"]);
    expect(onReorder).not.toHaveBeenCalled();

    rerender(<SortableTable {...props} sortable={false} />);
    expect(
      screen.queryByRole("button", { name: dragLabel }),
    ).not.toBeInTheDocument();
    expect(recordNames()).toEqual(["First record", "Second record"]);
    expect(onReorder).not.toHaveBeenCalled();

    rerender(<SortableTable {...props} />);
    expect(screen.getAllByRole("button", { name: dragLabel })).toHaveLength(2);
    for (const handle of screen.getAllByRole("button", { name: dragLabel }))
      expect(handle).toBeEnabled();
    expect(recordNames()).toEqual(["First record", "Second record"]);
  });

  it("reports a keyboard reorder and displays the owner's accepted order", async () => {
    // Supply the row geometry that jsdom's layout-free DOM cannot calculate.
    const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const row = this.closest("tr[data-row-key]");
        const index = records.findIndex(
          (record) => record.id === row?.getAttribute("data-row-key"),
        );
        return index < 0
          ? getBoundingClientRect.call(this)
          : new DOMRect(16, 48 + index * 48, 320, 48);
      },
    );
    const user = userEvent.setup();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <SortableTable
        columns={columns}
        data={records}
        dragLabel={dragLabel}
        onReorder={onReorder}
      />,
    );
    const firstHandle = screen.getAllByRole("button", { name: dragLabel })[0];
    firstHandle.focus();
    await user.keyboard("[Space]");
    await waitFor(() =>
      expect(firstHandle).toHaveAttribute("aria-pressed", "true"),
    );
    await user.keyboard("[ArrowDown]");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("second"),
    );
    await user.keyboard("[Space]");

    await waitFor(() =>
      expect(onReorder).toHaveBeenCalledExactlyOnceWith([
        records[1],
        records[0],
      ]),
    );
    expect(records.map((record) => record.id)).toEqual(["first", "second"]);
    rerender(
      <SortableTable
        columns={columns}
        data={[records[1], records[0]]}
        dragLabel={dragLabel}
        onReorder={onReorder}
      />,
    );
    expect(recordNames()).toEqual(["Second record", "First record"]);
  });

  it("cancels a keyboard drag without requesting a reorder", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    render(
      <SortableTable
        columns={columns}
        data={records}
        dragLabel={dragLabel}
        onReorder={onReorder}
      />,
    );
    const firstHandle = screen.getAllByRole("button", { name: dragLabel })[0];
    firstHandle.focus();
    await user.keyboard("[Space]");
    await waitFor(() =>
      expect(firstHandle).toHaveAttribute("aria-pressed", "true"),
    );
    await user.keyboard("[Escape]");

    await waitFor(() =>
      expect(firstHandle).not.toHaveAttribute("aria-pressed", "true"),
    );
    expect(recordNames()).toEqual(["First record", "Second record"]);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("expands record details without adding another reorder handle", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    render(
      <SortableTable
        columns={columns}
        data={records}
        dragLabel={dragLabel}
        expandable={{
          expandedRowRender: (record) => <div>Details for {record.name}</div>,
          rowExpandable: (record) => record.id === "first",
        }}
        onReorder={onReorder}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Expand row" }));
    const details = screen.getByRole("row", {
      name: "Details for First record",
    });
    expect(
      within(details).queryByRole("button", { name: dragLabel }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: dragLabel })).toHaveLength(2);
    expect(recordNames()).toEqual(["First record", "Second record"]);

    await user.click(screen.getByRole("button", { name: "Collapse row" }));
    expect(
      screen.queryByRole("row", { name: "Details for First record" }),
    ).not.toBeInTheDocument();
    expect(onReorder).not.toHaveBeenCalled();
  });
});
