"use client";

import { LoadingScreen, MessageScreen, RequireAuth, TopBar } from "@/components/AppShell";
import { Workspace } from "@/components/script/Workspace";
import { useAuth } from "@/lib/auth";
import { useDataset } from "@/lib/dataset";

function Scripts() {
  const { state } = useAuth();
  const dataset = useDataset(state.status === "ready");

  if (dataset.status === "loading") return <LoadingScreen label="Cargando clínicas…" />;
  if (dataset.status === "error") {
    return (
      <MessageScreen title="No se pudieron cargar los datos">
        <p>{dataset.message}</p>
      </MessageScreen>
    );
  }
  if (dataset.clinics.length === 0) {
    return (
      <MessageScreen title="Todavía no hay clínicas publicadas">
        <p>Cuando se publique la Master por primera vez, aparecerán aquí.</p>
      </MessageScreen>
    );
  }
  return <Workspace dataset={dataset} header={<TopBar />} />;
}

export default function HomePage() {
  return (
    <RequireAuth>
      <Scripts />
    </RequireAuth>
  );
}
