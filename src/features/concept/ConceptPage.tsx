import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  FlaskConical,
  HelpCircle,
  Languages,
  Lightbulb,
  Loader2,
  Minus,
  Play,
  Plus,
  Scale,
  Sparkles,
} from 'lucide-react';
import { ConceptHeader, AsciiBlock, ExplanationCard, QuizCard } from '@/components/learning';
import { Badge, Button, ErrorBoundary, Expandable, Tabs, type TabItem } from '@/components/ui';
import { FlowVisual, SequenceFlow } from '@/components/architecture/FlowVisual';
import { getConcept, loadConcept, peekConcept, resolveRelated } from '@/data/concepts';
import { loadDepth } from '@/data/concepts/deep';
import { getVisual } from '@/data/visuals';
import { useProgress } from '@/app/providers/ProgressProvider';
import { getLab } from '@/features/labs/registry';
import { cn } from '@/utils/cn';
import type {
  Analogy,
  Concept,
  ConceptDepth,
  ConceptSummary,
  DeepDiveSection,
  JargonTerm,
  WorkedExample,
} from '@/types';

/** Keeps sidebar chips to one readable line instead of a paragraph. */
const short = (text: string, max = 78) => {
  const clean = text.split(' - ')[0].split('. ')[0].replace(/\.$/, '');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}...` : clean;
};

export function ConceptPage() {
  const { slug } = useParams();
  // The index answers "does it exist" and draws the header at once; the lesson
  // itself arrives with its category chunk.
  const summary = getConcept(slug);
  const { concept, failed } = useFullConcept(summary);
  const { markVisited } = useProgress();

  useEffect(() => {
    if (summary) markVisited(summary.slug);
  }, [summary, markVisited]);

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">Concept not found</h1>
        <p className="mt-2 text-sm text-muted">Press Ctrl+K to search, or browse a category.</p>
        <Link to="/" className="mt-6 inline-block text-sm text-brand hover:underline">
          Back to the dashboard
        </Link>
      </div>
    );
  }

  return (
    <article>
      <ConceptHeader concept={summary} />
      {concept ? (
        <ConceptBody concept={concept} />
      ) : failed ? (
        <div className="mx-auto max-w-2xl px-5 py-12 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-danger" aria-hidden />
          <p className="mt-2 text-sm text-ink">This lesson could not be loaded.</p>
          <p className="mt-1 text-xs text-muted">
            Usually a new version was deployed while the page was open. Reloading fetches it.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading lesson...
        </div>
      )}
    </article>
  );
}

/**
 * The full lesson for a concept from the index. A category is one chunk, so
 * the first concept opened in it fetches it and the rest render immediately
 * from memory. Retries once for the same stale-deploy reason as useConceptDepth.
 */
function useFullConcept(summary: ConceptSummary | undefined): { concept?: Concept; failed: boolean } {
  const category = summary?.category;
  const slug = summary?.slug;
  const [state, setState] = useState<{ slug?: string; concept?: Concept; failed: boolean }>({ failed: false });
  const cached = category && slug ? peekConcept(category, slug) : undefined;

  useEffect(() => {
    if (!category || !slug || peekConcept(category, slug)) return;
    let current = true;
    const load = () => loadConcept(category, slug);

    load()
      .catch(() => new Promise((resolve) => setTimeout(resolve, 400)).then(load))
      .then((concept) => {
        if (current) setState({ slug, concept, failed: !concept });
      })
      .catch(() => {
        if (current) setState({ slug, failed: true });
      });

    return () => {
      current = false;
    };
  }, [category, slug]);

  if (cached) return { concept: cached, failed: false };
  // Ignore a result that belongs to the previous slug.
  return state.slug === slug ? state : { failed: false };
}

function ConceptBody({ concept }: { concept: Concept }) {
  const related = useMemo(() => resolveRelated(concept), [concept]);
  const lab = concept.lab ? getLab(concept.lab) : undefined;
  const visual = getVisual(concept.slug);

  const tabs = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [];

    if (visual) {
      items.push({
        id: 'diagram',
        label: 'Diagram',
        icon: <Play className="h-3.5 w-3.5" />,
        content: <FlowVisual spec={visual} />,
      });

      if (visual.steps?.length) {
        items.push({
          id: 'steps',
          label: 'Step by step',
          icon: <ArrowRight className="h-3.5 w-3.5" />,
          content: <SequenceFlow spec={visual} />,
        });
      }
    }

    if (lab) {
      items.push({
        id: 'lab',
        label: 'Interactive lab',
        icon: <FlaskConical className="h-3.5 w-3.5" />,
        content: (
          <ErrorBoundary area={lab.title}>
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading simulation...
                </div>
              }
            >
              <lab.Component />
            </Suspense>
          </ErrorBoundary>
        ),
      });
    }

    if (concept.tradeoffs?.length) {
      items.push({
        id: 'tradeoffs',
        label: 'Trade-offs',
        icon: <Scale className="h-3.5 w-3.5" />,
        content: <TradeOffBoard concept={concept} />,
      });
    }

    if (concept.quiz?.length) {
      items.push({
        id: 'quiz',
        label: 'Quiz',
        icon: <HelpCircle className="h-3.5 w-3.5" />,
        content: <QuizCard questions={concept.quiz} slug={concept.slug} />,
      });
    }

    items.push({
      id: 'detail',
      label: 'Full explanation',
      icon: <BookOpen className="h-3.5 w-3.5" />,
      content: <DeepDive concept={concept} />,
    });

    return items;
  }, [concept, lab, visual]);

  const when = concept.when ?? [];
  const costs = concept.tradeoffs?.[0]?.costs ?? [];
  const gains = concept.advantages ?? concept.tradeoffs?.[0]?.gains ?? [];

  return (
    <div className="px-5 py-5 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Diagram first - it is the content, not an illustration */}
        <div className="min-w-0">
          <Tabs items={tabs} />
        </div>

        {/* Short notes only. Anything longer lives in Full explanation. */}
        <aside className="space-y-3 xl:sticky xl:top-[4.5rem] xl:self-start">
          {concept.what ? (
            <div className="card p-4">
              <p className="label mb-1.5">In one line</p>
              <p className="text-sm leading-relaxed text-ink">{short(concept.what, 150)}.</p>
            </div>
          ) : null}

          {lab ? (
            <Link
              to={`/labs/${lab.id}`}
              className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-4 transition-colors hover:bg-brand/10"
            >
              <FlaskConical className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-brand">Open the lab</span>
                <span className="block truncate text-[11px] text-muted">{lab.title}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand" />
            </Link>
          ) : null}

          {when.length ? (
            <div className="card p-4">
              <p className="label mb-2 text-ok">Use it when</p>
              <ul className="space-y-1.5">
                {when.slice(0, 3).map((item) => (
                  <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                    {short(item, 90)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {costs.length ? (
            <div className="card p-4">
              <p className="label mb-2 text-danger">What it costs</p>
              <ul className="space-y-1.5">
                {costs.slice(0, 3).map((item) => (
                  <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                    {short(item, 90)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {gains.length ? (
            <div className="card p-4">
              <p className="label mb-2 text-brand">What you gain</p>
              <ul className="space-y-1.5">
                {gains.slice(0, 3).map((item) => (
                  <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    {short(item, 90)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {related.length ? (
            <div className="card p-4">
              <p className="label mb-2">Next</p>
              <div className="flex flex-wrap gap-1.5">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/concepts/${item.slug}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-brand hover:text-brand"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** Gains and costs as compact chips rather than prose. */
function TradeOffBoard({ concept }: { concept: Concept }) {
  return (
    <div className="space-y-3">
      {(concept.tradeoffs ?? []).map((tradeoff) => (
        <div key={tradeoff.approach} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line bg-elevated px-4 py-2.5">
            <h3 className="text-sm font-semibold text-ink">{tradeoff.approach}</h3>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2">
            {(
              [
                ['Gain', tradeoff.gains, 'ok', Plus],
                ['Cost', tradeoff.costs, 'danger', Minus],
              ] as const
            ).map(([label, list, tone, Icon]) => (
              <div key={label} className="bg-surface p-3">
                <p className={cn('label mb-2', tone === 'ok' ? 'text-ok' : 'text-danger')}>{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((item) => (
                    <span
                      key={item}
                      className={cn(
                        'inline-flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug',
                        tone === 'ok' ? 'border-ok/30 bg-ok/5 text-muted' : 'border-danger/30 bg-danger/5 text-muted',
                      )}
                    >
                      <Icon className={cn('mt-0.5 h-3 w-3 shrink-0', tone === 'ok' ? 'text-ok' : 'text-danger')} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {concept.mistakes?.length ? (
        <div className="rounded-2xl border border-warn/30 bg-warn/5 p-4">
          <p className="label mb-2 flex items-center gap-1.5 text-warn">
            <AlertTriangle className="h-3.5 w-3.5" />
            Common mistakes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {concept.mistakes.map((item) => (
              <span
                key={item}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] leading-snug text-muted"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="px-1 text-xs text-faint">
        Neither column wins on its own. Which one matters depends on your requirements.
      </p>
    </div>
  );
}

/**
 * The long-form lesson. Ordered the way a junior actually learns a new idea:
 * a picture they already understand, then the definition, then the mechanics,
 * then a worked example with real numbers, then the words to use for it.
 */
function DeepDive({ concept }: { concept: Concept }) {
  const { depth, failed } = useConceptDepth(concept);

  return (
    <div className="space-y-3">
      {depth ? <AnalogyCard analogy={depth.analogy} /> : null}
      {!depth && !failed ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the full lesson...
        </div>
      ) : null}
      {failed ? (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn/5 p-5 text-sm text-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>The extended lesson could not be loaded. Reload the page to try again.</span>
        </div>
      ) : null}

      {concept.what ? (
        <ExplanationCard title="What is it?" tone="brand">
          {concept.what}
        </ExplanationCard>
      ) : null}
      {concept.why ? <ExplanationCard title="Why does it exist?">{concept.why}</ExplanationCard> : null}

      {depth?.deepDive.map((section) => <DeepDiveBlock key={section.heading} section={section} />)}

      {depth?.examples.map((example) => <ExampleCard key={example.title} example={example} />)}

      {concept.how?.length ? (
        <Expandable title="How it works, step by step" defaultOpen>
          <ol className="space-y-2">
            {concept.how.map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="font-mono text-[11px] text-faint">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Expandable>
      ) : null}
      {concept.diagram ? (
        <Expandable title="Plain-text sketch" hint="ASCII">
          <AsciiBlock>{concept.diagram}</AsciiBlock>
        </Expandable>
      ) : null}
      {concept.when?.length ? (
        <Expandable title="When to use it">
          <ul className="space-y-1.5">
            {concept.when.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Expandable>
      ) : null}
      {concept.realWorld?.length ? (
        <Expandable title="In production">
          <ul className="space-y-1.5">
            {concept.realWorld.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Expandable>
      ) : null}
      {concept.mistakes?.length ? (
        <Expandable title="Common mistakes">
          <ul className="space-y-1.5">
            {concept.mistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Expandable>
      ) : null}

      {depth ? <JargonCard terms={depth.jargon} /> : null}
      {depth ? <RememberCard lines={depth.remember} /> : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge>{concept.difficulty}</Badge>
        {(concept.keywords ?? []).slice(0, 6).map((keyword) => (
          <Badge key={keyword}>{keyword}</Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * Fetches the long-form content for this concept. It is a separate chunk per
 * category, so nothing of it is downloaded until a learner opens this tab.
 *
 * The retry is the same problem `lazyWithRetry` solves: after a redeploy the
 * open document points at a chunk that no longer exists. Here that must not
 * take the page down, so a second failure degrades to the short explanation
 * plus a note, rather than an endless spinner.
 */
function useConceptDepth(concept: Concept): { depth?: ConceptDepth; failed: boolean } {
  const [state, setState] = useState<{ depth?: ConceptDepth; failed: boolean }>({ failed: false });

  useEffect(() => {
    let current = true;
    setState({ failed: false });

    const load = () => loadDepth(concept.category, concept.slug);

    load()
      .catch(() => new Promise((resolve) => setTimeout(resolve, 400)).then(load))
      .then((depth) => {
        if (current) setState({ depth, failed: !depth });
      })
      .catch(() => {
        if (current) setState({ failed: true });
      });

    return () => {
      current = false;
    };
  }, [concept.category, concept.slug]);

  return state;
}

/** The picture the learner already has in their head, borrowed for the concept. */
function AnalogyCard({ analogy }: { analogy: Analogy }) {
  return (
    <section className="flex gap-3 rounded-2xl border border-violet/30 bg-violet/5 p-5">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
      <div className="min-w-0">
        <p className="label text-violet">Think of it like</p>
        <h3 className="mt-1 text-sm font-semibold text-ink">{analogy.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{analogy.body}</p>
      </div>
    </section>
  );
}

/** One long-form teaching section: prose, optional bullets, optional snippet. */
function DeepDiveBlock({ section }: { section: DeepDiveSection }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-ink">{section.heading}</h3>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-muted">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {section.bullets?.length ? (
        <ul className="mt-3 space-y-2">
          {section.bullets.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-faint" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {section.code ? (
        <div className="mt-3">
          {section.code.caption ? (
            <p className="mb-1.5 text-[11px] text-faint">{section.code.caption}</p>
          ) : null}
          <AsciiBlock>{section.code.body}</AsciiBlock>
        </div>
      ) : null}
    </section>
  );
}

/** Numbers make an abstract idea concrete, and concrete ideas are remembered. */
function ExampleCard({ example }: { example: WorkedExample }) {
  return (
    <section className="rounded-2xl border border-info/30 bg-info/5 p-5">
      <p className="label flex items-center gap-1.5 text-info">
        <Calculator className="h-3.5 w-3.5" aria-hidden />
        Worked example
      </p>
      <h3 className="mt-1 text-sm font-semibold text-ink">{example.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{example.setup}</p>
      <ol className="mt-3 space-y-2">
        {example.walkthrough.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-muted">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-info/40 font-mono text-[10px] text-info">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-info/20 pt-3 text-sm leading-relaxed text-ink">{example.result}</p>
    </section>
  );
}

/** The words seniors say without explaining them. */
function JargonCard({ terms }: { terms: JargonTerm[] }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="label flex items-center gap-1.5">
        <Languages className="h-3.5 w-3.5" aria-hidden />
        Jargon decoder
      </p>
      <dl className="mt-3 space-y-2.5">
        {terms.map((term) => (
          <div key={term.term} className="grid gap-1 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:gap-3">
            <dt className="text-sm font-medium text-ink">{term.term}</dt>
            <dd className="text-sm leading-relaxed text-muted">{term.plain}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The few lines worth carrying out of the page. */
function RememberCard({ lines }: { lines: string[] }) {
  return (
    <section className="rounded-2xl border border-ok/30 bg-ok/5 p-5">
      <p className="label flex items-center gap-1.5 text-ok">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Remember this
      </p>
      <ul className="mt-3 space-y-2">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-ink">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ConceptPage;
