import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import {
  ALL_PHARMACIES,
  PHARMACIES_CENTRE,
  findPharmacy,
  isGrandArc,
  isLauziere,
} from "./pharmacies";
import { dateKey, formatDateFR, getDayNameFR, parseDateFR, addDays } from "./dates";
import { getFeriesDates } from "./generatePlanning";
import { inferEndStateFromPlanningDays } from "./planningRotationState";
import type { YearRotations, RotationEntry } from "./rotations";
import type { PharmacyGroup } from "./pharmacies";
import type {
  ImportSummary,
  PlanningDayInput,
  PlanningDayType,
  PharmacyStats,
  CategoryStats,
} from "./types";

/** Garde fériés (rotation fériés) — exclut la 2e garde des fériés tombant un samedi. */
export function isFerieRotationRow(
  day: Pick<PlanningDayInput, "type" | "heure_debut" | "centreRotation">
): boolean {
  if (day.type !== "ferie") return false;
  if (day.centreRotation) return day.centreRotation === "ferie";
  return day.heure_debut !== "09h00";
}

/** Garde week-ends (rotation dimanches) — inclut la 2e garde des fériés tombant un samedi. */
export function isWeekendRotationRow(
  day: Pick<PlanningDayInput, "type" | "heure_debut" | "centreRotation">
): boolean {
  if (day.type === "weekend") return true;
  if (day.type === "ferie" && day.centreRotation === "domingo") return true;
  if (day.type === "ferie" && day.heure_debut === "09h00") return true;
  return false;
}

function parseHeure(heure: string): { h: number; m: number } {
  const match = /^(\d+)h(\d+)$/.exec(heure.trim());
  if (!match) return { h: 19, m: 15 };
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

function statsCategoryForDay(
  day: Pick<PlanningDayInput, "type" | "heure_debut" | "centreRotation">
): keyof ReturnType<typeof emptyPharmaBuckets> | null {
  if (day.type === "vide") return null;
  if (isWeekendRotationRow(day)) return "weekend";
  if (day.type === "ferie") return "ferie";
  if (day.type === "lundi") return "lundi";
  if (day.type === "semaine") return "semaine";
  return null;
}

function emptyCategoryStats(): CategoryStats {
  return { turnos: 0, gardesJour: 0, gardesNuit: 0 };
}

function emptyPharmaBuckets() {
  return {
    ferie: emptyCategoryStats(),
    weekend: emptyCategoryStats(),
    lundi: emptyCategoryStats(),
    semaine: emptyCategoryStats(),
  };
}

function combinarFechaHora(date: Date, heure: string): Date {
  const result = new Date(date);
  const { h, m } = parseHeure(heure);
  result.setHours(h, m, 0, 0);
  return result;
}

const MS_BLOQUE_NUIT = (13 * 60 + 45) * 60 * 1000;
const MS_BLOQUE_JOUR = (10 * 60 + 15) * 60 * 1000;

/** Décompose une garde en blocs JOUR (09h00→19h15) et NUIT (19h15→09h00). */
export function calcularGardesJourNuit(
  dateDebut: Date,
  heureDebut: string,
  dateFin: Date,
  heureFin: string
): { jour: number; nuit: number } {
  let jour = 0;
  let nuit = 0;
  let cursor = combinarFechaHora(dateDebut, heureDebut);
  const fin = combinarFechaHora(dateFin, heureFin);

  while (cursor < fin) {
    const h = cursor.getHours();
    const m = cursor.getMinutes();

    if (h === 19 && m === 15) {
      nuit++;
      cursor = new Date(cursor.getTime() + MS_BLOQUE_NUIT);
    } else if (h === 9 && m === 0) {
      jour++;
      cursor = new Date(cursor.getTime() + MS_BLOQUE_JOUR);
    } else {
      break;
    }
  }

  return { jour, nuit };
}

/** @deprecated Utiliser calcularGardesJourNuit pour les stats. */
export function guardDurationDays(
  date: Date,
  dateFin: Date,
  heureDebut = "19h15",
  heureFin = "19h15"
): number {
  const start = new Date(date);
  const sd = parseHeure(heureDebut);
  start.setHours(sd.h, sd.m, 0, 0);
  const end = new Date(dateFin);
  const ed = parseHeure(heureFin);
  end.setHours(ed.h, ed.m, 0, 0);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function accumulateCategoryStats(
  buckets: ReturnType<typeof emptyPharmaBuckets>,
  category: keyof ReturnType<typeof emptyPharmaBuckets>,
  blocks: { jour: number; nuit: number }
) {
  const bucket = buckets[category];
  bucket.turnos += 1;
  bucket.gardesJour += blocks.jour;
  bucket.gardesNuit += blocks.nuit;
}

function toPharmacyStats(
  name: string,
  group: string,
  c: ReturnType<typeof emptyPharmaBuckets>
): PharmacyStats {
  const totalTurnos =
    c.ferie.turnos + c.weekend.turnos + c.lundi.turnos + c.semaine.turnos;
  const totalGardesJour =
    c.ferie.gardesJour +
    c.weekend.gardesJour +
    c.lundi.gardesJour +
    c.semaine.gardesJour;
  const totalGardesNuit =
    c.ferie.gardesNuit +
    c.weekend.gardesNuit +
    c.lundi.gardesNuit +
    c.semaine.gardesNuit;

  return {
    name,
    group,
    ferie: c.ferie,
    weekend: c.weekend,
    lundi: c.lundi,
    semaine: c.semaine,
    totalTurnos,
    totalGardesJour,
    totalGardesNuit,
  };
}

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

function isEmptyPharmacie(value: string): boolean {
  const s = value.trim().toLowerCase();
  return !s || s === "nan" || s === "null" || s === "undefined" || s === "-";
}

function normalizePharmacieCell(val: unknown): string {
  const s = String(val ?? "").trim();
  return isEmptyPharmacie(s) ? "" : s;
}

export function buildRowsByDateKey(rows: ExcelRow[]): Map<string, ExcelRow> {
  const map = new Map<string, ExcelRow>();
  for (const row of rows) {
    const d = parseDateFR(row.date_debut);
    if (!d) continue;
    map.set(dateKey(d), row);
  }
  return map;
}

/**
 * Excel Norman : pharmacie vide (nan) = même pharmacie que le jour précédent.
 */
export function getPharmacieParaFecha(
  fecha: Date,
  rowsByDate: Map<string, ExcelRow>,
  minDate: Date
): { pharmacie: string; adresse: string } {
  let cursor = new Date(fecha);
  cursor.setHours(12, 0, 0, 0);
  const min = new Date(minDate);
  min.setHours(12, 0, 0, 0);

  while (cursor.getTime() >= min.getTime()) {
    const row = rowsByDate.get(dateKey(cursor));
    if (row && !isEmptyPharmacie(row.pharmacie)) {
      const pharma = findPharmacy(row.pharmacie);
      return {
        pharmacie: pharma?.name ?? row.pharmacie,
        adresse: row.adresse || pharma?.adresse || "",
      };
    }
    cursor = addDays(cursor, -1);
  }
  return { pharmacie: "", adresse: "" };
}

function formatExcelCell(val: unknown): string {
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
}

/** Excel Norman brut : colonnes A–F sans en-têtes (date, heure, au, date fin, heure fin, pharmacie+adresse). */
function isNormanPositionalSheet(sheet: XLSX.WorkSheet): boolean {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });
  for (const row of matrix.slice(0, 8)) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const au = String(row[2] ?? "")
      .trim()
      .toLowerCase();
    const isDate =
      row[0] instanceof Date ||
      (typeof row[0] === "number" && row[0] > 40000);
    if (isDate && au === "au") return true;
  }
  return false;
}

function parseNormanPositionalSheet(sheet: XLSX.WorkSheet): ExcelRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });
  const rows: ExcelRow[] = [];

  for (const row of matrix) {
    if (!Array.isArray(row)) continue;
    const dateDebut = formatExcelCell(row[0]);
    const dateFin = formatExcelCell(row[3]);
    if (!dateDebut || !dateFin) continue;

    const combined = normalizePharmacieCell(row[5]);
    const matched = combined ? findPharmacy(combined) : undefined;
    rows.push({
      date_debut: dateDebut,
      heure_debut: String(row[1] ?? "19h15").trim() || "19h15",
      date_fin: dateFin,
      heure_fin: String(row[4] ?? "19h15").trim() || "19h15",
      pharmacie: matched?.name ?? combined,
      adresse: matched?.adresse ?? "",
    });
  }

  return rows;
}

function parseHeaderBasedSheet(sheet: XLSX.WorkSheet): ExcelRow[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return raw.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalizeHeader(k)] = v;
    }

    return {
      date_debut: formatExcelCell(normalized.date_debut),
      heure_debut: String(normalized.heure_debut ?? "19h15").trim(),
      date_fin: formatExcelCell(normalized.date_fin),
      heure_fin: String(normalized.heure_fin ?? "19h15").trim(),
      pharmacie: normalizePharmacieCell(normalized.pharmacie),
      adresse: String(normalized.adresse ?? "").trim(),
    };
  });
}

export function parseExcelBuffer(buffer: ArrayBuffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (isNormanPositionalSheet(sheet)) {
    return parseNormanPositionalSheet(sheet);
  }
  return parseHeaderBasedSheet(sheet);
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
  const feries = new Set([
    ...getFeriesDates(dateDebut.getFullYear()).map(dateKey),
    ...getFeriesDates(dateDebut.getFullYear() + 1).map(dateKey),
    ...getFeriesDates(dateDebut.getFullYear() - 1).map(dateKey),
  ]);
  if (feries.has(dateKey(dateDebut)) && PHARMACIES_CENTRE.some((p) => p.name === pharmacie)) {
    return "ferie";
  }
  return "semaine";
}

export function rowsToPlanningDays(
  rows: ExcelRow[],
  year: number
): PlanningDayInput[] {
  const filtered = rows.filter((r) => r.date_debut);
  const rowsByDate = buildRowsByDateKey(filtered);
  const parsedDates = filtered
    .map((r) => parseDateFR(r.date_debut))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const minDate = parsedDates[0] ?? new Date(year, 0, 1, 12, 0, 0, 0);

  const mapped = filtered
    .map((row) => {
      const dateDebut = parseDateFR(row.date_debut);
      const dateFin = parseDateFR(row.date_fin);
      if (!dateDebut || !dateFin) return null;

      const resolved = getPharmacieParaFecha(dateDebut, rowsByDate, minDate);
      const pharmacie = resolved.pharmacie;
      const adresse = resolved.adresse;

      return {
        year,
        date: dateDebut,
        heure_debut: row.heure_debut || "19h15",
        date_fin: dateFin,
        heure_fin: row.heure_fin || "19h15",
        pharmacie,
        adresse,
        type: inferType(dateDebut, pharmacie),
      };
    })
    .filter((d): d is PlanningDayInput => d !== null);

  let lastWeekend = { name: "", adresse: "" };
  return mapped.map((day) => {
    if (day.date.getDay() === 6 && day.pharmacie) {
      lastWeekend = { name: day.pharmacie, adresse: day.adresse };
    }
    if (day.type === "vide" && !day.pharmacie && lastWeekend.name) {
      return { ...day, pharmacie: lastWeekend.name, adresse: lastWeekend.adresse };
    }
    return day;
  });
}

function detectImportYear(rows: ExcelRow[]): number {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const d = parseDateFR(row.date_debut);
    if (!d) continue;
    const y = d.getFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let year = new Date().getFullYear();
  let max = 0;
  for (const [y, count] of Array.from(counts.entries())) {
    if (count > max) {
      max = count;
      year = y;
    }
  }
  return year;
}

export function analyzeImport(rows: ExcelRow[]): ImportSummary {
  const year = detectImportYear(rows);

  const days = rowsToPlanningDays(rows, year);
  const state = inferEndStateFromPlanningDays(days, year);

  return {
    year,
    lastFeriePharma: state.last_ferie_pharma,
    lastFerieIdx: state.last_ferie_idx,
    lastDomingoPharma: state.last_domingo_pharma,
    lastDomingoIdx: state.last_domingo_idx,
    lastLundiPharma: state.last_lundi_pharma,
    lastSemaineIdx: state.last_semaine_idx,
    totalRows: rows.length,
  };
}

export function enrichVideDaysFromWeekend<
  T extends { type: string; pharmacie: string; adresse: string },
>(days: T[]): T[] {
  let lastWeekend = { pharmacie: "", adresse: "" };
  return days.map((d) => {
    if (d.type === "weekend" && d.pharmacie) {
      lastWeekend = { pharmacie: d.pharmacie, adresse: d.adresse };
    }
    if (d.type === "vide" && !d.pharmacie && lastWeekend.pharmacie) {
      return {
        ...d,
        pharmacie: lastWeekend.pharmacie,
        adresse: lastWeekend.adresse,
      };
    }
    return d;
  });
}

const EXCEL_ROW_COLORS: Record<PlanningDayType, string> = {
  weekend: "FFDDEBF7",
  vide: "FFF2F2F2",
  lundi: "FFFFF2CC",
  semaine: "FFE2EFDA",
  ferie: "FFFCE4D6",
};

interface ExcelSheetRow {
  cells: string[];
  dateForBorder: Date;
  rowColor: string;
}

function ferieDatesForPlanning(year: number): Date[] {
  return [...getFeriesDates(year), ...getFeriesDates(year + 1)];
}

/** Date du jour férié couvert par la garde (pas la date de début de garde). */
function findFerieDateInGuard(
  day: PlanningDayInput,
  ferieDates: Date[]
): Date | null {
  const start = day.date.getTime();
  const end = day.date_fin.getTime();
  for (const f of ferieDates) {
    const t = f.getTime();
    if (t >= start && t <= end) return f;
  }
  return null;
}

function planningDayToWeekendExcelRow(day: PlanningDayInput): ExcelSheetRow {
  return {
    cells: [
      getDayNameFR(day.date),
      formatDateFR(day.date),
      day.heure_debut,
      formatDateFR(day.date_fin),
      day.heure_fin,
      day.pharmacie,
      day.adresse,
    ],
    dateForBorder: day.date,
    rowColor: EXCEL_ROW_COLORS.weekend,
  };
}

function buildFerieExportRows(
  days: PlanningDayInput[],
  year: number
): ExcelSheetRow[] {
  const ferieDates = ferieDatesForPlanning(year);
  return days
    .filter(isFerieRotationRow)
    .map((day) => {
      const ferieDate = findFerieDateInGuard(day, ferieDates);
      return {
        cells: [
          getDayNameFR(day.date),
          formatDateFR(day.date),
          day.heure_debut,
          formatDateFR(day.date_fin),
          day.heure_fin,
          ferieDate ? getDayNameFR(ferieDate) : "",
          day.pharmacie,
          day.adresse,
        ],
        dateForBorder: day.date,
        rowColor: EXCEL_ROW_COLORS.ferie,
      };
    });
}

function buildWeekendExportRows(
  days: PlanningDayInput[]
): ExcelSheetRow[] {
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  const result: ExcelSheetRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i];

    // Cas 2 (férié samedi) : garde partielle dimanche (rotation domingo)
    if (day.type === "ferie" && isWeekendRotationRow(day)) {
      result.push(planningDayToWeekendExcelRow(day));
      continue;
    }

    if (day.type !== "weekend") continue;

    const nextDay = sorted[i + 1];
    const pairsWithVide =
      nextDay?.type === "vide" && nextDay.pharmacie === day.pharmacie;

    if (pairsWithVide) {
      result.push({
        cells: [
          getDayNameFR(day.date),
          formatDateFR(day.date),
          day.heure_debut,
          formatDateFR(nextDay.date_fin),
          nextDay.heure_fin,
          day.pharmacie,
          day.adresse,
        ],
        dateForBorder: day.date,
        rowColor: EXCEL_ROW_COLORS.weekend,
      });
      i++;
    } else {
      result.push(planningDayToWeekendExcelRow(day));
    }
  }

  return result;
}

const EXCEL_STANDARD_HEADERS = [
  "jour",
  "date_debut",
  "heure_debut",
  "date_fin",
  "heure_fin",
  "pharmacie",
  "adresse",
] as const;

const EXCEL_FERIE_HEADERS = [
  "jour",
  "date_debut",
  "heure_debut",
  "date_fin",
  "heure_fin",
  "jour_ferie",
  "pharmacie",
  "adresse",
] as const;

const EXCEL_COLUMN_WIDTHS = [
  { width: 11 },
  { width: 13 },
  { width: 10 },
  { width: 13 },
  { width: 10 },
  { width: 35 },
  { width: 48 },
] as const;

const EXCEL_CATEGORY_SHEETS: {
  nombre: (year: number) => string;
  borderMode: "block" | "semaine";
  filter: (day: PlanningDayInput) => boolean;
  rowColor: string;
}[] = [
  {
    nombre: (year) => `Lundis ${year}`,
    borderMode: "block",
    filter: (d) => d.type === "lundi",
    rowColor: EXCEL_ROW_COLORS.lundi,
  },
  {
    nombre: (year) => `Semaine ${year}`,
    borderMode: "semaine",
    filter: (d) => d.type === "semaine",
    rowColor: EXCEL_ROW_COLORS.semaine,
  },
];

const BORDE_GRUESO: Partial<ExcelJS.Border> = {
  style: "medium",
  color: { argb: "FF000000" },
};
const BORDE_FINO: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: "FFBFBFBF" },
};

type ExcelBorderMode = "planning" | "block" | "semaine";

function styleExcelRow(
  row: ExcelJS.Row,
  color: string,
  borders: {
    top: Partial<ExcelJS.Border>;
    bottom: Partial<ExcelJS.Border>;
  }
) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
    cell.border = {
      top: borders.top,
      bottom: borders.bottom,
      left: BORDE_FINO,
      right: BORDE_FINO,
    };
  });
}

function bordersForRow(
  mode: ExcelBorderMode,
  day: PlanningDayInput,
  previousDate: Date | null
): { top: Partial<ExcelJS.Border>; bottom: Partial<ExcelJS.Border> } {
  const date = new Date(day.date);
  let top: Partial<ExcelJS.Border> = BORDE_FINO;
  let bottom: Partial<ExcelJS.Border> = BORDE_FINO;

  if (mode === "planning") {
    if (date.getDay() === 1) top = BORDE_GRUESO;
    if (date.getDay() === 0) bottom = BORDE_GRUESO;
  } else if (mode === "block") {
    top = BORDE_GRUESO;
    bottom = BORDE_GRUESO;
  } else if (mode === "semaine") {
    const saltoSemana =
      previousDate !== null &&
      date.getTime() - previousDate.getTime() > 3 * 24 * 60 * 60 * 1000;
    if (saltoSemana) top = BORDE_GRUESO;
  }

  return { top, bottom };
}

function addExcelSheetHeader(
  sheet: ExcelJS.Worksheet,
  headers: readonly string[]
) {
  const headerRow = sheet.addRow([...headers]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
}

function addExcelCustomRows(
  sheet: ExcelJS.Worksheet,
  rows: ExcelSheetRow[],
  borderMode: ExcelBorderMode
) {
  let previousDate: Date | null = null;

  for (const row of rows) {
    const excelRow = sheet.addRow(row.cells);
    styleExcelRow(
      excelRow,
      row.rowColor,
      bordersForRow(
        borderMode,
        { date: row.dateForBorder } as PlanningDayInput,
        previousDate
      )
    );
    previousDate = row.dateForBorder;
  }
}

function addExcelCustomSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: ExcelSheetRow[],
  options: {
    headers: readonly string[];
    columnWidths: { width: number }[];
    borderMode: ExcelBorderMode;
  }
) {
  const sheet = workbook.addWorksheet(name);
  addExcelSheetHeader(sheet, options.headers);
  addExcelCustomRows(sheet, rows, options.borderMode);
  sheet.columns = options.columnWidths;
}

function addExcelPlanningRows(
  sheet: ExcelJS.Worksheet,
  rows: PlanningDayInput[],
  options: { rowColor?: string; borderMode: ExcelBorderMode }
) {
  let previousDate: Date | null = null;

  for (const day of rows) {
    const row = sheet.addRow([
      getDayNameFR(day.date),
      formatDateFR(day.date),
      day.heure_debut,
      formatDateFR(day.date_fin),
      day.heure_fin,
      day.pharmacie,
      day.adresse,
    ]);
    const color = options.rowColor ?? EXCEL_ROW_COLORS[day.type] ?? "FFFFFFFF";
    styleExcelRow(
      row,
      color,
      bordersForRow(options.borderMode, day, previousDate)
    );
    previousDate = new Date(day.date);
  }
  sheet.columns = [...EXCEL_COLUMN_WIDTHS];
}

function addRotationsSheet(
  workbook: ExcelJS.Workbook,
  rotations: YearRotations
) {
  const sheet = workbook.addWorksheet(`Rotations ${rotations.year}`);
  sheet.columns = [{ width: 6 }, { width: 42 }, { width: 12 }];

  const groupColor = (group: PharmacyGroup): string => {
    if (group === "centre") return EXCEL_ROW_COLORS.weekend;
    if (group === "maurienne") return EXCEL_ROW_COLORS.lundi;
    return EXCEL_ROW_COLORS.semaine;
  };

  const addBlock = (
    title: string,
    entries: RotationEntry[],
    withDetail: boolean
  ) => {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    titleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" },
    };

    const headerRow = sheet.addRow(
      withDetail ? ["#", "Pharmacie", "Durée"] : ["#", "Pharmacie"]
    );
    headerRow.font = { bold: true };

    for (const entry of entries) {
      const cells = withDetail
        ? [entry.position, entry.name, entry.detail ?? ""]
        : [entry.position, entry.name];
      const row = sheet.addRow(cells);
      styleExcelRow(row, groupColor(entry.group), {
        top: BORDE_FINO,
        bottom: BORDE_FINO,
      });
    }

    sheet.addRow([]);
  };

  addBlock("Rotation Fériés", rotations.ferie, false);
  addBlock("Rotation Dimanches", rotations.domingo, false);
  addBlock("Rotation Lundis (Maurienne)", rotations.lundi, false);
  addBlock("Rotation Semaine (Extérieures)", rotations.semaine, true);
}

function addExcelPlanningSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: PlanningDayInput[],
  options: { rowColor?: string; borderMode: ExcelBorderMode }
) {
  const sheet = workbook.addWorksheet(name);
  addExcelSheetHeader(sheet, EXCEL_STANDARD_HEADERS);
  addExcelPlanningRows(sheet, rows, options);
}

export async function planningDaysToExcel(
  days: PlanningDayInput[],
  year: number,
  rotations?: YearRotations
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());

  addExcelPlanningSheet(workbook, `Planning ${year}`, sorted, {
    borderMode: "planning",
  });

  addExcelCustomSheet(
    workbook,
    `Fériés ${year}`,
    buildFerieExportRows(sorted, year),
    {
      headers: EXCEL_FERIE_HEADERS,
      columnWidths: [
        { width: 11 },
        { width: 13 },
        { width: 10 },
        { width: 13 },
        { width: 10 },
        { width: 12 },
        { width: 35 },
        { width: 48 },
      ],
      borderMode: "block",
    }
  );

  addExcelCustomSheet(
    workbook,
    `Week-ends ${year}`,
    buildWeekendExportRows(sorted),
    {
      headers: EXCEL_STANDARD_HEADERS,
      columnWidths: [...EXCEL_COLUMN_WIDTHS],
      borderMode: "block",
    }
  );

  for (const cat of EXCEL_CATEGORY_SHEETS) {
    addExcelPlanningSheet(
      workbook,
      cat.nombre(year),
      sorted.filter(cat.filter),
      {
        rowColor: cat.rowColor,
        borderMode: cat.borderMode,
      }
    );
  }

  if (rotations) {
    addRotationsSheet(workbook, rotations);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export function computeStats(days: PlanningDayInput[]): PharmacyStats[] {
  const byPharma = new Map<string, ReturnType<typeof emptyPharmaBuckets>>();

  for (const day of days) {
    if (!day.pharmacie) continue;
    const category = statsCategoryForDay(day);
    if (!category) continue;
    const cur = byPharma.get(day.pharmacie) ?? emptyPharmaBuckets();
    const blocks = calcularGardesJourNuit(
      day.date,
      day.heure_debut,
      day.date_fin,
      day.heure_fin
    );
    accumulateCategoryStats(cur, category, blocks);
    byPharma.set(day.pharmacie, cur);
  }

  return ALL_PHARMACIES.map((p) =>
    toPharmacyStats(
      p.name,
      p.group,
      byPharma.get(p.name) ?? emptyPharmaBuckets()
    )
  ).sort((a, b) => b.totalTurnos - a.totalTurnos);
}

export async function computeStatsFromDb(
  year: number
): Promise<PharmacyStats[]> {
  const { prisma } = await import("./db");
  const days = await prisma.planningDay.findMany({
    where: {
      year,
      type: { not: "vide" },
      pharmacie: { not: "" },
    },
    select: {
      pharmacie: true,
      type: true,
      date: true,
      date_fin: true,
      heure_debut: true,
      heure_fin: true,
    },
  });

  const byPharma = new Map<string, ReturnType<typeof emptyPharmaBuckets>>();

  for (const day of days) {
    if (!day.pharmacie) continue;
    const category = statsCategoryForDay({
      type: day.type as PlanningDayType,
      heure_debut: day.heure_debut,
    });
    if (!category) continue;
    const cur = byPharma.get(day.pharmacie) ?? emptyPharmaBuckets();
    const blocks = calcularGardesJourNuit(
      day.date,
      day.heure_debut,
      day.date_fin,
      day.heure_fin
    );
    accumulateCategoryStats(cur, category, blocks);
    byPharma.set(day.pharmacie, cur);
  }

  return ALL_PHARMACIES.map((p) =>
    toPharmacyStats(
      p.name,
      p.group,
      byPharma.get(p.name) ?? emptyPharmaBuckets()
    )
  ).sort((a, b) => b.totalTurnos - a.totalTurnos);
}
