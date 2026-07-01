"use client";

/**
 * SubmitButton — a form submit button that shows an in-flight state.
 *
 * Server actions run on the server and usually redirect back; between the click and that redirect
 * (a crawl, a sync, a report can take seconds) the plain <button> gave NO feedback — the user
 * clicked and nothing visibly happened. This wraps useFormStatus() so the button disables, shows a
 * spinner and an "… läuft" label while the enclosing form's action is pending. Must be rendered as
 * a child of the <form> whose action it submits.
 */

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export interface SubmitButtonProps {
  children: ReactNode;
  /** Label shown while the action is in flight (default: "läuft …"). */
  pendingLabel?: string;
  /** Full class string for the button (default "button"). */
  className?: string;
  /** Extra disable condition (e.g. a prerequisite lock). Pending always disables too. */
  disabled?: boolean;
  title?: string;
}

export function SubmitButton({
  children,
  pendingLabel = "läuft …",
  className = "button",
  disabled = false,
  title,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-pending={pending ? "" : undefined}
      title={title}
    >
      {pending ? (
        <span className="submit-button__pending">
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
