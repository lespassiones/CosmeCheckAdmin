import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAdmin, getAdminUser } from "@/lib/authGuard";
import { SignInForm } from "./SignInForm";

export const metadata = {
  title: "Connexion · CosmetWiki Admin",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  // Already signed in → go home.
  const me = await getAdminUser();
  if (me) redirect("/");

  // No admin enrolled yet → invite them to sign up.
  const enrolled = await hasAdmin();

  return (
    <main className="min-h-svh flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md glass-card p-8">
        <div className="text-center mb-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            CosmetWiki · Admin
          </p>
          <h1 className="text-[26px] font-bold tracking-tight">
            {enrolled ? "Connexion admin" : "Premier accès"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {enrolled
              ? "Entre tes identifiants pour accéder au tableau de bord."
              : "Crée le compte admin unique de ce dashboard."}
          </p>
        </div>

        <SignInForm />

        {!enrolled && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Pas encore inscrit ?{" "}
            <Link href="/auth/sign-up" className="font-medium text-rose-600 hover:underline">
              Créer le compte admin
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
