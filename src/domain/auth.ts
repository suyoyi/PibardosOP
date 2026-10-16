import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Introduce un correo válido.").trim().max(254),
  password: z.string().min(1, "Introduce tu contraseña.").max(128),
});
export const signupSchema = loginSchema.extend({
  password: z.string().min(12, "Usa al menos 12 caracteres.").max(128),
});

export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/";
  const parsed = new URL(value, "https://pibardos.invalid");
  if (
    parsed.origin !== "https://pibardos.invalid" ||
    parsed.pathname.startsWith("/login") ||
    parsed.pathname.startsWith("/auth")
  )
    return "/";
  return parsed.pathname + parsed.search;
}

export function googleCallbackUrl(origin: unknown, next: unknown): URL | null {
  if (typeof origin !== "string") return null;
  try {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      return null;
    const callback = new URL("/auth/callback", url.origin);
    callback.searchParams.set("next", safeReturnPath(next));
    return callback;
  } catch {
    return null;
  }
}

const googleErrors = {
  cancelled:
    "Has cancelado el acceso con Google. Puedes volver a intentarlo o entrar con tu correo.",
  failed:
    "No se pudo completar el acceso con Google. Vuelve a intentarlo desde este navegador o entra con tu correo.",
  unavailable:
    "El acceso con Google no está disponible ahora. Puedes entrar con tu correo y contraseña.",
} as const;
export function googleSignInError(reason: unknown): string | null {
  return typeof reason === "string" && Object.hasOwn(googleErrors, reason)
    ? googleErrors[reason as keyof typeof googleErrors]
    : null;
}
