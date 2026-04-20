import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-full w-full bg-bg text-content">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
