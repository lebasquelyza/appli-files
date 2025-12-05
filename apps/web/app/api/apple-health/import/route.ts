import { NextResponse } from "next/server";
import { cookies } from "next/headers";
// ⛔️ NE PAS importer jszip / fast-xml-parser ici en statique

export const runtime = "nodejs";

type AppleWorkout = {
  type: string;            // ex: HKWorkoutActivityTypeRunning
  start: string;           // ISO
  end: string;
  duration?: number;       // minutes
  distanceKm?: number;     // km
  energyKcal?: number;     // kcal
};

function parseAppleDate(s: string): string {
  // "2025-09-14 08:12:00 +0200" -> ISO
  try {
    const iso = s.replace(" ", "T").replace(" ", "");
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return s;
}

export async function POST(req: Request) {
  try {
    // ✅ imports dynamiques (bundlés uniquement pour cette route, et résolus au runtime)
    const [{ default: JSZip }, { XMLParser }] = await Promise.all([
      import("jszip"),
      import("fast-xml-parser"),
    ]);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    // Lire le zip en mémoire
    const buf = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);

    const exportXmlFile = zip.file("export.xml");
    if (!exportXmlFile) {
      return NextResponse.json({ error: "export.xml introuvable dans l’archive." }, { status: 400 });
    }

    const xmlText = await exportXmlFile.async("string");

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true,
      trimValues: true,
    });
    const data = parser.parse(xmlText);

    // HealthData.Workout (tableau d’objets avec attributs)
    const raw = data?.HealthData?.Workout;
    const workouts = Array.isArray(raw) ? raw : raw ? [raw] : [];

    const items: AppleWorkout[] = workouts.map((w: any) => {
      const type = String(w?.["@_workoutActivityType"] || "");
      const startDate = String(w?.["@_startDate"] || "");
      const endDate = String(w?.["@_endDate"] || "");
      const duration = Number(w?.["@_duration"] || NaN); // minutes
      const durationUnit = String(w?.["@_durationUnit"] || "min").toLowerCase();

      const dist = Number(w?.["@_totalDistance"] || NaN);
      const distUnit = String(w?.["@_totalDistanceUnit"] || "").toLowerCase();

      const energy = Number(w?.["@_totalEnergyBurned"] || NaN);
      const energyUnit = String(w?.["@_totalEnergyBurnedUnit"] || "").toLowerCase();

      const out: AppleWorkout = {
        type,
        start: parseAppleDate(startDate),
        end: parseAppleDate(endDate),
      };

      if (!isNaN(duration)) {
        out.duration = durationUnit.startsWith("min") ? duration : duration;
      }
      if (!isNaN(dist)) {
        out.distanceKm = distUnit === "mi" ? dist * 1.60934 : dist;
      }
      if (!isNaN(energy)) {
        out.energyKcal = energy;
      }
      return out;
    });

    // Trier par date de début desc
    items.sort((a, b) => (b.start || "").localeCompare(a.start || ""));

    // Garder 6 dernières
    const recent = items.slice(0, 6);

    const jar = cookies();
    jar.set("apple_health_recent", Buffer.from(JSON.stringify(recent), "utf8").toString("base64"), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    });

    // Flag UX
    jar.set("conn_apple_health", "1", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.redirect(new URL("/dashboard/connect?connected=apple-health", req.url));
  } catch (e: any) {
    return NextResponse.json({ error: "Import échoué." }, { status: 500 });
  }
}
