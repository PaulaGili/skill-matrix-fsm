import { useState } from "react";
import { inColumnOrder } from "@/lib/domain/matrix";
import { readStoredJson, store } from "@/lib/storage";

const KEY = "matrix:columnOrder";

function load(): string[] {
  const stored = readStoredJson(KEY);
  return Array.isArray(stored) ? stored : [];
}

// The order of the skill columns after dragging them, remembered in this browser.
export function useColumnOrder(skills: { id: string }[]) {
  const [columnOrder, setColumnOrder] = useState<string[]>(load);

  // The dragged skill takes the place of the one it is dropped on. The table's own result
  // is not used: dropped to the right it puts the column back where it was.
  function moveColumn(draggedId: string, droppedId: string) {
    const order = inColumnOrder(skills, columnOrder).map((skill) => skill.id);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(droppedId);
    if (from === -1 || to === -1) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    setColumnOrder(order);
    store(KEY, JSON.stringify(order));
  }

  return { columnOrder, moveColumn };
}
