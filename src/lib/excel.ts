import * as XLSX from "xlsx";
import {
  ALL_PHARMACIES,
  PHARMACIES_CENTRE,
  PHARMACIES_EXTERIEURES,
  PHARMACIES_MAURIENNE,
  findPharmacy,
  isGrandArc,
  isLauziere,
} from "./pharmacies";
import { dateKey, formatDateFR, parseDateFR } from "./dates";
import { getFeriesDates } from "./generatePlanning";
import type { ImportSummary, PlanningDayInput } from "./types";

export interface ExcelRow {
  date_debut: string;
  heure_debut: string;
  date_fin: string;
  heure_fin: string;
  pharmacie: string;
  adresse: string;
}

function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

export function parseExcelBuffer(buffer: ArrayBuffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return raw.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalizeHeader(k)] = v;
    }

    const formatCell = (val: unknown): string => {
      if (val instanceof Date) return formatDateFR(val);
      if (typeof val === "number") {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed) {
          return formatDateFR(
            new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0, 0)
          );
        }
      }
      return String(val ?? "").trim();
    };

    return {
      date_debut: formatCell(normalized.date_debut),
      heure_debut: String(normalized.heure_debut ?? "19h15").trim(),
      date_fin: formatCell(normalized.date_fin),
      heure_fin: String(normalized.heure_fin ?? "19h15").trim(),
      pharmacie: String(normalized.pharmacie ?? "").trim(),
      adresse: String(normalized.adresse ?? "").trim(),
    };
  });
}

function inferType(
  dateDebut: Date,
  pharmacie: string
): PlanningDayInput["type"] {
  const dow = dateDebut.getDay();
  if (!pharmacie) return "vide";
  if (dow === 6) return "weekend";
  if (dow === 0) return "vide";
  if (isLauziere(pharmacie) || isGrandArc(pharmacie)) return "lundi";
  const year = dateDebut.getFullYear();
  const feries = getFeriesDates(year).map(dateKey);
  if (feries.includes(dateKey(dateDebut))) return "ferie";
  if (PHARMACIES_CENTRE.some((p) => p.name === pharmacie)) {
    if (dow === 6 || dow === 0) return "weekend";
    return "ferie";
  }
  return "semaine";
}

export function rowsToPlanningDays(
  rows: ExcelRow[],
  year: number
): PlanningDayInput[] {
  return rows
    .filter((r) => r.date_debut)
    .map((row) => {
      const dateDebut = parseDateFR(row.date_debut);
      const dateFin = parseDateFR(row.date_fin);
      if (!dateDebut || !dateFin) return null;

      const pharma = findPharmacy(row.pharmacie);
      return {
        year,
        date: dateDebut,
        heure_debut: row.heure_debut || "19h15",
        date_fin: dateFin,
        heure_fin: row.heure_fin || "19h15",
        pharmacie: row.pharmacie,
        adresse: row.adresse || pharma?.adresse || "",
        type: inferType(dateDebut, row.pharmacie),
      };
    })
    .filter((d): d is PlanningDayInput => d !== null);
}

export function analyzeImport(rows: ExcelRow[]): ImportSummary {
  const parsed = rows
    .map((row) => {
      const date = parseDateFR(row.date_debut);
      if (!date) return null;
      return { ...row, date };
    })
    .filter((r): r is ExcelRow & { date: Date } => r !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const year = parsed[0]?.date.getFullYear() ?? new Date().getFullYear();

  let lastFeriePharma = PHARMACIES_CENTRE[0].name;
  let lastFerieIdx = 0;
  let lastDomingoPharma = PHARMACIES_CENTRE[0].name;
  let lastDomingoIdx = 0;
  let lastLundiPharma = PHARMACIES_MAURIENNE[0].name;
  let lastSemaineIdx = 0;

  const feriesSet = new Set(
    getFeriesDates(year).map((d) => dateKey(d))
  );

  for (const row of parsed) {
    const { date, pharmacie } = row;
    if (!pharmacie) continue;

    const dow = date.getDay();
    const key = dateKey(date);

    if (feriesSet.has(key) && PHARMACIES_CENTRE.some((p) => p.name === pharmacie)) {
      lastFeriePharma = pharmacie;
      const idx = PHARMACIES_CENTRE.findIndex((p) => p.name === pharmacie);
      if (idx >= 0) lastFerieIdx = idx;
    }

    if (dow === 6 && pharmacie) {
      lastDomingoPharma = pharmacie;
      const idx = PHARMACIES_CENTRE.findIndex((p) => p.name === pharmacie);
      if (idx >= 0) lastDomingoIdx = idx;
    }

    if (dow === 1 && (isLauziere(pharmacie) || isGrandArc(pharmacie))) {
      lastLundiPharma = pharmacie;
    }

    if (
      dow >= 2 &&
      dow <= 5 &&
      PHARMACIES_EXTERIEURES.some((p) => p.name === pharmacie)
    ) {
      const idx = PHARMACIES_EXTERIEURES.findIndex(
        (p) => p.name === pharmacie
      );
      if (idx >= 0) lastSemaineIdx = idx;
    }
  }

  return {
    year,
    lastFeriePharma,
    lastFerieIdx,
    lastDomingoPharma,
    lastDomingoIdx,
    lastLundiPharma,
    lastSemaineIdx,
    totalRows: parsed.length,
  };
}

export function planningDaysToExcel(
  days: PlanningDayInput[],
  year: number
): ArrayBuffer {
  const rows = days.map((d) => ({
    date_debut: formatDateFR(d.date),
    heure_debut: d.heure_debut,
    date_fin: formatDateFR(d.date_fin),
    heure_fin: d.heure_fin,
    pharmacie: d.pharmacie,
    adresse: d.adresse,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "date_debut",
      "heure_debut",
      "date_fin",
      "heure_fin",
      "pharmacie",
      "adresse",
    ],
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Planning ${year}`);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function computeStats(days: PlanningDayInput[]) {
  const counts = new Map<string, number>();
  for (const day of days) {
    if (!day.pharmacie) continue;
    counts.set(day.pharmacie, (counts.get(day.pharmacie) ?? 0) + 1);
  }

  return ALL_PHARMACIES.map((p) => ({
    name: p.name,
    group: p.group,
    count: counts.get(p.name) ?? 0,
  })).sort((a, b) => b.count - a.count);
}
