import { NextRequest, NextResponse } from "next/server";
import { getYearRotations } from "@/lib/rotations";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);
  if (Number.isNaN(year)) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 });
  }

  const rotations = await getYearRotations(year);
  return NextResponse.json(rotations);
}
