import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOldestYear } from "@/lib/years";
import {
  getBaselineRotations,
  rotationStartsFromEditedLists,
  yearConfigFromRotationStarts,
  type YearRotations,
} from "@/lib/rotations";

export const dynamic = "force-dynamic";

export async function GET() {
  const oldestYear = await getOldestYear();
  if (!oldestYear) {
    return NextResponse.json({ oldestYear: null, rotations: null });
  }

  const rotations = await getBaselineRotations(oldestYear);
  return NextResponse.json({ oldestYear, rotations });
}

export async function PUT(req: Request) {
  const oldestYear = await getOldestYear();
  if (!oldestYear) {
    return NextResponse.json(
      { error: "Aucune année enregistrée" },
      { status: 400 }
    );
  }

  const body = (await req.json()) as { rotations?: YearRotations };
  if (!body.rotations) {
    return NextResponse.json({ error: "rotations requis" }, { status: 400 });
  }

  const starts = rotationStartsFromEditedLists(body.rotations);
  const state = yearConfigFromRotationStarts(starts);

  await prisma.yearConfig.upsert({
    where: { year: oldestYear },
    create: {
      year: oldestYear,
      ...state,
      generated: true,
    },
    update: {
      ...state,
      generated: true,
    },
  });

  const rotations = await getBaselineRotations(oldestYear);
  return NextResponse.json({
    success: true,
    oldestYear,
    rotations,
    message:
      "Ordre enregistré. Les années suivantes devront être régénérées pour appliquer ce changement.",
  });
}
