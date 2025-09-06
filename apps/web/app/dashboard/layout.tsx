import "../globals.css";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

export const metadata = { title: "Dashboard — Files" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{background:"var(--panel)", minHeight:"100vh"}}>
      <Topbar />
      <div className="container" style={{display:"grid", gridTemplateColumns:"260px 1fr", gap:16, paddingTop:90, paddingBottom:24}}>
        <aside><div className="card" style={{padding:0}}><Sidebar /></div></aside>
        <main style={{display:"grid", gap:16}}>{children}</main>
      </div>
    </div>
  );
}
