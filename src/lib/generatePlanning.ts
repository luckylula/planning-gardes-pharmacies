import {
  PHARMACIES_CENTRE,
  PHARMACIES_EXTERIEURES,
  PHARMACIES_MAURIENNE,
  getPharmacyByIdx,
  isTwoDayPharmacy,
} from "./pharmacies";
import {
  addDays,
  dateKey,
  getFirstMondayOfJanuary,
  utcDate,
} from "./dates";
import type {
  GenerateConfig,
  PlanningDayInput,
  PlanningDayType,
  YearConfigState,
} from "./types";

const HEURE = "19h15";
const PLANNING_DAYS = 364;

/** Algorithme de Butcher pour le calcul de Pâques */
export function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

export function getFeriesDates(year: number): Date[] {
  const easter = getEaster(year);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const pentecoteMonday = addDays(easter, 50);

  return [
    utcDate(year, 1, 1),
    easterMonday,
    utcDate(year, 5, 1),
    utcDate(year, 5, 8),
    ascension,
    pentecoteMonday,
    utcDate(year, 7, 14),
    utcDate(year, 8, 15),
    utcDate(year, 11, 1),
    utcDate(year, 11, 11),
    utcDate(year, 12, 25),
  ];
}

export function getFeriesSet(year: number): Set<string> {
  const nextYearFeries = getFeriesDates(year + 1);
  const all = [...getFeriesDates(year), ...nextYearFeries];
  return new Set(all.map(dateKey));
}

function makeDay(
  year: number,
  dateDebut: Date,
  pharmacie: string,
  adresse: string,
  type: PlanningDayType
): PlanningDayInput {
  const dateFin = addDays(dateDebut, 1);
  return {
    year,
    date: dateDebut,
    heure_debut: HEURE,
    date_fin: dateFin,
    heure_fin: HEURE,
    pharmacie,
    adresse,
    type,
  };
}

interface RotationState {
  ferieIdx: number;
  domingoIdx: number;
  lundiNext: "lauziere" | "grand_arc";
  semaineIdx: number;
  activeTwoDay: string | null;
  pendingTwoDay: { idx: number } | null;
}

function nextNonTwoDayIdx(fromIdx: number): number {
  let idx = (fromIdx + 1) % PHARMACIES_EXTERIEURES.length;
  let guard = 0;
  while (
    isTwoDayPharmacy(PHARMACIES_EXTERIEURES[idx]) &&
    guard < PHARMACIES_EXTERIEURES.length
  ) {
    idx = (idx + 1) % PHARMACIES_EXTERIEURES.length;
    guard++;
  }
  return idx;
}

function assignSemaine(
  date: Date,
  dow: number,
  feries: Set<string>,
  state: RotationState
): PlanningDayInput | null {
  if (dow < 2 || dow > 5) return null;
  if (feries.has(dateKey(date))) return null;

  const daysLeft = 5 - dow + 1;

  if (state.activeTwoDay) {
    const pharma = PHARMACIES_EXTERIEURES.find(
      (p) => p.name === state.activeTwoDay
    )!;
    state.activeTwoDay = null;
    state.semaineIdx =
      (state.semaineIdx + 1) % PHARMACIES_EXTERIEURES.length;
    return makeDay(
      date.getFullYear(),
      date,
      pharma.name,
      pharma.adresse,
      "semaine"
    );
  }

  if (state.pendingTwoDay && dow === 2) {
    const pharma = PHARMACIES_EXTERIEURES[state.pendingTwoDay.idx];
    if (daysLeft >= 2) {
      state.pendingTwoDay = null;
      state.activeTwoDay = pharma.name;
      return makeDay(
        date.getFullYear(),
        date,
        pharma.name,
        pharma.adresse,
        "semaine"
      );
    }
  }

  const current = PHARMACIES_EXTERIEURES[state.semaineIdx];

  if (isTwoDayPharmacy(current)) {
    if (daysLeft >= 2) {
      state.activeTwoDay = current.name;
      return makeDay(
        date.getFullYear(),
        date,
        current.name,
        current.adresse,
        "semaine"
      );
    }
    state.pendingTwoDay = { idx: state.semaineIdx };
    const subIdx = nextNonTwoDayIdx(state.semaineIdx);
    const sub = PHARMACIES_EXTERIEURES[subIdx];
    return makeDay(
      date.getFullYear(),
      date,
      sub.name,
      sub.adresse,
      "semaine"
    );
  }

  state.semaineIdx =
    (state.semaineIdx + 1) % PHARMACIES_EXTERIEURES.length;
  return makeDay(
    date.getFullYear(),
    date,
    current.name,
    current.adresse,
    "semaine"
  );
}

export function configFromYearConfig(prev: YearConfigState): GenerateConfig {
  return {
    ferieStartIdx: (prev.last_ferie_idx + 1) % PHARMACIES_CENTRE.length,
    domingoStartIdx: (prev.last_domingo_idx + 1) % PHARMACIES_CENTRE.length,
    lundiNext: prev.last_lundi_pharma.toLowerCase().includes("lauzière") ||
      prev.last_lundi_pharma.toLowerCase().includes("lauziere")
      ? "grand_arc"
      : "lauziere",
    semaineStartIdx:
      (prev.last_semaine_idx + 1) % PHARMACIES_EXTERIEURES.length,
  };
}

export function generatePlanning(
  year: number,
  config: GenerateConfig
): { days: PlanningDayInput[]; finalState: YearConfigState } {
  const start = getFirstMondayOfJanuary(year);
  const feries = getFeriesSet(year);
  const days: PlanningDayInput[] = [];

  const state: RotationState = {
    ferieIdx: config.ferieStartIdx,
    domingoIdx: config.domingoStartIdx,
    lundiNext: config.lundiNext,
    semaineIdx: config.semaineStartIdx,
    activeTwoDay: null,
    pendingTwoDay: null,
  };

  let lastFeriePharma = "";
  let lastFerieIdx = config.ferieStartIdx;
  let lastDomingoPharma = "";
  let lastDomingoIdx = config.domingoStartIdx;
  let lastLundiPharma = "";

  for (let i = 0; i < PLANNING_DAYS; i++) {
    const dateDebut = addDays(start, i);
    const dow = dateDebut.getDay();
    const key = dateKey(dateDebut);
    const isFerie = feries.has(key);
    const planningYear = dateDebut.getFullYear();

    if (dow === 6) {
      const sunday = addDays(dateDebut, 1);
      const sundayIsFerie = feries.has(dateKey(sunday));

      let pharma;
      if (sundayIsFerie || isFerie) {
        pharma = getPharmacyByIdx("centre", state.ferieIdx);
        lastFeriePharma = pharma.name;
        lastFerieIdx = state.ferieIdx;
        state.ferieIdx = (state.ferieIdx + 1) % PHARMACIES_CENTRE.length;
      } else {
        pharma = getPharmacyByIdx("centre", state.domingoIdx);
        lastDomingoPharma = pharma.name;
        lastDomingoIdx = state.domingoIdx;
        state.domingoIdx =
          (state.domingoIdx + 1) % PHARMACIES_CENTRE.length;
      }

      days.push(
        makeDay(planningYear, dateDebut, pharma.name, pharma.adresse, "weekend")
      );
      continue;
    }

    if (dow === 0) {
      days.push(makeDay(planningYear, dateDebut, "", "", "vide"));
      continue;
    }

    if (isFerie) {
      const pharma = getPharmacyByIdx("centre", state.ferieIdx);
      lastFeriePharma = pharma.name;
      lastFerieIdx = state.ferieIdx;
      state.ferieIdx = (state.ferieIdx + 1) % PHARMACIES_CENTRE.length;
      days.push(
        makeDay(
          planningYear,
          dateDebut,
          pharma.name,
          pharma.adresse,
          "ferie"
        )
      );
      continue;
    }

    if (dow === 1) {
      const pharma =
        state.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[0]
          : PHARMACIES_MAURIENNE[1];
      lastLundiPharma = pharma.name;
      state.lundiNext =
        state.lundiNext === "lauziere" ? "grand_arc" : "lauziere";
      days.push(
        makeDay(planningYear, dateDebut, pharma.name, pharma.adresse, "lundi")
      );
      continue;
    }

    const semaineDay = assignSemaine(dateDebut, dow, feries, state);
    if (semaineDay) {
      days.push({ ...semaineDay, year: planningYear });
    }
  }

  const lastSemaineIdx =
    state.pendingTwoDay?.idx ??
    (state.semaineIdx - 1 + PHARMACIES_EXTERIEURES.length) %
      PHARMACIES_EXTERIEURES.length;

  return {
    days,
    finalState: {
      last_ferie_pharma: lastFeriePharma || getPharmacyByIdx("centre", lastFerieIdx).name,
      last_ferie_idx: lastFerieIdx,
      last_domingo_pharma:
        lastDomingoPharma || getPharmacyByIdx("centre", lastDomingoIdx).name,
      last_domingo_idx: lastDomingoIdx,
      last_lundi_pharma:
        lastLundiPharma ||
        (config.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[1].name
          : PHARMACIES_MAURIENNE[0].name),
      last_semaine_idx: lastSemaineIdx,
    },
  };
}
