# DATABASE_URL auf `queryland` umstellen (später, manuell)

> Notiz für anx22 — auf Wunsch festgehalten, **noch nicht ausgeführt**.
> Aktueller Stand: Production läuft auf der Datenbank **`neondb`** (von der nativen
> Neon↔Vercel-Integration automatisch gesetzt). `queryland` liegt im **selben**
> Neon-Speicher (Projekt `young-tooth-21703730`) und hat dieselbe Struktur.

## Worum es geht

Ein Neon-Speicher = ein Neon-Projekt, kann aber mehrere Datenbanken enthalten.
Hier liegen `neondb` (Default, aktiv) und `queryland` (gleiche Migrationen, ungenutzt).
Worauf die App zeigt, bestimmt allein die Env-Variable `DATABASE_URL` in Vercel.

## Klick-Anleitung (Vercel-Dashboard)

1. Vercel → Projekt **queryland** → **Settings** → **Environment Variables**.
2. `DATABASE_URL` suchen. Sie wird von der Neon-Integration verwaltet und zeigt auf
   `.../neondb`. Zwei Wege:
   - **Sauber:** In der **Neon-Integration** (Vercel → Integrations → Neon → Manage)
     die verbundene Datenbank von `neondb` auf `queryland` umstellen, falls die
     Integration das anbietet. So bleibt die Variable weiter verwaltet.
   - **Manuell (Override):** `DATABASE_URL` für **Production** (und Preview, falls
     gewünscht) auf folgenden Wert setzen:
     ```
     postgresql://neondb_owner:<PASSWORT>@ep-flat-hat-alpplu3m-pooler.c-3.eu-central-1.aws.neon.tech/queryland?channel_binding=require&sslmode=require
     ```
     `<PASSWORT>` aus der bestehenden, von der Integration gesetzten `DATABASE_URL`
     übernehmen (identische Rolle/Host, nur `/neondb` → `/queryland`).
     ⚠️ Achtung: Eine manuell überschriebene Variable kann von der Integration bei
     späteren Änderungen wieder überschrieben werden — daher ist der „saubere" Weg
     vorzuziehen.
3. **Redeploy** auslösen (Deployments → ⋯ → Redeploy), damit der neue Wert greift.
4. Prüfen: `/api/backend/health` → `database.details` muss `.../queryland` zeigen.

## Hinweis

`queryland` ist bereits voll migriert (12/12). Es gehen keine Daten verloren —
in `neondb` stehen aktuell nur Schema + Seed, keine echten Nutzdaten.
