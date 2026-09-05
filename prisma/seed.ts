import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rawData = fs.readFileSync(
    path.join(__dirname, "../scripts/seed-data.json"),
    "utf-8"
  );
  const data = JSON.parse(rawData);

  for (const [symbol, info] of Object.entries(data) as [string, any][]) {
    await prisma.stock.upsert({
      where: { symbol },
      update: {},
      create: {
        symbol,
        name: info.name,
        sector: info.sector,
      },
    });

    for (const record of info.history) {
      await prisma.priceHistory.upsert({
        where: {
          symbol_date: {
            symbol,
            date: new Date(record.date),
          },
        },
        update: {},
        create: {
          symbol,
          date: new Date(record.date),
          price: record.price,
          volume: record.volume,
          source: "seed",
        },
      });
    }

    console.log(`Seeded ${symbol}: ${info.history.length} days`);
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