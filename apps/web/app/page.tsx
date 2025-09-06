import Topbar from "@/components/Topbar";

export default function Home() {
  return (
    <>
      <Topbar />
      <main style={{paddingTop:90}}>
        <section>
          <div className="container" style={{display:"grid", gridTemplateColumns:"1.1fr .9fr", gap:34, alignItems:"center"}}>
            <div>
              <h1 className="h1">Files Le Coach — Coach Sportif IA</h1>
              <p className="lead">Séances personnalisées, conseils et suivi.</p>
              <div style={{height:16}} />
              <a className="btn" href="/dashboard">Entrer dans le dashboard</a>
            </div>
            <div className="card">
              <ul className="space-y-4" style={{margin:0, paddingLeft:18}}>
                <li>Programme personnalisé</li>
                <li>Minuteur & Musique</li>
                <li>Recettes healthy</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
