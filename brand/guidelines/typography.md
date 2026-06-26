# Query-Land — Typografie (die Signatur)

Drei Stimmen in Spannung — _Erzählung serif, Bedienung sans, Messwert mono_ — sind der Marken-Kern.
Direction: `DOCS/design/brand-identity.md` §4 · Token-Quelle: `DOCS/design/DESIGN.md`.

| Schrift | Rolle | Wo |
|---|---|---|
| **Literata** (Serif) | Erzählung, Prestige | Headlines, Hero, Sektions-Intros, Empty-States, Glossar |
| **Inter** (Sans) | Funktion, Klarheit | UI-Labels, Nav, Body, Buttons, Formulare, Tabellen |
| **JetBrains Mono** | „kalkuliert", Daten | **alle Messwerte**, URLs, HTTP-Status, Meta-Tags, IDs, Code |

**Faustregel:** Sobald eine Zahl eine **gemessene Kennzahl** ist → JetBrains Mono, `tabular-nums`.
Headlines dürfen **ein** SEO-Schlüsselwort orange setzen (max. eins).

> **Status:** noch nicht im Code verdrahtet — `layout.tsx` lädt keine Fonts (Inter fällt auf System-Sans).
> Umsetzung = **B-1** (erster Schnitt der Roadmap, `brand-identity.md` §9).
