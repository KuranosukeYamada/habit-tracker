"use client";

import { useEffect, useMemo, useState } from "react";

type Habit = {
  id: string;
  name: string;
  sortOrder: number;
  isArchived: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

type HabitLog = {
  id: string;
  habitId: string;
  date: string; // ISO string
  completed: boolean;
};

function formatYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AppPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logsByHabitId, setLogsByHabitId] = useState<Record<string, boolean>>(
    {}
  );

  const [loadingHabits, setLoadingHabits] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [submittingHabit, setSubmittingHabit] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null); // habitId currently toggling

  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => formatYMD(new Date()));

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.isArchived).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [habits]
  );

  const completedCount = useMemo(() => {
    let count = 0;
    for (const h of activeHabits) {
      if (logsByHabitId[h.id]) count++;
    }
    return count;
  }, [activeHabits, logsByHabitId]);

  async function loadHabits() {
    setError(null);
    setLoadingHabits(true);
    try {
      const res = await fetch("/api/habits", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load habits (${res.status})`);
      const data = await res.json();
      setHabits(data.habits ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load habits");
    } finally {
      setLoadingHabits(false);
    }
  }

  async function loadLogsForDay(dayYMD: string) {
    setError(null);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/logs?start=${dayYMD}&end=${dayYMD}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load logs (${res.status})`);
      const data = await res.json();

      const logs: HabitLog[] = data.logs ?? [];
      const map: Record<string, boolean> = {};
      for (const log of logs) {
        map[log.habitId] = !!log.completed;
      }
      setLogsByHabitId(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load logs");
      setLogsByHabitId({});
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadHabits();
  }, []);

  useEffect(() => {
    loadLogsForDay(selectedDate);
  }, [selectedDate]);

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmittingHabit(true);
    setError(null);

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`Failed to create habit (${res.status})`);
      const data = await res.json();
      if (data.habit) setHabits((prev) => [...prev, data.habit]);
      setName("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create habit");
    } finally {
      setSubmittingHabit(false);
    }
  }

  async function toggleHabitForDay(habitId: string) {
    setToggling(habitId);
    setError(null);
    try {
      const res = await fetch("/api/logs/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId, date: selectedDate }),
      });
      if (!res.ok) throw new Error(`Failed to toggle (${res.status})`);
      const data = await res.json();
      const completed = !!data?.log?.completed;

      setLogsByHabitId((prev) => ({
        ...prev,
        [habitId]: completed,
      }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to toggle habit");
    } finally {
      setToggling(null);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold">Habit Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Today checklist + habits list (next: calendar heatmap).
          </p>
        </header>

        {/* Today Pane */}
        <section className="rounded-2xl border p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-medium">Checklist</h2>
              <p className="text-sm text-muted-foreground">
                {loadingHabits || loadingLogs
                  ? "Loading…"
                  : `${completedCount}/${activeHabits.length} completed`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border px-3 py-2"
              />
            </div>
          </div>

          {loadingHabits ? (
            <p className="text-sm text-muted-foreground">Loading habits…</p>
          ) : activeHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a habit below to start tracking.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeHabits.map((h) => {
                const checked = !!logsByHabitId[h.id];
                const busy = toggling === h.id;
                return (
                  <li
                    key={h.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-2"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleHabitForDay(h.id)}
                      />
                      <span className="font-medium">{h.name}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {busy ? "Saving…" : checked ? "Done" : "Not yet"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {/* Add Habit */}
        <section className="rounded-2xl border p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-3">Add habit</h2>
          <form onSubmit={addHabit} className="flex flex-col gap-3 md:flex-row">
            <input
              className="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring-2"
              placeholder='e.g., "Go to the gym"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={submittingHabit}
            />
            <button
              type="submit"
              className="rounded-xl border px-4 py-2 font-medium disabled:opacity-50"
              disabled={submittingHabit || !name.trim()}
            >
              {submittingHabit ? "Adding..." : "Add"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}