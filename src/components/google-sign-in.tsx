"use client";
import { useActionState } from "react";
import { signInWithGoogle } from "@/app/login/google-actions";

export function GoogleSignIn({ returnPath }: { returnPath: string }) {
  const [state, action, pending] = useActionState(signInWithGoogle, {});
  return (
    <form action={action} className="grid gap-3" aria-label="Acceso con Google">
      <input type="hidden" name="next" value={returnPath} />
      <button
        className="button-secondary w-full"
        type="submit"
        disabled={pending}
      >
        {pending ? "Abriendo Google…" : "Continuar con Google"}
      </button>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
