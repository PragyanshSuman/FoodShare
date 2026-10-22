import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth/guards";
import { isStaff } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/site-header";

/**
 * In-kind donation acknowledgement. Printed to PDF by the browser — no PDF
 * service to pay for. Not itself a tax receipt: in India the recipient NGO
 * issues the 80G receipt; in the US the recipient charity acknowledges gifts.
 */
export default async function CertificatePage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const user = await pageUser(`/certificates/${claimId}`);
  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      listing: { include: { owner: { select: { name: true } }, organization: { select: { name: true, registrationNumber: true } } } },
      claimant: { select: { name: true, organization: { select: { name: true, registrationNumber: true, taxExemptId: true } } } },
    },
  });
  if (!claim || claim.status !== "COMPLETED" || claim.listing.mode !== "DONATION") notFound();
  if (![claim.listing.ownerId, claim.claimantId].includes(user.id) && !isStaff(user)) notFound();

  const donor = claim.listing.organization?.name ?? claim.listing.owner.name;
  const recipient = claim.claimant.organization?.name ?? claim.claimant.name;
  const value = claim.listing.originalPriceCents ? claim.listing.originalPriceCents * claim.quantity : null;
  const number = `FS-${claim.completedAt!.getFullYear()}-${claim.id.slice(-8).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton label="Save as PDF" />
      </div>
      <div className="rounded-2xl border-2 border-brand-600 bg-white p-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold text-brand-700">
            <Logo size={36} /> FoodShare
          </div>
          <div className="text-right text-xs text-muted">
            Certificate no. <span className="font-mono">{number}</span>
            <br />
            Issued {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
          </div>
        </div>
        <h1 className="mt-10 text-center text-3xl font-bold tracking-tight">Certificate of Food Donation</h1>
        <p className="mx-auto mt-6 max-w-xl text-center text-lg">
          This certifies that <strong>{donor}</strong> donated surplus food to <strong>{recipient}</strong> on{" "}
          <strong>{claim.completedAt!.toLocaleDateString("en-IN", { dateStyle: "long" })}</strong>, verified by in-person handover code.
        </p>
        <table className="mx-auto mt-8 w-full max-w-xl text-sm">
          <tbody className="divide-y divide-line">
            <Row k="Item" v={claim.listing.title} />
            <Row k="Quantity" v={`${claim.quantity} ${claim.listing.unit}`} />
            <Row k="Weight" v={`${claim.kgSaved} kg`} />
            <Row k="Meals equivalent" v={String(claim.meals)} />
            <Row k="Emissions avoided" v={`${claim.co2eKg} kg CO₂e`} />
            {value != null && <Row k="Declared retail value" v={formatMoney(value, claim.listing.currency)} />}
            {claim.listing.organization?.registrationNumber && <Row k="Donor licence no." v={claim.listing.organization.registrationNumber} />}
            {claim.claimant.organization?.registrationNumber && <Row k="Recipient reg. no." v={claim.claimant.organization.registrationNumber} />}
            {claim.claimant.organization?.taxExemptId && <Row k="Recipient tax-exempt id" v={claim.claimant.organization.taxExemptId} />}
          </tbody>
        </table>
        <p className="mt-10 text-center text-xs text-muted">
          This is an acknowledgement of an in-kind donation recorded on FoodShare. Tax-deduction receipts (e.g. 80G in India) are issued by the recipient organisation.
          Verify at {process.env.APP_URL}/certificates/{claim.id}.
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="py-2 text-muted">{k}</td>
      <td className="py-2 text-right font-medium">{v}</td>
    </tr>
  );
}
