import { Suspense } from 'react';
import { getUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface DashboardLayoutProps {
  children: React.ReactNode;
  liveTenderFeed: React.ReactNode;
}

export default async function DashboardLayout({ children, liveTenderFeed }: DashboardLayoutProps) {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">CompraTransparente</h1>
      </header>
      <div className="flex flex-1">
        <main className="flex-1 p-6">{children}</main>
        <aside className="w-80 border-l p-4">
          <Suspense fallback={<div className="animate-pulse">Cargando licitaciones...</div>}>
            {liveTenderFeed}
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
