export type PricePoint = {
  timestamp: string;
  price: number;
};

export type StockCatalogEntry = {
  symbol: string;
  msnId: string;
  sectionId: string;
};

export type StockSection = {
  id: string;
  name: string;
};

export type StockCatalog = {
  sections: StockSection[];
  entries: StockCatalogEntry[];
};

export type StockChartData = {
  symbol: string;
  shortName: string;
  displayName: string;
  msnId: string;
  previousClose: number | null;
  prices: PricePoint[];
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isStockChartData(value: unknown): value is StockChartData {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    typeof value.shortName === "string" &&
    typeof value.displayName === "string" &&
    typeof value.msnId === "string" &&
    (value.previousClose === null ||
      (typeof value.previousClose === "number" &&
        Number.isFinite(value.previousClose))) &&
    Array.isArray(value.prices) &&
    value.prices.length >= 2 &&
    value.prices.every(
      (point) =>
        isRecord(point) &&
        typeof point.timestamp === "string" &&
        Number.isFinite(Date.parse(point.timestamp)) &&
        typeof point.price === "number" &&
        Number.isFinite(point.price),
    )
  );
}

export function parseStockChartData(
  value: unknown,
  fallbackMsnId: string,
): StockChartData {
  const entries = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.value)
      ? value.value
      : null;
  const chart = entries?.[0];
  const series = isRecord(chart) && isRecord(chart.series) ? chart.series : null;
  const rawPrices = series?.prices;
  const rawTimestamps = series?.timeStamps;

  if (
    !isRecord(chart) ||
    !Array.isArray(rawPrices) ||
    !Array.isArray(rawTimestamps) ||
    rawPrices.length < 2 ||
    rawPrices.length !== rawTimestamps.length
  ) {
    throw new Error("O MSN não retornou dados suficientes para o gráfico.");
  }

  const prices = rawPrices.map((price, index) => {
    const timestamp = rawTimestamps[index];

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      typeof timestamp !== "string" ||
      !Number.isFinite(Date.parse(timestamp))
    ) {
      throw new Error("O MSN retornou um preço ou horário inválido.");
    }

    return { timestamp, price };
  });

  const symbol =
    typeof chart.symbol === "string" && chart.symbol
      ? chart.symbol
      : fallbackMsnId;
  const shortName =
    typeof chart.shortName === "string" && chart.shortName
      ? chart.shortName
      : typeof chart.displayName === "string" && chart.displayName
        ? chart.displayName
        : symbol;
  const displayName =
    typeof chart.displayName === "string" && chart.displayName
      ? chart.displayName
      : shortName;

  return {
    symbol,
    shortName,
    displayName,
    msnId: fallbackMsnId,
    previousClose:
      typeof chart.pricePreviousClose === "number" &&
      Number.isFinite(chart.pricePreviousClose)
        ? chart.pricePreviousClose
        : null,
    prices,
  };
}
