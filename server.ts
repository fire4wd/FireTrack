import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// Allow self-signed certificates for Nextcloud on local/VPN networks (e.g. Tailscale https://100.x.y.z:4443)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Health endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gemini Analysis Endpoint for APK / Screenshots / App preservation
  app.post("/api/analyze-app", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY non configurata nei segreti dell'ambiente."
        });
      }

      const { prompt, images, codeSnippet } = req.body;

      const ai = new GoogleGenAI({ apiKey });

      const contents: any[] = [];

      let systemInstruction = `Sei un esperto di ingegneria del software, reverse engineering concettuale, UI/UX design e preservazione digitale. 
Il tuo compito è analizzare informazioni su una vecchia applicazione Android (screenshot, descrizioni, estrazioni di codice o file decompilati) e generare una struttura completa in formato JSON per la sua ricostruzione moderna.
Rispondi SEMPRE ed esclusivamente con un oggetto JSON valido strutturato così:
{
  "appName": "Nome dell'app o stimato",
  "category": "Categoria (es. Produttività, Gioco, Utilità, Salute, Calcolatrice)",
  "summary": "Breve sintesi di cosa faceva l'app e del suo scopo principale",
  "designSystem": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "backgroundColor": "#hex",
    "fontStyle": "Stile (es. Sans-Serif Moderno, Retro Pixel, Serif Classico, Material Design)",
    "overallStyle": "Descrizione estetica"
  },
  "screens": [
    {
      "id": "screen_1",
      "name": "Nome Schermata",
      "description": "Descrizione layout e scopo",
      "components": ["Pulsante X", "Lista Y", "Grafico Z", "Input A"],
      "keyActions": ["Azione 1", "Azione 2"]
    }
  ],
  "features": [
    {
      "title": "Titolo Funzionalità",
      "description": "Dettaglio funzionamento e logica di business",
      "priority": "Alta / Media / Bassa"
    }
  ],
  "dataModel": [
    {
      "entity": "Nome Entità (es. Nota, Punteggio, Transazione)",
      "fields": ["campo1: tipo", "campo2: tipo"]
    }
  ],
  "recommendations": [
    "Consiglio 1 per modernizzare o preservare l'app",
    "Consiglio 2 per miglioramenti UX senza perdere l'anima dell'originale"
  ]
}`;

      let userText = `Analizza le seguenti informazioni relative alla vecchia app Android da replicare:\n`;
      if (prompt) userText += `Descrizione utente:\n${prompt}\n\n`;
      if (codeSnippet) userText += `Codice/Stringhe estratte dall'APK:\n${codeSnippet}\n\n`;

      contents.push({ text: userText });

      if (images && Array.isArray(images)) {
        for (const imgBase64 of images) {
          // Expecting format data:image/png;base64,xxxx or raw base64
          const match = imgBase64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            contents.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          } else if (typeof imgBase64 === "string") {
            contents.push({
              inlineData: {
                mimeType: "image/png",
                data: imgBase64
              }
            });
          }
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      res.json({ success: true, data: parsed });
    } catch (err: any) {
      console.error("Errore analisi Gemini:", err);
      res.status(500).json({
        error: "Impossibile analizzare i dati dell'app con Gemini.",
        details: err.message
      });
    }
  });

  // =========================================================================
  // NEXTCLOUD WEBDAV BACKUP & SYNC PROXY ENDPOINTS
  // Solves CORS and Mixed-Content (HTTPS -> HTTP) constraints in Web apps
  // =========================================================================

  // Helper to build Nextcloud WebDAV endpoints
  const getNextcloudUrls = (serverUrl: string, username: string, folder: string) => {
    let cleanBase = (serverUrl || "https://nc.fire4wd.uk").trim().replace(/\/+$/, "");
    if (!cleanBase.startsWith("http://") && !cleanBase.startsWith("https://")) {
      cleanBase = `https://${cleanBase}`;
    }
    const cleanUser = (username || "admin").trim();
    const cleanFolder = (folder || "FireTrack").trim().replace(/^\/+|\/+$/g, "");

    // If cleanBase already includes WebDAV path, use it directly
    if (cleanBase.includes("/remote.php/")) {
      const folderUrl = cleanFolder ? `${cleanBase}/${encodeURIComponent(cleanFolder)}/` : `${cleanBase}/`;
      return { baseWebdavUrl: `${cleanBase}/`, folderUrl, legacyFolderUrl: `${cleanBase}/`, cleanBase, cleanUser, cleanFolder };
    }

    const baseWebdavUrl = `${cleanBase}/remote.php/dav/files/${encodeURIComponent(cleanUser)}/`;
    const folderUrl = cleanFolder
      ? `${baseWebdavUrl}${cleanFolder.split("/").map(encodeURIComponent).join("/")}/`
      : baseWebdavUrl;
    const legacyFolderUrl = cleanFolder
      ? `${cleanBase}/remote.php/webdav/${cleanFolder.split("/").map(encodeURIComponent).join("/")}/`
      : `${cleanBase}/remote.php/webdav/`;

    return { baseWebdavUrl, folderUrl, legacyFolderUrl, cleanBase, cleanUser, cleanFolder };
  };

  const getBasicAuthHeader = (username: string, password?: string) => {
    const creds = `${username || "admin"}:${password || ""}`;
    return `Basic ${Buffer.from(creds, "utf-8").toString("base64")}`;
  };

  /**
   * Helper to ensure all nested directory segments exist on Nextcloud across modern and legacy WebDAV APIs
   */
  const ensureNextcloudFolder = async (cleanBase: string, cleanUser: string, cleanFolder: string, authHeader: string) => {
    if (!cleanFolder) return;
    const segments = cleanFolder.split("/").filter(Boolean);

    // 1. Try modern WebDAV path: /remote.php/dav/files/{user}/{segment}...
    let davPath = `${cleanBase}/remote.php/dav/files/${encodeURIComponent(cleanUser)}`;
    for (const seg of segments) {
      davPath += `/${encodeURIComponent(seg)}/`;
      try {
        await fetch(davPath, {
          method: "MKCOL",
          headers: {
            Authorization: authHeader,
            "OCS-APIRequest": "true",
            "User-Agent": "FireTrack/1.0 (Health Tracking App)"
          },
          signal: AbortSignal.timeout(6000)
        });
      } catch {}
    }
  };

  // 1. Test Nextcloud Connection & Prepare Folder
  app.post("/api/nextcloud/test", async (req, res) => {
    const { serverUrl, username, password, folder } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password obbligatoria. Inserisci la password o la Password Applicativa per connetterti a Nextcloud."
      });
    }

    const { baseWebdavUrl, legacyFolderUrl, cleanBase, cleanFolder, cleanUser } = getNextcloudUrls(serverUrl, username, folder);
    const authHeader = getBasicAuthHeader(cleanUser, password);

    try {
      // Step A: Check WebDAV root connectivity via PROPFIND with clean per-request timeout
      let rootRes: Response | null = null;
      try {
        rootRes = await fetch(baseWebdavUrl, {
          method: "PROPFIND",
          headers: {
            Authorization: authHeader,
            Depth: "0",
            "Content-Type": "application/xml",
            "OCS-APIRequest": "true",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            "User-Agent": "FireTrack/1.0 (Health Tracking App)"
          },
          signal: AbortSignal.timeout(10000)
        });
      } catch (firstErr: any) {
        // Fallback: try status.php or legacy webdav root
        try {
          rootRes = await fetch(`${cleanBase}/status.php`, {
            method: "GET",
            headers: {
              "User-Agent": "FireTrack/1.0 (Health Tracking App)"
            },
            signal: AbortSignal.timeout(6000)
          });
        } catch {
          throw firstErr;
        }
      }

      if (rootRes.status === 401 || rootRes.status === 403) {
        return res.status(401).json({
          success: false,
          error: `Autenticazione non riuscita su Nextcloud per l'utente '${cleanUser}'. Verifica la password o usa una "Password per l'applicazione" generata da Impostazioni Personali → Sicurezza.`
        });
      }

      if (!rootRes.ok && rootRes.status !== 207) {
        const errorText = await rootRes.text().catch(() => "");
        return res.status(rootRes.status).json({
          success: false,
          error: `Il server Nextcloud ha risposto con errore HTTP ${rootRes.status} (${rootRes.statusText}): ${errorText.slice(0, 150)}`
        });
      }

      // Step B: Ensure the destination folder exists (e.g. FireTrack)
      if (cleanFolder) {
        await ensureNextcloudFolder(cleanBase, cleanUser, cleanFolder, authHeader);
      }

      res.json({
        success: true,
        message: `✅ Connessione stabilita con successo a Nextcloud (${cleanBase})! Cartella '${cleanFolder}' pronta.`,
        serverUrl: cleanBase,
        username: cleanUser,
        folder: cleanFolder
      });
    } catch (err: any) {
      console.error("Errore connessione Nextcloud:", err);
      let errMsg = err.message || "Errore sconosciuto";
      if (err.name === "AbortError" || err.name === "TimeoutError" || errMsg.includes("aborted") || errMsg.includes("timeout")) {
        errMsg = `Timeout di connessione: il server ${cleanBase} non risponde entro 10 secondi.`;
      } else if (errMsg.includes("ECONNREFUSED")) {
        errMsg = `Connessione rifiutata su ${cleanBase}. Verifica che Nextcloud sia attivo.`;
      } else if (errMsg.includes("ENOTFOUND") || errMsg.includes("EAI_AGAIN")) {
        errMsg = `Indirizzo host non trovato (${cleanBase}).`;
      }
      res.status(502).json({
        success: false,
        error: errMsg
      });
    }
  });

  // 2. List Remote Backups in Nextcloud Folder
  app.post("/api/nextcloud/list", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const { serverUrl, username, password, folder } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: "Password mancante." });
    }

    const { folderUrl, cleanUser, cleanFolder, cleanBase } = getNextcloudUrls(serverUrl, username, folder);
    const authHeader = getBasicAuthHeader(cleanUser, password);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const listRes = await fetch(folderUrl, {
        method: "PROPFIND",
        headers: {
          Authorization: authHeader,
          Depth: "1",
          "Content-Type": "application/xml; charset=utf-8",
          "OCS-APIRequest": "true",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "User-Agent": "FireTrack/1.0 (Health Tracking App)"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (listRes.status === 401 || listRes.status === 403) {
        return res.status(401).json({ success: false, error: "Credenziali non valide su Nextcloud." });
      }

      // If the folder doesn't exist on Nextcloud (404), return empty array
      if (listRes.status === 404) {
        return res.json({ success: true, files: [], count: 0 });
      }

      if (!listRes.ok && listRes.status !== 207) {
        return res.status(listRes.status).json({
          success: false,
          error: `Errore Nextcloud WebDAV HTTP ${listRes.status} (${listRes.statusText})`
        });
      }

      const xmlText = await listRes.text();
      
      // Parse DAV responses from XML
      const files: Array<{
        name: string;
        path: string;
        size: number;
        lastModified: string;
        isDirectory: boolean;
        type?: string;
      }> = [];

      const responseMatches = xmlText.match(/<(?:[a-zA-Z0-9_-]+:)?response[\s>][\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?response>/gi) || [];

      for (const block of responseMatches) {
        const hrefMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?href>([^<]+)<\/(?:[a-zA-Z0-9_-]+:)?href>/i);
        if (!hrefMatch) continue;

        const rawHref = decodeURIComponent(hrefMatch[1]);
        const cleanHref = rawHref.replace(/\/+$/, "");
        const segments = cleanHref.split("/");
        const fileName = segments[segments.length - 1] || "";

        // Skip parent folder itself or empty filenames
        if (!fileName || fileName.toLowerCase() === cleanFolder.toLowerCase() || fileName.toLowerCase() === "firetrack") {
          continue;
        }

        // Check if item is a folder / collection
        const isDir = /<(?:\w+:)?collection(?:\s*\/|\s*>)/i.test(block) || /<d:resourcetype>\s*<d:collection\s*\/>\s*<\/d:resourcetype>/i.test(block);
        if (isDir) {
          // Skip subfolders - we only want backup files
          continue;
        }

        // Check that the file is strictly inside the target folder
        if (cleanFolder) {
          const folderSegment = `/${cleanFolder.toLowerCase()}/`;
          if (!cleanHref.toLowerCase().includes(folderSegment) && !cleanHref.toLowerCase().endsWith(`/${cleanFolder.toLowerCase()}/${fileName.toLowerCase()}`)) {
            continue;
          }
        }

        const sizeMatch = block.match(/<(?:\w+:)?getcontentlength>(\d+)<\/(?:\w+:)?getcontentlength>/i);
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

        const dateMatch = block.match(/<(?:\w+:)?getlastmodified>([^<]+)<\/(?:\w+:)?getlastmodified>/i);
        const lastModified = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();

        const typeMatch = block.match(/<(?:\w+:)?getcontenttype>([^<]+)<\/(?:\w+:)?getcontenttype>/i);
        const type = typeMatch
          ? typeMatch[1]
          : (fileName.endsWith(".json")
            ? "application/json"
            : fileName.endsWith(".sqlite") || fileName.endsWith(".db")
            ? "application/x-sqlite3"
            : "application/octet-stream");

        files.push({
          name: fileName,
          path: cleanHref,
          size,
          lastModified,
          isDirectory: false,
          type
        });
      }

      // Sort newest first
      files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

      res.json({ success: true, files, count: files.length });
    } catch (err: any) {
      console.error("Errore elenco file Nextcloud:", err);
      res.status(500).json({ success: false, error: err.message || "Impossibile recuperare l'elenco dei file da Nextcloud." });
    }
  });

  // 3. Upload File to Nextcloud (Supports text/json and base64 for SQLite)
  app.post("/api/nextcloud/upload", async (req, res) => {
    const { serverUrl, username, password, folder, filename, content, contentType, isBase64 } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: "Password mancante." });
    }
    if (!filename || content === undefined || content === null) {
      return res.status(400).json({ success: false, error: "Nome file e contenuto richiesti." });
    }

    const { folderUrl, cleanFolder, cleanUser, cleanBase } = getNextcloudUrls(serverUrl, username, folder);
    const authHeader = getBasicAuthHeader(cleanUser, password);

    try {
      // 1. Ensure folder exists in Nextcloud
      await ensureNextcloudFolder(cleanBase, cleanUser, cleanFolder, authHeader);

      const buffer = isBase64
        ? Buffer.from(content, "base64")
        : Buffer.from(typeof content === "string" ? content : JSON.stringify(content), "utf-8");

      const targetFileUrl = `${folderUrl.replace(/\/+$/, "")}/${encodeURIComponent(filename)}`;

      const reqHeaders: Record<string, string> = {
        Authorization: authHeader,
        "Content-Type": contentType || (filename.endsWith(".json") ? "application/json" : "application/octet-stream"),
        "Content-Length": buffer.length.toString(),
        "OCS-APIRequest": "true",
        "User-Agent": "FireTrack/1.0 (Health Tracking App)"
      };

      console.log(`[Nextcloud Upload] Caricamento di ${filename} (${buffer.length} bytes) -> ${targetFileUrl}`);

      // Attempt 1: Modern WebDAV endpoint /remote.php/dav/files/{user}/{folder}/{file}
      let uploadRes = await fetch(targetFileUrl, {
        method: "PUT",
        headers: reqHeaders,
        body: buffer
      });

      console.log(`[Nextcloud Upload] Tentativo 1 status: HTTP ${uploadRes.status}`);

      // Attempt 2: Legacy WebDAV endpoint /remote.php/webdav/{folder}/{file} if 404/405/409
      if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 204) {
        const legacyTargetUrl = cleanFolder
          ? `${cleanBase}/remote.php/webdav/${encodeURIComponent(cleanFolder)}/${encodeURIComponent(filename)}`
          : `${cleanBase}/remote.php/webdav/${encodeURIComponent(filename)}`;

        console.log(`[Nextcloud Upload] Tentativo 2 legacy -> ${legacyTargetUrl}`);
        try {
          const legacyRes = await fetch(legacyTargetUrl, {
            method: "PUT",
            headers: reqHeaders,
            body: buffer
          });
          console.log(`[Nextcloud Upload] Tentativo 2 status: HTTP ${legacyRes.status}`);
          if (legacyRes.ok || legacyRes.status === 201 || legacyRes.status === 204) {
            uploadRes = legacyRes;
          }
        } catch (legacyErr) {
          console.error(`[Nextcloud Upload] Errore tentativo 2:`, legacyErr);
        }
      }

      if (uploadRes.status === 401 || uploadRes.status === 403) {
        return res.status(401).json({ success: false, error: "Credenziali non valide su Nextcloud." });
      }

      if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 204) {
        const errorText = await uploadRes.text().catch(() => "");
        console.error(`[Nextcloud Upload Error] HTTP ${uploadRes.status}: ${errorText.slice(0, 200)}`);
        return res.status(uploadRes.status).json({
          success: false,
          error: `Errore caricamento HTTP ${uploadRes.status}: ${uploadRes.statusText}`
        });
      }

      console.log(`[Nextcloud Upload] File '${filename}' caricato con successo in Nextcloud/${cleanFolder}!`);

      res.json({
        success: true,
        message: `File '${filename}' caricato con successo in Nextcloud/${cleanFolder}!`,
        filename,
        bytes: buffer.length
      });
    } catch (err: any) {
      console.error("[Nextcloud Upload] Errore:", err);
      res.status(500).json({ success: false, error: err.message || "Errore durante l'upload su Nextcloud." });
    }
  });

  // 4. Download File from Nextcloud
  app.post("/api/nextcloud/download", async (req, res) => {
    const { serverUrl, username, password, folder, filename, asBase64 } = req.body;
    if (!password || !filename) {
      return res.status(400).json({ success: false, error: "Password e nome file richiesti." });
    }

    const { folderUrl, cleanUser } = getNextcloudUrls(serverUrl, username, folder);
    const authHeader = getBasicAuthHeader(cleanUser, password);
    const targetFileUrl = `${folderUrl.replace(/\/+$/, "")}/${encodeURIComponent(filename)}`;

    try {
      const downloadRes = await fetch(targetFileUrl, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "OCS-APIRequest": "true",
          "User-Agent": "FireTrack/1.0 (Health Tracking App)"
        }
      });

      if (downloadRes.status === 401 || downloadRes.status === 403) {
        return res.status(401).json({ success: false, error: "Credenziali non valide." });
      }

      if (downloadRes.status === 404) {
        return res.status(404).json({ success: false, error: `File '${filename}' non trovato su Nextcloud.` });
      }

      if (!downloadRes.ok) {
        return res.status(downloadRes.status).json({
          success: false,
          error: `Errore download HTTP ${downloadRes.status}`
        });
      }

      const contentType = downloadRes.headers.get("content-type") || "application/octet-stream";

      if (asBase64 || filename.endsWith(".sqlite") || filename.endsWith(".db")) {
        const arrayBuf = await downloadRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuf).toString("base64");
        return res.json({
          success: true,
          filename,
          isBase64: true,
          content: base64Data,
          contentType
        });
      } else {
        const textData = await downloadRes.text();
        return res.json({
          success: true,
          filename,
          isBase64: false,
          content: textData,
          contentType
        });
      }
    } catch (err: any) {
      console.error("Errore download Nextcloud:", err);
      res.status(500).json({ success: false, error: err.message || "Errore durante il download dal server Nextcloud." });
    }
  });

  // 5. Delete File from Nextcloud
  app.post("/api/nextcloud/delete", async (req, res) => {
    const { serverUrl, username, password, folder, filename } = req.body;
    if (!password || !filename) {
      return res.status(400).json({ success: false, error: "Password e nome file richiesti." });
    }

    const { folderUrl, cleanUser } = getNextcloudUrls(serverUrl, username, folder);
    const authHeader = getBasicAuthHeader(cleanUser, password);
    const targetFileUrl = `${folderUrl.replace(/\/+$/, "")}/${encodeURIComponent(filename)}`;

    try {
      const deleteRes = await fetch(targetFileUrl, {
        method: "DELETE",
        headers: {
          Authorization: authHeader,
          "OCS-APIRequest": "true",
          "User-Agent": "FireTrack/1.0 (Health Tracking App)"
        }
      });

      if (!deleteRes.ok && deleteRes.status !== 204 && deleteRes.status !== 404) {
        return res.status(deleteRes.status).json({
          success: false,
          error: `Errore eliminazione HTTP ${deleteRes.status}`
        });
      }

      res.json({ success: true, message: `File '${filename}' eliminato da Nextcloud.` });
    } catch (err: any) {
      console.error("Errore eliminazione Nextcloud:", err);
      res.status(500).json({ success: false, error: err.message || "Errore durante l'eliminazione del file." });
    }
  });

  // Vite middleware setup (development only, with safe fallback)
  let isViteMounted = false;
  if (process.env.NODE_ENV !== "production") {
    try {
      const viteModule = await import("vite").catch(() => null);
      if (viteModule && typeof viteModule.createServer === "function") {
        const vite = await viteModule.createServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        isViteMounted = true;
      }
    } catch {
      isViteMounted = false;
    }
  }

  if (!isViteMounted) {
    const rootPath = process.cwd();
    const distPath = path.join(rootPath, "dist");
    const staticDir = fs.existsSync(path.join(distPath, "index.html")) ? distPath : rootPath;

    app.use(express.static(staticDir));
    app.get("*", (_req, res) => {
      const targetHtml = path.join(staticDir, "index.html");
      if (fs.existsSync(targetHtml)) {
        res.sendFile(targetHtml);
      } else {
        res.send("FireTrack Backend API running. Use /api routes.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
