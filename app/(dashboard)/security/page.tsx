import { redirect } from "next/navigation";

// La Sécurité a fusionné dans la section « Système » (sous-onglet). On garde
// l'URL /security fonctionnelle en redirigeant vers le nouvel emplacement.
export default function SecurityRedirect() {
  redirect("/system/security");
}
