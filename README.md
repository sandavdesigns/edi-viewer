# EDI Viewer

Browserbasierter EDIFACT-Viewer für MSCONS- und ALOCAT-Dateien im deutschen Strom- und Gasmarkt.

## Funktionen

- Läuft vollständig im Browser, ohne Backend-Upload der EDIFACT-Dateien
- Unterstützt EDIFACT-Servicezeichen aus `UNA`
- Liest Segmentstrukturen wie `UNB`, `UNH`, `BGM`, `DTM`, `NAD`, `LOC`, `RFF`, `LIN`, `QTY`, `STS`, `UNT`, `UNZ`
- Erkennt und visualisiert `MSCONS` sowie `ALOCAT`
- Zeigt eine moderne Arbeitsansicht mit Lastgang-Tabelle, Grafik und kompaktem Info-Modal
- Gruppiert MSCONS-Lastgänge nach Zählpunkt und OBIS-Code sowie ALOCAT-Reihen nach `ZEU` und `QTY`-Qualifier; die Einzelzeitpunkte werden als Verlaufspunkte zur ausgewählten Reihe angezeigt
- Rechnet EDIFACT-Zeitstempel aus GMT/UTC automatisch in deutsche Marktzeit (`Europe/Berlin`) um, inklusive Sommer- und Winterzeit
- Unterstützt Mehrfachauswahl von Lastgängen und CSV-Export der Zeitreihen mit formatierten `von`/`bis`-Zeitpunkten, `wert` und `status`
- Der Button `Datei Info` öffnet wichtige Dateieigenschaften als Modal
- Rendert große Dateien in Tabellen-Paketen, damit der Browser auch bei mehr MB großen EDIFACT-Dateien bedienbar bleibt
- Liest Dateien mit UTF-8 oder Windows-1252, damit Umlaute in Zählpunkten korrekt angezeigt werden
- Exportiert ausgewählte oder aktuell gefilterte Lastgänge als CSV

## Lokal öffnen

Die App ist statisch. `index.html` kann direkt im Browser geöffnet werden.
Zum schnellen Testen liegt unter `examples/mscons-sample.edi` eine kleine MSCONS-Beispieldatei.

## Installation mit Docker

```bash
git clone https://github.com/sandavdesigns/edi-viewer.git
cd edi-viewer
docker compose up -d
```

Danach ist die App unter <http://localhost:8080> erreichbar.

Der externe Port kann per Environment Variable gesetzt werden:

```bash
APP_PORT=8090 docker compose up -d
```

Ohne Variable nutzt der Stack weiter Port `8080`.

Optional kann ein Branding gesetzt werden. Ohne diese Variablen bleibt die App im Standarddesign.

```bash
APP_THEME=gotha APP_NAME="Stadtwerke Gotha" docker compose up -d
```

`APP_THEME=gotha` aktiviert ein helles und dunkles Theme auf Basis der Gothaer-Stadtwerke-Energie-Farben. `APP_NAME` ergänzt den Titel oben zu `EDIFACT Lastgang Viewer - <Name>`.

Aktualisieren auf den neuesten Stand:

```bash
git pull
docker compose up -d
```

## Installation mit Portainer

Am einfachsten wird das öffentliche GitHub-Repository direkt als Stack verwendet.

1. In Portainer **Stacks** öffnen.
2. **Add stack** wählen.
3. Als Name zum Beispiel `edi-viewer` eintragen.
4. **Repository** auswählen.
5. Repository URL eintragen: `https://github.com/sandavdesigns/edi-viewer.git`
6. Compose path: `docker-compose.yml`
7. Optional unter **Environment variables** Port, Theme und Namen setzen:

```text
APP_PORT=8090
APP_THEME=gotha
APP_NAME=Stadtwerke Gotha
```

8. Stack deployen.

Die App ist danach unter `http://SERVER-IP:8080` erreichbar, oder bei gesetztem `APP_PORT` unter dem gewählten Port, zum Beispiel `http://SERVER-IP:8090`.

### Port ändern

```text
APP_PORT=8090
```

Der Container selbst hört intern auf Port `80`; `APP_PORT` ändert nur den externen Port auf dem Host.

### Branding ändern

```text
APP_THEME=gotha
APP_NAME=Stadtwerke Gotha
```

`APP_THEME=gotha` nutzt ein helles und dunkles Farbschema nach den Gothaer-Stadtwerke-Energie-Farben. Der vorhandene Umschalter **Auto/Hell/Dunkel** bleibt erhalten. `APP_NAME` ergänzt den Kopfbereich und den Browser-Titel. Wenn `APP_THEME` und `APP_NAME` leer bleiben, wird das Standarddesign verwendet.

Nach einer Änderung der Environment Variables muss der Stack in Portainer neu deployed werden. Falls der Browser noch das alte Design zeigt, einmal hart neu laden oder den Browser-Cache für die Seite leeren.

### Portainer-Hinweis

Das Compose-Setup nutzt direkt `nginx:1.27-alpine` und baut kein eigenes Image. Beim Start lädt der Container die statischen App-Dateien aus diesem GitHub-Repository und serviert sie mit nginx. Dadurch werden in Portainer kein BuildKit/Builder und keine Host-Datei-Mounts benötigt.

Alternativ kann das Repository auch lokal geklont und mit `docker compose up -d` gestartet werden.

## Grenzen

Der Viewer ist ein generischer EDIFACT-Parser mit energiemarktspezifischen Labels und Extraktionen. Er ersetzt keine vollständige Prüfsoftware nach jeweils aktueller BDEW/edi@energy-Anwendungshilfe, zeigt aber die Inhalte lesbar an und exportiert sie für weitere Auswertungen.
