import { requireUser } from "@/lib/auth";
import { ProfileForms } from "@/components/profile";
import { SiteHeader } from "@/components/site-ui";

export const metadata = { title: "Profile" };

export default async function SiteProfile() {
  const u = await requireUser();
  return <><SiteHeader title="Profile" back="/site/more" /><div className="p-5"><ProfileForms user={u} mobile /></div></>;
}
