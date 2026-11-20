import type { UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export type SortableRecord = { id: string };

export const reorderRows = <T extends SortableRecord>(
  data: T[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | undefined,
): T[] | undefined => {
  if (overId === undefined || activeId === overId) return;

  const activeIndex = data.findIndex(({ id }) => id === activeId);
  const overIndex = data.findIndex(({ id }) => id === overId);
  if (activeIndex < 0 || overIndex < 0) return;

  return arrayMove(data, activeIndex, overIndex);
};
