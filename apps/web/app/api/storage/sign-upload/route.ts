const onAnalyze = async () => {
  if (!file || !blobUrl) return;
  setIsAnalyzing(true);
  setProgress(10);
  setStatus(""); // si tu as un status debug
  setErrorMsg("");

  try {
    // 1) Demande d'URL d'upload signée
    const resSign = await fetch("/api/storage/sign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });
    if (!resSign.ok) throw new Error(`sign-upload: HTTP ${resSign.status} ${await resSign.text()}`);
    const { path, token } = await resSign.json();
    setProgress(30);

    // 2) Upload vers Supabase
    const { error: upErr } = await supabase.storage
      .from("videos")
      .uploadToSignedUrl(path, token, file);

    if (upErr) throw new Error(`uploadToSignedUrl: ${upErr.message || "Load failed"}`);
    setProgress(55);

    // 3) URL de lecture signée (fileUrl) pour l'IA
    const resRead = await fetch("/api/storage/sign-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, expiresIn: 60 * 60 }), // 1h
    });
    if (!resRead.ok) throw new Error(`sign-read: HTTP ${resRead.status} ${await resRead.text()}`);
    const { url: fileUrl } = await resRead.json();
    setProgress(65);

    // 4) ➜ EXTRAIRE DES FRAMES DE LA VIDEO CÔTÉ CLIENT
    // On prend 6–8 images réparties sur la durée.
    const { frames, timestamps } = await extractFramesFromBlob(blobUrl, { count: 8, quality: 0.75 });
    if (!frames.length) throw new Error("Aucune frame extraite du clip.");

    setProgress(80);

    // 5) Appel de l’IA : on envoie frames + timestamps (+ feeling + fileUrl)
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frames, timestamps, feeling, fileUrl }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`analyze: HTTP ${res.status} ${txt}`);
    }

    const data: AIAnalysis = await res.json();
    setAnalysis(data);
    setProgress(100);
  } catch (e: any) {
    console.error(e);
    alert(`Erreur pendant l'analyse: ${e?.message || e}`);
  } finally {
    setIsAnalyzing(false);
  }
};
