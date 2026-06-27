import { useEffect, type RefObject } from "react";

/**
 * Focus-trap for modal drawers/dialogs.
 *
 * When `active`, moves focus into the referenced element, keeps Tab/Shift+Tab cycling within it,
 * invokes `onClose` on Escape, and restores focus to the previously-focused element on teardown.
 * Pass `active=false` (e.g. while the drawer is closed) to disable it.
 *
 * Dependency-free — shared by every drawer (keyword inspector, evidence chain, issue actions,
 * URL explorer) so the accessibility behaviour stays identical everywhere.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      ref.current
        ? Array.from(
            ref.current.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];
    focusables()[0]?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previouslyFocused?.focus?.();
    };
  }, [ref, active, onClose]);
}
