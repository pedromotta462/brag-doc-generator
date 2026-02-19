import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// GET /api/brag-docs/[id] - Get a single brag doc
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  const doc = await prisma.bragDoc.findUnique({
    where: { id },
  });

  if (!doc || doc.userId !== authResult.userId) {
    return NextResponse.json(
      { message: "Brag doc not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(doc);
}

// DELETE /api/brag-docs/[id] - Delete a brag doc
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  const doc = await prisma.bragDoc.findUnique({
    where: { id },
  });

  if (!doc || doc.userId !== authResult.userId) {
    return NextResponse.json(
      { message: "Brag doc not found" },
      { status: 404 }
    );
  }

  await prisma.bragDoc.delete({ where: { id } });

  return NextResponse.json({ message: "Deleted" });
}
