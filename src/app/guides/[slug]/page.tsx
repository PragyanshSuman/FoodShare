import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES } from "@/content/pages";
import { ContentView } from "@/components/content-page";

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => Object.keys(GUIDES).map((slug) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: GUIDES[(await params).slug]?.title };
}

export default async function GuidePage({ params }: Props) {
  const page = GUIDES[(await params).slug];
  if (!page) notFound();
  return <ContentView page={page} />;
}
