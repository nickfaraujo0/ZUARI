import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";

export default async function Root() {
  const u = await getUser();
  redirect(u ? homeFor(u) : "/login");
}
