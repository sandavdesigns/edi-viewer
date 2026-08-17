# Admin-Handbuch

Dieses Dokument beschreibt Betrieb, Installation und Wartung des EDI Viewers.

## Zweck

Der EDI Viewer ist eine browserbasierte Anwendung zum Anzeigen und Exportieren von EDIFACT-Lastgangdaten im deutschen Energiemarkt. Der aktuelle Fokus liegt auf `MSCONS` und `ALOCAT`.

Die Anwendung richtet sich an Anwender, die EDIFACT-Dateien prüfen, Lastgänge ansehen, Einzelwerte nachvollziehen und Daten als CSV weiterverarbeiten möchten.

## Architektur

- Die Anwendung ist eine statische Web-App aus `index.html`, `styles.css` und `app.js`.
- Es gibt kein Backend und keine serverseitige Dateiablage.
- Dateien werden im Browser des Anwenders gelesen und verarbeitet.
- Der Docker-Container nutzt `nginx:1.27-alpine` zum Ausliefern der statischen Dateien.
- Beim Portainer-Setup lädt der Container beim Start den aktuellen Stand aus dem GitHub-Repository.

## Datenschutz und Dateiverarbeitung

EDIFACT-Dateien werden nicht an einen Server hochgeladen. Die Datei wird lokal im Browser des Anwenders eingelesen. Der nginx-Container liefert nur die App-Dateien aus.

Wichtig für den Betrieb:

- Keine EDIFACT-Dateien werden im Container gespeichert.
- Keine EDIFACT-Dateien werden an GitHub gesendet.
- Ein Neuladen der Seite entfernt die aktuell geladene Datei aus der Browser-Sitzung.

## Unterstützte Formate

Aktuell unterstützt:

- `MSCONS`
- `ALOCAT`

Die App erkennt EDIFACT-Servicezeichen aus `UNA` und verarbeitet unter anderem Segmente wie `UNB`, `UNH`, `BGM`, `DTM`, `NAD`, `LOC`, `RFF`, `LIN`, `QTY`, `STS`, `UNT` und `UNZ`.

EDIFACT-Zeitstempel werden aus GMT/UTC in deutsche Marktzeit `Europe/Berlin` umgerechnet. Sommerzeit und Winterzeit werden berücksichtigt.

## Installation mit Portainer

1. In Portainer **Stacks** öffnen.
2. **Add stack** wählen.
3. Stack-Name zum Beispiel `edi-viewer`.
4. Als Quelle **Repository** auswählen.
5. Repository URL eintragen:

```text
https://github.com/sandavdesigns/edi-viewer.git
```

6. Compose path eintragen:

```text
docker-compose.yml
```

7. Optional Environment Variables setzen:

```text
APP_PORT=8090
APP_THEME=energie
APP_NAME=Energieportal
```

8. Stack deployen.

Ohne `APP_PORT` ist die Anwendung unter `http://SERVER-IP:8080` erreichbar. Mit `APP_PORT=8090` entsprechend unter `http://SERVER-IP:8090`.

## Installation mit Docker Compose

```bash
git clone https://github.com/sandavdesigns/edi-viewer.git
cd edi-viewer
docker compose up -d
```

Standard-Port:

```text
8080
```

Anderer Port:

```bash
APP_PORT=8090 docker compose up -d
```

## Environment Variables

| Variable | Beispiel | Beschreibung |
| --- | --- | --- |
| `APP_PORT` | `8090` | Externer Host-Port. Intern hört nginx auf Port `80`. |
| `APP_THEME` | `energie` | Optionales Branding-Theme. Leer lassen für Standarddesign. |
| `APP_NAME` | `Energieportal` | Optionaler Name im Kopfbereich und Browser-Titel. |

`APP_THEME=energie` aktiviert ein helles und dunkles Energie-Farbschema. Der Umschalter **Auto/Hell/Dunkel** bleibt für Anwender erhalten.

Wenn `APP_THEME` und `APP_NAME` leer bleiben, verhält sich die App wie im Standardzustand.

## PV-Potentialanalyse

Die App enthält eine PV-Potentialanalyse für geladene Lastgänge. Sie wird über den Button **PV-Auswertung** im Kopfbereich geöffnet.

Die Analyse bewertet je Zeitreihe:

- Jahres- bzw. Zeitraumverbrauch
- Verbrauchsanteil in ausrichtungsgewichteten PV-Zeiten
- Abend- und Nachtanteile
- grobe PV-Leistung in `kWp`
- grobe Speichergröße in `kWh`
- Hinweis, ob der Zeitraum ein volles Jahr abdeckt

Im Dialog kann eine Dachausrichtung gewählt werden:

- Nord
- Nordost
- Ost
- Südost
- Süd
- Südwest
- West
- Nordwest

Die Auswahl verschiebt die relevante PV-Zeit in Richtung Vormittag oder Nachmittag und gewichtet den groben Ertrag gegenüber einer Süd-Ausrichtung. Dadurch ändern sich PV-Zeitanteil, grobe kWp-Bandbreite und Speicherhinweis.

Die Analyse ist eine Heuristik. Sie nutzt nur den Lastgang und die gewählte Ausrichtung, kennt aber keinen Standort, keine Dachfläche, keine Dachneigung, keine Verschattung, keine Strompreise und keine Einspeisevergütung. Sie eignet sich als Vorabschätzung, nicht als finale Anlagenplanung.

## MSCONS bündeln/trennen

Die App enthält ein offenes Werkzeug, um mehrere geladene MSCONS-Dateien zusammenzuführen und anschließend wieder zählpunktscharf zu trennen. Es wird über den Button **MSCONS bündeln/trennen** im Kopfbereich geöffnet. Zusätzlich bleibt dieses Tastenkürzel verfügbar:

```text
Strg+Alt+M
```

Funktion:

- alle aktuell geladenen Dateien werden ausgewertet
- gleiche Kombinationen aus `Zählpunkt + OBIS` werden zusammengeführt
- getrennte Zeiträume aus mehreren Dateien werden zu einer Zeitreihe kombiniert
- exakte doppelte Zeiträume werden nur einmal übernommen
- je Kombination werden Zeitraum, Anzahl Werte, Summe, Jahressumme und Anzahl Quelldateien angezeigt
- über `Jahressumme von/bis` können passende Kombinationen gefiltert werden
- ausgewählte Kombinationen können zählpunktscharf als ZIP exportiert werden; mehrere ausgewählte OBIS desselben Zählpunkts landen gemeinsam in einer MSCONS-Datei innerhalb der ZIP
- zusätzlich enthält die ZIP eine Sammeldatei `ZZ_ALLE_ZAEHLPUNKTE_MSCONS.txt` mit allen ausgewählten Kombinationen

Hinweis: Die exportierten MSCONS-Dateien werden neu aus dem internen Lastgangmodell erzeugt. Sie sind kein 1:1 Segment-Schnitt der Originaldateien. Vor produktiver Weitergabe sollten sie fachlich und prozessual geprüft werden.

## Updates

### Portainer

1. Stack öffnen.
2. **Update the stack** wählen.
3. Falls Portainer fragt, Repository erneut ziehen lassen.
4. Stack neu deployen.
5. Im Browser hart neu laden, falls alte Dateien sichtbar bleiben.

### Docker Compose

```bash
git pull
docker compose up -d
```

## Bedienlogik für Anwender

- Dateien können per Drag-and-drop oder über **Dateien wählen** geladen werden.
- Mehrere Dateien werden als Tabs geöffnet.
- Links steht der Nachrichtenbaum.
- Rechts oben steht die Lastgangübersicht.
- Unten steht die Grafik zum ausgewählten Lastgang.
- Ein Klick auf einen Zählpunkt im Baum filtert rechts auf diesen Zählpunkt.
- Ein Klick auf einen OBIS-Eintrag im Baum öffnet die Einzelwert-Tabelle.
- In der Einzelwert-Tabelle markiert ein Klick auf eine Zeile den Punkt in der Grafik.
- In der Einzelwertansicht markiert ein Klick in die Grafik den passenden Tabellenwert.

## Export

Die App bietet zwei CSV-Exporte für Lastgänge:

- Wenn Lastgänge angehakt sind, werden die angehakten Lastgänge exportiert.
- Wenn nichts angehakt ist, werden die aktuell gefilterten Lastgänge exportiert.
- **CSV** erzeugt den breiten Export: Bei mehreren Lastgängen werden die Kombinationen aus Zählpunkt und OBIS nebeneinander am gleichen Zeitpunkt ausgegeben. Zahlen werden ohne Tausendertrennpunkt und mit Dezimalkomma exportiert. Bei mehreren Lastgängen wird kein Status exportiert.
- **CSV lang** erzeugt eine Zeile je Messwert mit den Spalten `von`, `bis`, `location`, `Einheit`, `amount`. Die Zeitpunkte werden im Format `yyyy-mm-dd hh:mm:ss` und Werte mit Dezimalpunkt ausgegeben.

Die Schaltfläche **Kopieren** kopiert die aktuell angezeigte Tabelle als tabulatorgetrennte Daten, sodass sie direkt in Excel eingefügt werden kann.

## Repo-Struktur

| Datei/Ordner | Zweck |
| --- | --- |
| `index.html` | Grundstruktur der App |
| `styles.css` | Layout, Hell/Dunkel-Theme und Branding |
| `app.js` | Parser, UI-Logik, Tabellen, Grafik und Export |
| `config.js` | Standard-Konfiguration für lokalen/statischen Betrieb |
| `config.template.js` | Template für Docker/Portainer-Environment |
| `docker-compose.yml` | Portainer- und Docker-Compose-Setup |
| `Dockerfile` | Alternative Image-Build-Variante |
| `nginx.conf` | nginx-Konfiguration bei eigenem Image-Build |
| `examples/` | Beispieldateien |
| `docs/` | Betriebs- und Admin-Dokumentation |

## Troubleshooting

### Theme oder Name ändern sich nicht

Prüfen:

- Sind `APP_THEME` und `APP_NAME` in Portainer unter **Environment variables** gesetzt?
- Wurde der Stack nach der Änderung neu deployed?
- Wurde die Seite im Browser hart neu geladen?

Zum Prüfen kann im Browser diese Datei geöffnet werden:

```text
http://SERVER-IP:PORT/config.js
```

Dort sollten die gesetzten Werte sichtbar sein.

### Port ist nicht erreichbar

Prüfen:

- Ist der Stack gestartet?
- Ist der Host-Port frei?
- Ist `APP_PORT` korrekt gesetzt?
- Wird die URL mit dem externen Port aufgerufen?

Beispiel:

```text
APP_PORT=8090
http://SERVER-IP:8090
```

### Stack startet nicht in Portainer

Das aktuelle Compose-Setup baut kein eigenes Image und nutzt keine Host-Mounts. Falls der Start trotzdem fehlschlägt:

- Portainer-Log des Containers prüfen.
- Netzwerkzugriff des Docker-Hosts auf GitHub prüfen.
- Sicherstellen, dass `nginx:1.27-alpine` gezogen werden kann.

### Alte Version sichtbar

Der Container lädt beim Start den aktuellen Stand aus dem GitHub-Repository. Nach Updates:

- Stack neu deployen.
- Browser hart neu laden.
- Falls nötig Browser-Cache für die Seite leeren.

### Große Dateien wirken langsam

Die Verarbeitung passiert bewusst im Browser. Große Dateien können CPU und RAM des Arbeitsplatzrechners belasten. Die App rendert Tabellen in Paketen, damit die Oberfläche bedienbar bleibt, aber sehr große EDIFACT-Dateien bleiben clientseitig rechenintensiv.

Empfehlungen:

- Moderne Chromium- oder Firefox-Version nutzen.
- Nur benötigte Dateien gleichzeitig öffnen.
- Nach sehr großen Dateien den Tab neu laden, wenn der Browser träge bleibt.

## Grenzen

Der Viewer ist ein Anzeige- und Exportwerkzeug. Er ersetzt keine vollständige fachliche Prüfsoftware nach jeweils aktueller BDEW- oder edi@energy-Anwendungshilfe.

Die Extraktion ist auf die im Projekt unterstützten MSCONS- und ALOCAT-Strukturen ausgelegt. Andere EDIFACT-Nachrichten können als Rohsegmente sichtbar sein, werden aber nicht als Lastgangansicht garantiert unterstützt.
