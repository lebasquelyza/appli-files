// apps/web/app/dashboard/profile/loading.tsx
export default function Loading() {
  return (
    <div
      className="container"
      style={{ paddingTop: 24, paddingBottom: 32, fontSize: "12px" }}
    >
      <div className="card">
        <p className="text-sm font-semibold">
          Création de tes séances en cours…
        </p>
        <p className="text-xs text-gray-500" style={{ marginTop: 4 }}>
          Ça peut prendre quelques secondes, surtout la première génération.
        </p>
      </div>
    </div>
  );
}
