import type { StockCatalogEntry } from "./stock-types";

const STORAGE_KEY = "finance.stockCatalog";

type ChromeStorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

declare global {
  var chrome:
    | {
        runtime?: { id?: string };
        storage?: { local?: ChromeStorageArea };
      }
    | undefined;
}

function isCatalog(value: unknown): value is StockCatalogEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "symbol" in entry &&
        typeof entry.symbol === "string" &&
        entry.symbol.trim().length > 0 &&
        "msnId" in entry &&
        typeof entry.msnId === "string" &&
        entry.msnId.trim().length > 0,
    )
  );
}

export async function loadStockCatalog(): Promise<StockCatalogEntry[]> {
  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const catalog = stored[STORAGE_KEY] ?? [];

    if (!isCatalog(catalog)) {
      throw new Error("O catálogo salvo na extensão está em um formato inválido.");
    }

    return catalog;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === null) return [];

  let catalog: unknown;
  try {
    catalog = JSON.parse(stored);
  } catch {
    throw new Error("O catálogo local não contém um JSON válido.");
  }

  if (!isCatalog(catalog)) {
    throw new Error("O catálogo local está em um formato inválido.");
  }

  return catalog;
}

export async function saveStockCatalog(
  catalog: StockCatalogEntry[],
): Promise<void> {
  if (!isCatalog(catalog)) {
    throw new Error("Não é possível salvar um catálogo de ativos inválido.");
  }

  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: catalog });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}
