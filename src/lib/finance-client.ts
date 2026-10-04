import { isRecord, isStockChartData, type StockChartData } from "./stock-types";

async function readResponse(response: Response): Promise<unknown> {
  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Não foi possível consultar os dados financeiros.";
    throw new Error(message);
  }

  return result;
}

export async function resolveMsnId(
  symbol: string,
  signal: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({ symbol });
  const result = await readResponse(
    await fetch(`/api/stocks/resolve?${params}`, {
      cache: "no-store",
      signal,
    }),
  );

  if (!isRecord(result) || typeof result.msnId !== "string") {
    throw new Error("A busca não retornou um ID válido do MSN.");
  }

  return result.msnId;
}

export async function getStockChart(
  msnId: string,
  signal: AbortSignal,
): Promise<StockChartData> {
  const params = new URLSearchParams({ msnId });
  const result = await readResponse(
    await fetch(`/api/stocks?${params}`, {
      cache: "no-store",
      signal,
    }),
  );

  if (!isStockChartData(result)) {
    throw new Error("A API não retornou dados válidos para o gráfico.");
  }

  return result;
}
