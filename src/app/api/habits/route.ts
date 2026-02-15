import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/habits
 * Returns habits for the current user.
 * Return order: non-archived -> sortOrder -> createdAt
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const habits = await prisma.habit.findMany({
    where: { userId: user.id },
    orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      isArchived: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ habits });
}

/**
 * POST /api/habits
 * Body: { name: string }
 * Creates a habit for the current user.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();

  if (!name) {
    return NextResponse.json(
      { error: "Habit name is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const maxSort = await prisma.habit.aggregate({
    where: { userId: user.id, isArchived: false },
    _max: { sortOrder: true },
  });

  const habit = await prisma.habit.create({
    data: {
      userId: user.id,
      name,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      isArchived: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ habit }, { status: 201 });
}