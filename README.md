# Habit Tracker

Persönlicher Gewohnheitstracker als Progressive Web App (PWA) – läuft auf MacBook und iPhone, komplett offline, ohne Konto und ohne Server-Backend. Alle Daten bleiben lokal auf dem Gerät (localStorage).

**Live-Version:** <https://krbi-ma.github.io/habit-tracker/>
**Repository:** <https://github.com/KRBI-MA/habit-tracker>

## Funktionen

- Gewohnheiten anlegen mit Name, Emoji, Farbe und Wochentagen (täglich oder z. B. nur Mo/Mi/Fr)
- Tägliches Abhaken mit Fortschrittsring
- 7-Tage-Leiste: vergangene Tage ansehen und nachtragen
- Serien (Streaks 🔥) und Statistik (Erfüllungsquote der letzten 30 Tage, Rekord-Serie)
- Erinnerungen: Benachrichtigung bei geöffneter App plus geführte Einrichtung einer **Kurzbefehle-Automation** (App Kurzbefehle → Automation → Uhrzeit → „Mitteilung anzeigen“) für aktive Mitteilungen auch bei geschlossener App – auf iPhone und Mac
- Datenexport/-import als JSON (z. B. um Daten vom Mac aufs iPhone zu übertragen)
- Dark Mode folgt automatisch der Systemeinstellung
- Offline-fähig dank Service Worker

## Auf dem MacBook starten

```bash
cd "/Users/korbinianmaier/Claude Projekte/Habit Tracker"
python3 -m http.server 8642
```

Dann im Browser öffnen: <http://localhost:8642>

Tipp: In Safari über **Ablage → Zum Dock hinzufügen** (bzw. in Chrome „App installieren") wird daraus eine eigenständige Mac-App.

## Auf dem iPhone nutzen

Die App ist über GitHub Pages gehostet (siehe Live-Version oben):

1. <https://krbi-ma.github.io/habit-tracker/> in **Safari** öffnen
2. **Teilen-Button → „Zum Home-Bildschirm"**
3. Die App erscheint mit eigenem Icon und läuft im Vollbild wie eine native App – auch offline

> Hinweis: Mac und iPhone haben jeweils eigene lokale Daten. Zum Übertragen: Statistik (📊) → **Daten exportieren** auf dem einen Gerät, **Importieren** auf dem anderen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | App-Gerüst und Dialoge |
| `styles.css` | Design (hell/dunkel) |
| `app.js` | Gesamte Logik und Datenhaltung |
| `manifest.webmanifest` | PWA-Manifest (Installierbarkeit) |
| `sw.js` | Service Worker (Offline-Cache) |
| `icons/` | App-Icons |
