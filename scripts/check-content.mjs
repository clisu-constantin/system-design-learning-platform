/**
 * Coverage check for the long-form teaching content.
 *
 * The Lesson under each concept Diagram is assembled from src/data/concepts/deep.
 * A concept missing its entry renders as three short cards, which is the failure
 * this app exists to avoid. This asserts every concept carries the full teaching payload,
 * and that the payload is not a stub. Run with `npm run check:content`.
 *
 * It also holds the Concept standard: every Concept hosts a registered Lab and a Quiz of at
 * least ten questions, and every Lab renders a DiagramCanvas; see checkConceptStandard below.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'sdi-content-'));

// Minimums, not targets. They catch a stub; they do not grade the writing.
const MIN_ANALOGY_CHARS = 120;
const MIN_DEEP_SECTIONS = 2;
const MIN_SECTION_CHARS = 200;
const MIN_WALKTHROUGH_STEPS = 3;
const MIN_JARGON_TERMS = 4;
const MIN_REMEMBER_LINES = 3;
const MIN_QUIZ_QUESTIONS = 10;
// Four options would put the right one longest or shortest about a quarter of the time each.
const MAX_ANSWER_LENGTH_TELL = 0.35;

const REGISTRY = 'src/features/labs/registry.ts';

/** Lab rows of the registry as { id, file }, read from source - it imports React, so it is not run. */
function registeredLabs(problems) {
  const source = readFileSync(REGISTRY, 'utf8');
  const labs = [];
  for (const [, id, from] of source.matchAll(/\bid:\s*'([^']+)'[\s\S]*?import\('([^']+)'\)/g))
    labs.push({ id, file: resolveModule(from, REGISTRY) });
  // Each row pairs its id with the next lazy import, so a row without one would steal a file.
  const rows = source.match(/lazyWithRetry\(\(\) => import\(/g)?.length ?? 0;
  if (rows !== labs.length) problems.push(`${REGISTRY}: read ${labs.length} Lab ids but ${rows} lazy imports - update registeredLabs`);
  return labs;
}

/** A module specifier as a source file path, or undefined for a package. */
function resolveModule(from, importer) {
  let base;
  if (from.startsWith('@/')) base = join('src', from.slice(2));
  else if (from.startsWith('.')) base = join(dirname(importer), from);
  else return undefined;
  return ['', '.tsx', '.ts', '/index.tsx', '/index.ts'].map((ext) => base + ext).find((file) => existsSync(file) && statSync(file).isFile());
}

/** Local name -> { from, name } for every value import of a file. */
function importsOf(file, source) {
  const names = new Map();
  for (const [, clause, from] of source.matchAll(/^import\s+(?!type\s)([^'";]*?)\s+from\s+'([^']+)'/gm)) {
    const resolved = resolveModule(from, file);
    if (!resolved || clause.includes('*')) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    const defaultName = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
    if (defaultName) names.set(defaultName, { from: resolved, name: 'default' });
    for (const part of named ? named[1].split(',') : []) {
      const [imported, local = imported] = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
      if (imported && !part.trim().startsWith('type ')) names.set(local, { from: resolved, name: imported });
    }
  }
  return names;
}

/** The file that defines `name` when it is imported from `file`, following barrel re-exports. */
function definingFile(file, name, seen = new Set()) {
  if (!file || seen.has(file)) return undefined;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  const defines = name === 'default' ? /^export\s+default\b/m : new RegExp(`\\b(function|const|class)\\s+${name}\\b`);
  if (defines.test(source)) return file;
  for (const [, list, from] of source.matchAll(/^export\s+\{([^}]*)\}\s+from\s+'([^']+)'/gm)) {
    const hit = list
      .split(',')
      .map((part) => part.trim().split(/\s+as\s+/))
      .find(([imported, exported = imported]) => exported === name);
    if (hit) return definingFile(resolveModule(from, file), hit[0], seen);
  }
  for (const [, from] of source.matchAll(/^export\s+\*\s+from\s+'([^']+)'/gm)) {
    const found = definingFile(resolveModule(from, file), name, seen);
    if (found) return found;
  }
  return undefined;
}

/**
 * Whether a file renders a DiagramCanvas: it writes `<DiagramCanvas` itself, or it renders a
 * component imported from a file that does (FlowVisual, for one). A static read, not a render -
 * enough to catch a Lab built without the shared diagram.
 */
function rendersDiagram(file, seen = new Set()) {
  if (!file || seen.has(file)) return false;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  if (/<DiagramCanvas\b/.test(source)) return true;
  const imports = importsOf(file, source);
  for (const [, tag] of source.matchAll(/<([A-Z]\w*)/g)) {
    const imported = imports.get(tag);
    if (imported && rendersDiagram(definingFile(imported.from, imported.name), seen)) return true;
  }
  return false;
}

/**
 * Option length must not give the answer away. Per Category, the right option may be the strictly
 * longest (or strictly shortest) option in at most MAX_ANSWER_LENGTH_TELL of the questions - a
 * learner who always picks the longest answer should not pass.
 */
function checkAnswerLengthTell(concepts, problems) {
  const byCategory = new Map();
  for (const concept of concepts)
    for (const question of concept.quiz ?? []) {
      const lengths = question.options.map((option) => option.length);
      const right = lengths[question.answer];
      const others = lengths.filter((_, index) => index !== question.answer);
      const tally = byCategory.get(concept.category) ?? { total: 0, longest: 0, shortest: 0 };
      tally.total += 1;
      if (others.every((length) => length < right)) tally.longest += 1;
      if (others.every((length) => length > right)) tally.shortest += 1;
      byCategory.set(concept.category, tally);
    }
  for (const [category, { total, longest, shortest }] of byCategory)
    for (const [word, count] of [['longest', longest], ['shortest', shortest]])
      if (count / total > MAX_ANSWER_LENGTH_TELL)
        problems.push(
          `Quiz of category '${category}': the right option is the ${word} in ${count} of ${total} questions - reword options so length does not give the answer away`,
        );
}

/** The Concept standard: every Concept hosts a registered Lab and a Quiz, and every Lab draws its system. */
function checkConceptStandard(concepts, problems) {
  const labs = registeredLabs(problems);
  const labIds = new Set(labs.map((lab) => lab.id));

  for (const concept of concepts) {
    if (!concept.lab) problems.push(`${concept.slug}: hosts no Lab - set \`lab\` to a registered LabId`);
    else if (!labIds.has(concept.lab)) problems.push(`${concept.slug}: lab '${concept.lab}' is not in ${REGISTRY}`);
    const questions = (concept.quiz ?? []).length;
    if (questions < MIN_QUIZ_QUESTIONS)
      problems.push(`${concept.slug}: ${questions} quiz question(s), expected at least ${MIN_QUIZ_QUESTIONS}`);
  }
  for (const lab of labs)
    if (!rendersDiagram(lab.file))
      problems.push(`Lab ${lab.id}: does not render a DiagramCanvas (checked ${lab.file ?? 'an unresolved import'})`);
}

try {
  // One entry per category lesson file, so the check can see which file holds which concept.
  const categoryFiles = Object.fromEntries(
    readdirSync('src/data/concepts')
      .filter((file) => file.endsWith('.ts') && !['index.ts', 'all.ts', 'summaries.ts', 'merged.ts'].includes(file))
      .map((file) => [`category-${file.replace(/\.ts$/, '')}`, `src/data/concepts/${file}`]),
  );

  await build({
    // all.ts, not index.ts: the app index is generated by a Vite plugin and is not plain TypeScript.
    entryPoints: {
      concepts: 'src/data/concepts/all.ts',
      deep: 'src/data/concepts/deep/index.ts',
      merged: 'src/data/concepts/merged.ts',
      ...categoryFiles,
    },
    bundle: true,
    splitting: true, // the depth modules are loaded with dynamic import on purpose
    platform: 'node',
    format: 'esm',
    outdir: dir,
    outExtension: { '.js': '.mjs' },
    logLevel: 'error',
  });

  const { ALL_CONCEPTS: CONCEPTS } = await import(pathToFileURL(join(dir, 'concepts.mjs')).href);
  const { loadDepth, DEPTH_CATEGORIES } = await import(pathToFileURL(join(dir, 'deep.mjs')).href);
  const { MERGED_CONCEPTS } = await import(pathToFileURL(join(dir, 'merged.mjs')).href);
  const problems = [];

  // A merged Concept keeps its old slug only as a redirect. The redirect must land on a live
  // Concept, the old slug must not come back as a Concept of its own (the redirect would hide
  // it), and no `related` list may point at it - resolveRelated would silently drop the link.
  const liveSlugs = new Set(CONCEPTS.map((concept) => concept.slug));
  for (const [retired, kept] of Object.entries(MERGED_CONCEPTS)) {
    if (liveSlugs.has(retired)) problems.push(`${retired}: merged into '${kept}' but still a Concept of its own`);
    if (!liveSlugs.has(kept)) problems.push(`${retired}: merged into '${kept}', which is not a Concept`);
  }
  for (const concept of CONCEPTS) {
    for (const slug of concept.related ?? [])
      if (MERGED_CONCEPTS[slug]) problems.push(`${concept.slug}: related '${slug}' was merged into '${MERGED_CONCEPTS[slug]}'`);
  }

  // loadConcept fetches src/data/concepts/<category>.ts, so a concept filed
  // anywhere else would exist in the index but never load on its own page.
  const fileOf = new Map();
  for (const category of DEPTH_CATEGORIES) {
    const entry = `category-${category}`;
    if (!categoryFiles[entry]) {
      problems.push(`${category}: no src/data/concepts/${category}.ts - loadConcept has nothing to fetch`);
      continue;
    }
    const module = await import(pathToFileURL(join(dir, `${entry}.mjs`)).href);
    for (const concept of Object.values(module).find(Array.isArray) ?? []) fileOf.set(concept.slug, category);
  }
  for (const concept of CONCEPTS) {
    if (fileOf.get(concept.slug) !== concept.category)
      problems.push(
        `${concept.slug}: category is '${concept.category}' but it is not in src/data/concepts/${concept.category}.ts - its page could not load it`,
      );
  }

  // "Trade-off first" (CLAUDE.md): every concept states what its approach gains and what it
  // costs. A concept without one renders no Trade-offs chips; a one-sided entry is advocacy.
  for (const concept of CONCEPTS) {
    const at = (message) => problems.push(`${concept.slug}: ${message}`);
    const tradeoffs = concept.tradeoffs ?? [];
    if (!tradeoffs.length) at('no trade-offs - every concept must say what it gains and what it costs');
    for (const tradeoff of tradeoffs) {
      const filled = (list) => (list ?? []).filter((line) => typeof line === 'string' && line.trim()).length;
      if (!tradeoff.approach?.trim()) at('trade-off with an empty approach');
      if (!filled(tradeoff.gains)) at(`trade-off "${tradeoff.approach}" has no gains`);
      if (!filled(tradeoff.costs)) at(`trade-off "${tradeoff.approach}" has no costs`);
    }
  }

  checkConceptStandard(CONCEPTS, problems);
  checkAnswerLengthTell(CONCEPTS, problems);

  for (const concept of CONCEPTS) {
    const at = (message) => problems.push(`${concept.slug}: ${message}`);
    const depth = await loadDepth(concept.category, concept.slug);

    if (!depth) {
      at('no entry in src/data/concepts/deep - the Lesson under the Diagram would be nearly empty');
      continue;
    }

    if (!depth.analogy) at('no analogy - the lesson needs one memorable picture');
    else if ((depth.analogy.body ?? '').length < MIN_ANALOGY_CHARS)
      at(`analogy body is ${depth.analogy.body.length} chars, expected at least ${MIN_ANALOGY_CHARS}`);

    const sections = depth.deepDive ?? [];
    if (sections.length < MIN_DEEP_SECTIONS)
      at(`${sections.length} deep-dive section(s), expected at least ${MIN_DEEP_SECTIONS}`);
    for (const section of sections) {
      const prose = (section.paragraphs ?? []).join(' ');
      if (prose.length < MIN_SECTION_CHARS)
        at(`section "${section.heading}" has ${prose.length} chars of prose, expected ${MIN_SECTION_CHARS}+`);
    }

    const examples = depth.examples ?? [];
    if (!examples.length) at('no worked example - a junior needs concrete numbers');
    for (const example of examples) {
      if ((example.walkthrough ?? []).length < MIN_WALKTHROUGH_STEPS)
        at(`example "${example.title}" has fewer than ${MIN_WALKTHROUGH_STEPS} walkthrough steps`);
      if (!example.result) at(`example "${example.title}" has no result line`);
    }

    if ((depth.jargon ?? []).length < MIN_JARGON_TERMS)
      at(`${(depth.jargon ?? []).length} jargon term(s), expected at least ${MIN_JARGON_TERMS}`);
    if ((depth.remember ?? []).length < MIN_REMEMBER_LINES)
      at(`${(depth.remember ?? []).length} takeaway line(s), expected at least ${MIN_REMEMBER_LINES}`);
  }

  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} problem(s) in ${CONCEPTS.length} concepts`);
    process.exit(1);
  }

  console.log(`${CONCEPTS.length} concepts checked - lesson content present, Concept standard met`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
