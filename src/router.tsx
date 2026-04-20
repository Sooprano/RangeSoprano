/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/Layout/AppLayout';
import ViewerPage from '@/modules/viewer/ViewerPage';

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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/viewer" replace /> },
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
      { path: '*', element: <Navigate to="/viewer" replace /> },
    ],
  },
]);
