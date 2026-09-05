import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    include: { stock: true },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await req.json();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const stock = await prisma.stock.findUnique({ where: { symbol } });
  if (!stock) {
    return NextResponse.json({ error: "Unknown stock symbol" }, { status: 404 });
  }

  const item = await prisma.watchlistItem.upsert({
    where: { userId_symbol: { userId: session.user.id, symbol } },
    update: {},
    create: { userId: session.user.id, symbol },
  });

  return NextResponse.json(item, { status: 201 });
}