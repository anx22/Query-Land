"use client";

/**
 * SelectMenu — an accessible, fully-styled replacement for a native <select>.
 *
 * The native <select> only lets us style the CLOSED control; the open option
 * list is OS-rendered. This is a real listbox (button + role="listbox" popup)
 * so the open state is on-brand too.
 *
 * Two drop-in modes, matching how the app already uses selects:
 *   - Form mode (uncontrolled): pass `name` + `defaultValue`. A hidden input
 *     mirrors the value so server-action forms serialise it exactly as before.
 *   - Controlled mode: pass `value` + `onChange(value)` (filter bars, switchers).
 * `submitOnChange` requests submit on the enclosing form after a pick (for
 * native selects that auto-submitted onChange).
 *
 * A11y: button is aria-haspopup="listbox"/aria-expanded; list is role="listbox"
 * with aria-activedescendant; options are role="option"/aria-selected. Keyboard:
 * ↑/↓/Home/End move, Enter/Space pick, Esc closes, typeahead jumps. Click-outside
 * and blur close. Reduced-motion respected via CSS.
 *
 * Progressive-enhancement note: like every client island in this app, changing
 * the value needs JS (the hidden input still carries the default without it).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectMenuOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectMenuProps {
  options: SelectMenuOption[];
  /** Form mode: name of the hidden input that carries the value. */
  name?: string;
  /** Form mode: initial value (uncontrolled). */
  defaultValue?: string;
  /** Controlled mode: current value. */
  value?: string;
  /** Controlled/observed change — receives the chosen value. */
  onChange?: (value: string) => void;
  /** requestSubmit() the enclosing form after a pick (auto-submit selects). */
  submitOnChange?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** Shape variant to match the surrounding context. */
  variant?: "default" | "pill" | "plain";
  /** Extra class on the trigger button. */
  className?: string;
  /** Shown when the value is empty and no option matches. */
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function SelectMenu({
  options,
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  submitOnChange = false,
  disabled = false,
  required = false,
  id,
  variant = "default",
  className,
  placeholder = "Auswählen…",
  ...aria
}: SelectMenuProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? controlledValue ?? options[0]?.value ?? ""
  );
  const value = isControlled ? controlledValue! : internalValue;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef<{ query: string; at: number }>({ query: "", at: 0 });
  const reactId = useId();
  const listId = `${id ?? reactId}-list`;

  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((o) => o.value === value)),
    [options, value]
  );
  const selectedLabel = options.find((o) => o.value === value)?.label;

  const commit = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
      if (submitOnChange) {
        // Defer so the hidden input's value is in the DOM before submit.
        const form = triggerRef.current?.closest("form");
        if (form) requestAnimationFrame(() => form.requestSubmit());
      }
    },
    [isControlled, onChange, submitOnChange]
  );

  const openList = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  // Move focus into the list when it opens so keyboard nav works immediately.
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const moveActive = useCallback(
    (dir: 1 | -1 | "first" | "last") => {
      setActiveIndex((cur) => {
        const last = options.length - 1;
        let next = dir === "first" ? 0 : dir === "last" ? last : cur + dir;
        // Skip disabled options.
        while (next >= 0 && next <= last && options[next]?.disabled) next += dir === -1 ? -1 : 1;
        return Math.min(last, Math.max(0, next));
      });
    },
    [options]
  );

  const pick = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      commit(opt.value);
      close();
    },
    [options, commit, close]
  );

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        e.preventDefault();
        openList();
        break;
      default:
        break;
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        e.preventDefault();
        moveActive("first");
        break;
      case "End":
        e.preventDefault();
        moveActive("last");
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Typeahead: accumulate typed letters and jump to the first match.
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const now = Date.now();
          typeahead.current.query =
            now - typeahead.current.at < 800 ? typeahead.current.query + e.key : e.key;
          typeahead.current.at = now;
          const q = typeahead.current.query.toLowerCase();
          const found = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(q));
          if (found >= 0) setActiveIndex(found);
        }
        break;
    }
  }

  const triggerClass = [
    "select-menu__trigger",
    variant !== "default" ? `select-menu__trigger--${variant}` : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`select-menu select-menu--${variant}`} ref={rootRef} data-open={open ? "" : undefined}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={triggerClass}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`select-menu__value${selectedLabel ? "" : " select-menu__value--placeholder"}`}>
          {selectedLabel ?? placeholder}
        </span>
        <span className="select-menu__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="select-menu__list"
          tabIndex={-1}
          aria-activedescendant={`${listId}-opt-${activeIndex}`}
          onKeyDown={onListKeyDown}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={opt.value === value}
              aria-disabled={opt.disabled || undefined}
              className={[
                "select-menu__option",
                i === activeIndex ? "select-menu__option--active" : "",
                opt.value === value ? "select-menu__option--selected" : "",
                opt.disabled ? "select-menu__option--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerEnter={() => setActiveIndex(i)}
              onClick={() => pick(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
