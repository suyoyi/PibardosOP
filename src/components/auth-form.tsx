"use client";
import { useActionState, useState } from "react";
import { authenticate } from "@/app/login/actions";

export function AuthForm({ returnPath }: { returnPath: string }) {
  const [signup, setSignup] = useState(false);
  const [state, action, pending] = useActionState(authenticate, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="intent" value={signup ? "signup" : "login"} />
      <input type="hidden" name="next" value={returnPath} />
      <div>
        <label htmlFor="email" className="field-label">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          className="field"
          placeholder="tu@correo.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={signup ? 12 : 1}
          maxLength={128}
          className="field"
        />
        {signup && (
          <p className="mt-2 text-xs text-muted">
            Al menos 12 caracteres. Confirma tu correo si se solicita.
          </p>
        )}
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-lg border border-green-400/30 p-3 text-sm text-green-200"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        className="button-primary w-full"
        disabled={pending}
      >
        {pending
          ? "Conectando…"
          : signup
            ? "Crear cuenta"
            : "Entrar a mi espacio"}
      </button>
      <button
        type="button"
        className="min-h-11 w-full text-sm text-muted underline underline-offset-4"
        onClick={() => setSignup(!signup)}
      >
        {signup ? "Ya tengo una cuenta" : "Crear mi primera cuenta"}
      </button>
    </form>
  );
}
