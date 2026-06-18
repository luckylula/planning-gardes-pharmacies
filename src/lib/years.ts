import { prisma } from "./db";

/** Année la plus ancienne avec planning ou YearConfig en base. */
export async function getOldestYear(): Promise<number | null> {
  const [fromConfig, fromDays] = await Promise.all([
    prisma.yearConfig.findFirst({
      orderBy: { year: "asc" },
      select: { year: true },
    }),
    prisma.planningDay.findFirst({
      orderBy: { year: "asc" },
      select: { year: true },
    }),
  ]);

  const candidates = [fromConfig?.year, fromDays?.year].filter(
    (y): y is number => y != null
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}
