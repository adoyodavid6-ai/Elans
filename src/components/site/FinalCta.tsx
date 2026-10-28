import { ButtonLink, Container } from "@/components/ui/primitives";

export function FinalCta({ title = "Find your three biggest automation opportunities this week.", body = "Ten minutes, free, with a scored report you keep. Or talk it through with us in a Strategy Session." }: { title?: string; body?: string }) {
  return (
    <section className="bg-brown text-ivory" aria-labelledby="final-cta-h">
      <Container className="flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 id="final-cta-h" className="font-display text-3xl font-semibold leading-tight text-ivory sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 text-lg text-sand/85">{body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/assessment" variant="light" size="lg" icon="arrow-right">
            Start the assessment
          </ButtonLink>
          <ButtonLink href="/sessions" variant="outline-light" size="lg">
            Book a session
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

