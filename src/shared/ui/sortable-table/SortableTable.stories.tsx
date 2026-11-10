import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SortableTable } from "@/shared/ui/sortable-table";

const items = [
  { id: "first", name: "First record" },
  { id: "second", name: "Second record" },
];
const TableFixture = ({
  disabled = false,
  sortable = true,
  empty = false,
  onReorder,
}: {
  disabled?: boolean;
  sortable?: boolean;
  empty?: boolean;
  onReorder: (records: typeof items) => void;
}) => {
  const [data, setData] = useState(empty ? [] : items);
  return (
    <SortableTable
      columns={[{ dataIndex: "name", title: "Name" }]}
      data={data}
      disabled={disabled}
      dragLabel="Reorder record"
      onReorder={async (records) => {
        setData(records);
        onReorder(records);
      }}
      sortable={sortable}
    />
  );
};
const meta = {
  title: "Shared/SortableTable",
  component: TableFixture,
  args: { onReorder: fn() },
} satisfies Meta<typeof TableFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardReorder: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const handles = canvas.getAllByRole("button", { name: "Reorder record" });
    handles[0].focus();
    await userEvent.keyboard("[Space][ArrowDown][Space]");
    await expect(args.onReorder).toHaveBeenCalledWith([items[1], items[0]]);
    await expect(canvas.getAllByRole("row")[1]).toHaveTextContent(
      "Second record",
    );
  },
};
export const ReadOnly: Story = {
  args: { sortable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toHaveTextContent("First record");
    await expect(
      canvas.queryByRole("button", { name: "Reorder record" }),
    ).not.toBeInTheDocument();
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole("button", {
      name: "Reorder record",
    }))
      await expect(button).toBeDisabled();
  },
};
export const Empty: Story = { args: { empty: true, sortable: false } };
