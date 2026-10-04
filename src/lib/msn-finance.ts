import { AUTOSUGGEST_URL, CHARTS_URL, CHART_QUERY, MSN_API_KEY } from "./msn-config";
import { isRecord, parseStockChartData, type StockChartData } from "./stock-types";

async function fetchJson(url: URL): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "O serviço financeiro demorou para responder."
        : "Não foi possível conectar ao serviço financeiro.";
    throw new Error(message);
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

export async function resolveMsnId(symbol: string): Promise<string> {
  const url = new URL(AUTOSUGGEST_URL);
  url.searchParams.set("query", symbol);
  url.searchParams.set("market", "pt-br");
  url.searchParams.set("count", "10");

  const result = await fetchJson(url);
  const data = isRecord(result) && isRecord(result.data) ? result.data : null;
  const stocks = data?.stocks;

  if (!Array.isArray(stocks)) {
    throw new Error("A busca do ticker não retornou instrumentos válidos.");
  }

  const normalizedSymbol = symbol.trim().toLocaleUpperCase("pt-BR");

  for (const item of stocks) {
    let instrument: unknown = item;

    if (typeof item === "string") {
      try {
        instrument = JSON.parse(item);
      } catch {
        throw new Error("A busca do ticker retornou um instrumento inválido.");
      }
    }

    if (!isRecord(instrument) || typeof instrument.SecId !== "string") continue;

    const matches = [
      instrument.RT00S,
      instrument.OS001,
      instrument.DisplayName,
      instrument.FriendlyName,
      instrument.symbol,
    ].some(
      (value) =>
        typeof value === "string" &&
        value.trim().toLocaleUpperCase("pt-BR") === normalizedSymbol,
    );

    if (matches) return instrument.SecId;
  }

  throw new Error(`O ticker ${symbol} não foi encontrado no MSN Finance.`);
}

export async function getStockChart(msnId: string): Promise<StockChartData> {
  const url = new URL(CHARTS_URL);

  for (const [key, value] of Object.entries(CHART_QUERY)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", MSN_API_KEY);
  url.searchParams.set("ids", msnId);

  return parseStockChartData(await fetchJson(url), msnId);
}
