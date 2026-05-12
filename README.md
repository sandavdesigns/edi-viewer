# EDI Viewer

Browserbasierter EDIFACT-Viewer für gängige deutsche Strom- und Gasmarkt-Nachrichten.

## Funktionen

- Läuft vollständig im Browser, ohne Backend-Upload der EDIFACT-Dateien
- Unterstützt EDIFACT-Servicezeichen aus `UNA`
- Liest Segmentstrukturen wie `UNB`, `UNH`, `BGM`, `DTM`, `NAD`, `LOC`, `RFF`, `QTY`, `MOA`, `PRI`, `UNT`, `UNZ`
- Erkennt gängige Nachrichtentypen wie `UTILMD`, `MSCONS`, `INVOIC`, `REMADV`, `APERAK`, `CONTRL`, `PRICAT`, `ORDERS`, `ORDRSP`, `QUOTES` und `REQOTE`
- Zeigt Kerndaten, Geschäftsdaten, Segmenttabelle und SVG-Grafiken
- Rendert große Dateien in Tabellen-Paketen, damit der Browser auch bei mehr MB großen EDIFACT-Dateien bedienbar bleibt
- Exportiert Segmentdaten, Geschäftsdaten und JSON-Analyse

## Lokal öffnen

Die App ist statisch. `index.html` kann direkt im Browser geöffnet werden.
Zum schnellen Testen liegt unter `examples/mscons-sample.edi` eine kleine MSCONS-Beispieldatei.

## Docker

```bash
docker compose up -d
```

Danach ist die App unter <http://localhost:8080> erreichbar.

Das Compose-Setup nutzt direkt `nginx:1.27-alpine` und baut kein eigenes Image. Beim Start lädt der Container die statischen App-Dateien aus diesem GitHub-Repository und serviert sie mit nginx. Das ist besonders für Portainer praktisch, weil kein BuildKit/Builder und keine Host-Datei-Mounts benötigt werden.

## Grenzen

Der Viewer ist ein generischer EDIFACT-Parser mit energiemarktspezifischen Labels und Extraktionen. Er ersetzt keine vollständige Prüfsoftware nach jeweils aktueller BDEW/edi@energy-Anwendungshilfe, zeigt aber die Inhalte lesbar an und exportiert sie für weitere Auswertungen.
