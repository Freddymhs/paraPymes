import { getUser } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bienvenido</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="font-semibold">Mis oportunidades</h3>
        <p className="mt-2 text-sm text-gray-500">
          {/* TODO: consumir ct-core-api para mostrar licitaciones relevantes */}
          Conectando con la API de licitaciones...
        </p>
      </div>
    </div>
  );
}
