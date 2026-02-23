import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// GET /api/chat/[id] — get conversation with messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  const conversation = await prisma.chatConversation.findFirst({
    where: { id, userId: authResult.userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { message: "Conversation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(conversation);
}

// DELETE /api/chat/[id] — delete conversation
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  const conversation = await prisma.chatConversation.findFirst({
    where: { id, userId: authResult.userId },
  });

  if (!conversation) {
    return NextResponse.json(
      { message: "Conversation not found" },
      { status: 404 }
    );
  }

  await prisma.chatConversation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
