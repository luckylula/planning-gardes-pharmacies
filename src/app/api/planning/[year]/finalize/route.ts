import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);
  await prisma.yearConfig.update({
    where: { year },
    data: { generated: true },
  });
  return NextResponse.json({ success: true });
}
