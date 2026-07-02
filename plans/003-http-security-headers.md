# Plan 003 — HTTP-Security-Header

- **Kategorie:** Security (Defense-in-Depth) · **Aufwand:** S · **Risiko:** LOW–MED · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

`apps/web/next.config.mjs` setzt **keine** HTTP-Security-Header (kein `headers()`-Export), und es gibt
kein `apps/web/src/middleware.ts`. Dadurch fehlen Clickjacking-Schutz (`X-Frame-Options`),
MIME-Sniffing-Schutz (`X-Content-Type-Options`) und eine Content-Security-Policy als Sandbox. Die aktive
XSS-Angriffsfläche ist heute klein (keine Roh-HTML-/User-Content-Ausgabe), aber die Header sind eine
billige, wirksame Defense-in-Depth — besonders relevant, sobald künftig user-gelieferte Inhalte
gerendert werden.

Aktueller Stand — `apps/web/next.config.mjs` (um Zeile 7–28) enthält nur `output`, `transpilePackages`,
`serverExternalPackages`, `outputFileTracingRoot/Includes`. Kein `headers()`.

## Änderung

In **`apps/web/next.config.mjs`** eine `async headers()`-Funktion ergänzen, die für den Pfad `/(.*)`
folgende Header setzt:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — **konservativ**, an den realen Bedarf angepasst:
  - Next.js/React injizieren Inline-Styles → `style-src 'self' 'unsafe-inline'`.
  - Recharts ist SVG-basiert (kein `eval`); Next braucht für Hydration Inline-Scripts →
    `script-src 'self' 'unsafe-inline'` (falls sich später Nonces einführen lassen, verschärfen).
  - Die Web-App ruft die API unter `NEXT_PUBLIC_API_BASE_URL` → in `connect-src` aufnehmen.
  - Startwert:
    ```
    default-src 'self';
    img-src 'self' data:;
    style-src 'self' 'unsafe-inline';
    script-src 'self' 'unsafe-inline';
    connect-src 'self' <NEXT_PUBLIC_API_BASE_URL, sofern gesetzt>;
    frame-ancestors 'none';
    base-uri 'self'
    ```

Den CSP-String als eine Zeile (ohne Zeilenumbrüche im Header-Wert) zusammenbauen; `NEXT_PUBLIC_API_BASE_URL`
aus `process.env` lesen und nur anhängen, wenn gesetzt.

## Scope

- **In scope:** nur `apps/web/next.config.mjs`.
- **Explizit out of scope:** ein neues `middleware.ts` (Header via `headers()` genügt und ist billiger);
  Backend-CORS/`apps/api`; jede Produktiv-Logik.

## Verifikation (Done-Kriterien)

1. `npm --workspace @seo-tool/web run build` erfolgreich.
2. App lokal starten (`next dev`), in DevTools → Network die **Response-Header** eines Seiten-Requests
   prüfen: alle vier Header vorhanden.
3. **CSP-Regression testen** — Browser-Konsole auf `Content-Security-Policy`-Verstöße prüfen, während
   diese Seiten geladen werden: Overview `/`, Technical Audit, Keywords (Recharts-Charts), Reports,
   AI-Visibility. Es darf **nichts** blockiert werden (weiße Fläche, fehlende Charts, geblockte
   API-Calls sind Fehlersignale).
4. Bestehende Web-Tests bleiben grün: `npm --workspace @seo-tool/web run test`.

## Test-Plan

Kein Unit-Test (Header sind Framework-Config). Die Verifikation ist die manuelle Browser-Prüfung oben.
Optional: ein kleiner Smoke, der `next build` + einen `curl -I` gegen `next start` fährt und die Header
grept — nur falls einfach machbar, nicht erzwingen.

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Falls die App unter der CSP kaputtgeht und sich die Ursache nicht schnell per
  Direktive beheben lässt, den Header zunächst als **`Content-Security-Policy-Report-Only`** ausliefern
  (beobachtet + meldet Verstöße, blockiert aber nicht) und das melden — **nicht** die Header ganz
  weglassen. So bleibt der Schutz-Pfad offen und die Verstöße werden sichtbar.
- Wenn später Nonce-basiertes Scripting eingeführt wird, `'unsafe-inline'` bei `script-src` entfernen.
- Bei neuen externen Quellen (Fonts, Analytics, Bild-CDNs) die passende `*-src`-Direktive erweitern —
  bewusst eng halten.
