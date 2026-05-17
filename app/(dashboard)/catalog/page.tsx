import { redirect } from "next/navigation";

/** Catalog has no landing of its own — default to Products. */
export default function CatalogIndex() {
  redirect("/catalog/products");
}
