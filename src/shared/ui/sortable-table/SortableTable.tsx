import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Table, type TableProps } from "antd";
import { GripVertical } from "lucide-react";
import {
  createContext,
  type CSSProperties,
  type HTMLAttributes,
  useContext,
} from "react";

type SortableRecord = { id: string };

type SortableTableProps<T extends SortableRecord> = Pick<
  TableProps<T>,
  "columns" | "expandable" | "loading" | "scroll" | "size"
> & {
  data: T[];
  disabled?: boolean;
  dragLabel: string;
  onReorder: (data: T[]) => Promise<void>;
  sortable?: boolean;
};

type RowContextValue = {
  attributes: DraggableAttributes;
  disabled: boolean;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
};

const RowContext = createContext<RowContextValue | null>(null);

function DragHandle({ label }: { label: string }) {
  return (
    <RowContext.Consumer>
      {(context) =>
        context ? (
          <Button
            {...context.attributes}
            {...context.listeners}
            aria-label={label}
            disabled={context.disabled}
            icon={<GripVertical aria-hidden size="1em" />}
            ref={context.setActivatorNodeRef}
            style={{ cursor: "grab", touchAction: "none" }}
            type="text"
          />
        ) : null
      }
    </RowContext.Consumer>
  );
}

const DisabledContext = createContext(false);

function DraggableRow(
  props: HTMLAttributes<HTMLTableRowElement> & { "data-row-key": string },
) {
  const disabled = useContext(DisabledContext);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled, id: props["data-row-key"] });
  const style: CSSProperties = {
    ...props.style,
    position: "relative",
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 1 } : {}),
  };

  return (
    <RowContext.Provider
      value={{ attributes, disabled, listeners, setActivatorNodeRef }}
    >
      <tr {...props} ref={setNodeRef} style={style} />
    </RowContext.Provider>
  );
}

function SortableRow(
  props: HTMLAttributes<HTMLTableRowElement> & { "data-row-key"?: string },
) {
  const id = props["data-row-key"];
  if (id === undefined) return <tr {...props} />;

  return <DraggableRow {...props} data-row-key={id} />;
}

export function SortableTable<T extends SortableRecord>({
  columns,
  data,
  disabled = false,
  dragLabel,
  expandable,
  loading,
  onReorder,
  scroll,
  size,
  sortable = true,
}: SortableTableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const baseColumns = columns ?? [];
  const dragColumn = {
    align: "center" as const,
    key: "sort",
    render: () => <DragHandle label={dragLabel} />,
    title: dragLabel,
    width: 48,
  };
  const sortableColumns: TableProps<T>["columns"] = [
    ...(sortable ? [dragColumn] : []),
    ...baseColumns,
  ];

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (disabled || !sortable || !over || active.id === over.id) return;
    const activeIndex = data.findIndex(({ id }) => id === active.id);
    const overIndex = data.findIndex(({ id }) => id === over.id);
    if (activeIndex >= 0 && overIndex >= 0) {
      const reorderedData = arrayMove(data, activeIndex, overIndex);
      void onReorder(reorderedData);
    }
  }

  return (
    <DisabledContext value={disabled || !sortable}>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <SortableContext
          items={data.map(({ id }) => id)}
          strategy={verticalListSortingStrategy}
        >
          <Table<T>
            columns={sortableColumns}
            components={{ body: { row: SortableRow } }}
            dataSource={data}
            expandable={expandable}
            loading={loading}
            pagination={false}
            rowKey="id"
            scroll={scroll}
            size={size}
          />
        </SortableContext>
      </DndContext>
    </DisabledContext>
  );
}
