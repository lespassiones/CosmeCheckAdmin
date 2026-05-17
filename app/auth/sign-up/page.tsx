import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAdmin, getAdminUser } from "@/lib/authGuard";
import { SignUpForm } from "./SignUpForm";

export const metadata = {
  title: "Création du compte admin · CosmetWiki Admin",
  robots: { index: false, follow: false },
};

export default async function SignUpPage() {
  // Already signed in → go home.
  const me = await getAdminUser();
  if (me) redirect("/");

  // An admin is already enrolled → only allow sign-in from now on.
  if (await hasAdmin()) redirect("/auth/sign-in");

  return (
    <main className="min-h-svh flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md glass-card p-8">
        <div className="text-center mb-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            CosmetWiki · Admin
          </p>
          <h1 className="text-[26px] font-bold tracking-tight">
            Crée le compte admin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Un seul compte admin est autorisé sur ce dashboard. Une fois créé,
            cette page sera désactivée.
          </p>
        </div>

        <SignUpForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tu as déjà un compte ?{" "}
          <Link href="/auth/sign-in" className="font-medium text-rose-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </section>
    </main>
  );
}
