# Regole e Contesto del Progetto FireTrack (OnTrack)

## Configurazione Nextcloud
- **Server URL predefinito:** `https://nc.fire4wd.uk`
- **Username predefinito:** `admin`
- **Cartella predefinita:** `FireTrack`
- **Certificato SSL:** Il server Nextcloud è raggiungibile sia con certificato pubblico che autofirmato.
  - Sull'app nativa Android (`CapacitorHttp`), è configurato il bypass del controllo certificato in `patch-capacitor.js`.
  - Sul server Node.js web (`server.ts`), è abilitato `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"`.

## Deploy e Architettura
- **App Android (APK / Capacitor):**
  - Comunicazione diretta via plugin nativo `CapacitorHttp` verso `https://nc.fire4wd.uk`.
  - Build Android: `npm run build:android` (esegue `vite build`, `node patch-capacitor.js`, `npx cap sync android`).
- **Versione Web (PC / Server esterno):**
  - Servita tramite `server.ts` (Express) sulla porta 3000 con rotte proxy `/api/nextcloud/*` per evitare blocchi CORS e gestire HTTPS verso Nextcloud.
