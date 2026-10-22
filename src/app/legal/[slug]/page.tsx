import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL } from "@/content/pages";
import { ContentView } from "@/components/content-page";

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => Object.keys(LEGAL).map((slug) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: LEGAL[(await params).slug]?.title };
}

export default async function LegalPage({ params }: Props) {
  const page = LEGAL[(await params).slug];
  if (!page) notFound();
  return <ContentView page={page} />;
}
