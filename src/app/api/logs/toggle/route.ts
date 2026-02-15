import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/logs/toggle
 * Body: { habitId: string, date: "YYYY-MM-DD" }
 *
 * creates a HabitLog row if missing, otherwise flips completed
 * returns the updated log row
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const habitId = (body?.habitId ?? "").toString();
  const dateStr = (body?.date ?? "").toString();

  if (!habitId || !dateStr) {
    return NextResponse.json(
      { error: "habitId and date are required" },
      { status: 400 }
    );
  }

  // store day as UTC midnight so unique(habitId, date) consistent
  const day = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
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

  // ensure the habit belongs to this user
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: user.id },
    select: { id: true },
  });
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  // look up existing log for that day
  const existing = await prisma.habitLog.findUnique({
    where: {
      habitId_date: {
        habitId,
        date: day,
      },
    },
    select: { id: true, completed: true },
  });

  // if row doesnt exist, create completed=true
  // if row exists, completed=false
  const log = existing
    ? await prisma.habitLog.update({
        where: { id: existing.id },
        data: { completed: !existing.completed },
        select: { id: true, habitId: true, date: true, completed: true },
      })
    : await prisma.habitLog.create({
        data: {
          userId: user.id,
          habitId,
          date: day,
          completed: true,
        },
        select: { id: true, habitId: true, date: true, completed: true },
      });

  return NextResponse.json({ log });
}