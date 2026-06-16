export type PlanningDayType =
  | "ferie"
  | "weekend"
  | "lundi"
  | "semaine"
  | "vide";

export interface PlanningDayInput {
  year: number;
  date: Date;
  heure_debut: string;
  date_fin: Date;
  heure_fin: string;
  pharmacie: string;
  adresse: string;
  type: PlanningDayType;
  modified?: boolean;
  note?: string;
}

export interface GenerateConfig {
  centreStartIdx: number;
  ferieStartIdx: number;
  domingoStartIdx: number;
  lundiNext: "lauziere" | "grand_arc";
  semaineStartIdx: number;
}

export interface YearConfigState {
  last_ferie_pharma: string;
  last_ferie_idx: number;
  last_domingo_pharma: string;
  last_domingo_idx: number;
  last_lundi_pharma: string;
  last_semaine_idx: number;
}

export interface ImportSummary {
  year: number;
  lastFeriePharma: string;
  lastFerieIdx: number;
  lastDomingoPharma: string;
  lastDomingoIdx: number;
  lastLundiPharma: string;
  lastSemaineIdx: number;
  totalRows: number;
}

export interface PharmacyStats {
  name: string;
  group: string;
  count: number;
}
