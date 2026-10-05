import type {
  StockCatalog,
  StockCatalogEntry,
  StockSection,
} from "./stock-types";

const STORAGE_KEY = "finance.stockCatalog";
const DEFAULT_SECTION: StockSection = { id: "section-1", name: "Seção 1" };

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

function isCatalogEntry(
  value: unknown,
): value is Pick<StockCatalogEntry, "symbol" | "msnId"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "symbol" in value &&
    typeof value.symbol === "string" &&
    value.symbol.trim().length > 0 &&
    "msnId" in value &&
    typeof value.msnId === "string" &&
    value.msnId.trim().length > 0
  );
}

function isStockCatalog(value: unknown): value is StockCatalog {
  if (
    typeof value !== "object" ||
    value === null ||
    !("sections" in value) ||
    !Array.isArray(value.sections) ||
    !("entries" in value) ||
    !Array.isArray(value.entries)
  ) {
    return false;
  }

  const sectionsValid = value.sections.every(
    (section) =>
      typeof section === "object" &&
      section !== null &&
      "id" in section &&
      typeof section.id === "string" &&
      section.id.length > 0 &&
      "name" in section &&
      typeof section.name === "string" &&
      section.name.trim().length > 0,
  );

  if (!sectionsValid || !value.entries.every(isCatalogEntry)) return false;

  const sectionIds = new Set(value.sections.map((section) => section.id));
  return value.entries.every(
    (entry) =>
      "sectionId" in entry &&
      typeof entry.sectionId === "string" &&
      sectionIds.has(entry.sectionId),
  );
}

function emptyCatalog(): StockCatalog {
  return { sections: [DEFAULT_SECTION], entries: [] };
}

export async function loadStockCatalog(): Promise<StockCatalog> {
  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const catalog = stored[STORAGE_KEY];
    if (catalog === undefined) return emptyCatalog();
    if (!isStockCatalog(catalog)) {
      throw new Error("O catálogo salvo na extensão está em um formato inválido.");
    }
    return catalog;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === null) return emptyCatalog();

  let catalog: unknown;
  try {
    catalog = JSON.parse(stored);
  } catch {
    throw new Error("O catálogo local não contém um JSON válido.");
  }

  if (!isStockCatalog(catalog)) {
    throw new Error("O catálogo local está em um formato inválido.");
  }

  return catalog;
}

export async function saveStockCatalog(
  catalog: StockCatalog,
): Promise<void> {
  if (!isStockCatalog(catalog)) {
    throw new Error("Não é possível salvar um catálogo de ativos inválido.");
  }

  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: catalog });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}
