import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  const s = getSession();

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <PageHeader title="Mon profil" subtitle="Photo, identité et formule d’abonnement" />

      <Section title="Informations">
        {/* wrapper pour appliquer le style .section sans toucher à Section */}
        <div className="section" style={{ marginTop: 12 }}>
          <form action={updateProfile} className="space-y-4" encType="multipart/form-data">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="w-full">
                <label className="label">Nom affiché</label>
                <input name="name" className="input" defaultValue={s?.name || ""} />
              </div>

              <div className="w-full">
                <label className="label">Formule</label>
                <select name="plan" className="input" defaultValue={s?.plan || "BASIC"}>
                  <option value="BASIC">Basic</option>
                  <option value="PLUS">Plus</option>
                  <option value="PREMIUM">Premium</option>
                </select>
              </div>

              {/* Photo: URL + capture/import mobile */}
              <div className="lg:col-span-2 w-full">
                <label className="label">Photo</label>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* URL */}
                  <div className="card">
                    <div className="text-sm" style={{ color: "#6b7280", marginBottom: 6 }}>Depuis une URL</div>
                    <input name="image" className="input" defaultValue={s?.image || ""} placeholder="https://…" />
                  </div>

                  {/* Téléphone / appareil photo */}
                  <div className="card">
                    <div className="text-sm" style={{ color: "#6b7280", marginBottom: 8 }}>Depuis votre téléphone</div>
                    <div className="flex items-center" style={{ gap: 12 }}>
                      {/* Import depuis la pellicule/fichiers */}
                      <input id="upload" type="file" name="photo" accept="image/*" style={{ display: "none" }} />
                      <label htmlFor="upload" className="btn btn-outline">Importer</label>

                      {/* Ouvrir la caméra (mobile) */}
                      <input id="captureFile" type="file" name="camera" accept="image/*" capture="user" style={{ display: "none" }} />
                      <label htmlFor="captureFile" className="btn btn-dash">Prendre une photo</label>
                    </div>
                    <p className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>
                      Sur smartphone, « Prendre une photo » ouvre l’appareil photo. Sur ordinateur, un sélecteur de fichier s’ouvrira.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
              <span className="text-sm" />
              <button className="btn btn-dash" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>
      </Section>
    </div>
  );
}
