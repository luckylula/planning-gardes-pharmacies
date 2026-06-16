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

/** Algorithme de Oudin (1940) — calcul fiable de Pâques */
export function getEaster(year: number): Date {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H =
    (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I =
    H -
    f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return utcDate(year, month, day);
}

export function getFeriesDates(year: number): Date[] {
  const easter = getEaster(year);
  return [
    utcDate(year, 1, 1),
    addDays(easter, 1),
    utcDate(year, 5, 1),
    utcDate(year, 5, 8),
    addDays(easter, 39),
    addDays(easter, 50),
    utcDate(year, 7, 14),
    utcDate(year, 8, 15),
    utcDate(year, 11, 1),
    utcDate(year, 11, 11),
    utcDate(year, 12, 25),
  ];
}

/** Ensemble des jours fériés couvrant la période du planning */
export function getFeriesSet(planningYear: number): Set<string> {
  const keys = new Set<string>();
  for (const d of getFeriesDates(planningYear)) keys.add(dateKey(d));
  for (const d of getFeriesDates(planningYear + 1)) keys.add(dateKey(d));
  return keys;
}

function makeDay(
  year: number,
  dateDebut: Date,
  pharmacie: string,
  adresse: string,
  type: PlanningDayType
): PlanningDayInput {
  return {
    year,
    date: dateDebut,
    heure_debut: HEURE,
    date_fin: addDays(dateDebut, 1),
    heure_fin: HEURE,
    pharmacie,
    adresse,
    type,
  };
}

function takeCentrePharmacy(idx: number): {
  pharma: (typeof PHARMACIES_CENTRE)[0];
  idx: number;
} {
  const pharma = getPharmacyByIdx("centre", idx);
  return {
    pharma,
    idx: (idx + 1) % PHARMACIES_CENTRE.length,
  };
}

interface RotationState {
  centreIdx: number;
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
  state: RotationState
): PlanningDayInput {
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
    const sub = PHARMACIES_EXTERIEURES[nextNonTwoDayIdx(state.semaineIdx)];
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

export function normalizeGenerateConfig(
  config: Partial<GenerateConfig>
): GenerateConfig {
  const centre =
    config.centreStartIdx ??
    config.ferieStartIdx ??
    config.domingoStartIdx ??
    0;
  return {
    centreStartIdx: centre,
    ferieStartIdx: centre,
    domingoStartIdx: centre,
    lundiNext: config.lundiNext ?? "grand_arc",
    semaineStartIdx: config.semaineStartIdx ?? 0,
  };
}

export function configFromYearConfig(prev: YearConfigState): GenerateConfig {
  const lastCentre = Math.max(prev.last_ferie_idx, prev.last_domingo_idx);
  const nextCentre = (lastCentre + 1) % PHARMACIES_CENTRE.length;
  return {
    centreStartIdx: nextCentre,
    ferieStartIdx: nextCentre,
    domingoStartIdx: nextCentre,
    lundiNext:
      isLauziereName(prev.last_lundi_pharma) ? "grand_arc" : "lauziere",
    semaineStartIdx:
      (prev.last_semaine_idx + 1) % PHARMACIES_EXTERIEURES.length,
  };
}

function isLauziereName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("lauzière") || n.includes("lauziere");
}

export function generatePlanning(
  year: number,
  rawConfig: GenerateConfig
): { days: PlanningDayInput[]; finalState: YearConfigState } {
  const config = normalizeGenerateConfig(rawConfig);
  const start = getFirstMondayOfJanuary(year);
  const feries = getFeriesSet(year);
  const days: PlanningDayInput[] = [];

  const state: RotationState = {
    centreIdx: config.centreStartIdx,
    lundiNext: config.lundiNext,
    semaineIdx: config.semaineStartIdx,
    activeTwoDay: null,
    pendingTwoDay: null,
  };

  let lastCentrePharma = "";
  let lastCentreIdx = config.centreStartIdx;
  let lastLundiPharma = "";

  for (let i = 0; i < PLANNING_DAYS; i++) {
    const dateDebut = addDays(start, i);
    const dow = dateDebut.getDay();
    const isFerie = feries.has(dateKey(dateDebut));
    const planningYear = dateDebut.getFullYear();

    // SAMEDI → Centre Albertville (rotation unique), type weekend
    if (dow === 6) {
      const { pharma, idx } = takeCentrePharmacy(state.centreIdx);
      state.centreIdx = idx;
      lastCentrePharma = pharma.name;
      lastCentreIdx = (idx - 1 + PHARMACIES_CENTRE.length) % PHARMACIES_CENTRE.length;
      days.push(
        makeDay(planningYear, dateDebut, pharma.name, pharma.adresse, "weekend")
      );
      continue;
    }

    // DIMANCHE → ligne vide (même pharmacie que le samedi)
    if (dow === 0) {
      days.push(makeDay(planningYear, dateDebut, "", "", "vide"));
      continue;
    }

    // Jour férié (lun–ven) → Centre Albertville, type ferie
    if (isFerie) {
      const { pharma, idx } = takeCentrePharmacy(state.centreIdx);
      state.centreIdx = idx;
      lastCentrePharma = pharma.name;
      lastCentreIdx = (idx - 1 + PHARMACIES_CENTRE.length) % PHARMACIES_CENTRE.length;
      days.push(
        makeDay(planningYear, dateDebut, pharma.name, pharma.adresse, "ferie")
      );
      continue;
    }

    // LUNDI normal → alternance Lauzière / Grand Arc
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

    // MARDI–VENDREDI → extérieures
    if (dow >= 2 && dow <= 5) {
      days.push(assignSemaine(dateDebut, dow, state));
    }
  }

  const lastSemaineIdx =
    state.pendingTwoDay?.idx ??
    (state.semaineIdx - 1 + PHARMACIES_EXTERIEURES.length) %
      PHARMACIES_EXTERIEURES.length;

  const centreName =
    lastCentrePharma ||
    getPharmacyByIdx("centre", lastCentreIdx).name;

  return {
    days,
    finalState: {
      last_ferie_pharma: centreName,
      last_ferie_idx: lastCentreIdx,
      last_domingo_pharma: centreName,
      last_domingo_idx: lastCentreIdx,
      last_lundi_pharma:
        lastLundiPharma ||
        (config.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[1].name
          : PHARMACIES_MAURIENNE[0].name),
      last_semaine_idx: lastSemaineIdx,
    },
  };
}
