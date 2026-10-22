import { pageUser } from "@/lib/auth/guards";
import { Notice, PageHeader } from "@/components/ui";
import { DeliveriesBoard } from "./board";

export default async function DeliveriesPage() {
  const user = await pageUser("/dashboard/deliveries");
  return (
    <div className="space-y-5">
      <PageHeader title="Volunteer deliveries" subtitle="Pick up from a donor, drop off with a recipient. Stipends are paid from the sponsor-funded Rescue Fund when it has money." />
      {!user.isVolunteer ? (
        <Notice>Turn on &ldquo;I volunteer for deliveries&rdquo; in Settings to see nearby tasks.</Notice>
      ) : user.lat == null ? (
        <Notice tone="warn">Set your home area in Settings so we can show deliveries near you.</Notice>
      ) : null}
      {user.isVolunteer && <DeliveriesBoard />}
    </div>
  );
}
