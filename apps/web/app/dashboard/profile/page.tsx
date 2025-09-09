import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  const s = getSession();

  return (
    <div className="container" style={{paddingTop: 24, paddingBottom: 32}}>
      {/* Titre + sous-titre, même contenu, look + élégant */}
      <div className="page-header">
        <div>
          <h1 className="h1">Mon profil</h1>
          <p className="lead">Photo, identité et formule d’abonnement</p>
        </div>
      </div>

      {/* Section encartée */}
      <div className="section" style={{marginTop: 16}}>
        <div className="section-head">
          <h2>Informations</h2>
          <span className="badge">Sécurité & confidentialité respectées</span>
        </div>
        <div className="section-body">
          <form action={updateProfile} className="space-y-4" encType="multipart/form-data">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Nom */}
              <div className="w-full">
                <label className="label">Nom affiché</label>
                <input
                  name="name"
                  className="input"
                  defaultValue={s?.name || ""}
                  placeholder="Jane Doe"
                />
                <div className="text-sm" style={{color:'#6b7280', marginTop:6}}>Ce nom sera visible par les autres.</div>
              </div>

              {/* Formule */}
              <div className="w-full">
                <label className="label">Formule</label>
                <select
                  name="plan"
                  className="input"
                  defaultValue={s?.plan || "BASIC"}
                >
                  <option value="BASIC">Basic</option>
                  <option value="PLUS">Plus</option>
                  <option value="PREMIUM">Premium</option>
                </select>
                <div className="text-sm" style={{color:'#6b7280', marginTop:6}}>Modifiable à tout moment.</div>
              </div>

              {/* Photo: URL + Téléphone/Appareil photo */}
              <div className="lg:col-span-2 w-full">
                <label className="label">Photo</label>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Option 1: URL */}
                  <div className="card">
                    <div className="text-sm" style={{color:'#6b7280', marginBottom:6}}>Depuis une URL</div>
                    <input
                      name="image"
                      className="input"
                      defaultValue={s?.image || ""}
                      placeholder="https://…"
                    />
                  </div>

                  {/* Option 2: Téléphone / appareil photo */}
                  <div className="card">
                    <div className="text-sm" style={{color:'#6b7280', marginBottom:8}}>Depuis votre téléphone</div>

                    <div className="flex items-center" style={{gap:12}}>
                      {/* Importer depuis la pellicule/fichiers */}
                      <input id="upload" type="file" name="photo" accept="image/*" style={{display:'none'}} />
                      <label htmlFor="upload" className="btn btn-outline">Importer</label>

                      {/* Ouvrir directement l'appareil photo (mobile) */}
                      <input id="capture" type="file" name="photo" accept="image/*" capture="user" style={{display:'none'}} />
                      <label htmlFor="capture" className="btn btn-dash">Prendre une photo</label>
                    </div>

                    <p className="text-sm" style={{color:'#6b7280', marginTop:6}}>
                      Sur smartphone, « Prendre une photo » ouvre l’appareil photo. Sur ordinateur, cela ouvrira la boîte de sélection de fichiers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Barre d’actions */}
            <div className="flex items-center justify-between" style={{marginTop:8}}>
              <div className="text-sm" style={{color:'#6b7280'}}>Vos changements sont enregistrés de façon sécurisée.</div>
              <button className="btn btn-dash" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
