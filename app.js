"use strict";

const state = {
  fileName: "",
  parsed: null,
  documents: [],
  activeDocumentId: null,
  nextDocumentId: 1,
  segmentFilter: "",
  businessFilter: "",
  businessDetailFilter: "",
  chartMode: "quantities",
  treeCollapsed: false,
  measurementView: "series",
  selectedMeteringPoint: "",
  selectedObis: "",
  dateFrom: "",
  dateTo: "",
  hideZeroProfiles: false,
  selectedSeriesKey: "",
  selectedPointIndex: null,
  selectedSeriesKeys: new Set(),
  visibleMeasurementRows: 500,
  visiblePointRows: 500,
  visibleBusinessRows: 500,
  visibleSegmentRows: 500,
};

const INITIAL_VISIBLE_ROWS = 500;
const ROW_LOAD_STEP = 500;
const MEASUREMENT_CHART_WIDTH = 1100;
const MEASUREMENT_CHART_HEIGHT = 360;
const MEASUREMENT_PLOT = { x: 44, y: 28, width: 1018, height: 278 };
const MEASUREMENT_AXIS_LABEL_Y = MEASUREMENT_CHART_HEIGHT - 30;
const THEME_STORAGE_KEY = "edi-viewer-theme";
const runtimeConfig = normalizeRuntimeConfig(window.EDI_VIEWER_CONFIG);
const MARKET_TIME_ZONE = "Europe/Berlin";
const marketDateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: MARKET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const marketDateTimeCache = new Map();
const systemDarkMode = window.matchMedia?.("(prefers-color-scheme: dark)");

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
  ALOCAT: "Allokationsdaten",
  MSCONS: "Messwerte und Energiemengen",
  ORDRSP: "Auftragsantwort",
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
  fileInputSecondary: document.querySelector("#fileInputSecondary"),
  dropZone: document.querySelector("#dropZone"),
  documentTabs: document.querySelector("#documentTabs"),
  fileName: document.querySelector("#fileName"),
  messageType: document.querySelector("#messageType"),
  segmentCount: document.querySelector("#segmentCount"),
  factsList: document.querySelector("#factsList"),
  chart: document.querySelector("#chart"),
  chartMode: document.querySelector("#chartMode"),
  themeMode: document.querySelector("#themeMode"),
  segmentFilter: document.querySelector("#segmentFilter"),
  businessFilter: document.querySelector("#businessFilter"),
  meteringPointFilter: document.querySelector("#meteringPointFilter"),
  obisFilter: document.querySelector("#obisFilter"),
  dateFromFilter: document.querySelector("#dateFromFilter"),
  dateToFilter: document.querySelector("#dateToFilter"),
  hideZeroProfiles: document.querySelector("#hideZeroProfiles"),
  businessDetailFilter: document.querySelector("#businessDetailFilter"),
  treeView: document.querySelector("#treeView"),
  treeToggle: document.querySelector("#treeToggle"),
  infoOpen: document.querySelector("#infoOpen"),
  infoClose: document.querySelector("#infoClose"),
  infoDialog: document.querySelector("#infoDialog"),
  manualOpen: document.querySelector("#manualOpen"),
  manualClose: document.querySelector("#manualClose"),
  manualDialog: document.querySelector("#manualDialog"),
  measurementHead: document.querySelector(".measurement-panel thead"),
  measurementTable: document.querySelector("#measurementTable"),
  measurementCount: document.querySelector("#measurementCount"),
  measurementSum: document.querySelector("#measurementSum"),
  measurementMore: document.querySelector("#measurementMore"),
  copyMeasurement: document.querySelector("#copyMeasurement"),
  seriesInsights: document.querySelector("#seriesInsights"),
  graphTitle: document.querySelector("#graphTitle"),
  windowTitle: document.querySelector("#windowTitle"),
  segmentsTable: document.querySelector("#segmentsTable"),
  businessTable: document.querySelector("#businessTable"),
  businessCount: document.querySelector("#businessCount"),
  segmentsCount: document.querySelector("#segmentsCount"),
  businessMore: document.querySelector("#businessMore"),
  segmentsMore: document.querySelector("#segmentsMore"),
  exportSegments: document.querySelector("#exportSegments"),
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
      const dtm = dtmParts(segment);
      rows.push(makeRow("Datum", dtm.qualifier, formatEdifactDate(dtm.value, dtm.format), qualifierLabel("DTM", dtm.qualifier), segment));
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

function dtmParts(segment) {
  const first = segment.elements[0] || [];
  return {
    qualifier: first[0] || "",
    value: first[1] || "",
    format: first[2] || segment.elements[1]?.[1] || "",
  };
}

function extractFacts(segments, rows, chars, byteSize = 0) {
  const firstUnb = segments.find((segment) => segment.tag === "UNB");
  const firstUnh = segments.find((segment) => segment.tag === "UNH");
  const firstBgm = segments.find((segment) => segment.tag === "BGM");
  const bgmCode = firstBgm?.elements[0]?.[0] || "";
  const documentNumber = firstBgm?.elements[1]?.[0] || "";
  const rawMessageType = firstUnh?.elements[1]?.[0] || "";
  const messageType = isAlocatMessage(rawMessageType, bgmCode, documentNumber) ? "ALOCAT" : rawMessageType;
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

function isAlocatMessage(messageType, bgmCode, documentNumber) {
  return messageType === "ORDRSP" && (["X1G", "X5G"].includes(bgmCode) || String(documentNumber || "").startsWith("ALOCAT"));
}

function extractMeasurementRows(segments, facts) {
  if (facts.messageType === "ALOCAT") return extractAlocatRows(segments, facts);

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
      const { qualifier, value, format } = dtmParts(segment);
      const formatted = formatEdifactDate(value, format);
      const target = pending || context;
      if (["163", "324", "157"].includes(qualifier)) target.start = formatted;
      if (["164", "158"].includes(qualifier)) target.end = formatted;
      if (["718", "719"].includes(format) && splitEdifactDateRange(value)) {
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

function extractAlocatRows(segments, facts) {
  const rows = [];
  const context = {
    allocationReference: "",
    documentStart: "",
    documentEnd: "",
  };
  let group = null;
  let pendingPeriod = null;

  const finishGroup = () => {
    if (!group || !group.points.length) {
      group = null;
      return;
    }
    const meteringPoint = group.zeu || context.allocationReference || `Position ${group.line || rows.length + 1}`;
    const thirdParty = group.zsh || context.allocationReference || "";
    for (const point of group.points) {
      rows.push({
        index: rows.length,
        meteringPoint,
        obis: point.obis || "Z03",
        from: point.from || context.documentStart || "-",
        to: point.to || context.documentEnd || point.from || "-",
        quantity: point.quantity,
        unit: point.unit || "",
        minimum: point.quantity,
        minimumAt: point.from || "",
        maximum: point.quantity,
        maximumAt: point.from || "",
        sender: facts.sender || "-",
        receiver: facts.receiver || "-",
        thirdParty,
        status: point.status || "",
        segment: point.segment,
      });
    }
    group = null;
  };

  for (const segment of segments) {
    if (segment.tag === "RFF") {
      const qualifier = segment.elements[0]?.[0] || "";
      const value = segment.elements[0]?.[1] || "";
      if (qualifier === "Z13" && value) context.allocationReference = value;
    }

    if (segment.tag === "DTM") {
      const { qualifier, value, format } = dtmParts(segment);
      const range = ["2", "Z01"].includes(qualifier) ? splitEdifactDateRange(value) : null;
      if (range) {
        const formatted = range.map((part) => formatEdifactDate(part, part.length >= 12 ? "203" : "102"));
        if (qualifier === "Z01") {
          context.documentStart = formatted[0] || context.documentStart;
          context.documentEnd = formatted[1] || context.documentEnd;
        } else {
          pendingPeriod = { from: formatted[0] || "", to: formatted[1] || "" };
        }
      } else if (format === "203" && qualifier === "2") {
        pendingPeriod = { from: formatEdifactDate(value, format), to: "" };
      }
    }

    if (segment.tag === "LIN") {
      finishGroup();
      group = {
        line: segment.elements[0]?.[0] || "",
        zeu: "",
        zsh: "",
        points: [],
      };
      pendingPeriod = null;
      continue;
    }

    if (segment.tag === "NAD" && group) {
      const qualifier = segment.elements[0]?.[0] || "";
      const value = segment.elements[1]?.[0] || "";
      if (qualifier === "ZEU" && value) group.zeu = value;
      if (qualifier === "ZSH" && value) group.zsh = value;
      continue;
    }

    if (segment.tag === "QTY" && group) {
      const qualifier = segment.elements[0]?.[0] || "";
      const quantity = Number(normalizeDecimal(segment.elements[0]?.[1] || ""));
      if (!Number.isFinite(quantity)) continue;
      group.points.push({
        obis: qualifier || "Z03",
        from: pendingPeriod?.from || "",
        to: pendingPeriod?.to || "",
        quantity,
        unit: segment.elements[0]?.[2] || "",
        status: "",
        segment: `${segment.index} ${segment.tag}`,
      });
      continue;
    }

    if (segment.tag === "STS" && group?.points.length) {
      group.points[group.points.length - 1].status = segment.elements.flat().filter(Boolean).join(":");
    }
  }

  finishGroup();
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
  const digits = String(value).replace(/\D/g, "");
  if (format === "102" && digits.length >= 8) return `${digits.slice(6, 8)}.${digits.slice(4, 6)}.${digits.slice(0, 4)}`;
  if (format === "203" && digits.length >= 12) return formatUtcMarketDateTime(digits.slice(0, 12));
  if (format === "303" && digits.length >= 12) return formatUtcMarketDateTime(digits.slice(0, 14));
  if (["718", "719"].includes(format)) {
    const range = splitEdifactDateRange(value);
    if (range) return range.map((part) => formatEdifactDate(part, part.length >= 12 ? "203" : "102")).join(" bis ");
  }
  return value;
}

function formatUtcMarketDateTime(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 12) return value || "";
  const cacheKey = digits.slice(0, 14);
  if (marketDateTimeCache.has(cacheKey)) return marketDateTimeCache.get(cacheKey);
  const date = new Date(Date.UTC(
    Number(digits.slice(0, 4)),
    Number(digits.slice(4, 6)) - 1,
    Number(digits.slice(6, 8)),
    Number(digits.slice(8, 10)),
    Number(digits.slice(10, 12)),
    Number(digits.slice(12, 14) || 0),
  ));
  const parts = marketDateTimeFormatter.formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const formatted = `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
  marketDateTimeCache.set(cacheKey, formatted);
  return formatted;
}

function splitEdifactDateRange(value) {
  const text = String(value || "");
  if (text.includes("-")) return text.split("-");
  const digits = text.replace(/\D/g, "");
  if (digits.length === 24) return [digits.slice(0, 12), digits.slice(12, 24)];
  if (digits.length === 16) return [digits.slice(0, 8), digits.slice(8, 16)];
  return null;
}

function normalizeDecimal(value) {
  return String(value || "").replace(",", ".");
}

function shortFileName(name) {
  const clean = String(name || "Datei").replace(/\.[^.]+$/, "");
  if (clean.length <= 34) return clean;
  return `${clean.slice(0, 15)}...${clean.slice(-14)}`;
}

function formatDocumentSubtitle(parsed) {
  const sender = parsed?.facts?.sender || "";
  const receiver = parsed?.facts?.receiver || "";
  if (sender && receiver) return `${sender} -> ${receiver}`;
  return "Datei geladen";
}

function render() {
  const parsed = state.parsed;
  els.windowTitle.textContent = getAppTitle();
  els.fileName.textContent = parsed ? formatDocumentSubtitle(parsed) : "Noch keine Datei";
  els.messageType.textContent = parsed ? describeMessageType(parsed.facts.messageType) : "-";
  els.segmentCount.textContent = parsed ? `${parsed.segments.length} Segmente` : "0 Segmente";

  renderFacts(parsed);
  renderDocumentTabs();
  renderMeteringPointFilter(parsed);
  renderObisFilter(parsed);
  renderTree(parsed);
  renderMeasurementTable(parsed);
  renderBusinessTable(parsed);
  renderSegmentsTable(parsed);
  renderSeriesInsights(parsed);
  renderChart(parsed);
}

function renderDocumentTabs() {
  els.documentTabs.innerHTML = "";
  if (!state.documents.length) {
    els.documentTabs.hidden = true;
    return;
  }

  els.documentTabs.hidden = false;
  const fragment = document.createDocumentFragment();
  for (const documentState of state.documents) {
    const tab = document.createElement("button");
    tab.className = `document-tab${documentState.id === state.activeDocumentId ? " is-active" : ""}`;
    tab.type = "button";
    tab.dataset.documentId = String(documentState.id);
    tab.title = documentState.fileName;

    const label = document.createElement("span");
    label.className = "document-tab-label";
    label.textContent = shortFileName(documentState.fileName);

    const close = document.createElement("span");
    close.className = "document-tab-close";
    close.dataset.closeDocument = String(documentState.id);
    close.setAttribute("aria-hidden", "true");
    close.title = "Tab schließen";
    close.textContent = "×";

    tab.append(label, close);
    fragment.append(tab);
  }
  els.documentTabs.append(fragment);
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

function renderMeteringPointFilter(parsed) {
  els.meteringPointFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Alle Zählpunkte";
  els.meteringPointFilter.append(allOption);

  const points = [...new Set((parsed?.measurementSeries || []).map((row) => row.meteringPoint).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  for (const point of points) {
    const option = document.createElement("option");
    option.value = point;
    option.textContent = point;
    els.meteringPointFilter.append(option);
  }

  if (points.includes(state.selectedMeteringPoint)) {
    els.meteringPointFilter.value = state.selectedMeteringPoint;
  } else {
    state.selectedMeteringPoint = "";
    els.meteringPointFilter.value = "";
  }
}

function renderObisFilter(parsed) {
  els.obisFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Alle OBIS";
  els.obisFilter.append(allOption);

  const candidates = (parsed?.measurementSeries || []).filter((row) => !state.selectedMeteringPoint || row.meteringPoint === state.selectedMeteringPoint);
  const codes = [...new Set(candidates.map((row) => row.obis).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  for (const code of codes) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    els.obisFilter.append(option);
  }

  if (codes.includes(state.selectedObis)) {
    els.obisFilter.value = state.selectedObis;
  } else {
    state.selectedObis = "";
    els.obisFilter.value = "";
  }
}

function renderTree(parsed) {
  els.treeView.innerHTML = "";
  updateTreePanelState();
  if (!parsed) {
    const empty = document.createElement("div");
    empty.className = "tree-node";
    empty.style.setProperty("--level", "0");
    empty.innerHTML = '<span class="tree-icon">•</span><span class="tree-label">Noch keine Datei geladen</span>';
    els.treeView.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  const root = treeNode(0, "▾", "Aktive Datei", state.measurementView === "series" && !state.selectedMeteringPoint, { root: true, title: state.fileName || "" });
  fragment.append(root);

  const groups = groupMeasurements(parsed.measurementSeries);
  for (const [meteringPoint, rows] of groups) {
    fragment.append(treeNode(1, "▾", meteringPoint, state.selectedMeteringPoint === meteringPoint && state.measurementView === "series", { meteringPoint }));
    for (const row of rows) {
      fragment.append(treeNode(2, "•", `${row.obis} - ${formatNumber(row.quantity)}`, row.key === getSelectedSeries(parsed)?.key && state.measurementView === "points", { seriesKey: row.key }));
    }
  }

  if (!groups.size) {
    for (const segment of parsed.segments.slice(0, 300)) {
      fragment.append(treeNode(1, "•", `${segment.index} ${segment.tag} - ${segment.label}`, false));
    }
  }

  els.treeView.append(fragment);
}

function updateTreePanelState() {
  document.body.classList.toggle("is-tree-collapsed", state.treeCollapsed);
  const label = state.parsed?.facts?.messageType === "ALOCAT" ? "ALOCAT" : "MSCONS";
  els.treeToggle.textContent = state.treeCollapsed ? `${label} anzeigen` : label;
  els.treeToggle.setAttribute("aria-expanded", String(!state.treeCollapsed));
}

function treeNode(level, icon, label, selected, options = {}) {
  const node = document.createElement("div");
  node.className = `tree-node${selected ? " is-selected" : ""}`;
  node.style.setProperty("--level", String(level));
  if (options.root) {
    node.dataset.rootNode = "true";
    node.tabIndex = 0;
  }
  if (options.meteringPoint) {
    node.dataset.meteringPoint = options.meteringPoint;
    node.tabIndex = 0;
  }
  if (options.seriesKey) {
    node.dataset.seriesKey = options.seriesKey;
    node.tabIndex = 0;
  }
  const iconNode = document.createElement("span");
  iconNode.className = "tree-icon";
  iconNode.textContent = icon;
  const labelNode = document.createElement("span");
  labelNode.className = "tree-label";
  labelNode.textContent = label;
  node.append(iconNode, labelNode);
  if (options.title) node.title = options.title;
  return node;
}

function groupMeasurements(rows) {
  return groupBy(rows, (row) => row.meteringPoint || "-");
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
    els.measurementSum.textContent = "";
    renderMeasurementPointTable(parsed);
    return;
  }

  els.messageType.textContent = parsed ? describeMessageType(parsed.facts.messageType) : "MSCONS";
  updateMeasurementHeader(["✓", "Zählpunkt", "OBIS", "von", "bis", "Menge", "Minimum", "Minimum am", "Maximum", "Maximum am", "Absender", "Empfänger"]);
  const rows = getFilteredMeasurementRows(parsed);
  const visibleRows = rows.slice(0, state.visibleMeasurementRows);
  renderSelectAllHeader(rows);
  updateMeasurementFooter(visibleRows.length, rows);
  if (!rows.length) return appendEmpty(els.measurementTable, 12);

  const selectedExists = visibleRows.some((row) => row.key === state.selectedSeriesKey);
  if (!selectedExists && visibleRows[0]) state.selectedSeriesKey = visibleRows[0].key;

  const fragment = document.createDocumentFragment();
  for (const row of visibleRows) {
    const summary = summarizeSeries(row);
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
    const meteringCell = appendCell(tr, row.meteringPoint, "metering-point-cell");
    meteringCell.dataset.meteringPoint = row.meteringPoint;
    meteringCell.title = "Lastgang öffnen";
    appendCell(tr, row.obis, "mono");
    appendCell(tr, formatDateTime(summary.from));
    appendCell(tr, formatDateTime(summary.to));
    appendCell(tr, formatNumber(summary.quantity), "num");
    appendCell(tr, formatNumber(summary.minimum), "num");
    appendCell(tr, formatDateTime(summary.minimumAt));
    appendCell(tr, formatNumber(summary.maximum), "num");
    appendCell(tr, formatDateTime(summary.maximumAt));
    appendCell(tr, row.sender, "mono");
    appendCell(tr, row.receiver, "mono");
    fragment.append(tr);
  }
  els.measurementTable.append(fragment);
  updateGraphTitle(parsed);
}

function renderMeasurementPointTable(parsed) {
  const selectedSeries = getSelectedSeries(parsed);
  const points = getFilteredSeriesPoints(selectedSeries);
  const visibleRows = points.slice(0, state.visiblePointRows);
  els.messageType.textContent = selectedSeries ? `${selectedSeries.meteringPoint} - ${selectedSeries.obis}` : "Einzelwerte";
  updateMeasurementHeader(["", "Zeitpunkt", "OBIS", "von", "bis", "Wert", "Status", "Einheit", "Segment", "Absender", "Empfänger", ""]);
  updateTableFooter(els.measurementCount, els.measurementMore, visibleRows.length, points.length, "Einzelwerte");
  if (!points.length) return appendEmpty(els.measurementTable, 12);

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < visibleRows.length; index += 1) {
    const point = visibleRows[index];
    const tr = document.createElement("tr");
    tr.dataset.pointIndex = String(index);
    if (state.selectedPointIndex === index) tr.className = "is-selected";
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

function renderSelectAllHeader(rows) {
  const header = document.querySelector(".measurement-panel thead th.select-col");
  if (!header) return;
  header.innerHTML = "";
  const checkbox = document.createElement("input");
  checkbox.id = "seriesSelectAll";
  checkbox.className = "row-check select-all-check";
  checkbox.type = "checkbox";
  checkbox.disabled = !rows.length;
  checkbox.checked = rows.length > 0 && rows.every((row) => state.selectedSeriesKeys.has(row.key));
  checkbox.indeterminate = rows.some((row) => state.selectedSeriesKeys.has(row.key)) && !checkbox.checked;
  checkbox.setAttribute("aria-label", "Alle gefilterten Lastgänge exportieren");
  checkbox.title = "Alle gefilterten Lastgänge auswählen";
  header.append(checkbox);
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
  return td;
}

function appendEmpty(target, colspan = 5) {
  const row = els.emptyRowTemplate.content.firstElementChild.cloneNode(true);
  row.firstElementChild.colSpan = colspan;
  target.append(row);
}

function updateTableFooter(countEl, moreButton, visible, total, label) {
  countEl.textContent = total ? `${visible} von ${total} ${label}` : `0 ${label}`;
  moreButton.toggleAttribute("hidden", visible >= total);
}

function updateMeasurementFooter(visible, rows) {
  const total = rows.length;
  const sum = rows.reduce((value, row) => value + (Number(row.quantity) || 0), 0);
  els.measurementCount.textContent = total ? `${visible} von ${total} Lastgänge` : "0 Lastgänge";
  els.measurementSum.textContent = total ? `Summe: ${formatNumber(sum)}` : "";
  els.measurementMore.toggleAttribute("hidden", visible >= total);
}

function getFilteredBusinessRows(parsed) {
  return parsed?.businessRows.filter((row) => includesFilter(row, state.businessDetailFilter)) || [];
}

function getFilteredSegments(parsed) {
  return parsed?.segments.filter((segment) => includesFilter(segment, state.segmentFilter)) || [];
}

function getFilteredMeasurementRows(parsed) {
  return parsed?.measurementSeries.filter((row) => {
    if (state.selectedMeteringPoint && row.meteringPoint !== state.selectedMeteringPoint) return false;
    if (state.selectedObis && row.obis !== state.selectedObis) return false;
    if ((state.dateFrom || state.dateTo) && !getFilteredSeriesPoints(row).length) return false;
    if (state.hideZeroProfiles && Math.abs(Number(summarizeSeries(row).quantity) || 0) < 0.000001) return false;
    return includesFilter(row, state.businessFilter);
  }) || [];
}

function getFilteredSeriesPoints(series) {
  const start = parseDateInput(state.dateFrom, "start");
  const end = parseDateInput(state.dateTo, "end");
  return filterPointsByRange(series?.points || [], start, end);
}

function filterPointsByRange(points, start, end) {
  if (!start && !end) return points;
  return points.filter((point) => {
    const time = parseDateValue(point.from);
    if (!time) return true;
    if (start && time < start) return false;
    if (end && time > end) return false;
    return true;
  });
}

function summarizeSeries(row) {
  const points = getFilteredSeriesPoints(row);
  if (!points.length) return { ...row, points: [], pointCount: 0, quantity: 0, minimum: 0, minimumAt: "", maximum: 0, maximumAt: "", from: "", to: "" };
  let quantity = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let minimumAt = "";
  let maximumAt = "";
  for (const point of points) {
    const value = Number(point.quantity) || 0;
    quantity += value;
    if (value < minimum) {
      minimum = value;
      minimumAt = point.from;
    }
    if (value > maximum) {
      maximum = value;
      maximumAt = point.from;
    }
  }
  return {
    ...row,
    points,
    pointCount: points.length,
    quantity,
    minimum,
    minimumAt,
    maximum,
    maximumAt,
    from: points[0]?.from || row.from,
    to: points[points.length - 1]?.to || row.to,
  };
}

function includesFilter(value, filter) {
  if (!filter) return true;
  return value.searchText.includes(filter.toLowerCase());
}

function renderChart(parsed) {
  const svg = els.chart;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", state.chartMode === "quantities" ? `0 0 ${MEASUREMENT_CHART_WIDTH} ${MEASUREMENT_CHART_HEIGHT}` : "0 0 720 300");

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
  addText(svg, MEASUREMENT_CHART_WIDTH / 2, MEASUREMENT_CHART_HEIGHT / 2, "Keine Datei geladen", "middle", "var(--muted)", 18, 700);
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
    addText(svg, 24, y + 14, tag, "start", "var(--text-table)", 13, 800);
    addRect(svg, 92, y, width, barHeight, index % 2 ? "var(--accent)" : "var(--accent-2)");
    addText(svg, 612, y + 14, String(count), "end", "var(--text-table)", 13, 750);
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

  addLine(svg, 44, 250, 676, 250, "var(--line-strong)");
  addLine(svg, 44, 46, 44, 250, "var(--line-strong)");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--accent)");
  path.setAttribute("stroke-width", "3");
  svg.append(path);

  points.forEach(([x, y, value]) => {
    addCircle(svg, x, y, 4, "var(--accent-2)");
    addText(svg, x, y - 10, compactNumber(value), "middle", "var(--text-table)", 11, 700);
  });
}

function drawMeasurementChart(svg, rows) {
  const selectedSeries = getSelectedSeries(state.parsed, rows);
  const pointsForSeries = getFilteredSeriesPoints(selectedSeries);
  const values = pointsForSeries.map((row) => Number(row.quantity)).filter((value) => Number.isFinite(value));

  if (!values.length) {
    addPlotBackground(svg, MEASUREMENT_PLOT.x, MEASUREMENT_PLOT.y, MEASUREMENT_PLOT.width, MEASUREMENT_PLOT.height);
    addText(svg, MEASUREMENT_CHART_WIDTH / 2, MEASUREMENT_PLOT.y + MEASUREMENT_PLOT.height / 2, "Kein Lastgang ausgewählt", "middle", "var(--muted)", 15, 700);
    return;
  }

  const plot = MEASUREMENT_PLOT;
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

  addPath(svg, areaPath, "var(--chart-fill)", "none", 0);
  addPath(svg, linePath, "none", "var(--accent-2)", 1.8);

  const minPoint = points.find((point) => point[2] === min);
  const maxPoint = points.find((point) => point[2] === max);
  if (minPoint) addCircle(svg, minPoint[0], minPoint[1], 3, "var(--accent-dark)");
  if (maxPoint) addCircle(svg, maxPoint[0], maxPoint[1], 3, "var(--accent-dark)");

  if (Number.isInteger(state.selectedPointIndex) && points[state.selectedPointIndex]) {
    const selectedPoint = points[state.selectedPointIndex];
    const selectedValue = pointsForSeries[state.selectedPointIndex];
    addLine(svg, selectedPoint[0], plot.y, selectedPoint[0], baseline, "var(--danger)", 1.4);
    addCircle(svg, selectedPoint[0], selectedPoint[1], 5, "var(--danger)");
    addText(svg, Math.min(selectedPoint[0] + 8, plot.x + plot.width), Math.max(selectedPoint[1] - 10, plot.y + 12), compactNumber(selectedValue.quantity), "end", "var(--danger)", 11, 800);
  }

  addText(svg, plot.x - 10, plot.y + 5, compactNumber(max), "end", "var(--text-table)", 11, 700);
  addText(svg, plot.x - 10, baseline + 4, compactNumber(min), "end", "var(--text-table)", 11, 700);
  addText(svg, plot.x, MEASUREMENT_AXIS_LABEL_Y, formatAxisDate(pointsForSeries[0]?.from), "start", "var(--muted)", 11, 650);
  addText(svg, plot.x + plot.width, MEASUREMENT_AXIS_LABEL_Y, formatAxisDate(pointsForSeries[pointsForSeries.length - 1]?.to), "end", "var(--muted)", 11, 650);
}

function selectPointFromChart(event) {
  if (state.measurementView !== "points") return;
  const selectedSeries = getSelectedSeries(state.parsed);
  const points = getFilteredSeriesPoints(selectedSeries);
  if (!points.length) return;

  const chartPoint = clientPointToSvgPoint(els.chart, event.clientX, event.clientY);
  if (!chartPoint) return;
  const plot = MEASUREMENT_PLOT;
  const clampedX = Math.min(Math.max(chartPoint.x, plot.x), plot.x + plot.width);
  const index = Math.round(((clampedX - plot.x) / plot.width) * Math.max(points.length - 1, 0));

  selectMeasurementPoint(index, { scroll: true });
}

function clientPointToSvgPoint(svg, clientX, clientY) {
  const matrix = svg.getScreenCTM?.();
  if (!matrix) return null;
  const point = svg.createSVGPoint ? svg.createSVGPoint() : new DOMPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix.inverse());
}

function selectMeasurementPoint(index, options = {}) {
  const selectedSeries = getSelectedSeries(state.parsed);
  const points = getFilteredSeriesPoints(selectedSeries);
  if (!Number.isInteger(index) || index < 0 || index >= points.length) return;

  state.selectedPointIndex = index;
  if (index >= state.visiblePointRows) {
    state.visiblePointRows = Math.ceil((index + 1) / ROW_LOAD_STEP) * ROW_LOAD_STEP;
  }

  renderMeasurementTable(state.parsed);
  renderSeriesInsights(state.parsed);
  renderChart(state.parsed);

  if (options.scroll) {
    window.requestAnimationFrame(() => {
      const row = els.measurementTable.querySelector(`tr[data-point-index="${index}"]`);
      row?.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }
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
    addLine(svg, x, lineY, x + width, lineY, i === 4 ? "var(--line-strong)" : "var(--line)", i === 4 ? 1.2 : 0.8);
  }
  for (let i = 0; i <= 8; i += 1) {
    const lineX = x + i * (width / 8);
    addLine(svg, lineX, y, lineX, y + height, "var(--line)", 0.8);
  }
  addLine(svg, x, y, x, y + height, "var(--line-strong)", 1.2);
}

function addPath(svg, d, fill, stroke, strokeWidth, dash = "") {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", fill);
  path.setAttribute("stroke", stroke);
  path.setAttribute("stroke-width", strokeWidth);
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  if (dash) path.setAttribute("stroke-dasharray", dash);
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

function formatCsvNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value).replace(".", ",");
  return String(number).replace(".", ",");
}

function formatAxisDate(value) {
  const text = String(value || "");
  const formatted = formatDateTime(text);
  const german = formatted.match(/^(\d{2})\.(\d{2})\.\d{4}\s+(\d{2}):(\d{2})/);
  if (german) return `${german[1]}.${german[2]}. ${german[3]}:${german[4]}`;
  const dateOnly = formatted.match(/^(\d{2})\.(\d{2})\.\d{4}/);
  if (dateOnly) return `${dateOnly[1]}.${dateOnly[2]}.`;
  return text;
}

function formatDateTime(value) {
  const text = String(value || "");
  const german = text.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (german) return `${german[1]}.${german[2]}.${german[3]} ${german[4] || "00"}:${german[5] || "00"}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]} ${iso[4]}:${iso[5]}`;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 8) return text;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10) || "00";
  const minute = digits.slice(10, 12) || "00";
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

function parseDateInput(value, boundary = "start") {
  if (!value) return null;
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0);
    if (boundary === "end") date.setHours(23, 59, 59, 999);
    return date.getTime();
  }
  const time = parseDateValue(value);
  if (!time) return null;
  if (boundary === "end") {
    const date = new Date(time);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function parseDateValue(value) {
  const text = String(value || "");
  const german = text.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (german) return new Date(Number(german[3]), Number(german[2]) - 1, Number(german[1]), Number(german[4] || 0), Number(german[5] || 0)).getTime();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4]), Number(iso[5])).getTime();
  const digits = text.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return new Date(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)) - 1, Number(digits.slice(6, 8)), Number(digits.slice(8, 10) || 0), Number(digits.slice(10, 12) || 0)).getTime();
}

function getSelectedSeries(parsed, candidates = null) {
  const rows = candidates || parsed?.measurementSeries || [];
  return rows.find((item) => item.key === state.selectedSeriesKey) || rows[0] || null;
}

function updateGraphTitle(parsed) {
  const row = getSelectedSeries(parsed);
  els.graphTitle.textContent = row ? `${row.meteringPoint} - ${row.obis}: ${formatDateTime(row.from)} - ${formatDateTime(row.to)}` : "Lastgang / Mengenverlauf";
}

function renderSeriesInsights(parsed) {
  els.seriesInsights.innerHTML = "";
  const series = getSelectedSeries(parsed);
  if (!series) {
    appendInsight("Status", "Keine Zeitreihe");
    return;
  }

  const points = getFilteredSeriesPoints(series);
  const analysis = analyzeSeries({ ...series, points });
  appendInsight("Werte", formatNumber(points.length));
  appendInsight("Summe", formatNumber(points.reduce((sum, point) => sum + (Number(point.quantity) || 0), 0)));
  appendInsight("Min / Max", points.length ? `${formatNumber(Math.min(...points.map((point) => Number(point.quantity) || 0)))} / ${formatNumber(Math.max(...points.map((point) => Number(point.quantity) || 0)))}` : "-");
  appendInsight("Durchschnitt", points.length ? formatNumber(points.reduce((sum, point) => sum + (Number(point.quantity) || 0), 0) / points.length) : "-");
  appendInsight("Lücken", String(analysis.gaps.length));
  appendInsight("Status", formatStatusSummary(points));
}

function appendInsight(label, value) {
  const card = document.createElement("div");
  card.className = "insight-card";
  const title = document.createElement("span");
  title.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value || "-";
  card.append(title, content);
  els.seriesInsights.append(card);
}

function formatStatusSummary(points) {
  const counts = points.reduce((acc, point) => {
    const key = point.status || "-";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ");
}

function analyzeSeries(series) {
  const points = [...(series?.points || [])].sort((a, b) => (parseDateValue(a.from) || 0) - (parseDateValue(b.from) || 0));
  const seen = new Set();
  const duplicates = [];
  const gaps = [];
  const values = points.map((point) => Number(point.quantity)).filter((value) => Number.isFinite(value));
  const outliers = [];

  for (const point of points) {
    const key = `${point.from || ""}||${point.to || ""}`;
    if (seen.has(key)) duplicates.push(point);
    seen.add(key);
  }

  const diffs = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = parseDateValue(points[index - 1].from);
    const current = parseDateValue(points[index].from);
    if (previous && current && current > previous) diffs.push(current - previous);
  }
  const expected = median(diffs);
  if (expected) {
    for (let index = 1; index < points.length; index += 1) {
      const previous = parseDateValue(points[index - 1].from);
      const current = parseDateValue(points[index].from);
      if (previous && current && current - previous > expected * 1.5) {
        gaps.push({ from: points[index - 1].from, to: points[index].from, missing: Math.max(1, Math.round((current - previous) / expected) - 1) });
      }
    }
  }

  if (values.length >= 8) {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
    if (deviation > 0) {
      points.forEach((point) => {
        const value = Number(point.quantity);
        if (Number.isFinite(value) && Math.abs(value - average) > deviation * 4) outliers.push(point);
      });
    }
  }

  return { expectedInterval: expected, duplicates, gaps, outliers };
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function openDialog(dialog) {
  try {
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
      return;
    }
  } catch {
    // Fall back to the non-modal open attribute for older or stricter browser contexts.
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
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

function toTsv(rows, columns) {
  const clean = (value) => String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
  return [
    columns.map((column) => clean(column.label)).join("\t"),
    ...rows.map((row) => columns.map((column) => clean(column.value(row))).join("\t")),
  ].join("\n");
}

function selectedLoadProfileSeries(parsed) {
  if (!parsed) return [];
  const selectedKeys = state.selectedSeriesKeys.size ? [...state.selectedSeriesKeys] : [state.selectedSeriesKey].filter(Boolean);
  return selectedKeys.length
    ? parsed.measurementSeries.filter((row) => selectedKeys.includes(row.key))
    : getFilteredMeasurementRows(parsed);
}

function selectedLoadProfileRows(parsed, series) {
  if (!parsed) return [];
  const rowsByPeriod = new Map();
  for (const row of series) {
    for (const point of getFilteredSeriesPoints(row)) {
      const key = `${point.from || ""}||${point.to || ""}`;
      if (!rowsByPeriod.has(key)) {
        rowsByPeriod.set(key, {
          fromRaw: point.from || "",
          toRaw: point.to || "",
          from: formatDateTime(point.from),
          to: formatDateTime(point.to),
        });
      }
      const exportRow = rowsByPeriod.get(key);
      exportRow[`${row.key}__value`] = point.quantity;
      exportRow[`${row.key}__status`] = point.status || "";
    }
  }

  return [...rowsByPeriod.values()].sort((a, b) => a.fromRaw.localeCompare(b.fromRaw) || a.toRaw.localeCompare(b.toRaw));
}

function exportSelectedLoadProfiles(suffix) {
  if (!state.parsed) return;
  const series = selectedLoadProfileSeries(state.parsed);
  const rows = selectedLoadProfileRows(state.parsed, series);
  const columns = [
    { label: "von", value: (row) => row.from },
    { label: "bis", value: (row) => row.to },
  ];
  for (const row of series) {
    const label = `${row.meteringPoint} | ${row.obis}`;
    columns.push({ label: `${label} wert`, value: (exportRow) => formatCsvNumber(exportRow[`${row.key}__value`]) });
    if (series.length === 1) {
      columns.push({ label: `${label} status`, value: (exportRow) => exportRow[`${row.key}__status`] ?? "" });
    }
  }
  const csv = toCsv(rows, columns);
  download(`${baseName(state.fileName)}-${suffix}.csv`, "text/csv;charset=utf-8", `\uFEFF${csv}`);
}

function currentMeasurementCopyData() {
  if (!state.parsed) return { rows: [], columns: [] };
  if (state.measurementView === "points") {
    const selectedSeries = getSelectedSeries(state.parsed);
    const rows = (selectedSeries?.points || []).slice(0, state.visiblePointRows);
    return {
      rows,
      columns: [
        { label: "Zeitpunkt", value: (row) => formatDateTime(row.from) },
        { label: "OBIS", value: (row) => row.obis },
        { label: "von", value: (row) => formatDateTime(row.from) },
        { label: "bis", value: (row) => formatDateTime(row.to) },
        { label: "Wert", value: (row) => formatNumber(row.quantity) },
        { label: "Status", value: (row) => row.status || "" },
        { label: "Einheit", value: (row) => row.unit || "" },
        { label: "Segment", value: (row) => row.segment },
        { label: "Absender", value: (row) => row.sender },
        { label: "Empfänger", value: (row) => row.receiver },
      ],
    };
  }

  const rows = getFilteredMeasurementRows(state.parsed).slice(0, state.visibleMeasurementRows).map((row) => summarizeSeries(row));
  return {
    rows,
    columns: [
      { label: "Zählpunkt", value: (row) => row.meteringPoint },
      { label: "OBIS", value: (row) => row.obis },
      { label: "von", value: (row) => formatDateTime(row.from) },
      { label: "bis", value: (row) => formatDateTime(row.to) },
      { label: "Menge", value: (row) => formatNumber(row.quantity) },
      { label: "Minimum", value: (row) => formatNumber(row.minimum) },
      { label: "Minimum am", value: (row) => formatDateTime(row.minimumAt) },
      { label: "Maximum", value: (row) => formatNumber(row.maximum) },
      { label: "Maximum am", value: (row) => formatDateTime(row.maximumAt) },
      { label: "Absender", value: (row) => row.sender },
      { label: "Empfänger", value: (row) => row.receiver },
    ],
  };
}

async function copyCurrentMeasurementTable() {
  const { rows, columns } = currentMeasurementCopyData();
  if (!rows.length) return;
  const text = toTsv(rows, columns);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  els.copyMeasurement.textContent = "Kopiert";
  window.setTimeout(() => {
    els.copyMeasurement.textContent = "Kopieren";
  }, 1200);
}

async function handleFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  saveActiveDocumentState();

  for (const file of files) {
    state.fileName = `${file.name} wird geladen...`;
    state.parsed = null;
    applyDocumentView(defaultDocumentView());
    render();
    await nextFrame();

    const text = await readEdifactFile(file);
    const documentState = {
      id: state.nextDocumentId,
      fileName: file.name,
      parsed: parseEdifact(text),
      view: defaultDocumentView(),
    };
    state.nextDocumentId += 1;
    state.documents.push(documentState);
    activateDocument(documentState.id, false);
  }
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
  applyDocumentView(defaultDocumentView());
}

function defaultDocumentView() {
  return {
    segmentFilter: "",
    businessFilter: "",
    businessDetailFilter: "",
    chartMode: "quantities",
    measurementView: "series",
    selectedMeteringPoint: "",
    selectedObis: "",
    dateFrom: "",
    dateTo: "",
    hideZeroProfiles: false,
    selectedSeriesKey: "",
    selectedPointIndex: null,
    selectedSeriesKeys: [],
    visibleMeasurementRows: INITIAL_VISIBLE_ROWS,
    visiblePointRows: INITIAL_VISIBLE_ROWS,
    visibleBusinessRows: INITIAL_VISIBLE_ROWS,
    visibleSegmentRows: INITIAL_VISIBLE_ROWS,
  };
}

function currentDocumentView() {
  return {
    segmentFilter: state.segmentFilter,
    businessFilter: state.businessFilter,
    businessDetailFilter: state.businessDetailFilter,
    chartMode: state.chartMode,
    measurementView: state.measurementView,
    selectedMeteringPoint: state.selectedMeteringPoint,
    selectedObis: state.selectedObis,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    hideZeroProfiles: state.hideZeroProfiles,
    selectedSeriesKey: state.selectedSeriesKey,
    selectedPointIndex: state.selectedPointIndex,
    selectedSeriesKeys: [...state.selectedSeriesKeys],
    visibleMeasurementRows: state.visibleMeasurementRows,
    visiblePointRows: state.visiblePointRows,
    visibleBusinessRows: state.visibleBusinessRows,
    visibleSegmentRows: state.visibleSegmentRows,
  };
}

function applyDocumentView(view) {
  state.selectedSeriesKey = "";
  state.selectedPointIndex = null;
  state.selectedMeteringPoint = "";
  state.selectedObis = "";
  state.selectedSeriesKeys = new Set();
  Object.assign(state, {
    segmentFilter: view.segmentFilter || "",
    businessFilter: view.businessFilter || "",
    businessDetailFilter: view.businessDetailFilter || "",
    chartMode: view.chartMode || "quantities",
    measurementView: view.measurementView || "series",
    selectedMeteringPoint: view.selectedMeteringPoint || "",
    selectedObis: view.selectedObis || "",
    dateFrom: view.dateFrom || "",
    dateTo: view.dateTo || "",
    hideZeroProfiles: Boolean(view.hideZeroProfiles),
    selectedSeriesKey: view.selectedSeriesKey || "",
    selectedPointIndex: Number.isInteger(view.selectedPointIndex) ? view.selectedPointIndex : null,
    selectedSeriesKeys: new Set(view.selectedSeriesKeys || []),
    visibleMeasurementRows: view.visibleMeasurementRows || INITIAL_VISIBLE_ROWS,
    visiblePointRows: view.visiblePointRows || INITIAL_VISIBLE_ROWS,
    visibleBusinessRows: view.visibleBusinessRows || INITIAL_VISIBLE_ROWS,
    visibleSegmentRows: view.visibleSegmentRows || INITIAL_VISIBLE_ROWS,
  });
  els.segmentFilter.value = state.segmentFilter;
  els.businessFilter.value = state.businessFilter;
  els.businessDetailFilter.value = state.businessDetailFilter;
  els.dateFromFilter.value = state.dateFrom;
  els.dateToFilter.value = state.dateTo;
  els.hideZeroProfiles.checked = state.hideZeroProfiles;
}

function saveActiveDocumentState() {
  const documentState = state.documents.find((item) => item.id === state.activeDocumentId);
  if (!documentState) return;
  documentState.view = currentDocumentView();
}

function activateDocument(documentId, saveCurrent = true) {
  if (saveCurrent) saveActiveDocumentState();
  const documentState = state.documents.find((item) => item.id === documentId);
  if (!documentState) return;
  state.activeDocumentId = documentState.id;
  state.fileName = documentState.fileName;
  state.parsed = documentState.parsed;
  applyDocumentView(documentState.view);
  render();
}

function closeDocument(documentId) {
  const index = state.documents.findIndex((item) => item.id === documentId);
  if (index < 0) return;
  state.documents.splice(index, 1);
  if (state.activeDocumentId !== documentId) {
    renderDocumentTabs();
    return;
  }

  const nextDocument = state.documents[index] || state.documents[index - 1];
  if (nextDocument) {
    state.activeDocumentId = null;
    activateDocument(nextDocument.id, false);
  } else {
    state.activeDocumentId = null;
    state.fileName = "";
    state.parsed = null;
    applyDocumentView(defaultDocumentView());
    render();
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function openSeriesDetail(seriesKey) {
  if (!seriesKey) return;
  state.selectedSeriesKey = seriesKey;
  state.selectedPointIndex = null;
  state.measurementView = "points";
  state.visiblePointRows = INITIAL_VISIBLE_ROWS;
  renderMeasurementTable(state.parsed);
  renderTree(state.parsed);
  renderSeriesInsights(state.parsed);
  renderChart(state.parsed);
}

function openSeriesList() {
  state.measurementView = "series";
  state.selectedPointIndex = null;
  renderMeasurementTable(state.parsed);
  renderTree(state.parsed);
  renderSeriesInsights(state.parsed);
  renderChart(state.parsed);
}

function showMeteringPoint(meteringPoint) {
  state.selectedMeteringPoint = meteringPoint || "";
  state.selectedObis = "";
  state.measurementView = "series";
  state.selectedPointIndex = null;
  state.visibleMeasurementRows = INITIAL_VISIBLE_ROWS;
  renderMeteringPointFilter(state.parsed);
  renderObisFilter(state.parsed);
  renderMeasurementTable(state.parsed);
  renderTree(state.parsed);
  renderSeriesInsights(state.parsed);
  renderChart(state.parsed);
}

function wireEvents() {
  els.fileInputSecondary.addEventListener("change", (event) => {
    handleFiles(event.target.files);
    event.target.value = "";
  });
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
  els.meteringPointFilter.addEventListener("change", (event) => {
    showMeteringPoint(event.target.value);
  });
  els.obisFilter.addEventListener("change", (event) => {
    state.selectedObis = event.target.value;
    state.measurementView = "series";
    state.selectedPointIndex = null;
    state.visibleMeasurementRows = INITIAL_VISIBLE_ROWS;
    renderMeasurementTable(state.parsed);
    renderSeriesInsights(state.parsed);
    renderChart(state.parsed);
    renderTree(state.parsed);
  });
  els.hideZeroProfiles.addEventListener("change", (event) => {
    state.hideZeroProfiles = event.target.checked;
    state.measurementView = "series";
    state.selectedPointIndex = null;
    state.visibleMeasurementRows = INITIAL_VISIBLE_ROWS;
    renderMeasurementTable(state.parsed);
    renderSeriesInsights(state.parsed);
    renderChart(state.parsed);
    renderTree(state.parsed);
  });
  for (const input of [els.dateFromFilter, els.dateToFilter]) {
    input.addEventListener("change", () => {
      state.dateFrom = els.dateFromFilter.value;
      state.dateTo = els.dateToFilter.value;
      state.selectedPointIndex = null;
      state.visibleMeasurementRows = INITIAL_VISIBLE_ROWS;
      state.visiblePointRows = INITIAL_VISIBLE_ROWS;
      renderMeasurementTable(state.parsed);
      renderSeriesInsights(state.parsed);
      renderChart(state.parsed);
      renderTree(state.parsed);
    });
  }
  els.businessDetailFilter.addEventListener("input", (event) => {
    state.businessDetailFilter = event.target.value;
    state.visibleBusinessRows = INITIAL_VISIBLE_ROWS;
    renderBusinessTable(state.parsed);
  });
  els.chartMode?.addEventListener("change", (event) => {
    state.chartMode = event.target.value;
    renderChart(state.parsed);
  });

  els.themeMode.addEventListener("change", (event) => {
    setThemeMode(event.target.value);
  });

  systemDarkMode?.addEventListener("change", () => {
    if (els.themeMode.value === "auto") applyThemeMode("auto");
  });

  els.infoOpen.addEventListener("click", () => {
    openDialog(els.infoDialog);
  });

  els.infoClose.addEventListener("click", () => {
    closeDialog(els.infoDialog);
  });

  els.infoDialog.addEventListener("click", (event) => {
    if (event.target === els.infoDialog) closeDialog(els.infoDialog);
  });

  els.manualOpen.addEventListener("click", () => {
    openDialog(els.manualDialog);
  });

  els.manualClose.addEventListener("click", () => {
    closeDialog(els.manualDialog);
  });

  els.manualDialog.addEventListener("click", (event) => {
    if (event.target === els.manualDialog) closeDialog(els.manualDialog);
  });

  els.treeToggle.addEventListener("click", () => {
    state.treeCollapsed = !state.treeCollapsed;
    updateTreePanelState();
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
    handleFiles(event.dataTransfer.files);
  });

  els.documentTabs.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-document]");
    if (closeButton) {
      event.stopPropagation();
      closeDocument(Number(closeButton.dataset.closeDocument));
      return;
    }

    const tab = event.target.closest("[data-document-id]");
    if (!tab) return;
    activateDocument(Number(tab.dataset.documentId));
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

  els.copyMeasurement.addEventListener("click", () => {
    copyCurrentMeasurementTable().catch(() => {
      els.copyMeasurement.textContent = "Fehler";
      window.setTimeout(() => {
        els.copyMeasurement.textContent = "Kopieren";
      }, 1200);
    });
  });

  els.measurementHead.addEventListener("change", (event) => {
    if (event.target.id !== "seriesSelectAll") return;
    const rows = getFilteredMeasurementRows(state.parsed);
    for (const row of rows) {
      if (event.target.checked) {
        state.selectedSeriesKeys.add(row.key);
      } else {
        state.selectedSeriesKeys.delete(row.key);
      }
    }
    renderMeasurementTable(state.parsed);
  });

  els.treeView.addEventListener("click", (event) => {
    const root = event.target.closest("[data-root-node]");
    if (root) {
      showMeteringPoint("");
      return;
    }
    const meteringPoint = event.target.closest("[data-metering-point]");
    if (meteringPoint) {
      showMeteringPoint(meteringPoint.dataset.meteringPoint);
      return;
    }
    const node = event.target.closest("[data-series-key]");
    if (!node) return;
    openSeriesDetail(node.dataset.seriesKey);
  });

  els.treeView.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const root = event.target.closest("[data-root-node]");
    const meteringPoint = event.target.closest("[data-metering-point]");
    const node = event.target.closest("[data-series-key]");
    if (!root && !meteringPoint && !node) return;
    event.preventDefault();
    if (root) {
      showMeteringPoint("");
    } else if (meteringPoint) {
      showMeteringPoint(meteringPoint.dataset.meteringPoint);
    } else {
      openSeriesDetail(node.dataset.seriesKey);
    }
  });

  els.measurementTable.addEventListener("click", (event) => {
    const pointRow = event.target.closest("tr[data-point-index]");
    if (pointRow) {
      selectMeasurementPoint(Number(pointRow.dataset.pointIndex));
      return;
    }

    const row = event.target.closest("tr[data-key]");
    if (!row) return;
    if (event.target.classList.contains("row-check")) {
      if (event.target.checked) {
        state.selectedSeriesKeys.add(row.dataset.key);
      } else {
        state.selectedSeriesKeys.delete(row.dataset.key);
      }
      renderSelectAllHeader(getFilteredMeasurementRows(state.parsed));
      return;
    }
    const meteringCell = event.target.closest(".metering-point-cell");
    if (meteringCell) {
      openSeriesDetail(row.dataset.key);
      return;
    }
    state.selectedSeriesKey = row.dataset.key || "";
    state.selectedPointIndex = null;
    state.measurementView = "series";
    renderMeasurementTable(state.parsed);
    renderTree(state.parsed);
    renderSeriesInsights(state.parsed);
    renderChart(state.parsed);
  });

  els.measurementTable.addEventListener("dblclick", (event) => {
    const row = event.target.closest("tr[data-key]");
    if (!row || event.target.classList.contains("row-check")) return;
    openSeriesDetail(row.dataset.key);
  });

  els.segmentsMore.addEventListener("click", () => {
    state.visibleSegmentRows += ROW_LOAD_STEP;
    renderSegmentsTable(state.parsed);
  });

  els.exportSegments.addEventListener("click", () => {
    exportSelectedLoadProfiles("lastgang");
  });

  els.chart.addEventListener("click", selectPointFromChart);
}

function baseName(name) {
  return (name || "edifact").replace(/\.[^.]+$/, "");
}

function initTheme() {
  const saved = readStoredTheme();
  els.themeMode.value = ["auto", "light", "dark"].includes(saved) ? saved : "auto";
  applyThemeMode(els.themeMode.value);
}

function setThemeMode(mode) {
  const normalized = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
  els.themeMode.value = normalized;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage errors; the selected theme still applies for this session.
  }
  applyThemeMode(normalized);
}

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return "auto";
  }
}

function normalizeRuntimeConfig(config) {
  const rawTheme = String(config?.theme || "").trim().toLowerCase();
  const theme = ["energie", "energy", "brand", "custom"].includes(rawTheme) ? "energie" : "";
  const name = String(config?.name || "").trim();
  return { theme, name };
}

function applyRuntimeConfig() {
  if (runtimeConfig.theme) {
    document.body.dataset.brandTheme = runtimeConfig.theme;
  } else {
    delete document.body.dataset.brandTheme;
  }
  document.title = getAppTitle();
}

function getAppTitle() {
  return runtimeConfig.name ? `EDIFACT Lastgang Viewer - ${runtimeConfig.name}` : "EDIFACT Lastgang Viewer";
}

function applyThemeMode(mode) {
  const effectiveTheme = mode === "auto" ? (systemDarkMode?.matches ? "dark" : "light") : mode;
  document.body.dataset.theme = effectiveTheme;
  document.body.dataset.themeMode = mode;
  renderChart(state.parsed);
}

applyRuntimeConfig();
initTheme();
wireEvents();
render();
