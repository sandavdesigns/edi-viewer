"use strict";

const state = {
  fileName: "",
  parsed: null,
  segmentFilter: "",
  businessFilter: "",
  businessDetailFilter: "",
  chartMode: "quantities",
  leftTab: "mscons",
  measurementView: "series",
  selectedSeriesKey: "",
  selectedSeriesKeys: new Set(),
  visibleMeasurementRows: 500,
  visiblePointRows: 500,
  visibleBusinessRows: 500,
  visibleSegmentRows: 500,
};

const INITIAL_VISIBLE_ROWS = 500;
const ROW_LOAD_STEP = 500;

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
  businessDetailFilter: document.querySelector("#businessDetailFilter"),
  treeView: document.querySelector("#treeView"),
  measurementTable: document.querySelector("#measurementTable"),
  measurementCount: document.querySelector("#measurementCount"),
  measurementMore: document.querySelector("#measurementMore"),
  graphTitle: document.querySelector("#graphTitle"),
  windowTitle: document.querySelector("#windowTitle"),
  segmentsTable: document.querySelector("#segmentsTable"),
  businessTable: document.querySelector("#businessTable"),
  businessCount: document.querySelector("#businessCount"),
  segmentsCount: document.querySelector("#segmentsCount"),
  businessMore: document.querySelector("#businessMore"),
  segmentsMore: document.querySelector("#segmentsMore"),
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

  for (const segment of segments) {
    segment.searchText = [segment.index, segment.tag, segment.label, segment.raw].join(" ").toLowerCase();
  }

  const businessRows = extractBusinessRows(segments);
  for (const row of businessRows) {
    row.searchText = [row.type, row.qualifier, row.value, row.extra, row.segment].join(" ").toLowerCase();
  }
  const facts = extractFacts(segments, businessRows, chars, rawText.length);
  const measurementRows = extractMeasurementRows(segments, facts);
  for (const row of measurementRows) {
    row.searchText = Object.values(row).join(" ").toLowerCase();
  }
  const measurementSeries = buildMeasurementSeries(measurementRows);
  for (const row of measurementSeries) {
    row.searchText = [row.meteringPoint, row.obis, row.from, row.to, row.quantity, row.minimum, row.maximum, row.sender, row.receiver, row.thirdParty].join(" ").toLowerCase();
  }
  const validation = validateInterchange(segments);

  return { chars, rawText: text, segments, businessRows, measurementRows, measurementSeries, facts, validation };
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

function extractFacts(segments, rows, chars, byteSize = 0) {
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
    byteSize,
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

function extractMeasurementRows(segments, facts) {
  const rows = [];
  const context = {
    meteringPoint: "",
    obis: "",
    start: "",
    end: "",
    status: "",
    thirdParty: "",
  };
  let pending = null;

  const flushPending = () => {
    if (!pending) return;
    pending.from = pending.from || context.start || "-";
    pending.to = pending.to || context.end || pending.from;
    pending.minimumAt = pending.from;
    pending.maximumAt = pending.to;
    rows.push(pending);
    pending = null;
  };

  for (const segment of segments) {
    const raw = segment.raw;
    const obisMatch = raw.match(/\b\d-\d:\d+\.\d+\.\d+\b/);
    if (obisMatch) context.obis = obisMatch[0];

    if (segment.tag === "LOC") {
      flushPending();
      const qualifier = segment.elements[0]?.[0] || "";
      const value = segment.elements[0]?.[1] || segment.elements[1]?.[0] || "";
      if (["172", "Z16", "Z18"].includes(qualifier) && value) context.meteringPoint = value;
    }

    if (segment.tag === "RFF") {
      const qualifier = segment.elements[0]?.[0] || "";
      const value = segment.elements[0]?.[1] || "";
      if (["Z13", "Z14", "MG"].includes(qualifier) && value && !context.meteringPoint) context.meteringPoint = value;
    }

    if (segment.tag === "STS") {
      context.status = segment.elements.flat().filter(Boolean).join(":");
      if (pending) pending.status = context.status;
    }

    if (segment.tag === "DTM") {
      const qualifier = segment.elements[0]?.[0] || "";
      const value = segment.elements[0]?.[1] || "";
      const format = segment.elements[0]?.[2] || "";
      const formatted = formatEdifactDate(value, format);
      const target = pending || context;
      if (["163", "324", "157"].includes(qualifier)) target.start = formatted;
      if (["164", "158"].includes(qualifier)) target.end = formatted;
      if (format === "718" && value.includes("-")) {
        const [start, end] = formatted.split(" bis ");
        target.start = start || target.start;
        target.end = end || target.end;
      }
      if (pending) {
        pending.from = pending.start || pending.from;
        pending.to = pending.end || pending.to;
      }
    }

    if (segment.tag !== "QTY" && segment.tag !== "MEA") continue;
    flushPending();

    const qualifier = segment.elements[0]?.[0] || "";
    const value = Number(normalizeDecimal(segment.elements[0]?.[1] || segment.elements[2]?.[0] || ""));
    if (!Number.isFinite(value)) continue;

    const unit = segment.elements[0]?.[2] || "";
    const minimum = Math.min(0, value);
    const maximum = Math.max(0, value);
    pending = {
      index: rows.length,
      meteringPoint: context.meteringPoint || "-",
      obis: context.obis || qualifier || "-",
      from: "",
      to: "",
      quantity: value,
      unit,
      minimum,
      minimumAt: "",
      maximum,
      maximumAt: "",
      sender: facts.sender || "-",
      receiver: facts.receiver || "-",
      thirdParty: context.thirdParty || "",
      status: context.status || qualifier || "",
      segment: `${segment.index} ${segment.tag}`,
    };
  }

  flushPending();
  return rows;
}

function buildMeasurementSeries(points) {
  const seriesByKey = new Map();

  for (const point of points) {
    const key = `${point.meteringPoint}||${point.obis}`;
    if (!seriesByKey.has(key)) {
      seriesByKey.set(key, {
        key,
        index: seriesByKey.size,
        meteringPoint: point.meteringPoint,
        obis: point.obis,
        from: point.from,
        to: point.to,
        quantity: 0,
        minimum: point.quantity,
        minimumAt: point.from,
        maximum: point.quantity,
        maximumAt: point.from,
        sender: point.sender,
        receiver: point.receiver,
        thirdParty: point.thirdParty,
        pointCount: 0,
        points: [],
      });
    }

    const series = seriesByKey.get(key);
    series.points.push(point);
    series.pointCount += 1;
    series.quantity += point.quantity;
    if (!series.from || series.from === "-") series.from = point.from;
    series.to = point.to || series.to;
    if (point.quantity < series.minimum) {
      series.minimum = point.quantity;
      series.minimumAt = point.from;
    }
    if (point.quantity > series.maximum) {
      series.maximum = point.quantity;
      series.maximumAt = point.from;
    }
  }

  return [...seriesByKey.values()];
}

function validateInterchange(segments) {
  const issues = [];
  const untSegments = segments.filter((segment) => segment.tag === "UNT");
  const unhSegments = segments.filter((segment) => segment.tag === "UNH");
  const unz = segments.find((segment) => segment.tag === "UNZ");
  let activeUnh = null;

  if (!segments.some((segment) => segment.tag === "UNB")) issues.push("UNB fehlt");
  if (!unhSegments.length) issues.push("UNH fehlt");
  if (untSegments.length !== unhSegments.length) issues.push("UNH/UNT Anzahl passt nicht");
  if (!unz) issues.push("UNZ fehlt");

  for (const segment of segments) {
    if (segment.tag === "UNH") activeUnh = segment;
    if (segment.tag !== "UNT") continue;
    const expected = Number(segment.elements[0]?.[0]);
    if (!Number.isFinite(expected) || !activeUnh) continue;
    const actual = segment.index - activeUnh.index + 1;
    if (expected !== actual) issues.push(`UNT ${segment.index}: erwartet ${expected}, gefunden ${actual}`);
    activeUnh = null;
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
  els.windowTitle.textContent = state.fileName || "Deutscher Strom- und Gasmarkt";
  els.fileName.textContent = state.fileName || "Noch keine Datei";
  els.messageType.textContent = parsed ? describeMessageType(parsed.facts.messageType) : "-";
  els.segmentCount.textContent = parsed ? `${parsed.segments.length} Segmente` : "0 Segmente";
  els.validationState.textContent = parsed ? parsed.validation.message : "Bereit";
  els.validationState.style.color = parsed ? (parsed.validation.ok ? "var(--accent-3)" : "var(--danger)") : "var(--muted)";

  renderFacts(parsed);
  renderTree(parsed);
  renderMeasurementTable(parsed);
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
    ["Dateiname", state.fileName || "-"],
    ["Dateigröße", formatBytes(parsed.facts.byteSize)],
    ["Nachricht", parsed.facts.messageDescription],
    ["Version", parsed.facts.version || "-"],
    ["Absender", parsed.facts.sender || "-"],
    ["Empfänger", parsed.facts.receiver || "-"],
    ["Interchange", parsed.facts.interchangeRef || "-"],
    ["Syntax", parsed.facts.syntax || "-"],
    ["Trennzeichen", parsed.facts.separators],
    ["Lastgänge", `${parsed.measurementSeries.length} Reihen / ${parsed.measurementRows.length} Werte`],
    ["Extrahiert", `${parsed.facts.references} Referenzen · ${parsed.facts.quantities} Mengen · ${parsed.facts.amounts} Beträge`],
  ];

  for (const [label, value] of facts) {
    els.factsList.append(factNode(label, value));
  }
}

function renderTree(parsed) {
  els.treeView.innerHTML = "";
  updateLeftTabs();
  if (!parsed) {
    const empty = document.createElement("div");
    empty.className = "tree-node";
    empty.style.setProperty("--level", "0");
    empty.innerHTML = '<span class="tree-icon">•</span><span class="tree-label">Noch keine Datei geladen</span>';
    els.treeView.append(empty);
    return;
  }

  if (state.leftTab === "text") {
    const text = document.createElement("pre");
    text.className = "edi-text-view";
    text.textContent = parsed.rawText.replace(/'/g, "'\n");
    els.treeView.append(text);
    return;
  }

  const fragment = document.createDocumentFragment();
  const root = treeNode(0, "▾", state.fileName || "EDIFACT-Datei", true);
  fragment.append(root);

  if (state.leftTab === "structure") {
    const messages = parsed.segments.filter((segment) => segment.tag === "UNH");
    if (messages.length) {
      for (const message of messages.slice(0, 300)) {
        const type = message.elements[1]?.[0] || "Nachricht";
        fragment.append(treeNode(1, "▸", `${message.index} ${type} - ${describeMessageType(type)}`, false));
      }
    } else {
      for (const segment of parsed.segments.slice(0, 500)) {
        fragment.append(treeNode(1, "•", `${segment.index} ${segment.tag} - ${segment.label}`, false));
      }
    }
    els.treeView.append(fragment);
    return;
  }

  const groups = groupMeasurements(parsed.measurementSeries);
  for (const [meteringPoint, rows] of groups) {
    fragment.append(treeNode(1, "▾", `${meteringPoint} - ${rows.length} OBIS`, false));
    for (const row of rows) {
      fragment.append(treeNode(2, "▸", `${row.obis} - ${row.pointCount} Werte - ${formatNumber(row.quantity)}`, row.key === getSelectedSeries(parsed)?.key, row.key));
    }
  }

  if (!groups.size) {
    for (const segment of parsed.segments.slice(0, 300)) {
      fragment.append(treeNode(1, "•", `${segment.index} ${segment.tag} - ${segment.label}`, false));
    }
  }

  els.treeView.append(fragment);
}

function updateLeftTabs() {
  document.querySelectorAll("[data-left-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.leftTab === state.leftTab);
  });
}

function treeNode(level, icon, label, selected, seriesKey = "") {
  const node = document.createElement("div");
  node.className = `tree-node${selected ? " is-selected" : ""}`;
  node.style.setProperty("--level", String(level));
  if (seriesKey) {
    node.dataset.seriesKey = seriesKey;
    node.tabIndex = 0;
  }
  const iconNode = document.createElement("span");
  iconNode.className = "tree-icon";
  iconNode.textContent = icon;
  const labelNode = document.createElement("span");
  labelNode.className = "tree-label";
  labelNode.textContent = label;
  node.append(iconNode, labelNode);
  return node;
}

function groupMeasurements(rows) {
  return groupBy(rows.slice(0, 500), (row) => row.meteringPoint || "-");
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function sumRows(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
}

function formatBytes(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`;
  return `${formatNumber(bytes / 1024 / 1024)} MB`;
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
  const rows = getFilteredBusinessRows(parsed);
  const visibleRows = rows.slice(0, state.visibleBusinessRows);
  updateTableFooter(els.businessCount, els.businessMore, visibleRows.length, rows.length, "Zeilen");
  if (!rows.length) return appendEmpty(els.businessTable);

  const fragment = document.createDocumentFragment();
  for (const row of visibleRows) {
    const tr = document.createElement("tr");
    appendCell(tr, row.type);
    appendCell(tr, row.qualifier);
    appendCell(tr, row.value);
    appendCell(tr, row.extra);
    appendCell(tr, row.segment, "mono");
    fragment.append(tr);
  }
  els.businessTable.append(fragment);
}

function renderMeasurementTable(parsed) {
  els.measurementTable.innerHTML = "";
  if (state.measurementView === "points") {
    renderMeasurementPointTable(parsed);
    return;
  }

  updateMeasurementHeader(["✓", "Zählpunkt", "OBIS", "von", "bis", "Menge", "Minimum", "Minimum am", "Maximum", "Maximum am", "Absender", "Empfänger"]);
  const rows = getFilteredMeasurementRows(parsed);
  const visibleRows = rows.slice(0, state.visibleMeasurementRows);
  updateTableFooter(els.measurementCount, els.measurementMore, visibleRows.length, rows.length, "Lastgänge");
  if (!rows.length) return appendEmpty(els.measurementTable, 12);

  const selectedExists = visibleRows.some((row) => row.key === state.selectedSeriesKey);
  if (!selectedExists && visibleRows[0]) state.selectedSeriesKey = visibleRows[0].key;

  const fragment = document.createDocumentFragment();
  for (const row of visibleRows) {
    const tr = document.createElement("tr");
    tr.dataset.key = row.key;
    if (row.key === state.selectedSeriesKey) tr.className = "is-selected";
    const selectCell = document.createElement("td");
    selectCell.className = "select-col";
    const checkbox = document.createElement("input");
    checkbox.className = "row-check";
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedSeriesKeys.has(row.key);
    checkbox.setAttribute("aria-label", `${row.meteringPoint} ${row.obis} exportieren`);
    selectCell.append(checkbox);
    tr.append(selectCell);
    appendCell(tr, row.meteringPoint);
    appendCell(tr, row.obis, "mono");
    appendCell(tr, formatDateTime(row.from));
    appendCell(tr, formatDateTime(row.to));
    appendCell(tr, formatNumber(row.quantity), "num");
    appendCell(tr, formatNumber(row.minimum), "num");
    appendCell(tr, formatDateTime(row.minimumAt));
    appendCell(tr, formatNumber(row.maximum), "num");
    appendCell(tr, formatDateTime(row.maximumAt));
    appendCell(tr, row.sender, "mono");
    appendCell(tr, row.receiver, "mono");
    fragment.append(tr);
  }
  els.measurementTable.append(fragment);
  updateGraphTitle(parsed);
}

function renderMeasurementPointTable(parsed) {
  const selectedSeries = getSelectedSeries(parsed);
  const points = selectedSeries?.points || [];
  const visibleRows = points.slice(0, state.visiblePointRows);
  els.messageType.textContent = selectedSeries ? `${selectedSeries.meteringPoint} - ${selectedSeries.obis}` : "Einzelwerte";
  updateMeasurementHeader(["", "Zeitpunkt", "OBIS", "von", "bis", "Wert", "Status", "Einheit", "Segment", "Absender", "Empfänger", ""]);
  updateTableFooter(els.measurementCount, els.measurementMore, visibleRows.length, points.length, "Einzelwerte");
  if (!points.length) return appendEmpty(els.measurementTable, 12);

  const fragment = document.createDocumentFragment();
  for (const point of visibleRows) {
    const tr = document.createElement("tr");
    appendCell(tr, "");
    appendCell(tr, formatDateTime(point.from));
    appendCell(tr, point.obis, "mono");
    appendCell(tr, formatDateTime(point.from));
    appendCell(tr, formatDateTime(point.to));
    appendCell(tr, formatNumber(point.quantity), "num");
    appendCell(tr, point.status || "");
    appendCell(tr, point.unit || "");
    appendCell(tr, point.segment, "mono");
    appendCell(tr, point.sender, "mono");
    appendCell(tr, point.receiver, "mono");
    appendCell(tr, "");
    fragment.append(tr);
  }
  els.measurementTable.append(fragment);
  updateGraphTitle(parsed);
}

function updateMeasurementHeader(labels) {
  const headers = document.querySelectorAll(".measurement-panel thead th");
  headers.forEach((header, index) => {
    header.textContent = labels[index] || "";
  });
}

function renderSegmentsTable(parsed) {
  els.segmentsTable.innerHTML = "";
  const rows = getFilteredSegments(parsed);
  const visibleRows = rows.slice(0, state.visibleSegmentRows);
  updateTableFooter(els.segmentsCount, els.segmentsMore, visibleRows.length, rows.length, "Segmente");
  if (!rows.length) return appendEmpty(els.segmentsTable);

  const fragment = document.createDocumentFragment();
  for (const segment of visibleRows) {
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
    fragment.append(tr);
  }
  els.segmentsTable.append(fragment);
}

function appendCell(row, text, className = "") {
  const td = document.createElement("td");
  td.textContent = text || "";
  if (className) td.className = className;
  row.append(td);
}

function appendEmpty(target, colspan = 5) {
  const row = els.emptyRowTemplate.content.firstElementChild.cloneNode(true);
  row.firstElementChild.colSpan = colspan;
  target.append(row);
}

function updateTableFooter(countEl, moreButton, visible, total, label) {
  countEl.textContent = total ? `${visible} von ${total} ${label}` : `0 ${label}`;
  moreButton.hidden = visible >= total;
}

function getFilteredBusinessRows(parsed) {
  return parsed?.businessRows.filter((row) => includesFilter(row, state.businessDetailFilter)) || [];
}

function getFilteredSegments(parsed) {
  return parsed?.segments.filter((segment) => includesFilter(segment, state.segmentFilter)) || [];
}

function getFilteredMeasurementRows(parsed) {
  return parsed?.measurementSeries.filter((row) => includesFilter(row, state.businessFilter)) || [];
}

function includesFilter(value, filter) {
  if (!filter) return true;
  return value.searchText.includes(filter.toLowerCase());
}

function renderChart(parsed) {
  const svg = els.chart;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", state.chartMode === "quantities" ? "0 0 720 220" : "0 0 720 300");

  if (!parsed) {
    drawEmptyChart(svg);
    return;
  }

  if (state.chartMode === "quantities") {
    drawMeasurementChart(svg, getFilteredMeasurementRows(parsed));
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

function drawMeasurementChart(svg, rows) {
  const selectedSeries = getSelectedSeries(state.parsed, rows);
  const pointsForSeries = selectedSeries?.points || [];
  const values = pointsForSeries.map((row) => Number(row.quantity)).filter((value) => Number.isFinite(value));

  if (!values.length) {
    addPlotBackground(svg, 58, 22, 612, 156);
    addText(svg, 360, 112, "Kein Lastgang ausgewählt", "middle", "var(--muted)", 15, 700);
    return;
  }

  const plot = { x: 58, y: 22, width: 612, height: 156 };
  addPlotBackground(svg, plot.x, plot.y, plot.width, plot.height);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = plot.x + (index / Math.max(values.length - 1, 1)) * plot.width;
    const y = plot.y + plot.height - ((value - min) / range) * plot.height;
    return [x, y, value];
  });
  const baseline = plot.y + plot.height;
  const linePath = buildStepPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${baseline} L ${points[0][0]} ${baseline} Z`;

  addPath(svg, areaPath, "rgba(47, 143, 47, 0.11)", "none", 0);
  addPath(svg, linePath, "none", "var(--accent-2)", 1.8);

  const minPoint = points.find((point) => point[2] === min);
  const maxPoint = points.find((point) => point[2] === max);
  if (minPoint) addCircle(svg, minPoint[0], minPoint[1], 3, "var(--accent-dark)");
  if (maxPoint) addCircle(svg, maxPoint[0], maxPoint[1], 3, "var(--accent-dark)");

  addText(svg, plot.x - 10, plot.y + 5, compactNumber(max), "end", "#26312c", 11, 700);
  addText(svg, plot.x - 10, baseline + 4, compactNumber(min), "end", "#26312c", 11, 700);
  addText(svg, plot.x, 204, formatAxisDate(pointsForSeries[0]?.from), "start", "#526059", 11, 650);
  addText(svg, plot.x + plot.width, 204, formatAxisDate(pointsForSeries[pointsForSeries.length - 1]?.to), "end", "#526059", 11, 650);
}

function buildStepPath(points) {
  if (!points.length) return "";
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` H ${points[index][0]} V ${points[index][1]}`;
  }
  return path;
}

function addPlotBackground(svg, x, y, width, height) {
  addRect(svg, x, y, width, height, "var(--plot)", 0);
  for (let i = 0; i <= 4; i += 1) {
    const lineY = y + i * (height / 4);
    addLine(svg, x, lineY, x + width, lineY, i === 4 ? "#aebdad" : "#d4ddcf", i === 4 ? 1.2 : 0.8);
  }
  for (let i = 0; i <= 8; i += 1) {
    const lineX = x + i * (width / 8);
    addLine(svg, lineX, y, lineX, y + height, "#dce3d7", 0.8);
  }
  addLine(svg, x, y, x, y + height, "#aebdad", 1.2);
}

function addPath(svg, d, fill, stroke, strokeWidth) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", fill);
  path.setAttribute("stroke", stroke);
  path.setAttribute("stroke-width", strokeWidth);
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
}

function addRect(svg, x, y, width, height, fill, rx = 4) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("rx", rx);
  rect.setAttribute("fill", fill);
  svg.append(rect);
}

function addLine(svg, x1, y1, x2, y2, stroke, strokeWidth = 1) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", stroke);
  line.setAttribute("stroke-width", strokeWidth);
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

function formatNumber(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(Number(value) || 0);
}

function formatAxisDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return value || "";
  const day = digits.slice(6, 8);
  const month = digits.slice(4, 6);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);
  return hour ? `${day}.${month}. ${hour}:${minute || "00"}` : `${day}.${month}.`;
}

function formatDateTime(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return value || "";
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10) || "00";
  const minute = digits.slice(10, 12) || "00";
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

function getSelectedSeries(parsed, candidates = null) {
  const rows = candidates || parsed?.measurementSeries || [];
  return rows.find((item) => item.key === state.selectedSeriesKey) || rows[0] || null;
}

function updateGraphTitle(parsed) {
  const row = getSelectedSeries(parsed);
  els.graphTitle.textContent = row ? `${row.meteringPoint} - ${row.obis}: ${formatDateTime(row.from)} - ${formatDateTime(row.to)}` : "Lastgang / Mengenverlauf";
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

function selectedLoadProfileRows(parsed) {
  if (!parsed) return [];
  const selectedKeys = state.selectedSeriesKeys.size ? [...state.selectedSeriesKeys] : [state.selectedSeriesKey].filter(Boolean);
  const series = selectedKeys.length
    ? parsed.measurementSeries.filter((row) => selectedKeys.includes(row.key))
    : getFilteredMeasurementRows(parsed);

  return series.flatMap((row) =>
    row.points.map((point) => ({
      meteringPoint: row.meteringPoint,
      obis: row.obis,
      from: formatDateTime(point.from),
      to: formatDateTime(point.to),
      value: point.quantity,
      status: point.status || "",
    })),
  );
}

function exportSelectedLoadProfiles(suffix) {
  if (!state.parsed) return;
  const rows = selectedLoadProfileRows(state.parsed);
  const csv = toCsv(rows, [
    { label: "Zaehlpunkt", value: (row) => row.meteringPoint },
    { label: "OBIS", value: (row) => row.obis },
    { label: "von", value: (row) => row.from },
    { label: "bis", value: (row) => row.to },
    { label: "wert", value: (row) => row.value },
    { label: "status", value: (row) => row.status },
  ]);
  download(`${baseName(state.fileName)}-${suffix}.csv`, "text/csv;charset=utf-8", `\uFEFF${csv}`);
}

async function handleFile(file) {
  if (!file) return;
  state.fileName = `${file.name} wird geladen...`;
  state.parsed = null;
  resetVisibleRows();
  render();
  await nextFrame();
  const text = await readEdifactFile(file);
  state.fileName = file.name;
  state.parsed = parseEdifact(text);
  resetVisibleRows();
  render();
}

async function readEdifactFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function resetVisibleRows() {
  state.selectedSeriesKey = "";
  state.selectedSeriesKeys = new Set();
  state.measurementView = "series";
  state.visibleMeasurementRows = INITIAL_VISIBLE_ROWS;
  state.visiblePointRows = INITIAL_VISIBLE_ROWS;
  state.visibleBusinessRows = INITIAL_VISIBLE_ROWS;
  state.visibleSegmentRows = INITIAL_VISIBLE_ROWS;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function openSeriesDetail(seriesKey) {
  if (!seriesKey) return;
  state.selectedSeriesKey = seriesKey;
  state.measurementView = "points";
  state.visiblePointRows = INITIAL_VISIBLE_ROWS;
  renderMeasurementTable(state.parsed);
  renderTree(state.parsed);
  renderChart(state.parsed);
}

function wireEvents() {
  els.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
  els.fileInputSecondary.addEventListener("change", (event) => handleFile(event.target.files[0]));
  els.segmentFilter.addEventListener("input", (event) => {
    state.segmentFilter = event.target.value;
    state.visibleSegmentRows = INITIAL_VISIBLE_ROWS;
    renderSegmentsTable(state.parsed);
  });
  els.businessFilter.addEventListener("input", (event) => {
    state.businessFilter = event.target.value;
    state.measurementView = "series";
    state.visibleMeasurementRows = INITIAL_VISIBLE_ROWS;
    renderMeasurementTable(state.parsed);
    renderChart(state.parsed);
    renderTree(state.parsed);
  });
  els.businessDetailFilter.addEventListener("input", (event) => {
    state.businessDetailFilter = event.target.value;
    state.visibleBusinessRows = INITIAL_VISIBLE_ROWS;
    renderBusinessTable(state.parsed);
  });
  els.chartMode?.addEventListener("change", (event) => {
    state.chartMode = event.target.value;
    renderChart(state.parsed);
  });

  document.querySelectorAll("[data-left-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.leftTab = button.dataset.leftTab || "structure";
      renderTree(state.parsed);
    });
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

  els.businessMore.addEventListener("click", () => {
    state.visibleBusinessRows += ROW_LOAD_STEP;
    renderBusinessTable(state.parsed);
  });

  els.measurementMore.addEventListener("click", () => {
    if (state.measurementView === "points") {
      state.visiblePointRows += ROW_LOAD_STEP;
    } else {
      state.visibleMeasurementRows += ROW_LOAD_STEP;
    }
    renderMeasurementTable(state.parsed);
    renderChart(state.parsed);
  });

  els.treeView.addEventListener("click", (event) => {
    const node = event.target.closest("[data-series-key]");
    if (!node) return;
    openSeriesDetail(node.dataset.seriesKey);
  });

  els.treeView.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = event.target.closest("[data-series-key]");
    if (!node) return;
    event.preventDefault();
    openSeriesDetail(node.dataset.seriesKey);
  });

  els.measurementTable.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-key]");
    if (!row) return;
    if (event.target.classList.contains("row-check")) {
      if (event.target.checked) {
        state.selectedSeriesKeys.add(row.dataset.key);
      } else {
        state.selectedSeriesKeys.delete(row.dataset.key);
      }
      return;
    }
    state.selectedSeriesKey = row.dataset.key || "";
    state.measurementView = "series";
    renderMeasurementTable(state.parsed);
    renderTree(state.parsed);
    renderChart(state.parsed);
  });

  els.segmentsMore.addEventListener("click", () => {
    state.visibleSegmentRows += ROW_LOAD_STEP;
    renderSegmentsTable(state.parsed);
  });

  els.exportSegments.addEventListener("click", () => {
    exportSelectedLoadProfiles("lastgang");
  });

  els.exportBusiness.addEventListener("click", () => {
    exportSelectedLoadProfiles("lastgang-daten");
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
