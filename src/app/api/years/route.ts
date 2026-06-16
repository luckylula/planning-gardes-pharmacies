import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const configs = await prisma.yearConfig.findMany({
    orderBy: { year: "desc" },
  });

  const years = await Promise.all(
    configs.map(async (c) => {
      const dayCount = await prisma.planningDay.count({
        where: { year: c.year },
      });
      return { ...c, dayCount };
    })
  );

  return NextResponse.json(years);
}
