import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui';
import { ThemeProvider } from './providers/ThemeProvider';
import { ProgressProvider } from './providers/ProgressProvider';
import { router } from './router';

export function App() {
  return (
    <ErrorBoundary area="Application">
      <ThemeProvider>
        <ProgressProvider>
          <RouterProvider router={router} />
        </ProgressProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
