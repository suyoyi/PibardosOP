"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/config";
import { loginSchema, signupSchema, safeReturnPath } from "@/domain/auth";

export type AuthState = { error?: string; message?: string };
export async function authenticate(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!getSupabaseConfig())
    return { error: "Configura la conexión de Supabase para acceder." };
  const isSignup = form.get("intent") === "signup";
  const result = (isSignup ? signupSchema : loginSchema).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!result.success) return { error: result.error.issues[0].message };
  try {
    const client = await createClient();
    const response = isSignup
      ? await client.auth.signUp(result.data)
      : await client.auth.signInWithPassword(result.data);
    if (response.error)
      return {
        error: isSignup
          ? "No se pudo crear la cuenta. Revisa los datos o inténtalo más tarde."
          : "No se pudo acceder. Revisa el correo, la contraseña y la confirmación de tu cuenta.",
      };
    if (isSignup && !response.data.session)
      return {
        message: "Revisa tu correo para confirmar la cuenta antes de acceder.",
      };
  } catch {
    return {
      error: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.",
    };
  }
  redirect(safeReturnPath(String(form.get("next") ?? "/")));
}

export async function signOut() {
  const client = await createClient();
  const { error } = await client.auth.signOut();
  if (error)
    throw new Error("No se pudo cerrar la sesión. Inténtalo de nuevo.");
  redirect("/login");
}
