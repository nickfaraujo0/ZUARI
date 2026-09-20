import { requireUser } from "@/lib/auth";
import { ProfileForms } from "@/components/profile";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const u = await requireUser();
  return <><PageHeader title="Profile" sub={u.company.name} /><div className="max-w-xl"><ProfileForms user={u} vapidKey={process.env.VAPID_PUBLIC_KEY ?? null} /></div></>;
}
