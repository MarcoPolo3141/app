# Zeig, was du kannst! – Projektbegleitung (Desktop-App)

Ein richtiges Desktop-Programm (Electron) mit eigenem Fenster – kein Browser. Läuft lokal, jede Lehrkraft hat ihre eigenen Gruppen/Daten auf dem eigenen Rechner (`daten.json` im Anwendungs-Datenordner). Enthält Dashboard, die vier Projektphasen, automatische Notenberechnung und PDF-Bescheinigung.

## Wichtiger Hinweis vorab

Ich habe die komplette App fertig programmiert und die Kernlogik (Datenhaltung, Notenberechnung, PDF-Erzeugung) automatisiert getestet – alle Tests laufen grün (`npm test`). Ich kann in meiner Arbeitsumgebung hier aber **keine echte .exe/.dmg-Datei erzeugen**, weil das Netzwerk hier auf wenige Adressen beschränkt ist und der Download der Electron-Programmdateien (die für den Bau eines Installers nötig sind) blockiert wird. Das lässt sich nicht umgehen.

Deshalb liegt hier der vollständige Quellcode **plus** eine automatische Bau-Pipeline (GitHub Actions, siehe unten), die genau das für dich erledigt – auf echten Windows- und Mac-Rechnern in der Cloud, inklusive Signierung. Das ist auch der Standardweg, wie so etwas in der echten Softwareentwicklung gemacht wird (auch professionelle Entwickler bauen signierte Mac-Apps nicht "nebenbei" auf einem Linux-Rechner).

## 1. Erst mal ausprobieren (auf deinem eigenen Rechner)

Voraussetzung: [Node.js](https://nodejs.org) (LTS-Version) installieren – einmalig, dauert 2 Minuten.

```bash
cd app
npm install
npm start
```

Es öffnet sich ein eigenes Programmfenster – funktioniert identisch auf Windows und macOS. Das ist die App, so wie sie am Ende aussieht, nur eben noch nicht als fertiger Installer verpackt.

Zum Testen der Kernlogik (ohne Fenster):

```bash
npm test
```

## 2. Wie die Daten gespeichert werden

Jede Installation speichert ihre Daten lokal in einer `daten.json`:

- Windows: `%APPDATA%\zeig-was-du-kannst\daten.json`
- macOS: `~/Library/Application Support/zeig-was-du-kannst/daten.json`

Über *Datei → Datenordner öffnen* in der App gelangt man direkt dorthin. Über *Datei → Datensicherung exportieren* lässt sich die Datei jederzeit als Backup sichern oder z.B. per E-Mail weitergeben.

## 3. Signierte Installer für Windows & Mac bauen

### Was Signierung bedeutet und was du dafür brauchst

Ohne Signatur zeigen Windows (SmartScreen) und macOS (Gatekeeper) beim ersten Start eine Warnung, die einmalig bestätigt werden muss – die App funktioniert trotzdem einwandfrei. Für eine **signierte** Version brauchst du:

| Plattform | Was du brauchst | Ungefähre Kosten |
|---|---|---|
| Windows | Ein Code-Signing-Zertifikat (z.B. bei SSL.com, Sectigo, DigiCert) | ca. 70–300 €/Jahr |
| macOS | Ein Apple Developer Program-Account | 99 $/Jahr |

Diese Zertifikate muss **du** (bzw. die Schule/das Land als Herausgeber) beschaffen – das kann ich nicht für dich erledigen, da dafür eine Firmen-/Personenverifizierung bei Microsoft bzw. Apple nötig ist.

### Weg A – automatisch über GitHub Actions (empfohlen)

1. Lege ein (kostenloses) GitHub-Konto an und erstelle ein neues, privates Repository.
2. Lade den Inhalt dieses `app`-Ordners dort hoch (per GitHub Desktop oder `git push`).
3. Falls vorhanden, hinterlege deine Zertifikate unter *Settings → Secrets and variables → Actions*:
   - `WIN_CSC_LINK` (deine `.pfx`-Datei Base64-codiert) und `WIN_CSC_KEY_PASSWORD`
   - `MAC_CSC_LINK` (deine `.p12`-Datei Base64-codiert) und `MAC_CSC_KEY_PASSWORD`
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (für die Notarisierung bei Apple)
   - Ohne diese Secrets baut die Pipeline trotzdem – nur eben unsigniert.
4. Einen Versions-Tag pushen, z.B.:
   ```bash
   git tag v1.0.0
   git push --tags
   ```
5. GitHub baut automatisch je einen Windows- und einen Mac-Installer und stellt sie unter *Releases* zum Download bereit – die kannst du dann an deine Kolleg:innen weitergeben.

Die fertige Konfiguration dafür liegt bereits unter `.github/workflows/build.yml`.

### Weg B – lokal bauen (nur unsigniert bzw. nur für das eigene Betriebssystem)

```bash
npm run dist:win   # erzeugt eine .exe – funktioniert von Windows UND von deinem Mac aus
npm run dist:mac   # erzeugt eine .dmg – funktioniert zuverlässig nur auf einem echten Mac
```

Die fertigen Dateien landen im Ordner `release/`.

## 4. Verteilung an Kolleg:innen

Einfach die `.exe`- bzw. `.dmg`-Datei weitergeben (E-Mail-Anhang ist meist zu groß – besser über das Schul-Laufwerk oder einen Cloud-Link). Jede Kollegin/jeder Kollege installiert die App auf dem eigenen Rechner und legt dort ihre/seine eigenen Gruppen an – die Daten sind pro Installation getrennt.

## 5. Projektstruktur

```
app/
  src/
    main.js            – Electron-Hauptprozess (Fenster, Menü, Datei-Dialoge)
    preload.js          – sichere Schnittstelle zwischen Fenster und Hauptprozess
    store.js            – lokale Datenhaltung (JSON-Datei)
    certificate.js       – PDF-Erzeugung der Bescheinigung
    renderer/            – die eigentliche Oberfläche (HTML/CSS/JS)
  test/                  – automatisierte Tests der Kernlogik
  build/                 – App-Icon (Windows/Mac/Linux)
  .github/workflows/     – automatischer Bau-/Signier-Prozess
```

## 6. Bekannte Grenzen / mögliche nächste Schritte

- Aktuell ein einfaches, robustes App-Icon (Blitz-Motiv). Kann jederzeit gegen ein eigenes Schul-/Projektlogo ausgetauscht werden (`build/icon.png`, 1024×1024, dann `icon.ico`/`icon.icns` neu erzeugen).
- Kein automatisches Update eingebaut – neue Versionen müssten erneut verteilt werden. Kann bei Bedarf ergänzt werden (`electron-updater`).
- Datenhaltung ist bewusst "jede Lehrkraft für sich" – falls doch ein gemeinsamer Datenzugriff gewünscht ist, ist das eine größere Erweiterung (siehe Rückfrage zu Beginn).
