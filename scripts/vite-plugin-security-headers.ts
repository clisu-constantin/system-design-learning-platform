import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { contentSecurityPolicy, withContentSecurityPolicy } from './security-headers.ts';

/**
 * Writes dist/serve.json with a Content-Security-Policy that allows this
 * build's API and Firebase auth domain (see security-headers.ts).
 *
 * public/serve.json stays the template - Vite copies it into dist as it is, and
 * this rewrites the copy once the bundle is written. Only `vite build` runs it:
 * the dev server does not apply serve.json at all (`serve` does, in production).
 */
export function securityHeaders(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'security-headers',
    apply: 'build',

    configResolved(resolved) {
      config = resolved;
    },

    writeBundle() {
      const template = JSON.parse(readFileSync(join(config.publicDir, 'serve.json'), 'utf8'));
      const csp = contentSecurityPolicy({
        apiUrl: config.env.VITE_API_URL,
        firebaseAuthDomain: config.env.VITE_FIREBASE_AUTH_DOMAIN,
      });
      const target = resolve(config.root, config.build.outDir, 'serve.json');
      writeFileSync(target, `${JSON.stringify(withContentSecurityPolicy(template, csp), null, 2)}\n`);
    },
  };
}
