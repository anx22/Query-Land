# Query-Land — Brand Kit

Heimat **aller** Marken- und Website-Assets. Bewusst auf Repo-Ebene neben `apps/`, `packages/`,
`services/` — Brand-Assets sind Produkt-Assets, **keine** Dokumentation.

> **Design-Direction & Spec (Doku):** `DOCS/design/brand-identity.md` · Token-Quelle: `DOCS/design/DESIGN.md`
> · Voice: `DOCS/design/ux-ui-sprint.md` (Teil 1).
>
> **Format:** aktuell **JPG** (Referenz-/Arbeitsstand). Finale, skalierbare **SVGs** (Logo, Header, Favicon)
> folgen später und ersetzen die JPGs in `logo/`, `header/`, `favicon/`.

---

## Vokabular (verbindlich, damit wir nichts mehr verwechseln)

| Begriff | Was | Einsatz |
|---|---|---|
| **Horizont** | Höhenzüge + aufgehende orange Sonne (Seitenansicht der Landschaft) | **Hero / Overview** — `header/horizon/` |
| **Ridges** | topografische **Höhenlinien-Bänder** (Landschaft als Konturlinien) | **Unterseiten** — `header/ridges/` |
| **Contours** | konzentrische Höhenlinien-Ringe + Such-Fokuspunkt | **Logomark / Daten-Textur** (Mark) |
| **Wortmarke** | `Query-Land.` (Literata, oranger Bindestrich/Punkt) | überall |
| **Orange** `#ff5c00` | „wir / CTA" — chirurgisch | Akzente |

> **Grundprinzip** (`guidelines/cartographic-system.jpg`): **ein** Terrain, in zwei Ansichten —
> Horizont = von der Seite, Contours = von oben. Dieses kartografische System ist der Marken-Kern.
> *(Hinweis: das Übersichtsblatt nutzt noch ältere interne Labels; maßgeblich ist die Tabelle hier.
> Beim finalen SVG-Satz werden die Labels darauf angeglichen.)*

---

## Ordnerstruktur

```
brand/
  guidelines/        Marken-Grundlagen: cartographic-system (Grundprinzip), identity-sheet, color, typography
  logo/
    wordmark/        Query-Land. Wortmarke              [final SVG folgt]
    logomark/        Marks (Horizont / Contours)        [final SVG folgt]
    lockup/          Wortmarke + Mark kombiniert         [final SVG folgt]
  favicon/           Favicon-Ableitungen                 [final folgt]
  header/
    horizon/         HERO-Header (Höhenzüge + Sonne)      ← „Horizont"
    ridges/          UNTERSEITEN-Header (Höhenlinien)     ← „Ridges", wie gehabt
  illustration/
    landscapes/      weitere Natur-Landschaften          ← Asset-Extension, für später
    spot/            Spot-Illustrationen / Empty-State-Glyphs
  texture/           Papier-Grain, Contour-Daten-Textur
  icon/              UI-Icon-Set (oneline, 1px)
  social/            OG-Image (1200×630), Twitter-Card, Link-Preview
  reference/         Referenz/Vergleich (z. B. Before→After)
```

**App-Einbindung:** final genutzte Assets werden nach `apps/web/public/brand/` gespiegelt (Next liefert
sie unter `/brand/...`) und per `currentColor`/`--primary` eingefärbt. `brand/` bleibt die Quelle.

---

## Belegt vs. offen

- ✅ **Horizont** (Hero) — `header/horizon/` (Bänder, Full-bleed-Overview, Wortmarke-Hero, Asset-System)
- ✅ **Ridges** (Unterseiten) — `header/ridges/` (zwei Höhenlinien-Bänder + Asset-System)
- ✅ **Grundprinzip** — `guidelines/cartographic-system.jpg`
- ✅ **Asset-Extension (Landschaften)** — `illustration/landscapes/` (für später)
- ⏳ **offen:** finale `logo/`-, `favicon/`-SVGs · `texture/` · `icon/` · `social/` (OG-Image)
