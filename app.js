"use strict";

const state = {
  fileName: "",
  parsed: null,
  segmentFilter: "",
  businessFilter: "",
  chartMode: "segments",
};

const SEGMENT_LABELS = {
  UNA: "Service-Zeichen",
  UNB: "Nutzdaten-Kopf",
  UNH: "Nachrichten-Kopf",
  BGM: "Dokument/Transaktion",
  DTM: "Datum/Zeit",
  RFF: "Referenz",
  NAD: "Marktpartner",
  CTA: "Kontakt",
  COM: "Kommunikation",
  LOC: "Ort/Marktlokation/Messlokation",
  LIN: "Positionszeile",
  PIA: "Zusätzliche Produktkennung",
  IMD: "Beschreibung",
  QTY: "Menge",
  MOA: "Betrag",
  PRI: "Preis",
  TAX: "Steuer",
  CUX: "Währung",
  MEA: "Messwert",
  STS: "Status",
  FTX: "Freitext",
  SCC: "Zeitplan",
  UNS: "Abschnittswechsel",
  CNT: "Kontrollsumme",
  UNT: "Nachrichten-Ende",
  UNZ: "Nutzdaten-Ende",
};

const MESSAGE_TYPES = {
  UTILMD: "Stammdaten / Lieferantenwechsel / Marktprozesse",
  MSCONS: "Messwerte und Energiemengen",
  INVOIC: "Rechnung",
  REMADV: "Zahlungsavis",
  APERAK: "Anwendungsfehler und Rückmeldungen",
  CONTRL: "Syntax- und Empfangsbestätigung",
  PRICAT: "Preiskatalog",
  ORDERS: "Auftrag",
  ORDRSP: "Auftragsantwort",
  QUOTES: "Angebot",
  REQOTE: "Angebotsanforderung",
};

const QUALIFIER_LABELS = {
  DTM: {
    137: "Dokumentdatum",
    157: "Gültig ab",
    158: "Gültig bis",
    163: "Lieferbeginn",
    164: "Lieferende",
    293: "Ausführungsdatum",
    324: "Nachrichtenzeitraum",
  },
  NAD: {
    MS: "Absender",
    MR: "Empfänger",
    SU: "Lieferant",
    DP: "Lieferstelle",
    UD: "Endkunde",
    Z01: "Netzbetreiber",
    Z02: "Lieferant",
    Z03: "Messstellenbetreiber",
    Z04: "Bilanzkreisverantwortlicher",
    Z05: "Messdienstleister",
    Z06: "Übertragungsnetzbetreiber",
  },
  LOC: {
    172: "Marktlokation",
    Z16: "Messlokation",
    Z18: "Netzlokation",
    237: "Ort",
  },
  RFF: {
    AAK: "Geschäftsvorfall",
    ACE: "Referenz",
    AHL: "Vorgangsnummer",
    AGO: "Lieferantennummer",
    MG: "Zählernummer",
    Z13: "Marktlokation",
    Z14: "Messlokation",
    Z30: "Bilanzkreis",
  },
  QTY: {
    47: "Berechnete Menge",
    61: "Zurückgewiesene Menge",
    79: "Gesamtmenge",
    136: "Energieverbrauch",
    Z07: "Menge",
    Z10: "Arbeitsmenge",
  },
  MOA: {
    9: "Fälliger Betrag",
    39: "Rechnungsbetrag",
    77: "Steuerbetrag",
    79: "Positionsbetrag",
    124: "Steuerbasis",
    203: "Abschlagsbetrag",
  },
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  fileInputSecondary: document.querySelector("#fileInputSecondary"),
  dropZone: document.querySelector("#dropZone"),
  fileName: document.querySelector("#fileName"),
  messageType: document.querySelector("#messageType"),
  segmentCount: document.querySelector("#segmentCount"),
  validationState: document.querySelector("#validationState"),
  factsList: document.querySelector("#factsList"),
  chart: document.querySelector("#chart"),
  chartMode: document.querySelector("#chartMode"),
  segmentFilter: document.querySelector("#segmentFilter"),
  businessFilter: document.querySelector("#businessFilter"),
  segmentsTable: document.querySelector("#segmentsTable"),
  businessTable: document.querySelector("#businessTable"),
  exportSegments: document.querySelector("#exportSegments"),
  exportBusiness: document.querySelector("#exportBusiness"),
  exportJson: document.querySelector("#exportJson"),
  emptyRowTemplate: document.querySelector("#emptyRowTemplate"),
};

function parseEdifact(rawText) {
  const text = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const chars = detectServiceChars(text);
  const payload = text.startsWith("UNA") ? text.slice(9) : text;
  const rawSegments = splitReleased(payload, chars.segmentTerminator, chars.releaseChar)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const segments = rawSegments.map((raw, index) => {
    const parts = splitReleased(raw, chars.elementSeparator, chars.releaseChar);
    const tag = parts.shift() || "";
    const elements = parts.map((element) => splitReleased(element, chars.componentSeparator, chars.releaseChar));
    return {
      index: index + 1,
      tag,
      label: SEGMENT_LABELS[tag] || "EDIFACT-Segment",
      elements,
      raw,
    };
  });

  const businessRows = extractBusinessRows(segments);
  const facts = extractFacts(segments, businessRows, chars);
  const validation = validateInterchange(segments);

  return { chars, segments, businessRows, facts, validation };
}

function detectServiceChars(text) {
  if (text.startsWith("UNA") && text.length >= 9) {
    return {
      componentSeparator: text[3],
      elementSeparator: text[4],
      decimalMark: text[5],
      releaseChar: text[6],
      repetitionSeparator: text[7],
      segmentTerminator: text[8],
    };
  }

  return {
    componentSeparator: ":",
    elementSeparator: "+",
    decimalMark: ".",
    releaseChar: "?",
    repetitionSeparator: "*",
    segmentTerminator: "'",
  };
}

function splitReleased(value, separator, releaseChar) {
  const result = [];
  let current = "";
  let released = false;

  for (const char of value) {
    if (released) {
      current += char;
      released = false;
      continue;
    }
    if (char === releaseChar) {
      released = true;
      continue;
    }
    if (char === separator) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current);
  return result;
}

function extractBusinessRows(segments) {
  const rows = [];
  let currentLine = "";

  for (const segment of segments) {
    const first = segment.elements[0] || [];
    const qualifier = first[0] || segment.elements[0]?.[0] || "";
    const value = first[1] || segment.elements[1]?.[0] || "";
    const extra = first.slice(2).concat(segment.elements.slice(1).flat()).filter(Boolean).join(" / ");

    if (segment.tag === "LIN") {
      currentLine = segment.elements.flat().filter(Boolean).join(" / ");
      rows.push(makeRow("Position", "", currentLine || `Position ${segment.index}`, "", segment));
    }

    if (segment.tag === "UNH") {
      const type = segment.elements[1]?.[0] || "";
      rows.push(makeRow("Nachricht", type, describeMessageType(type), segment.elements[1]?.slice(1).join(" / "), segment));
    }

    if (segment.tag === "BGM") {
      rows.push(makeRow("Dokument", segment.elements[0]?.[0] || "", segment.elements[1]?.[0] || "", segment.elements[2]?.[0] || "", segment));
    }

    if (segment.tag === "DTM") {
      rows.push(makeRow("Datum", qualifier, formatEdifactDate(value, first[2]), qualifierLabel("DTM", qualifier), segment));
    }

    if (segment.tag === "NAD") {
      const party = [segment.elements[1]?.[0], segment.elements[2]?.join(" "), segment.elements[4]?.join(" ")].filter(Boolean).join(" / ");
      rows.push(makeRow("Marktpartner", segment.elements[0]?.[0] || "", party, qualifierLabel("NAD", segment.elements[0]?.[0]), segment));
    }

    if (segment.tag === "LOC") {
      rows.push(makeRow("Lokation", qualifier, value, qualifierLabel("LOC", qualifier), segment));
    }

    if (segment.tag === "RFF") {
      rows.push(makeRow("Referenz", qualifier, value, qualifierLabel("RFF", qualifier), segment));
    }

    if (segment.tag === "QTY") {
      rows.push(makeRow("Menge", qualifier, normalizeDecimal(value), [qualifierLabel("QTY", qualifier), first[2], currentLine].filter(Boolean).join(" / "), segment));
    }

    if (segment.tag === "MOA") {
      rows.push(makeRow("Betrag", qualifier, normalizeDecimal(value), [qualifierLabel("MOA", qualifier), first[2], currentLine].filter(Boolean).join(" / "), segment));
    }

    if (segment.tag === "PRI") {
      rows.push(makeRow("Preis", qualifier, normalizeDecimal(value), extra, segment));
    }

    if (segment.tag === "MEA") {
      rows.push(makeRow("Messwert", qualifier, segment.elements.flat().filter(Boolean).join(" / "), "", segment));
    }

    if (segment.tag === "STS") {
      rows.push(makeRow("Status", qualifier, segment.elements.flat().filter(Boolean).join(" / "), "", segment));
    }

    if (segment.tag === "FTX") {
      rows.push(makeRow("Freitext", qualifier, segment.elements.flat().filter(Boolean).join(" "), "", segment));
    }
  }

  return rows;
}

function makeRow(type, qualifier, value, extra, segment) {
  return {
    type,
    qualifier: qualifier || "",
    value: value || "",
    extra: extra || "",
    segment: `${segment.index} ${segment.tag}`,
  };
}

function extractFacts(segments, rows, chars) {
  const firstUnb = segments.find((segment) => segment.tag === "UNB");
  const firstUnh = segments.find((segment) => segment.tag === "UNH");
  const messageType = firstUnh?.elements[1]?.[0] || "";
  const version = firstUnh?.elements[1]?.slice(1).filter(Boolean).join(".") || "";
  const sender = firstUnb?.elements[1]?.join(":") || rows.find((row) => row.type === "Marktpartner" && row.qualifier === "MS")?.value || "";
  const receiver = firstUnb?.elements[2]?.join(":") || rows.find((row) => row.type === "Marktpartner" && row.qualifier === "MR")?.value || "";
  const references = rows.filter((row) => row.type === "Referenz").length;
  const quantities = rows.filter((row) => row.type === "Menge").length;
  const amounts = rows.filter((row) => row.type === "Betrag").length;

  return {
    messageType,
    messageDescription: describeMessageType(messageType),
    version,
    sender,
    receiver,
    interchangeRef: firstUnb?.elements[4]?.[0] || "",
    syntax: firstUnb?.elements[0]?.join(":") || "",
    separators: `Element ${chars.elementSeparator} · Komponente ${chars.componentSeparator} · Release ${chars.releaseChar}`,
    references,
    quantities,
    amounts,
  };
}

function validateInterchange(segments) {
  const issues = [];
  const untSegments = segments.filter((segment) => segment.tag === "UNT");
  const unhSegments = segments.filter((segment) => segment.tag === "UNH");
  const unz = segments.find((segment) => segment.tag === "UNZ");

  if (!segments.some((segment) => segment.tag === "UNB")) issues.push("UNB fehlt");
  if (!unhSegments.length) issues.push("UNH fehlt");
  if (untSegments.length !== unhSegments.length) issues.push("UNH/UNT Anzahl passt nicht");
  if (!unz) issues.push("UNZ fehlt");

  for (const unt of untSegments) {
    const expected = Number(unt.elements[0]?.[0]);
    if (!Number.isFinite(expected)) continue;
    const previousUnh = [...segments].slice(0, unt.index).reverse().find((segment) => segment.tag === "UNH");
    if (!previousUnh) continue;
    const actual = unt.index - previousUnh.index + 1;
    if (expected !== actual) issues.push(`UNT ${unt.index}: erwartet ${expected}, gefunden ${actual}`);
  }

  return {
    ok: issues.length === 0,
    message: issues.length ? issues.join("; ") : "Formal plausibel",
  };
}

function describeMessageType(type) {
  return type ? `${type} · ${MESSAGE_TYPES[type] || "EDIFACT-Nachricht"}` : "-";
}

function qualifierLabel(segment, qualifier) {
  return QUALIFIER_LABELS[segment]?.[qualifier] || "";
}

function formatEdifactDate(value, format) {
  if (!value) return "";
  if (format === "102" && /^\d{8}$/.test(value)) return `${value.slice(6, 8)}.${value.slice(4, 6)}.${value.slice(0, 4)}`;
  if (format === "203" && /^\d{12}$/.test(value)) return `${value.slice(6, 8)}.${value.slice(4, 6)}.${value.slice(0, 4)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
  if (format === "303" && /^\d{14}$/.test(value)) return `${value.slice(6, 8)}.${value.slice(4, 6)}.${value.slice(0, 4)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
  if (format === "718" && value.includes("-")) {
    return value.split("-").map((part) => formatEdifactDate(part, "102")).join(" bis ");
  }
  return value;
}

function normalizeDecimal(value) {
  return String(value || "").replace(",", ".");
}

function render() {
  const parsed = state.parsed;
  els.fileName.textContent = state.fileName || "Noch keine Datei";
  els.messageType.textContent = parsed ? describeMessageType(parsed.facts.messageType) : "-";
  els.segmentCount.textContent = parsed ? String(parsed.segments.length) : "0";
  els.validationState.textContent = parsed ? parsed.validation.message : "Bereit";
  els.validationState.style.color = parsed ? (parsed.validation.ok ? "var(--accent-3)" : "var(--danger)") : "var(--muted)";

  renderFacts(parsed);
  renderBusinessTable(parsed);
  renderSegmentsTable(parsed);
  renderChart(parsed);
}

function renderFacts(parsed) {
  els.factsList.innerHTML = "";
  if (!parsed) {
    els.factsList.append(factNode("Status", "Datei laden, um Kerndaten zu sehen"));
    return;
  }

  const facts = [
    ["Nachricht", parsed.facts.messageDescription],
    ["Version", parsed.facts.version || "-"],
    ["Absender", parsed.facts.sender || "-"],
    ["Empfänger", parsed.facts.receiver || "-"],
    ["Interchange", parsed.facts.interchangeRef || "-"],
    ["Syntax", parsed.facts.syntax || "-"],
    ["Trennzeichen", parsed.facts.separators],
    ["Extrahiert", `${parsed.facts.references} Referenzen · ${parsed.facts.quantities} Mengen · ${parsed.facts.amounts} Beträge`],
  ];

  for (const [label, value] of facts) {
    els.factsList.append(factNode(label, value));
  }
}

function factNode(label, value) {
  const wrapper = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = value;
  wrapper.append(dt, dd);
  return wrapper;
}

function renderBusinessTable(parsed) {
  els.businessTable.innerHTML = "";
  const rows = parsed?.businessRows.filter((row) => includesFilter(row, state.businessFilter)) || [];
  if (!rows.length) return appendEmpty(els.businessTable);

  for (const row of rows) {
    const tr = document.createElement("tr");
    appendCell(tr, row.type);
    appendCell(tr, row.qualifier);
    appendCell(tr, row.value);
    appendCell(tr, row.extra);
    appendCell(tr, row.segment, "mono");
    els.businessTable.append(tr);
  }
}

function renderSegmentsTable(parsed) {
  els.segmentsTable.innerHTML = "";
  const rows = parsed?.segments.filter((segment) => includesFilter(segment, state.segmentFilter)) || [];
  if (!rows.length) return appendEmpty(els.segmentsTable);

  for (const segment of rows) {
    const tr = document.createElement("tr");
    appendCell(tr, String(segment.index), "mono");
    const tag = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "tag-pill";
    pill.textContent = segment.tag;
    tag.append(pill);
    tr.append(tag);
    appendCell(tr, segment.label);
    appendCell(tr, segment.elements.map((parts) => parts.join(":")).join(" + "), "mono");
    appendCell(tr, segment.raw, "mono");
    els.segmentsTable.append(tr);
  }
}

function appendCell(row, text, className = "") {
  const td = document.createElement("td");
  td.textContent = text || "";
  if (className) td.className = className;
  row.append(td);
}

function appendEmpty(target) {
  target.append(els.emptyRowTemplate.content.firstElementChild.cloneNode(true));
}

function includesFilter(value, filter) {
  if (!filter) return true;
  return JSON.stringify(value).toLowerCase().includes(filter.toLowerCase());
}

function renderChart(parsed) {
  const svg = els.chart;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 720 300");

  if (!parsed) {
    drawEmptyChart(svg);
    return;
  }

  if (state.chartMode === "quantities") {
    drawQuantityChart(svg, parsed.businessRows);
  } else {
    drawSegmentChart(svg, parsed.segments);
  }
}

function drawEmptyChart(svg) {
  addText(svg, 360, 145, "Keine Datei geladen", "middle", "var(--muted)", 18, 700);
}

function drawSegmentChart(svg, segments) {
  const counts = Object.entries(
    segments.reduce((acc, segment) => {
      acc[segment.tag] = (acc[segment.tag] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const max = Math.max(...counts.map(([, count]) => count), 1);
  const barHeight = 18;
  counts.forEach(([tag, count], index) => {
    const y = 22 + index * 26;
    const width = Math.max(4, (count / max) * 510);
    addText(svg, 24, y + 14, tag, "start", "#26312c", 13, 800);
    addRect(svg, 92, y, width, barHeight, index % 2 ? "var(--accent)" : "var(--accent-2)");
    addText(svg, 612, y + 14, String(count), "end", "#26312c", 13, 750);
  });
}

function drawQuantityChart(svg, rows) {
  const values = rows
    .filter((row) => row.type === "Menge")
    .map((row) => Number(row.value))
    .filter((value) => Number.isFinite(value))
    .slice(0, 18);

  if (!values.length) {
    addText(svg, 360, 145, "Keine Mengenwerte gefunden", "middle", "var(--muted)", 18, 700);
    return;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 44 + (index / Math.max(values.length - 1, 1)) * 620;
    const y = 250 - ((value - min) / range) * 190;
    return [x, y, value];
  });

  addLine(svg, 44, 250, 676, 250, "#c5d0c9");
  addLine(svg, 44, 46, 44, 250, "#c5d0c9");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--accent)");
  path.setAttribute("stroke-width", "3");
  svg.append(path);

  points.forEach(([x, y, value]) => {
    addCircle(svg, x, y, 4, "var(--accent-2)");
    addText(svg, x, y - 10, compactNumber(value), "middle", "#26312c", 11, 700);
  });
}

function addRect(svg, x, y, width, height, fill) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("rx", 4);
  rect.setAttribute("fill", fill);
  svg.append(rect);
}

function addLine(svg, x1, y1, x2, y2, stroke) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", stroke);
  line.setAttribute("stroke-width", "1");
  svg.append(line);
}

function addCircle(svg, cx, cy, r, fill) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", cx);
  circle.setAttribute("cy", cy);
  circle.setAttribute("r", r);
  circle.setAttribute("fill", fill);
  svg.append(circle);
}

function addText(svg, x, y, text, anchor, fill, size, weight) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("text-anchor", anchor);
  node.setAttribute("fill", fill);
  node.setAttribute("font-size", size);
  node.setAttribute("font-weight", weight);
  node.textContent = text;
  svg.append(node);
}

function compactNumber(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

function download(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows, columns) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.map((column) => escape(column.label)).join(";"),
    ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(";")),
  ].join("\n");
}

async function handleFile(file) {
  if (!file) return;
  const text = await file.text();
  state.fileName = file.name;
  state.parsed = parseEdifact(text);
  render();
}

function wireEvents() {
  els.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
  els.fileInputSecondary.addEventListener("change", (event) => handleFile(event.target.files[0]));
  els.segmentFilter.addEventListener("input", (event) => {
    state.segmentFilter = event.target.value;
    renderSegmentsTable(state.parsed);
  });
  els.businessFilter.addEventListener("input", (event) => {
    state.businessFilter = event.target.value;
    renderBusinessTable(state.parsed);
  });
  els.chartMode.addEventListener("change", (event) => {
    state.chartMode = event.target.value;
    renderChart(state.parsed);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
    });
  }

  els.dropZone.addEventListener("drop", (event) => {
    handleFile(event.dataTransfer.files[0]);
  });

  els.exportSegments.addEventListener("click", () => {
    if (!state.parsed) return;
    const csv = toCsv(state.parsed.segments, [
      { label: "#", value: (row) => row.index },
      { label: "Tag", value: (row) => row.tag },
      { label: "Beschreibung", value: (row) => row.label },
      { label: "Elemente", value: (row) => row.elements.map((parts) => parts.join(":")).join(" + ") },
      { label: "Rohsegment", value: (row) => row.raw },
    ]);
    download(`${baseName(state.fileName)}-segmente.csv`, "text/csv;charset=utf-8", csv);
  });

  els.exportBusiness.addEventListener("click", () => {
    if (!state.parsed) return;
    const csv = toCsv(state.parsed.businessRows, [
      { label: "Typ", value: (row) => row.type },
      { label: "Qualifier", value: (row) => row.qualifier },
      { label: "Wert", value: (row) => row.value },
      { label: "Zusatz", value: (row) => row.extra },
      { label: "Segment", value: (row) => row.segment },
    ]);
    download(`${baseName(state.fileName)}-daten.csv`, "text/csv;charset=utf-8", csv);
  });

  els.exportJson.addEventListener("click", () => {
    if (!state.parsed) return;
    download(`${baseName(state.fileName)}-analyse.json`, "application/json;charset=utf-8", JSON.stringify(state.parsed, null, 2));
  });
}

function baseName(name) {
  return (name || "edifact").replace(/\.[^.]+$/, "");
}

wireEvents();
render();
