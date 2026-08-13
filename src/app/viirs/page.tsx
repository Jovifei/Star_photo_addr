import { redirect } from "next/navigation";

/** Backwards-compatible entry for old bookmarks and data-source links. */
export default function ViirsRedirect() {
  redirect("/?view=light-pollution");
}
