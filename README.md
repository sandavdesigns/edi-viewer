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
- Der Button `Datei Info` öffnet wichtige Dateieigenschaften und Prüfhinweise als Modal
- Rendert große Dateien in Tabellen-Paketen, damit der Browser auch bei mehr MB großen EDIFACT-Dateien bedienbar bleibt
- Liest Dateien mit UTF-8 oder Windows-1252, damit Umlaute in Zählpunkten korrekt angezeigt werden
- Exportiert ausgewählte Lastgänge als CSV und die komplette Analyse als JSON

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
