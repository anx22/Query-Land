"use client";

/**
 * InfoTip — a small circular "i" trigger with an elegant popover tooltip.
 *
 * Distinct from TermTooltip (which marks inline glossary terms with a dotted
 * underline). InfoTip is for contextual help next to a heading, label or metric:
 * a quiet "i" the user can hover/focus to reveal a short explanation.
 *
 * A11y: <button> trigger, opens on hover AND focus, closes on Escape/blur,
 * popover is role="tooltip" + aria-describedby. Respects reduced motion via CSS.
 */

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

export interface InfoTipProps {
  /** Help content shown in the popover. */
  children: ReactNode;
  /** Accessible label for the trigger (default "Mehr Informationen"). */
  label?: string;
}

export function InfoTip({ children, label = "Mehr Informationen" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.blur();
    }
  }, []);

  return (
    <span className="infotip" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={triggerRef}
        type="button"
        className="infotip__trigger"
        aria-label={label}
        aria-describedby={open ? popoverId : undefined}
        onFocus={show}
        onBlur={hide}
        onKeyDown={onKeyDown}
      >
        <Icon name="info" />
      </button>
      {open && (
        <span id={popoverId} className="infotip__popover" role="tooltip" aria-live="polite">
          {children}
        </span>
      )}
    </span>
  );
}
