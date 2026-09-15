import { Suspense, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  FlaskConical,
  HelpCircle,
  Loader2,
  Minus,
  Play,
  Plus,
  Scale,
} from 'lucide-react';
import { ConceptHeader, AsciiBlock, ExplanationCard, QuizCard } from '@/components/learning';
import { Badge, ErrorBoundary, Expandable, Tabs, type TabItem } from '@/components/ui';
import { FlowVisual, SequenceFlow } from '@/components/architecture/FlowVisual';
import { getConcept, resolveRelated } from '@/data/concepts';
import { getVisual } from '@/data/visuals';
import { useProgress } from '@/app/providers/ProgressProvider';
import { getLab } from '@/features/labs/registry';
import { cn } from '@/utils/cn';

/** Keeps sidebar chips to one readable line instead of a paragraph. */
const short = (text: string, max = 78) => {
  const clean = text.split(' - ')[0].split('. ')[0].replace(/\.$/, '');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}...` : clean;
};

export function ConceptPage() {
  const { slug } = useParams();
  const concept = getConcept(slug);
  const { markVisited } = useProgress();

  useEffect(() => {
    if (concept) markVisited(concept.slug);
  }, [concept, markVisited]);

  const related = useMemo(() => (concept ? resolveRelated(concept) : []), [concept]);
  const lab = concept?.lab ? getLab(concept.lab) : undefined;
  const visual = concept ? getVisual(concept.slug) : undefined;

  const tabs = useMemo<TabItem[]>(() => {
    if (!concept) return [];
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

  if (!concept) {
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

  const when = concept.when ?? [];
  const costs = concept.tradeoffs?.[0]?.costs ?? [];
  const gains = concept.advantages ?? concept.tradeoffs?.[0]?.gains ?? [];

  return (
    <article>
      <ConceptHeader concept={concept} />

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
    </article>
  );
}

/** Gains and costs as compact chips rather than prose. */
function TradeOffBoard({ concept }: { concept: NonNullable<ReturnType<typeof getConcept>> }) {
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

/** All the prose, kept off the default path. */
function DeepDive({ concept }: { concept: NonNullable<ReturnType<typeof getConcept>> }) {
  return (
    <div className="space-y-3">
      {concept.what ? (
        <ExplanationCard title="What is it?" tone="brand">
          {concept.what}
        </ExplanationCard>
      ) : null}
      {concept.why ? <ExplanationCard title="Why does it exist?">{concept.why}</ExplanationCard> : null}
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
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge>{concept.difficulty}</Badge>
        {(concept.keywords ?? []).slice(0, 6).map((keyword) => (
          <Badge key={keyword}>{keyword}</Badge>
        ))}
      </div>
    </div>
  );
}

export default ConceptPage;
