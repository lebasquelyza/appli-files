export type Session = { name?: string; image?: string; plan?: "BASIC"|"PLUS"|"PREMIUM" } | null;

export function getSession(): Session { return null; }
export async function getServerSession(): Promise<Session> { return null; }

export async function signOutAction(){
  "use server";
  /* stub logout */
}

export async function updateProfile(formData: FormData){
  "use server";
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") obj[key] = value;
    else obj[key] = value?.name ?? ""; // si jamais un fichier est envoyé
  });
  console.log("updateProfile", obj);
  // TODO: persister (DB / Google Sheets) si besoin
}
