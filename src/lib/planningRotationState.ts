import { dateKey, addDays } from "./dates";
import {
  PHARMACIES_CENTRE,
  PHARMACIES_EXTERIEURES,
  PHARMACIES_MAURIENNE,
  findCycleIdxForPharmacy,
  isGrandArc,
  isLauziere,
  nextExterieuresCycleIdx,
} from "./pharmacies";
import {
  configFromYearConfig,
  getFeriesDates,
  normalizeGenerateConfig,
  collectRelevantFerieDates,
} from "./generatePlanning";
import type { GenerateConfig, PlanningDayInput, YearConfigState } from "./types";

function parseHeure(heure: string): { h: number; m: number } {
  const match = /^(\d+)h(\d+)$/.exec(heure.trim());
  if (!match) return { h: 19, m: 15 };
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

function combinarFechaHora(date: Date, heure: string): Date {
  const result = new Date(date);
  const { h, m } = parseHeure(heure);
  result.setHours(h, m, 0, 0);
  return result;
}

function centreIdx(name: string): number {
  return PHARMACIES_CENTRE.findIndex((p) => p.name === name);
}

function isCentrePharmacy(name: string): boolean {
  return centreIdx(name) >= 0;
}

function isFerieMonday(year: number, date: Date): boolean {
  const key = dateKey(date);
  return getFeriesDates(year).some((f) => dateKey(f) === key);
}

/** Le jour férié tombe dans la plage date/heure de la garde. */
export function guardCoversFerieDate(
  day: Pick<PlanningDayInput, "date" | "heure_debut" | "date_fin" | "heure_fin">,
  ferieDate: Date
): boolean {
  const start = combinarFechaHora(day.date, day.heure_debut).getTime();
  const end = combinarFechaHora(day.date_fin, day.heure_fin).getTime();
  const noon = new Date(ferieDate);
  noon.setHours(12, 0, 0, 0);
  const t = noon.getTime();
  return t >= start && t <= end;
}

/** Garde de rotation fériés couvrant un jour férié donné. */
export function findFerieRotationForDate(
  days: PlanningDayInput[],
  ferieDate: Date
): PlanningDayInput | null {
  const candidates = days.filter(
    (d) =>
      d.pharmacie &&
      isCentrePharmacy(d.pharmacie) &&
      guardCoversFerieDate(d, ferieDate)
  );

  const ferieRotation = candidates.find(
    (d) => d.type === "ferie" && d.heure_debut !== "09h00"
  );
  if (ferieRotation) return ferieRotation;

  const eveningStart = candidates.filter((d) => d.heure_debut === "19h15");
  if (eveningStart.length === 1) return eveningStart[0];
  if (eveningStart.length > 1) {
    return eveningStart.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  }

  return candidates[0] ?? null;
}

function feriesInPlanningWindow(
  year: number,
  days: PlanningDayInput[]
): Date[] {
  if (days.length === 0) return [];
  const start = days[0].date;
  const end = days[days.length - 1].date;
  return collectRelevantFerieDates(start, end).sort(
    (a, b) => a.getTime() - b.getTime()
  );
}

/**
 * Pharmacie de garde un jour calendaire donné (midi).
 * Excel Norman : une ligne non vide = début de garde ce soir à 19h15 ;
 * la journée est couverte par la garde commencée la veille.
 */
function pharmacieAtCalendarDate(
  days: PlanningDayInput[],
  fecha: Date,
  maxLookback = 14
): string {
  const dayOnDate = days.find((d) => dateKey(d.date) === dateKey(fecha));
  const startFrom = dayOnDate?.pharmacie ? addDays(fecha, -1) : fecha;

  let cursor = new Date(startFrom);
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < maxLookback; i++) {
    const day = days.find((d) => dateKey(d.date) === dateKey(cursor));
    if (day?.pharmacie) return day.pharmacie;
    cursor = addDays(cursor, -1);
  }
  return "";
}

function daysInCalendarYear(
  days: PlanningDayInput[],
  year: number
): PlanningDayInput[] {
  return days.filter((d) => d.date.getFullYear() === year);
}

function isFerieRotationAssignment(
  day: Pick<PlanningDayInput, "type" | "heure_debut" | "centreRotation">
): boolean {
  if (day.type !== "ferie") return false;
  if (day.centreRotation) return day.centreRotation === "ferie";
  return day.heure_debut !== "09h00";
}

function isWeekendRotationAssignment(
  day: Pick<PlanningDayInput, "type" | "heure_debut" | "centreRotation">
): boolean {
  if (day.type === "weekend") return true;
  if (day.type === "ferie" && day.centreRotation === "domingo") return true;
  if (day.type === "ferie" && day.heure_debut === "09h00") return true;
  return false;
}

/** État de fin d'année déduit des dernières gardes réelles du planning. */
export function inferEndStateFromPlanningDays(
  days: PlanningDayInput[],
  year: number
): YearConfigState {
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  const inYear = daysInCalendarYear(sorted, year);

  let lastFeriePharma = PHARMACIES_CENTRE[0].name;
  let lastFerieIdx = 0;
  let lastDomingoPharma = PHARMACIES_CENTRE[0].name;
  let lastDomingoIdx = 0;
  let lastLundiPharma = PHARMACIES_MAURIENNE[0].name;
  let lastSemaineIdx = 0;

  let calendarFerie: { idx: number; pharma: string; date: Date } | null = null;
  for (const ferieDate of feriesInPlanningWindow(year, inYear)) {
    const guard = findFerieRotationForDate(sorted, ferieDate);
    const fromCalendar = pharmacieAtCalendarDate(sorted, ferieDate);
    const name = guard?.pharmacie || fromCalendar || "";
    if (name && isCentrePharmacy(name)) {
      const idx = centreIdx(name);
      if (idx >= 0) {
        calendarFerie = { idx, pharma: name, date: ferieDate };
      }
    }
  }

  let rowFerie: { idx: number; pharma: string; date: Date } | null = null;
  for (const day of inYear) {
    if (
      isFerieRotationAssignment(day) &&
      day.pharmacie &&
      isCentrePharmacy(day.pharmacie)
    ) {
      const idx = centreIdx(day.pharmacie);
      if (idx >= 0) {
        rowFerie = { idx, pharma: day.pharmacie, date: day.date };
      }
    }
  }

  const ferieEnd =
    rowFerie &&
    (!calendarFerie || rowFerie.date.getTime() > calendarFerie.date.getTime())
      ? rowFerie
      : calendarFerie;
  if (ferieEnd) {
    lastFerieIdx = ferieEnd.idx;
    lastFeriePharma = ferieEnd.pharma;
  }

  let calendarDomingo: { idx: number; pharma: string; date: Date } | null = null;
  for (const day of inYear) {
    if (
      day.date.getDay() === 6 &&
      day.type === "weekend" &&
      day.pharmacie &&
      isCentrePharmacy(day.pharmacie)
    ) {
      const idx = centreIdx(day.pharmacie);
      if (idx >= 0) {
        calendarDomingo = { idx, pharma: day.pharmacie, date: day.date };
      }
    }
  }

  let rowDomingo: { idx: number; pharma: string; date: Date } | null = null;
  for (const day of inYear) {
    if (
      isWeekendRotationAssignment(day) &&
      day.pharmacie &&
      isCentrePharmacy(day.pharmacie)
    ) {
      const idx = centreIdx(day.pharmacie);
      if (idx >= 0) {
        rowDomingo = { idx, pharma: day.pharmacie, date: day.date };
      }
    }
  }

  const domingoEnd =
    rowDomingo &&
    (!calendarDomingo ||
      rowDomingo.date.getTime() > calendarDomingo.date.getTime())
      ? rowDomingo
      : calendarDomingo ?? rowDomingo;
  if (domingoEnd) {
    lastDomingoIdx = domingoEnd.idx;
    lastDomingoPharma = domingoEnd.pharma;
  }

  for (const day of inYear) {
    if (!day.pharmacie) continue;
    if (
      day.type === "lundi" &&
      (isLauziere(day.pharmacie) || isGrandArc(day.pharmacie)) &&
      !isFerieMonday(day.date.getFullYear(), day.date)
    ) {
      lastLundiPharma = day.pharmacie;
    }
  }

  // Lundis : pharmacie au jour calendaire (héritage Excel Norman)
  {
    let cursor = new Date(year, 11, 31, 12, 0, 0, 0);
    for (let i = 0; i < 21; i++) {
      if (cursor.getDay() === 1 && !isFerieMonday(cursor.getFullYear(), cursor)) {
        const name = pharmacieAtCalendarDate(sorted, cursor);
        if (name && (isLauziere(name) || isGrandArc(name))) {
          lastLundiPharma = name;
          break;
        }
      }
      cursor = addDays(cursor, -1);
    }
  }

  for (const day of inYear) {
    if (!day.pharmacie) continue;
    if (
      day.type === "semaine" &&
      PHARMACIES_EXTERIEURES.some((p) => p.name === day.pharmacie)
    ) {
      lastSemaineIdx = findCycleIdxForPharmacy(day.pharmacie, lastSemaineIdx);
    }
  }

  return {
    last_ferie_pharma: lastFeriePharma,
    last_ferie_idx: lastFerieIdx,
    last_domingo_pharma: lastDomingoPharma,
    last_domingo_idx: lastDomingoIdx,
    last_lundi_pharma: lastLundiPharma,
    last_semaine_idx: lastSemaineIdx,
  };
}

/** Config de début d'année pour afficher l'ordre des rotations de l'année. */
export function inferStartConfigFromPlanningDays(
  days: PlanningDayInput[],
  year: number
): GenerateConfig {
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());

  let ferieStartIdx = 0;
  let domingoStartIdx = 0;
  let lundiNext: "lauziere" | "grand_arc" = "lauziere";
  let semaineStartIdx = 0;

  const feries = feriesInPlanningWindow(year, sorted);
  const firstFerie = feries[0];
  if (firstFerie) {
    const guard = findFerieRotationForDate(sorted, firstFerie);
    if (guard) {
      const idx = centreIdx(guard.pharmacie);
      if (idx >= 0) ferieStartIdx = idx;
    }
  }

  const firstSaturday = sorted.find(
    (d) => d.date.getDay() === 6 && d.type === "weekend" && d.pharmacie
  );
  if (firstSaturday) {
    const idx = centreIdx(firstSaturday.pharmacie);
    if (idx >= 0) domingoStartIdx = idx;
  }

  const firstLundi = sorted.find(
    (d) =>
      d.type === "lundi" &&
      d.pharmacie &&
      (isLauziere(d.pharmacie) || isGrandArc(d.pharmacie)) &&
      !isFerieMonday(d.date.getFullYear(), d.date)
  );
  if (firstLundi) {
    lundiNext = isLauziere(firstLundi.pharmacie) ? "lauziere" : "grand_arc";
  }

  const firstSemaine = sorted.find((d) => d.type === "semaine" && d.pharmacie);
  if (firstSemaine) {
    semaineStartIdx = findCycleIdxForPharmacy(firstSemaine.pharmacie, -1);
  }

  return normalizeGenerateConfig({
    centreStartIdx: domingoStartIdx,
    ferieStartIdx,
    domingoStartIdx,
    lundiNext,
    semaineStartIdx,
  });
}

export function configForYearFromPreviousPlanning(
  prevDays: PlanningDayInput[],
  prevYear: number
): GenerateConfig {
  const endState = inferEndStateFromPlanningDays(prevDays, prevYear);
  return configFromYearConfig(endState);
}

export function defaultRotationConfig(year: number): GenerateConfig {
  const centreStartIdx = year === 2027 ? 3 : 0;
  return normalizeGenerateConfig({
    centreStartIdx,
    ferieStartIdx: centreStartIdx,
    domingoStartIdx: centreStartIdx,
    lundiNext: year === 2027 ? "grand_arc" : "lauziere",
    semaineStartIdx: 0,
  });
}

/** Prochain index après le dernier slot semaine utilisé. */
export function nextSemaineStartIdx(lastSemaineIdx: number): number {
  return nextExterieuresCycleIdx(lastSemaineIdx);
}
