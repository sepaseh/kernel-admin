import type { KeyboardEvent } from "react";

// Ant Design owns opening, Escape and trigger restoration. Intercept Tab at
// the endpoints so a browser cannot first move focus outside the modal.
export const trapDialogFocus = (event: KeyboardEvent<HTMLElement>) => {
  if (
    event.key !== "Tab" ||
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;

  const root = event.currentTarget;
  const active = root.ownerDocument.activeElement;
  if (!root.contains(active)) return;

  const controls = [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]',
    ),
  ]
    .filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(":disabled") &&
        !element.closest("[inert]") &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility === "visible",
    )
    .sort((left, right) => {
      const leftOrder = left.tabIndex > 0 ? left.tabIndex : Infinity;
      const rightOrder = right.tabIndex > 0 ? right.tabIndex : Infinity;
      return leftOrder - rightOrder;
    });
  const first = controls[0];
  const last = controls.at(-1);
  const target = event.shiftKey
    ? active === first && last
    : active === last && first;

  if (target) {
    event.preventDefault();
    target.focus();
  }
};
