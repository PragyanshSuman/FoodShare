import type { ContentPage } from "@/content/pages";

export function ContentView({ page }: { page: ContentPage }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-3 text-lg text-muted">{page.intro}</p>
      {page.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
