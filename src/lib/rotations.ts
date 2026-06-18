import {
  ALL_PHARMACIES,
  PHARMACIES_CENTRE,
  PHARMACIES_MAURIENNE,
  ROTATION_EXTERIEURES_CYCLE,
  type Pharmacy,
  type PharmacyGroup,
} from "./pharmacies";
import type { GenerateConfig } from "./types";
import {
  configForYearFromPreviousPlanning,
  defaultRotationConfig,
  inferEndStateFromPlanningDays,
} from "./planningRotationState";
import { configFromYearConfig } from "./generatePlanning";

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

/**
 * Config de début d'année pour l'affichage des rotations (ordre cyclique complet).
 * Déduit des dernières gardes de l'année précédente si disponible,
 * sinon des dernières gardes de l'année elle-même (fin de liste = dernière garde réelle).
 * N'utilise PAS YearConfig.
 */
export async function resolveRotationConfigForYear(
  year: number
): Promise<GenerateConfig> {
  const prevDays = await loadPlanningDays(year - 1);
  if (prevDays.length > 0) {
    return configForYearFromPreviousPlanning(prevDays, year - 1);
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
