"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  useActionState,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import type { ActionState } from "@/domain/forms";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  if (!isValidElement<{ id?: string; "aria-describedby"?: string }>(children))
    throw new Error("Field requires a single form control.");
  const id = children.props.id ?? generatedId;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby":
          [children.props["aria-describedby"], hint ? `${id}-hint` : undefined]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {hint && (
        <span
          id={`${id}-hint`}
          className="mt-2 block text-xs leading-5 text-muted"
        >
          {hint}
        </span>
      )}
    </div>
  );
}
export function ActionForm({
  action,
  children,
  submit = "Guardar",
  confirm,
  className = "panel grid gap-5 p-5",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submit?: string;
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {}),
    formRef = useRef<HTMLFormElement>(null),
    values = useRef<FormData | null>(null);
  // React resets uncontrolled fields after a completed Action; retain user input on validation errors.
  useLayoutEffect(() => {
    if (state.error && values.current && formRef.current)
      for (const element of Array.from(formRef.current.elements)) {
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          if (!element.name || element.type === "hidden") continue;
          if (
            element instanceof HTMLInputElement &&
            ["checkbox", "radio"].includes(element.type)
          )
            element.checked = values.current
              .getAll(element.name)
              .includes(element.value);
          else element.value = String(values.current.get(element.name) ?? "");
        }
      }
  }, [state]);
  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }
        values.current = new FormData(event.currentTarget);
      }}
    >
      <fieldset disabled={pending} className="grid min-w-0 gap-5">
        {children}
      </fieldset>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300/40 p-4 text-sm text-red-200"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-200">
          {state.success}
        </p>
      )}
      <button className="button-primary" disabled={pending}>
        {pending ? "Guardando…" : submit}
      </button>
    </form>
  );
}
export function SavedNotice({ saved }: { saved?: string }) {
  return saved === "1" ? (
    <p
      role="status"
      className="mb-6 rounded-xl border border-green-300/30 bg-green-300/5 p-4 text-sm text-green-200"
    >
      Cambios guardados.
    </p>
  ) : null;
}
