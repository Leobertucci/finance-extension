"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getStockChart, resolveMsnId } from "@/lib/finance-client";
import { loadStockCatalog, saveStockCatalog } from "@/lib/stock-catalog";
import type {
  FormEvent,
} from "react";
import type {
  StockCatalogEntry,
  StockChartData,
} from "@/lib/stock-types";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const priceNumber = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar os dados financeiros.";
}

function PriceChart({
  data,
  baseline,
  isPositive,
}: {
  data: StockChartData;
  baseline: number;
  isPositive: boolean;
}) {
  const gradientId = useId().replaceAll(":", "");
  const width = 360;
  const height = 180;
  const left = 8;
  const right = 352;
  const top = 24;
  const bottom = 150;
  const chartPoints = data.prices.filter(
    (_, index) => index % 2 === 0 || index === data.prices.length - 1,
  );
  const values = chartPoints.map((point) => point.price);
  const minimum = Math.min(...values, baseline);
  const maximum = Math.max(...values, baseline);
  const padding = (maximum - minimum) * 0.16 || maximum * 0.01;
  const lowerBound = minimum - padding;
  const upperBound = maximum + padding;
  const baselineY =
    top + ((upperBound - baseline) / (upperBound - lowerBound)) * (bottom - top);
  const trendColor = isPositive ? "#13865e" : "#cf4756";
  const coordinates = chartPoints.map((point, index) => ({
    x: left + (index / (chartPoints.length - 1)) * (right - left),
    y:
      top +
      ((upperBound - point.price) / (upperBound - lowerBound)) *
        (bottom - top),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;
  const lastPoint = chartPoints[chartPoints.length - 1];
  const timeMarkers = [0, 1, 2, 3].map((markerIndex) => {
    const pointIndex = Math.round(
      (markerIndex / 3) * (chartPoints.length - 1),
    );
    return {
      x: coordinates[pointIndex].x,
      label: timeLabel.format(
        new Date(chartPoints[pointIndex].timestamp),
      ),
    };
  });

  return (
    <div className="chart-wrap">
      <svg
        className="price-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Gráfico intradiário de ${chartPoints.length} cotações de ${data.symbol}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity=".2" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((index) => {
          const y = top + (index / 3) * (bottom - top);
          return (
            <line
              key={index}
              x1={left}
              x2={right}
              y1={y}
              y2={y}
              className="chart-grid"
            />
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <line
          x1={left}
          x2={right}
          y1={baselineY}
          y2={baselineY}
          className="chart-baseline"
        />
        <path
          d={linePath}
          className={isPositive ? "chart-line positive" : "chart-line negative"}
        />
        <g
          className="chart-baseline-badge"
          role="img"
          aria-label={`Fechamento anterior: ${priceNumber.format(baseline)}`}
        >
          <title>Fechamento anterior</title>
          <rect
            x={right - 40}
            y={baselineY - 10}
            width="40"
            height="20"
            rx="5"
          />
          <text x={right - 20} y={baselineY + 4} textAnchor="middle">
            {priceNumber.format(baseline)}
          </text>
        </g>
        <circle
          cx={coordinates[coordinates.length - 1].x}
          cy={coordinates[coordinates.length - 1].y}
          r="5"
          className={
            isPositive
              ? "chart-current-point positive"
              : "chart-current-point negative"
          }
        />

        {timeMarkers.map((marker, index) => (
          <text
            key={`${marker.label}-${index}`}
            x={marker.x}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === 3 ? "end" : "middle"}
            className="chart-time"
          >
            {marker.label}
          </text>
        ))}

        <title>
          {data.shortName}: {currency.format(lastPoint.price)} às{" "}
          {timeLabel.format(new Date(lastPoint.timestamp))}
        </title>
      </svg>
    </div>
  );
}

function StockCard({
  entry,
  onRemove,
}: {
  entry: StockCatalogEntry;
  onRemove: (msnId: string) => void;
}) {
  const [data, setData] = useState<StockChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function loadData() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setIsLoading(true);
    setError(null);

    try {
      setData(await getStockChart(entry.msnId, request.signal));
    } catch (requestError) {
      if (!request.signal.aborted) setError(getErrorMessage(requestError));
    } finally {
      if (!request.signal.aborted) setIsLoading(false);
    }
  }

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;

    void getStockChart(entry.msnId, request.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (!request.signal.aborted) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!request.signal.aborted) setIsLoading(false);
      });

    return () => request.abort();
  }, [entry.msnId]);

  const lastPoint = data?.prices[data.prices.length - 1];
  const baseline =
    data?.previousClose ?? data?.prices[0]?.price ?? lastPoint?.price ?? 0;
  const change = lastPoint ? lastPoint.price - baseline : 0;
  const changePercent = baseline === 0 ? 0 : (change / baseline) * 100;
  const isPositive = change >= 0;
  const sign = isPositive ? "+" : "−";

  return (
    <section
      className="stock-card"
      aria-labelledby={`stock-title-${entry.msnId}`}
      aria-busy={isLoading}
    >
      <div className="stock-header">
        <h2 id={`stock-title-${entry.msnId}`}>
          {data ? `${data.shortName} · ${data.symbol}` : entry.symbol}
        </h2>
        <button
          className="remove-card"
          type="button"
          onClick={() => onRemove(entry.msnId)}
          aria-label={`Remover ${entry.symbol}`}
          title="Remover ativo"
        >
          ×
        </button>
      </div>

      {data && lastPoint && (
        <div className="quote-block">
          <div className="quote-value">{currency.format(lastPoint.price)}</div>
          <div
            className={isPositive ? "quote-change positive" : "quote-change negative"}
            title={
              data.previousClose !== null
                ? "Variação em relação ao fechamento anterior"
                : "Variação em relação ao primeiro preço do dia"
            }
          >
            <span>{sign}{percent.format(Math.abs(changePercent))}%</span>
            <span>({sign}{currency.format(Math.abs(change))})</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="chart-placeholder" aria-live="polite">
          <span className="loading-spinner" />
          Carregando cotações...
        </div>
      )}

      {error && (
        <div className="error-state" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadData()}>
            Tentar novamente
          </button>
        </div>
      )}

      {data && lastPoint && !error && (
        <PriceChart
          data={data}
          baseline={baseline}
          isPositive={isPositive}
        />
      )}
    </section>
  );
}

function AddAssetDialog({
  isAdding,
  error,
  onClose,
  onAdd,
}: {
  isAdding: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (value: string, mode: "symbol" | "msnId") => Promise<void>;
}) {
  const [mode, setMode] = useState<"symbol" | "msnId">("symbol");
  const [value, setValue] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onAdd(value, mode);
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isAdding) onClose();
    }}>
      <section
        className="asset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="dialog-close"
          type="button"
          onClick={onClose}
          disabled={isAdding}
          aria-label="Fechar"
        >
          ×
        </button>
        <p className="dialog-eyebrow">NOVO CARTÃO</p>
        <h2 id="dialog-title">Adicionar ativo</h2>
        <p className="dialog-description">
          Busque pelo símbolo do ativo ou informe o ID usado no MSN Finance.
        </p>

        <div className="asset-mode" role="group" aria-label="Tipo de identificador">
          <button
            type="button"
            aria-pressed={mode === "symbol"}
            onClick={() => setMode("symbol")}
          >
            Símbolo
          </button>
          <button
            type="button"
            aria-pressed={mode === "msnId"}
            onClick={() => setMode("msnId")}
          >
            ID do MSN
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="asset-input-label" htmlFor="asset-identifier">
            {mode === "symbol" ? "Símbolo do ativo" : "ID do ativo no MSN"}
          </label>
          <input
            id="asset-identifier"
            className="asset-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={mode === "symbol" ? "Ex.: ROXO34" : "Ex.: calgcw"}
            autoComplete="off"
            required
            maxLength={80}
            disabled={isAdding}
          />
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isAdding}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isAdding || value.trim().length === 0}
            >
              {isAdding ? "Adicionando..." : "Adicionar cartão"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function StockChart() {
  const [catalog, setCatalog] = useState<StockCatalogEntry[] | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void loadStockCatalog()
      .then((savedCatalog) => {
        if (isActive) setCatalog(savedCatalog);
      })
      .catch((error: unknown) => {
        if (isActive) setCatalogError(getErrorMessage(error));
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function addAsset(value: string, mode: "symbol" | "msnId") {
    const normalizedValue = value.trim();

    if (!normalizedValue || !catalog) return;

    setIsAdding(true);
    setDialogError(null);

    try {
      const msnId =
        mode === "symbol"
          ? await resolveMsnId(normalizedValue.toLocaleUpperCase("pt-BR"), new AbortController().signal)
          : normalizedValue;
      const existing = catalog.some(
        (entry) => entry.msnId.toLocaleLowerCase() === msnId.toLocaleLowerCase(),
      );

      if (existing) {
        throw new Error("Esse ativo já está no seu catálogo.");
      }

      const entry = {
        symbol:
          mode === "symbol"
            ? normalizedValue.toLocaleUpperCase("pt-BR")
            : normalizedValue,
        msnId,
      };
      const nextCatalog = [...catalog, entry];
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setIsAddOpen(false);
    } catch (error) {
      setDialogError(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function removeAsset(msnId: string) {
    if (!catalog) return;

    const nextCatalog = catalog.filter((entry) => entry.msnId !== msnId);

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  function openAddDialog() {
    setDialogError(null);
    setIsAddOpen(true);
  }

  return (
    <main className={`dashboard${isDarkMode ? " dark-mode" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M5 22.5 12 15l5 4 10-11"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 8h6v6"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="brand-name">Market New Tab</span>
        </div>
        <button
          className="theme-toggle"
          type="button"
          onClick={() => setIsDarkMode((current) => !current)}
          aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
          title={isDarkMode ? "Modo escuro" : "Modo claro"}
        >
          {isDarkMode ? (
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="3.5" />
              <path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M16.8 12.6A7.3 7.3 0 0 1 7.4 3.2a7.5 7.5 0 1 0 9.4 9.4Z" />
            </svg>
          )}
        </button>
      </header>

      {catalogError && (
        <div className="catalog-error" role="alert">
          {catalogError}
        </div>
      )}

      <div className="watchlist-grid">
        {catalog?.map((entry) => (
          <StockCard
            key={entry.msnId}
            entry={entry}
            onRemove={(msnId) => void removeAsset(msnId)}
          />
        ))}
        {catalog !== null && (
          <button
            className="add-card"
            type="button"
            onClick={openAddDialog}
            aria-label="Adicionar cartão de ativo"
          >
            <span className="add-card-icon" aria-hidden="true">+</span>
            <span>Adicionar ativo</span>
          </button>
        )}
        {catalog === null && !catalogError && (
          <div className="catalog-loading" aria-live="polite">
            <span className="loading-spinner" />
            Carregando seu catálogo...
          </div>
        )}
      </div>

      <footer className="page-footer">
        <span>Dados de mercado por <strong>MSN Finance</strong></span>
      </footer>

      {isAddOpen && (
        <AddAssetDialog
          isAdding={isAdding}
          error={dialogError}
          onClose={() => setIsAddOpen(false)}
          onAdd={addAsset}
        />
      )}
    </main>
  );
}
