import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-6xl" aria-hidden>
        🥡
      </div>
      <h1 className="mt-4 text-2xl font-bold">This page has been picked up already</h1>
      <p className="mt-2 text-muted">It may have expired, been withdrawn, or never existed.</p>
      <ButtonLink href="/browse" className="mt-6">
        Find food nearby
      </ButtonLink>
    </div>
  );
}
