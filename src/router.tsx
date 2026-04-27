/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Link } from 'react-router-dom';
import { AppLayout } from '@/components/Layout/AppLayout';
import ViewerPage from '@/modules/viewer/ViewerPage';

const HomePage = lazy(() => import('@/modules/home/HomePage'));
const TrainerPage = lazy(() => import('@/modules/trainer/TrainerPage'));
const EditorPage = lazy(() => import('@/modules/editor/EditorPage'));

function PageFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full min-h-[40vh] items-center justify-center text-sm text-content-muted"
    >
      Loading…
    </div>
  );
}

function NotFoundPage() {
  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-content-muted">
        404
      </p>
      <h1 className="text-2xl font-semibold text-content">Page not found</h1>
      <p className="max-w-sm text-sm text-content-muted">
        That route doesn't exist. Head back to the viewer to keep exploring.
      </p>
      <Link
        to="/viewer"
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        Go to Viewer
      </Link>
    </div>
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<PageFallback />}>
              <HomePage />
            </Suspense>
          ),
        },
        { path: 'viewer', element: <ViewerPage /> },
        {
          path: 'trainer',
          element: (
            <Suspense fallback={<PageFallback />}>
              <TrainerPage />
            </Suspense>
          ),
        },
        {
          path: 'editor',
          element: (
            <Suspense fallback={<PageFallback />}>
              <EditorPage />
            </Suspense>
          ),
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
);
