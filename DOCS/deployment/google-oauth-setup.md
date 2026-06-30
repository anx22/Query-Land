# Google Search Console verbinden (OAuth-Setup)

Diese Anleitung richtet die echte **Google-Search-Console-(GSC)-Integration** ein. Danach bringt ein
Klick auf „Mit Google verbinden" (Einstellungen → Datenquellen) echte Klicks, Impressionen, CTR und
Positionen ins Produkt — und macht **Content & Chancen**, **Keywords & Rankings + Visibility** und die
**Übersicht** produktiv.

> Hinweis: Backlinks kommen **nicht** aus GSC (der Links-Report ist nicht per API verfügbar) und
> bleiben vorerst ein ehrlicher Leerzustand.

## 1. Google-Cloud-Projekt & API

1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt anlegen (oder bestehendes wählen).
2. **APIs & Dienste → Bibliothek** → „**Google Search Console API**" aktivieren.

## 2. OAuth-Zustimmungsbildschirm

1. **APIs & Dienste → OAuth-Zustimmungsbildschirm** → Nutzertyp **Extern**.
2. App-Name, Support-E-Mail, Entwickler-Kontakt eintragen.
3. **Scope** hinzufügen: `https://www.googleapis.com/auth/webmasters.readonly`.
4. Solange die App im Test-Modus ist: die Google-Konten, die sich verbinden dürfen, unter
   **Testnutzer** eintragen.

## 3. OAuth-Client (Web)

1. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID** → Typ **Webanwendung**.
2. **Autorisierte Weiterleitungs-URIs** — exakt eintragen (eine pro Umgebung):
   - lokal: `http://localhost:3000/api/oauth/google/callback`
   - Produktion: `https://<ihre-vercel-domain>/api/oauth/google/callback`
3. Client-ID und Client-Secret notieren.

## 4. Property in der Search Console verifizieren

Die in der App hinterlegte **Website-Adresse** muss als Property in der
[Search Console](https://search.google.com/search-console) **verifiziert** sein (Domain-Property
`sc-domain:` bevorzugt, sonst URL-Präfix). Der Callback ordnet die Property automatisch der Host-Adresse
der Website zu; ohne verifizierte, passende Property schlägt die Verbindung mit einer klaren Meldung fehl.

## 5. Umgebungsvariablen

Lokal in `.env` (siehe `.env.example`), in Produktion unter **Vercel → Project Settings → Environment
Variables**:

| Variable | Wert |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth-Client-ID aus Schritt 3 |
| `GOOGLE_CLIENT_SECRET` | OAuth-Client-Secret aus Schritt 3 |
| `GOOGLE_OAUTH_REDIRECT_URI` | exakt die Redirect-URI der jeweiligen Umgebung (Schritt 3.2) |
| `OAUTH_ENCRYPTION_KEY` | langer Zufallsstring; verschlüsselt die gespeicherten Refresh-Tokens (AES-256-GCM) |

Hinweise:
- Die App fordert `access_type=offline` + `prompt=consent` an, damit Google ein **Refresh-Token**
  ausgibt — sonst meldet der Callback „Kein dauerhafter Zugriff erhalten".
- Refresh-Tokens werden **nur verschlüsselt** in der Datenbank (`integration_accounts.auth_config`)
  abgelegt; Tokens werden nie geloggt.

## 6. Verbinden & prüfen

1. App öffnen → **Einstellungen → Datenquellen** → bei Google Search Console **„Mit Google verbinden"**.
2. Google-Einwilligung bestätigen → Weiterleitung zurück zu `/settings?connected=gsc`, Status **„verbunden"**.
3. **Content & Chancen** → „Search Performance synchronisieren" → echte Zeilen + Optimierungschancen.
4. **Keywords & Rankings** → Keyword anlegen → Ranking messen → Position/Visibility füllen sich.
5. Nach ~1 Stunde erneut synchronisieren: das abgelaufene Access-Token wird automatisch erneuert.

Siehe auch `DOCS/deployment/vercel-single-deployment.md` für das übrige Deployment (DATABASE_URL,
CRON_SECRET).
