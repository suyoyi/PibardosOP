import { collectionEnabled } from "@/lib/features";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { PageHeading } from "@/components/ui";
export default async function SettingsPage() {
  const { user } = await requireUser();
  return (
    <>
      <PageHeading
        eyebrow="TU ESPACIO PERSONAL"
        title="Ajustes"
        description="Gestiona tu sesión."
      />
      {collectionEnabled && (
        <nav aria-label="Mis cartas" className="mb-6 flex flex-wrap gap-3">
          <Link className="button-secondary" href="/collection">
            Mi colección
          </Link>
          <Link className="button-secondary" href="/wishlist">
            Lista de deseos
          </Link>
        </nav>
      )}
      <section className="panel max-w-xl p-6">
        <h2 className="font-semibold">Cuenta</h2>
        <p className="mt-3 break-all text-sm text-muted">{user.email}</p>
        <form action={signOut} className="mt-6">
          <button className="button-secondary" type="submit">
            Cerrar sesión
          </button>
        </form>
      </section>
    </>
  );
}
