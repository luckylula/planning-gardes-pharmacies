import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { year: string; id: string } }
) {
  const id = parseInt(params.id, 10);
  const body = await req.json();
  const { pharmacie, adresse } = body;

  const day = await prisma.planningDay.update({
    where: { id },
    data: {
      pharmacie: pharmacie ?? undefined,
      adresse: adresse ?? undefined,
      modified: true,
    },
  });

  return NextResponse.json(day);
}
