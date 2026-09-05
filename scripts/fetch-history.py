import yfinance as yf
import json
from datetime import datetime

# Mix of calm blue-chips and more volatile names, so your tiering
# logic actually has something to differentiate against
SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "LT.NS", "ADANIENT.NS", "SUZLON.NS", "AXISBANK.NS", "IRCTC.NS",
    "SBIN.NS", "ITC.NS", "WIPRO.NS", "BAJFINANCE.NS", "ONGC.NS",
]

all_data = {}

for symbol in SYMBOLS:
    print(f"Fetching {symbol}...")
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period="90d")

    records = []
    for date, row in hist.iterrows():
        records.append({
            "date": date.strftime("%Y-%m-%d"),
            "price": round(float(row["Close"]), 2),
            "volume": float(row["Volume"]),
        })

    clean_symbol = symbol.replace(".NS", "")
    all_data[clean_symbol] = {
        "name": ticker.info.get("longName", clean_symbol),
        "sector": ticker.info.get("sector"),
        "history": records,
    }

with open("scripts/seed-data.json", "w") as f:
    json.dump(all_data, f, indent=2)

print(f"Done. Wrote {len(all_data)} symbols to scripts/seed-data.json")