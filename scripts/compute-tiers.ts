import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeZScore, computeVolumeRatio } from "../src/lib/scoring";
import { computeRawTier, computeStreak } from "../src/lib/tiering";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const LOOKBACK_DAYS = 20;

async function computeForStock(stock: { symbol: string }) {
  const history = await prisma.priceHistory.findMany({
    where: { symbol: stock.symbol },
    orderBy: { date: "asc" },
  });

  if (history.length < LOOKBACK_DAYS + 1) {
    console.log(`Skipping ${stock.symbol}: not enough history yet`);
    return;
  }

  let previous: { rawTier: "NORMAL" | "WATCH" | "HIGH"; streakCount: number } | null = null;

  for (let i = LOOKBACK_DAYS; i < history.length; i++) {
    const today = history[i];
    const priorDays = history.slice(i - LOOKBACK_DAYS, i);

    const priorPctChanges: number[] = [];
    for (let j = 1; j < priorDays.length; j++) {
      const pct =
        ((priorDays[j].price - priorDays[j - 1].price) / priorDays[j - 1].price) * 100;
      priorPctChanges.push(pct);
    }
    const priorVolumes = priorDays.map((d) => d.volume);

    const yesterdayPrice = priorDays[priorDays.length - 1].price;
    const todayPctChange = ((today.price - yesterdayPrice) / yesterdayPrice) * 100;

    const zScore = computeZScore(todayPctChange, priorPctChanges);
    const volumeRatio = computeVolumeRatio(today.volume, priorVolumes);
    const rawTier = computeRawTier(zScore, volumeRatio);
    const { streakCount, displayTier } = computeStreak(rawTier, previous);

    await prisma.dailyMetric.upsert({
      where: { symbol_date: { symbol: stock.symbol, date: today.date } },
      update: {},
      create: {
        symbol: stock.symbol,
        date: today.date,
        price: today.price,
        volume: today.volume,
        pctChange: todayPctChange,
        zScore,
        volumeRatio,
        rawTier,
        streakCount,
        displayTier,
      },
    });

    previous = { rawTier, streakCount };
  }

  console.log(`Computed tiers for ${stock.symbol}: ${history.length - LOOKBACK_DAYS} days`);
}

async function main() {
  const stocks = await prisma.stock.findMany();

  for (const stock of stocks) {
    let attempts = 0;
    let succeeded = false;
    while (attempts < 3 && !succeeded) {
      try {
        await computeForStock(stock);
        succeeded = true;
      } catch (err) {
        attempts++;
        console.log(`Retry ${attempts} for ${stock.symbol} after error: ${err}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!succeeded) {
      console.log(`FAILED after 3 attempts: ${stock.symbol}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });