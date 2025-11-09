import dynamic from "next/dynamic";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";

// Importação dinâmica do componente MapView (evita erro no SSR)
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function RotaPage() {
  const { loading, ok } = useRequireAuth({ role: "admin" });

  if (loading || !ok) return null;

  return (
    <AdminLayout title="Rotas e localização">
      <div className="admin-page">
        <section className="admin-section">
          <header className="admin-section-header">
            <div>
              <h2>Check-in com geolocalização</h2>
              <p className="muted">
                Utilize o mapa para registrar check-in e check-out próximos ao
                ponto de parada configurado.
              </p>
            </div>
          </header>

          <div className="card">
            <MapView />
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
