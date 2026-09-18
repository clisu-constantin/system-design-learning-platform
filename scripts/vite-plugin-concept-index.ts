import { build } from 'esbuild';
import { resolve } from 'node:path';
import { normalizePath, type Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:concept-index';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const ENTRY = 'src/data/concepts/summaries.ts';

/**
 * Serves `virtual:concept-index`: the light per-concept summary the whole app
 * navigates by, computed from the full catalogue at build time.
 *
 * The catalogue is ~200 KB of lesson text. Importing it anywhere in the shell
 * (sidebar, search, progress) would put all of it in the main bundle, so this
 * plugin bundles src/data/concepts/summaries.ts with esbuild - the same way
 * scripts/check-content.mjs reads the data - runs it, and inlines only the
 * resulting summaries as JSON. The lesson files themselves stay lazy chunks.
 *
 * In dev every file the summary was built from is watched; editing one
 * rebuilds the index and reloads the page.
 */
export function conceptIndex(): Plugin {
  let root = process.cwd();
  let inputs = new Set<string>();

  return {
    name: 'concept-index',

    configResolved(config) {
      root = config.root;
    },

    resolveId(source) {
      return source === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null;

      const result = await build({
        absWorkingDir: root,
        entryPoints: [ENTRY],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
        metafile: true,
        logLevel: 'silent',
      });

      inputs = new Set(Object.keys(result.metafile.inputs).map((file) => normalizePath(resolve(root, file))));
      for (const file of inputs) this.addWatchFile(file);

      const code = result.outputFiles[0].text;
      const module = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as {
        SUMMARIES: unknown[];
      };

      return `export default ${JSON.stringify(module.SUMMARIES)};`;
    },

    handleHotUpdate({ file, server }) {
      if (!inputs.has(normalizePath(file))) return;
      const module = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: 'full-reload' });
    },
  };
}
