import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const watchlistItems = await prisma.watchlistItem.findMany({
    where: { userId },
    include: { stock: true },
  });

  const viewStates = await prisma.userViewState.findMany({
    where: { userId },
  });
  const viewStateMap = new Map(viewStates.map((v) => [v.symbol, v]));

  const results = [];

  for (const item of watchlistItems) {
    const latestMetric = await prisma.dailyMetric.findFirst({
      where: { symbol: item.symbol },
      orderBy: { date: "desc" },
    });

    const previousView = viewStateMap.get(item.symbol);

    if (!latestMetric) {
      // Genuinely no computed data yet — honest state, not a fake tier
      results.push({
        symbol: item.symbol,
        name: item.stock.name,
        status: "GATHERING_DATA",
      });
      continue;
    }

    const changedSinceLastVisit =
      previousView && previousView.lastSeenTier !== latestMetric.displayTier;

    results.push({
      symbol: item.symbol,
      name: item.stock.name,
      sector: item.stock.sector,
      price: latestMetric.price,
      pctChange: latestMetric.pctChange,
      displayTier: latestMetric.displayTier,
      streakCount: latestMetric.streakCount,
      updatedAt: latestMetric.computedAt,
      changedSinceLastVisit: changedSinceLastVisit ?? false,
      previousTier: previousView?.lastSeenTier ?? null,
    });

    // Update view state for next visit
    await prisma.userViewState.upsert({
      where: { userId_symbol: { userId, symbol: item.symbol } },
      update: { lastSeenAt: new Date(), lastSeenTier: latestMetric.displayTier },
      create: {
        userId,
        symbol: item.symbol,
        lastSeenAt: new Date(),
        lastSeenTier: latestMetric.displayTier,
      },
    });
  }

  // Group by tier for the frontend to render as sections
  const grouped = {
    SUSTAINED: results.filter((r) => r.displayTier === "SUSTAINED"),
    NEW_SPIKE: results.filter((r) => r.displayTier === "NEW_SPIKE"),
    WATCH: results.filter((r) => r.displayTier === "WATCH"),
    NORMAL: results.filter((r) => r.displayTier === "NORMAL"),
    COOLING_OFF: results.filter((r) => r.displayTier === "COOLING_OFF"),
    GATHERING_DATA: results.filter((r) => r.status === "GATHERING_DATA"),
  };

  return NextResponse.json(grouped);
}