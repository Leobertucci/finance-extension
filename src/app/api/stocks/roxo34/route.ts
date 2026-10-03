const AUTOSUGGEST_URL =
  "https://services.bingapis.com/contentservices-finance.csautosuggest/api/v1/Query";
const CHARTS_URL = "https://assets.msn.com/service/Finance/Charts";
const MSN_API_KEY = "1hYoJsIRvPEnSkk0hlnJF2092mHqiz7xFenIFKa9uc";
const CHART_QUERY = {
  activityId: "6a5e68e4-23a4-4823-8e0d-ae3c0b02ace4",
  ocid: "finance-utils-peregrine",
  cm: "en-gb",
  it: "app",
  scn: "APP_ANON",
  type: "1D1M",
  wrapodata: "false",
  chartflag: "7",
};

type PricePoint = {
  timestamp: string;
  price: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchJson(url: URL): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "O serviço financeiro demorou para responder."
        : "Não foi possível conectar ao serviço financeiro.";
    throw new Error(reason);
  }

  if (!response.ok) {
    throw new Error(`O serviço financeiro respondeu com HTTP ${response.status}.`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error("O serviço financeiro retornou uma resposta inválida.");
  }
}

async function findSecurityId(): Promise<string> {
  const url = new URL(AUTOSUGGEST_URL);
  url.searchParams.set("query", "ROXO34");
  url.searchParams.set("market", "pt-br");
  url.searchParams.set("count", "10");

  const result = await fetchJson(url);
  const data = isRecord(result) && isRecord(result.data) ? result.data : null;
  const stocks = data?.stocks;

  if (!Array.isArray(stocks)) {
    throw new Error("A busca do ticker não retornou instrumentos válidos.");
  }

  for (const stock of stocks) {
    const instrument: unknown =
      typeof stock === "string" ? JSON.parse(stock) : stock;

    if (
      isRecord(instrument) &&
      instrument.RT00S === "ROXO34" &&
      typeof instrument.SecId === "string"
    ) {
      return instrument.SecId;
    }
  }

  throw new Error("O ticker ROXO34 não foi encontrado no serviço financeiro.");
}

function parsePrices(result: unknown): {
  name: string;
  previousClose: number | null;
  prices: PricePoint[];
} {
  const entries = Array.isArray(result)
    ? result
    : isRecord(result) && Array.isArray(result.value)
      ? result.value
      : null;
  const chart = entries?.[0];
  const series = isRecord(chart) && isRecord(chart.series) ? chart.series : null;
  const prices = series?.prices;
  const timestamps = series?.timeStamps;

  if (!Array.isArray(prices) || !Array.isArray(timestamps) || prices.length < 2) {
    throw new Error("O serviço financeiro não retornou dados para o gráfico.");
  }

  if (prices.length !== timestamps.length) {
    throw new Error("Os horários e preços retornados não estão alinhados.");
  }

  const points = prices.map((price, index) => {
    const timestamp = timestamps[index];

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      typeof timestamp !== "string" ||
      !Number.isFinite(Date.parse(timestamp))
    ) {
      throw new Error("O serviço financeiro retornou um ponto inválido.");
    }

    return { timestamp, price };
  });

  return {
    name:
      isRecord(chart) && typeof chart.shortName === "string"
        ? chart.shortName
        : "Nu Holdings Ltd.",
    previousClose:
      isRecord(chart) &&
      typeof chart.pricePreviousClose === "number" &&
      Number.isFinite(chart.pricePreviousClose)
        ? chart.pricePreviousClose
        : null,
    prices: points,
  };
}

export async function GET() {
  try {
    const securityId = await findSecurityId();
    const url = new URL(CHARTS_URL);

    for (const [key, value] of Object.entries(CHART_QUERY)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apikey", MSN_API_KEY);
    url.searchParams.set("ids", securityId);

    const chart = parsePrices(await fetchJson(url));

    return Response.json(
      { symbol: "ROXO34", securityId, ...chart },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar os dados financeiros.";

    console.error("[api/stocks/roxo34]", message);

    return Response.json({ error: message }, { status: 502 });
  }
}
