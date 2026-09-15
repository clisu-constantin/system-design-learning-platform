import { Link } from 'react-router-dom';
import { Compass, FlaskConical, Layers3 } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <p className="font-mono text-sm text-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">This route does not exist</h1>
      <p className="mt-2 text-sm text-muted">
        No load balancer can route a request to a server that was never registered. Try one of these instead.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { to: '/', label: 'Dashboard', Icon: Compass },
          { to: '/labs', label: 'Interactive labs', Icon: FlaskConical },
          { to: '/playground', label: 'Playground', Icon: Layers3 },
        ].map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-5 text-sm text-ink transition-colors hover:border-brand hover:text-brand"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-faint">Press Ctrl+K to search everything.</p>
    </div>
  );
}

export default NotFoundPage;
