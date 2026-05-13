# NeonFrame – Setup-Anleitung

## Was du brauchst
- ✅ Supabase-Account (hast du bereits)
- ⬜ Vercel-Account (kostenlos, brauchst du noch)
- ⬜ GitHub-Account (kostenlos, für Deployment)

---

## Schritt 1 – Supabase einrichten (5 Minuten)

1. Gehe zu **supabase.com** → dein Projekt öffnen
2. Links im Menü: **SQL Editor** → **New query**
3. Inhalt der Datei `supabase-setup.sql` komplett reinkopieren
4. Auf **Run** klicken → fertig!

Jetzt nochmal links: **Settings → API** – dort brauchst du:
- `Project URL` → das ist dein `SUPABASE_URL`
- `anon public` Key → das ist dein `SUPABASE_ANON_KEY`

---

## Schritt 2 – Vercel-Account erstellen (2 Minuten)

1. Gehe zu **vercel.com** → "Sign Up" → "Continue with GitHub"
2. Fertig

---

## Schritt 3 – Projekt auf GitHub hochladen (3 Minuten)

1. Gehe zu **github.com** → "New repository"
2. Name: `neonframe` → "Create repository"
3. Den Ordner `neonframe` auf deinen Computer entpacken
4. Im Terminal (oder GitHub Desktop):
   ```
   cd neonframe
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/DEIN-USER/neonframe.git
   git push -u origin main
   ```

---

## Schritt 4 – Auf Vercel deployen (3 Minuten)

1. **vercel.com** → "Add New Project"
2. Dein `neonframe` GitHub-Repo auswählen → "Import"
3. Bei **Environment Variables** folgendes eintragen:

   | Name | Wert |
   |------|------|
   | `NEXT_PUBLIC_SUPABASE_URL` | deine Project URL aus Schritt 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dein anon key aus Schritt 1 |
   | `ADMIN_PASSWORD` | dein gewünschtes Admin-Passwort |
   | `NEXT_PUBLIC_ADMIN_PW` | dasselbe Passwort (für Client) |

4. "Deploy" klicken → nach ~2 Minuten ist die Seite live!

---

## Schritt 5 – Domain verbinden (neonframe.de)

1. In Vercel: dein Projekt → **Settings → Domains**
2. `neonframe.de` eingeben → "Add"
3. Vercel zeigt dir DNS-Einträge → die bei deinem Domain-Anbieter eintragen
4. Nach 5–30 Minuten ist `neonframe.de` live

---

## Fertig! So funktioniert das System

| URL | Was |
|-----|-----|
| `neonframe.de/admin` | Deine Admin-Seite (passwortgeschützt) |
| `neonframe.de/angebot/[id]` | Individuelle Kundenseite |

**Workflow:**
1. `neonframe.de/admin` aufrufen → Passwort eingeben
2. PDF hochladen → Daten automatisch erkannt
3. Bild hochladen → direkt in Supabase gespeichert
4. Preise prüfen/anpassen
5. "Veröffentlichen" klicken → Link wird generiert
6. Link an Kunden schicken – fertig!

---

## Passwort ändern

In Vercel: **Settings → Environment Variables** → `ADMIN_PASSWORD` und `NEXT_PUBLIC_ADMIN_PW` ändern → "Save" → "Redeploy"

---

## Fragen?

Wende dich an deinen Entwickler oder öffne ein neues Chat mit Claude.
