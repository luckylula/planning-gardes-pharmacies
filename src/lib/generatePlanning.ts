import {
  PHARMACIES_CENTRE,
  PHARMACIES_MAURIENNE,
  ROTATION_EXTERIEURES_CYCLE_LENGTH,
  getExterieuresCycleSlot,
  getPharmacyByIdx,
  nextExterieuresCycleIdx,
  nextOneDayCycleIdx,
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
  CentreRotation,
  YearConfigState,
} from "./types";

const HEURE = "19h15";
const HEURE_DIMANCHE_MATIN = "09h00";
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

export function getFeriesSet(planningYear: number): Set<string> {
  const keys = new Set<string>();
  for (const d of getFeriesDates(planningYear)) keys.add(dateKey(d));
  for (const d of getFeriesDates(planningYear + 1)) keys.add(dateKey(d));
  return keys;
}

interface ScheduledGuard {
  debut: Date;
  fin: Date;
  heure_debut: string;
  heure_fin: string;
  rotation: CentreRotation;
  type: PlanningDayType;
}

function buildFerieSchedule(ferieDate: Date): {
  guards: ScheduledGuard[];
  absorbed: string[];
} {
  const dow = ferieDate.getDay();
  const absorbed: string[] = [];

  // Cas 1 — Mar/Mer/Jeu/Ven : garde unique 48h (rotation fériés)
  if (dow >= 2 && dow <= 5) {
    const debut = addDays(ferieDate, -1);
    const fin = addDays(ferieDate, 1);
    absorbed.push(dateKey(ferieDate));
    if (dow === 5) absorbed.push(dateKey(fin));
    return {
      guards: [
        {
          debut,
          fin,
          heure_debut: HEURE,
          heure_fin: HEURE,
          rotation: "ferie",
          type: "ferie",
        },
      ],
      absorbed,
    };
  }

  // Cas 2 — Samedi : deux gardes (fériés + dimanches)
  if (dow === 6) {
    absorbed.push(dateKey(ferieDate));
    return {
      guards: [
        {
          debut: addDays(ferieDate, -1),
          fin: addDays(ferieDate, 1),
          heure_debut: HEURE,
          heure_fin: HEURE_DIMANCHE_MATIN,
          rotation: "ferie",
          type: "ferie",
        },
        {
          debut: addDays(ferieDate, 1),
          fin: addDays(ferieDate, 2),
          heure_debut: HEURE_DIMANCHE_MATIN,
          heure_fin: HEURE,
          rotation: "domingo",
          type: "ferie",
        },
      ],
      absorbed,
    };
  }

  // Cas 3 — Lundi : week-end normal + garde fériée (lundi Maurienne absorbé)
  if (dow === 1) {
    absorbed.push(dateKey(ferieDate));
    return {
      guards: [
        {
          debut: addDays(ferieDate, -2),
          fin: addDays(ferieDate, -1),
          heure_debut: HEURE,
          heure_fin: HEURE,
          rotation: "domingo",
          type: "weekend",
        },
        {
          debut: addDays(ferieDate, -1),
          fin: addDays(ferieDate, 1),
          heure_debut: HEURE,
          heure_fin: HEURE,
          rotation: "ferie",
          type: "ferie",
        },
      ],
      absorbed,
    };
  }

  // Cas 4 — Dimanche : garde 48h samedi→lundi (rotation fériés, dimanches ne avance pas)
  if (dow === 0) {
    absorbed.push(dateKey(ferieDate));
    return {
      guards: [
        {
          debut: addDays(ferieDate, -1),
          fin: addDays(ferieDate, 1),
          heure_debut: HEURE,
          heure_fin: HEURE,
          rotation: "ferie",
          type: "ferie",
        },
      ],
      absorbed,
    };
  }

  return { guards: [], absorbed: [] };
}

function collectFerieSchedules(
  start: Date,
  end: Date
): {
  guardsByDebut: Map<string, ScheduledGuard[]>;
  absorbedSlots: Set<string>;
} {
  const guardsByDebut = new Map<string, ScheduledGuard[]>();
  const absorbedSlots = new Set<string>();

  const yearStart = start.getFullYear();
  const yearEnd = end.getFullYear();
  const ferieDates: Date[] = [
    ...getFeriesDates(yearStart),
    ...(yearEnd !== yearStart ? getFeriesDates(yearEnd) : []),
  ];
  const uniqueFerieDates = ferieDates.filter(
    (d, i, arr) =>
      arr.findIndex((x) => dateKey(x) === dateKey(d)) === i
  );

  for (const ferieDate of uniqueFerieDates) {
    if (ferieDate < start || ferieDate > end) continue;

    const { guards, absorbed } = buildFerieSchedule(ferieDate);
    const inRangeGuards = guards.filter(
      (g) => g.debut >= start && g.debut <= end
    );
    if (inRangeGuards.length === 0) continue;

    for (const guard of inRangeGuards) {
      const key = dateKey(guard.debut);
      const existing = guardsByDebut.get(key) ?? [];
      existing.push(guard);
      guardsByDebut.set(key, existing);
    }

    absorbed.forEach((slot) => {
      if (!inRangeGuards.some((g) => dateKey(g.debut) === slot)) {
        absorbedSlots.add(slot);
      }
    });
  }

  return { guardsByDebut, absorbedSlots };
}

function makeDay(
  year: number,
  dateDebut: Date,
  dateFin: Date,
  pharmacie: string,
  adresse: string,
  type: PlanningDayType,
  heureDebut = HEURE,
  heureFin = HEURE,
  centreRotation?: CentreRotation
): PlanningDayInput {
  return {
    year,
    date: dateDebut,
    heure_debut: heureDebut,
    date_fin: dateFin,
    heure_fin: heureFin,
    pharmacie,
    adresse,
    type,
    centreRotation,
  };
}

function takeCentrePharmacy(idx: number): {
  pharma: (typeof PHARMACIES_CENTRE)[0];
  idx: number;
  usedIdx: number;
} {
  const usedIdx =
    ((idx % PHARMACIES_CENTRE.length) + PHARMACIES_CENTRE.length) %
    PHARMACIES_CENTRE.length;
  const pharma = getPharmacyByIdx("centre", usedIdx);
  return {
    pharma,
    idx: (usedIdx + 1) % PHARMACIES_CENTRE.length,
    usedIdx,
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

function assignSemaine(
  date: Date,
  dow: number,
  state: RotationState
): PlanningDayInput {
  const daysLeft = 5 - dow + 1;

  if (state.activeTwoDay) {
    const { pharma } = getExterieuresCycleSlot(state.semaineIdx);
    state.activeTwoDay = null;
    state.semaineIdx = nextExterieuresCycleIdx(state.semaineIdx);
    return makeDay(
      date.getFullYear(),
      date,
      addDays(date, 1),
      pharma.name,
      pharma.adresse,
      "semaine"
    );
  }

  if (state.pendingTwoDay && dow === 2) {
    const { pharma, dias } = getExterieuresCycleSlot(state.pendingTwoDay.idx);
    if (daysLeft >= 2 && dias === 2) {
      state.pendingTwoDay = null;
      state.activeTwoDay = pharma.name;
      return makeDay(
        date.getFullYear(),
        date,
        addDays(date, 1),
        pharma.name,
        pharma.adresse,
        "semaine"
      );
    }
  }

  const { pharma: current, dias } = getExterieuresCycleSlot(state.semaineIdx);

  if (dias === 2) {
    if (daysLeft >= 2) {
      state.activeTwoDay = current.name;
      return makeDay(
        date.getFullYear(),
        date,
        addDays(date, 1),
        current.name,
        current.adresse,
        "semaine"
      );
    }
    state.pendingTwoDay = { idx: state.semaineIdx };
    const sub = getExterieuresCycleSlot(
      nextOneDayCycleIdx(state.semaineIdx)
    ).pharma;
    return makeDay(
      date.getFullYear(),
      date,
      addDays(date, 1),
      sub.name,
      sub.adresse,
      "semaine"
    );
  }

  state.semaineIdx = nextExterieuresCycleIdx(state.semaineIdx);
  return makeDay(
    date.getFullYear(),
    date,
    addDays(date, 1),
    current.name,
    current.adresse,
    "semaine"
  );
}

/** Cas 2 (férié samedi) : 2e garde — éviter la même pharmacie que la garde fériés du vendredi. */
function isSaturdayFerieSecondGuard(guard: ScheduledGuard): boolean {
  return (
    guard.rotation === "domingo" &&
    guard.type === "ferie" &&
    guard.heure_debut === HEURE_DIMANCHE_MATIN
  );
}

function findSaturdayFerieFirstPharmacy(
  guard: ScheduledGuard,
  days: PlanningDayInput[]
): string | null {
  const pairedDebut = addDays(guard.debut, -2);
  const paired = days.find(
    (d) =>
      dateKey(d.date) === dateKey(pairedDebut) &&
      d.type === "ferie" &&
      d.heure_fin === HEURE_DIMANCHE_MATIN
  );
  return paired?.pharmacie ?? null;
}

function emitScheduledGuards(
  scheduled: ScheduledGuard[],
  planningYear: number,
  state: RotationState,
  days: PlanningDayInput[],
  track: {
    lastFeriePharma: string;
    lastFerieIdx: number;
    lastDomingoPharma: string;
    lastDomingoIdx: number;
    lastWeekendPharma: { name: string; adresse: string };
  }
) {
  for (const guard of scheduled) {
    const rotationIdx =
      guard.rotation === "ferie" ? state.ferieIdx : state.domingoIdx;
    let { pharma, idx, usedIdx } = takeCentrePharmacy(rotationIdx);

    if (isSaturdayFerieSecondGuard(guard)) {
      const feriePharma = findSaturdayFerieFirstPharmacy(guard, days);
      if (feriePharma && feriePharma === pharma.name) {
        ({ pharma, idx, usedIdx } = takeCentrePharmacy(idx));
      }
    }

    if (guard.rotation === "ferie") {
      state.ferieIdx = idx;
      track.lastFeriePharma = pharma.name;
      track.lastFerieIdx = usedIdx;
    } else {
      state.domingoIdx = idx;
      track.lastDomingoPharma = pharma.name;
      track.lastDomingoIdx = usedIdx;
    }

    if (guard.type === "weekend" || guard.rotation === "domingo") {
      track.lastWeekendPharma = { name: pharma.name, adresse: pharma.adresse };
    }

    days.push(
      makeDay(
        planningYear,
        guard.debut,
        guard.fin,
        pharma.name,
        pharma.adresse,
        guard.type,
        guard.heure_debut,
        guard.heure_fin,
        guard.rotation
      )
    );
  }
}

export function normalizeGenerateConfig(
  config: Partial<GenerateConfig>
): GenerateConfig {
  const ferie =
    config.ferieStartIdx ?? config.centreStartIdx ?? 0;
  const domingo =
    config.domingoStartIdx ?? config.centreStartIdx ?? ferie;
  return {
    centreStartIdx: config.centreStartIdx ?? ferie,
    ferieStartIdx: ferie,
    domingoStartIdx: domingo,
    lundiNext: config.lundiNext ?? "grand_arc",
    semaineStartIdx: config.semaineStartIdx ?? 0,
  };
}

export function configFromYearConfig(prev: YearConfigState): GenerateConfig {
  return {
    centreStartIdx:
      (prev.last_domingo_idx + 1) % PHARMACIES_CENTRE.length,
    ferieStartIdx:
      (prev.last_ferie_idx + 1) % PHARMACIES_CENTRE.length,
    domingoStartIdx:
      (prev.last_domingo_idx + 1) % PHARMACIES_CENTRE.length,
    lundiNext:
      isLauziereName(prev.last_lundi_pharma) ? "grand_arc" : "lauziere",
    semaineStartIdx:
      nextExterieuresCycleIdx(prev.last_semaine_idx),
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
  const end = addDays(start, PLANNING_DAYS - 1);
  const { guardsByDebut, absorbedSlots } = collectFerieSchedules(start, end);

  const days: PlanningDayInput[] = [];
  const state: RotationState = {
    ferieIdx: config.ferieStartIdx,
    domingoIdx: config.domingoStartIdx,
    lundiNext: config.lundiNext,
    semaineIdx: config.semaineStartIdx,
    activeTwoDay: null,
    pendingTwoDay: null,
  };

  const track = {
    lastFeriePharma: "",
    lastFerieIdx: config.ferieStartIdx,
    lastDomingoPharma: "",
    lastDomingoIdx: config.domingoStartIdx,
    lastWeekendPharma: { name: "", adresse: "" },
  };
  let lastLundiPharma = "";

  for (let i = 0; i < PLANNING_DAYS; i++) {
    const dateDebut = addDays(start, i);
    const key = dateKey(dateDebut);
    const dow = dateDebut.getDay();
    const planningYear = dateDebut.getFullYear();

    const scheduled = guardsByDebut.get(key);
    if (scheduled) {
      emitScheduledGuards(scheduled, planningYear, state, days, track);
      continue;
    }

    if (absorbedSlots.has(key)) continue;

    if (dow === 6) {
      const { pharma, idx, usedIdx } = takeCentrePharmacy(state.domingoIdx);
      state.domingoIdx = idx;
      track.lastDomingoPharma = pharma.name;
      track.lastDomingoIdx = usedIdx;
      track.lastWeekendPharma = { name: pharma.name, adresse: pharma.adresse };
      days.push(
        makeDay(
          planningYear,
          dateDebut,
          addDays(dateDebut, 1),
          pharma.name,
          pharma.adresse,
          "weekend",
          HEURE,
          HEURE,
          "domingo"
        )
      );
      continue;
    }

    if (dow === 0) {
      days.push(
        makeDay(
          planningYear,
          dateDebut,
          addDays(dateDebut, 1),
          track.lastWeekendPharma.name,
          track.lastWeekendPharma.adresse,
          "vide"
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
        makeDay(
          planningYear,
          dateDebut,
          addDays(dateDebut, 1),
          pharma.name,
          pharma.adresse,
          "lundi"
        )
      );
      continue;
    }

    if (dow >= 2 && dow <= 5) {
      days.push(assignSemaine(dateDebut, dow, state));
    }
  }

  const lastSemaineIdx =
    state.pendingTwoDay?.idx ??
    (state.semaineIdx - 1 + ROTATION_EXTERIEURES_CYCLE_LENGTH) %
      ROTATION_EXTERIEURES_CYCLE_LENGTH;

  return {
    days,
    finalState: {
      last_ferie_pharma:
        track.lastFeriePharma ||
        getPharmacyByIdx("centre", track.lastFerieIdx).name,
      last_ferie_idx: track.lastFerieIdx,
      last_domingo_pharma:
        track.lastDomingoPharma ||
        getPharmacyByIdx("centre", track.lastDomingoIdx).name,
      last_domingo_idx: track.lastDomingoIdx,
      last_lundi_pharma:
        lastLundiPharma ||
        (config.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[1].name
          : PHARMACIES_MAURIENNE[0].name),
      last_semaine_idx: lastSemaineIdx,
    },
  };
}
