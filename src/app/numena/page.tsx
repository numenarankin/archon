import { redirect } from "next/navigation";

// Prospecting moved to /numena/prospecting. Redirect the old path so existing
// links and bookmarks still resolve.
export default function NumenaPage() {
  redirect("/numena/prospecting");
}
