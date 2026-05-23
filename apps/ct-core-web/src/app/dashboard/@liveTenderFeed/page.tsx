// Parallel route slot: feed en vivo de licitaciones nuevas.
// Si este slot falla, el resto del dashboard sigue funcionando.
export default async function LiveTenderFeedSlot() {
  // TODO: consumir ct-core-api GET /licitaciones y hacer streaming con Suspense
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Licitaciones recientes
      </h3>
      <p className="text-sm text-gray-400">Feed pendiente de implementación.</p>
    </div>
  );
}
