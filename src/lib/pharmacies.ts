export type PharmacyGroup = "centre" | "maurienne" | "exterieures";

export interface Pharmacy {
  id: string;
  name: string;
  adresse: string;
  group: PharmacyGroup;
  needsTwoDays?: boolean;
}

export const PHARMACIES_CENTRE: Pharmacy[] = [
  {
    id: "belle-etoile",
    name: "Pharmacie de la Belle Étoile",
    adresse: "20 avenue Général de Gaulle 73200 Albertville",
    group: "centre",
  },
  {
    id: "croix-orme",
    name: "Pharmacie de la Croix de l'Orme",
    adresse: "2 place de la Croix de l'Orme 73200 Albertville",
    group: "centre",
  },
  {
    id: "centre",
    name: "Pharmacie du Centre",
    adresse: "42 rue de la République 73200 Albertville",
    group: "centre",
  },
  {
    id: "parc-olympique",
    name: "Pharmacie du Parc Olympique",
    adresse: "99 avenue des XVI JO 73200 Albertville",
    group: "centre",
  },
  {
    id: "val-roses",
    name: "Pharmacie du Val des Roses",
    adresse: "458 rue Commandant Dubois 73200 Albertville",
    group: "centre",
  },
  {
    id: "pierre-roy",
    name: "Pharmacie de la Pierre du Roy",
    adresse: "70 chemin de la Pierre du Roy 73200 Albertville",
    group: "centre",
  },
  {
    id: "republique",
    name: "Pharmacie République",
    adresse: "116 rue de la République 73200 Albertville",
    group: "centre",
  },
  {
    id: "zakar",
    name: "Pharmacie Zakar",
    adresse: "24 rue de la République 73200 Albertville",
    group: "centre",
  },
];

export const PHARMACIES_MAURIENNE: Pharmacy[] = [
  {
    id: "lauziere",
    name: "Pharmacie de la Lauzière",
    adresse: "140 rue de la Lauzière 73220 Épierre",
    group: "maurienne",
  },
  {
    id: "grand-arc",
    name: "Pharmacie du Grand Arc",
    adresse: "Grande rue 73220 Aiguebelle Val d'Arc",
    group: "maurienne",
  },
];

export const PHARMACIES_EXTERIEURES: Pharmacy[] = [
  {
    id: "gelon",
    name: "Pharmacie du Gélon",
    adresse: "76 rue de la République 73390 Chamoux sur Gélon",
    group: "exterieures",
  },
  {
    id: "rond-point",
    name: "Pharmacie du Rond-Point",
    adresse: "75 rue du 8 Mai 73400 Ugine",
    group: "exterieures",
  },
  {
    id: "gresy",
    name: "Pharmacie de Grésy sur Isère",
    adresse: "23 grande rue 73460 Grésy sur Isère",
    group: "exterieures",
  },
  {
    id: "mercury",
    name: "Pharmacie de Mercury",
    adresse: "790 route de la Forêt 73200 Mercury",
    group: "exterieures",
    needsTwoDays: true,
  },
  {
    id: "mont-charvin",
    name: "Pharmacie du Mont Charvin",
    adresse: "387 avenue de la Libération 73400 Ugine",
    group: "exterieures",
  },
  {
    id: "gilly",
    name: "Pharmacie de Gilly sur Isère",
    adresse: "21 route de Chambéry 73200 Gilly sur Isère",
    group: "exterieures",
  },
  {
    id: "bathie",
    name: "Pharmacie de la Bathie",
    adresse: "1992 rue Louis Armand 73540 La Bathie",
    group: "exterieures",
  },
  {
    id: "chef-lieu",
    name: "Pharmacie du Chef-Lieu",
    adresse: "22 place de l'Hôtel de Ville 73400 Ugine",
    group: "exterieures",
  },
  {
    id: "laconnay",
    name: "Pharmacie De Laconnay",
    adresse: "rue Louis Blanc Pinget 73250 Saint-Pierre-d'Albigny",
    group: "exterieures",
  },
  {
    id: "fina-tardy",
    name: "Pharmacie Fina Tardy",
    adresse: "11 rue de la Mairie 73460 Frontenex",
    group: "exterieures",
    needsTwoDays: true,
  },
];

export const ALL_PHARMACIES: Pharmacy[] = [
  ...PHARMACIES_CENTRE,
  ...PHARMACIES_MAURIENNE,
  ...PHARMACIES_EXTERIEURES,
];

export function findPharmacy(name: string): Pharmacy | undefined {
  const normalized = name.trim().toLowerCase();
  return ALL_PHARMACIES.find(
    (p) =>
      p.name.toLowerCase() === normalized ||
      p.name.toLowerCase().includes(normalized) ||
      normalized.includes(p.name.toLowerCase())
  );
}

export function getPharmacyByIdx(
  group: "centre" | "exterieures",
  idx: number
): Pharmacy {
  const list =
    group === "centre" ? PHARMACIES_CENTRE : PHARMACIES_EXTERIEURES;
  return list[((idx % list.length) + list.length) % list.length];
}

export function isTwoDayPharmacy(pharmacy: Pharmacy): boolean {
  return pharmacy.needsTwoDays === true;
}

export function isLauziere(name: string): boolean {
  return name.toLowerCase().includes("lauzière") || name.toLowerCase().includes("lauziere");
}

export function isGrandArc(name: string): boolean {
  return name.toLowerCase().includes("grand arc");
}

export function getNextLundiPharmacy(lastLundi: string): Pharmacy {
  if (isLauziere(lastLundi)) return PHARMACIES_MAURIENNE[1];
  return PHARMACIES_MAURIENNE[0];
}
