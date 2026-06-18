import {
  ALL_PHARMACIES,
  PHARMACIES_CENTRE,
  PHARMACIES_MAURIENNE,
  ROTATION_EXTERIEURES_CYCLE,
  ROTATION_EXTERIEURES_CYCLE_LENGTH,
  type Pharmacy,
  type PharmacyGroup,
} from "./pharmacies";
import type { GenerateConfig, YearConfigState } from "./types";
import {
  defaultRotationConfig,
  inferEndStateFromPlanningDays,
} from "./planningRotationState";
import {
  configFromYearConfig,
  normalizeGenerateConfig,
} from "./generatePlanning";

export interface RotationEntry {
  position: number;
  name: string;
  group: PharmacyGroup;
  detail?: string;
}

export interface YearRotations {
  year: number;
  ferie: RotationEntry[];
  domingo: RotationEntry[];
  lundi: RotationEntry[];
  semaine: RotationEntry[];
}

export function getRotationOrdenada<T>(lista: T[], startIdx: number): T[] {
  const len = lista.length;
  const resultado: T[] = [];
  for (let i = 0; i < len; i++) {
    resultado.push(lista[((startIdx + i) % len + len) % len]);
  }
  return resultado;
}

export function buildRotationsFromConfig(
  year: number,
  config: GenerateConfig
): YearRotations {
  const feriePharmas = getRotationOrdenada(
    PHARMACIES_CENTRE,
    config.ferieStartIdx
  );
  const domingoPharmas = getRotationOrdenada(
    PHARMACIES_CENTRE,
    config.domingoStartIdx
  );

  const lundiPharmas: Pharmacy[] =
    config.lundiNext === "lauziere"
      ? [PHARMACIES_MAURIENNE[0], PHARMACIES_MAURIENNE[1]]
      : [PHARMACIES_MAURIENNE[1], PHARMACIES_MAURIENNE[0]];

  const semaineSlots = getRotationOrdenada(
    ROTATION_EXTERIEURES_CYCLE,
    config.semaineStartIdx
  );

  const toEntry = (
    position: number,
    pharma: Pharmacy,
    detail?: string
  ): RotationEntry => ({
    position,
    name: pharma.name,
    group: pharma.group,
    detail,
  });

  return {
    year,
    ferie: feriePharmas.map((p, i) => toEntry(i + 1, p)),
    domingo: domingoPharmas.map((p, i) => toEntry(i + 1, p)),
    lundi: lundiPharmas.map((p, i) => toEntry(i + 1, p)),
    semaine: semaineSlots.map((slot, i) => {
      const pharma = ALL_PHARMACIES.find((p) => p.id === slot.pharmacyId)!;
      return toEntry(
        i + 1,
        pharma,
        slot.dias === 2 ? "2 jours" : "1 jour"
      );
    }),
  };
}

async function loadPlanningDays(year: number) {
  const { prisma } = await import("./db");
  const { enrichVideDaysFromWeekend } = await import("./excel");
  const raw = await prisma.planningDay.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });
  return enrichVideDaysFromWeekend(raw).map((d) => ({
    year: d.year,
    date: d.date,
    heure_debut: d.heure_debut,
    date_fin: d.date_fin,
    heure_fin: d.heure_fin,
    pharmacie: d.pharmacie,
    adresse: d.adresse,
    type: d.type as import("./types").PlanningDayInput["type"],
  }));
}

function prevCentreIdx(startIdx: number): number {
  const len = PHARMACIES_CENTRE.length;
  return ((startIdx - 1) % len + len) % len;
}

function prevSemaineIdx(startIdx: number): number {
  return (
    ((startIdx - 1) % ROTATION_EXTERIEURES_CYCLE_LENGTH) +
    ROTATION_EXTERIEURES_CYCLE_LENGTH
  ) % ROTATION_EXTERIEURES_CYCLE_LENGTH;
}

function isLauziereName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("lauzière") || n.includes("lauziere");
}

/** Convertit les indices de début de rotation en YearConfig (état de fin de l'année précédente). */
export function yearConfigFromRotationStarts(
  config: GenerateConfig
): YearConfigState {
  const normalized = normalizeGenerateConfig(config);
  const prevFerie = prevCentreIdx(normalized.ferieStartIdx);
  const prevDomingo = prevCentreIdx(normalized.domingoStartIdx);
  const prevSemaine = prevSemaineIdx(normalized.semaineStartIdx);

  return {
    last_ferie_pharma: PHARMACIES_CENTRE[prevFerie].name,
    last_ferie_idx: prevFerie,
    last_domingo_pharma: PHARMACIES_CENTRE[prevDomingo].name,
    last_domingo_idx: prevDomingo,
    last_lundi_pharma:
      normalized.lundiNext === "lauziere"
        ? PHARMACIES_MAURIENNE[1].name
        : PHARMACIES_MAURIENNE[0].name,
    last_semaine_idx: prevSemaine,
  };
}

/** Déduit les indices de début à partir des listes réordonnées. */
export function rotationStartsFromEditedLists(rotations: {
  ferie: RotationEntry[];
  domingo: RotationEntry[];
  lundi: RotationEntry[];
  semaine: RotationEntry[];
}): GenerateConfig {
  const ferieStartIdx = PHARMACIES_CENTRE.findIndex(
    (p) => p.name === rotations.ferie[0]?.name
  );
  const domingoStartIdx = PHARMACIES_CENTRE.findIndex(
    (p) => p.name === rotations.domingo[0]?.name
  );

  const firstLundi = rotations.lundi[0]?.name ?? "";
  const lundiNext: "lauziere" | "grand_arc" = isLauziereName(firstLundi)
    ? "lauziere"
    : "grand_arc";

  const firstSemaine = rotations.semaine[0];
  let semaineStartIdx = 0;
  if (firstSemaine) {
    for (let i = 0; i < ROTATION_EXTERIEURES_CYCLE_LENGTH; i++) {
      const slots = getRotationOrdenada(ROTATION_EXTERIEURES_CYCLE, i);
      const pharma = ALL_PHARMACIES.find((p) => p.id === slots[0].pharmacyId);
      if (!pharma) continue;
      const detail = slots[0].dias === 2 ? "2 jours" : "1 jour";
      if (
        pharma.name === firstSemaine.name &&
        (firstSemaine.detail ?? detail) === detail
      ) {
        semaineStartIdx = i;
        break;
      }
    }
  }

  return normalizeGenerateConfig({
    ferieStartIdx: ferieStartIdx >= 0 ? ferieStartIdx : 0,
    domingoStartIdx: domingoStartIdx >= 0 ? domingoStartIdx : 0,
    lundiNext,
    semaineStartIdx,
  });
}

/** Config de début de rotation pour l'année N à partir de l'année N-1. */
export async function resolveStartConfigFromPreviousYear(
  prevYear: number
): Promise<GenerateConfig> {
  const { prisma } = await import("./db");
  const yc = await prisma.yearConfig.findUnique({ where: { year: prevYear } });
  if (yc) {
    return configFromYearConfig(yc);
  }

  const prevDays = await loadPlanningDays(prevYear);
  if (prevDays.length > 0) {
    const end = inferEndStateFromPlanningDays(prevDays, prevYear);
    return configFromYearConfig(end);
  }

  return defaultRotationConfig(prevYear + 1);
}

/** Rotations de référence pour l'année la plus ancienne (baseline du système). */
export async function getBaselineRotations(oldestYear: number): Promise<YearRotations> {
  const { prisma } = await import("./db");
  const yc = await prisma.yearConfig.findUnique({ where: { year: oldestYear } });
  const config = yc
    ? configFromYearConfig(yc)
    : await resolveRotationConfigForYear(oldestYear);
  return buildRotationsFromConfig(oldestYear, config);
}

/**
 * Config de début d'année pour l'affichage des rotations (ordre cyclique complet).
 * Priorité : YearConfig de l'année précédente, puis inférence depuis le planning.
 */
export async function resolveRotationConfigForYear(
  year: number
): Promise<GenerateConfig> {
  const prevDays = await loadPlanningDays(year - 1);
  if (prevDays.length > 0) {
    return resolveStartConfigFromPreviousYear(year - 1);
  }

  const yearDays = await loadPlanningDays(year);
  if (yearDays.length > 0) {
    const end = inferEndStateFromPlanningDays(yearDays, year);
    return configFromYearConfig(end);
  }

  return defaultRotationConfig(year);
}

export async function getYearRotations(year: number): Promise<YearRotations> {
  const config = await resolveRotationConfigForYear(year);
  return buildRotationsFromConfig(year, config);
}

// Rétrocompatibilité scripts de test
export { inferStartConfigFromPlanningDays } from "./planningRotationState";
