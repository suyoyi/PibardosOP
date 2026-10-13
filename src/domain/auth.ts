import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Introduce un correo válido.").trim().max(254),
  password: z.string().min(1, "Introduce tu contraseña.").max(128),
});
export const signupSchema = loginSchema.extend({
  password: z.string().min(12, "Usa al menos 12 caracteres.").max(128),
});

export function safeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
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
