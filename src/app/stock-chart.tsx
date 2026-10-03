"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type PricePoint = {
  timestamp: string;
  price: number;
};

type StockChartData = {
  symbol: string;
  securityId: string;
  name: string;
  previousClose: number | null;
  prices: PricePoint[];
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStockChartData(value: unknown): value is StockChartData {
  return (
    isRecord(value) &&
    typeof value.symbol === "string" &&
    typeof value.securityId === "string" &&
    typeof value.name === "string" &&
    (value.previousClose === null ||
      (typeof value.previousClose === "number" &&
        Number.isFinite(value.previousClose))) &&
    Array.isArray(value.prices) &&
    value.prices.every(
      (point) =>
        isRecord(point) &&
        typeof point.timestamp === "string" &&
        typeof point.price === "number" &&
        Number.isFinite(point.price),
    )
  );
}

async function requestStockChart(signal: AbortSignal): Promise<StockChartData> {
  const response = await fetch("/api/stocks/roxo34", {
    cache: "no-store",
    signal,
  });
  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Não foi possível carregar os dados da ação.";
    throw new Error(message);
  }

  if (!isStockChartData(result) || result.prices.length < 2) {
    throw new Error("A resposta da API não contém dados de gráfico válidos.");
  }

  return result;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar os dados da ação.";
}

function PriceChart({ points }: { points: PricePoint[] }) {
  const width = 960;
  const height = 320;
  const left = 28;
  const right = 936;
  const top = 18;
  const bottom = 258;
  const values = points.map((point) => point.price);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = (maximum - minimum) * 0.16 || maximum * 0.01;
  const lowerBound = minimum - padding;
  const upperBound = maximum + padding;
  const coordinates = points.map((point, index) => ({
    x: left + (index / (points.length - 1)) * (right - left),
    y:
      top +
      ((upperBound - point.price) / (upperBound - lowerBound)) *
        (bottom - top),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;
  const current = points[points.length - 1];
  const startTime = new Date(points[0].timestamp);
  const endTime = new Date(current.timestamp);
  const timeMarkers = [0, 1, 2, 3, 4].map((index) => {
    const point = coordinates[
      Math.round((index / 4) * (coordinates.length - 1))
    ];
    const source = points[
      Math.round((index / 4) * (points.length - 1))
    ];
    return { x: point.x, label: timeLabel.format(new Date(source.timestamp)) };
  });

  return (
    <div className="chart-wrap">
      <svg
        className="price-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Gráfico intradiário de ${points.length} cotações de ROXO34`}
      >
        <defs>
          <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6946f5" stopOpacity=".2" />
            <stop offset="100%" stopColor="#6946f5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((index) => {
          const y = top + (index / 3) * (bottom - top);
          const value = upperBound - (index / 3) * (upperBound - lowerBound);

          return (
            <g key={index}>
              <line
                x1={left}
                x2={right}
                y1={y}
                y2={y}
                className="chart-grid"
              />
              <text x={left} y={y - 7} className="chart-value">
                {currency.format(value)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#price-fill)" />
        <path d={linePath} className="chart-line" />
        <circle
          cx={coordinates[coordinates.length - 1].x}
          cy={coordinates[coordinates.length - 1].y}
          r="5"
          className="chart-current-point"
        />

        {timeMarkers.map((marker, index) => (
          <text
            key={`${marker.label}-${index}`}
            x={marker.x}
            y={height - 18}
            textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"}
            className="chart-time"
          >
            {marker.label}
          </text>
        ))}

        <title>
          ROXO34: {currency.format(current.price)} às{" "}
          {timeLabel.format(endTime)}
        </title>
      </svg>
      <p className="chart-caption">
        {timeLabel.format(startTime)} — {timeLabel.format(endTime)} · horário de
        Brasília
      </p>
    </div>
  );
}

export default function StockChart() {
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
      setData(await requestStockChart(request.signal));
    } catch (requestError) {
      if (request.signal.aborted) return;
      setError(getErrorMessage(requestError));
    } finally {
      if (!request.signal.aborted) setIsLoading(false);
    }
  }

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;

    void requestStockChart(request.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (!request.signal.aborted) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!request.signal.aborted) setIsLoading(false);
      });

    return () => request.abort();
  }, []);

  const lastPoint = data?.prices[data.prices.length - 1];
  const baseline =
    data?.previousClose ?? data?.prices[0]?.price ?? lastPoint?.price ?? 0;
  const change = lastPoint ? lastPoint.price - baseline : 0;
  const changePercent = baseline === 0 ? 0 : (change / baseline) * 100;
  const isPositive = change >= 0;
  const updatedAt = lastPoint
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(lastPoint.timestamp))
    : null;

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Finance, início">
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
          <span>finance</span>
        </Link>
        <span className="environment-badge">
          <span className="live-dot" />
          ambiente local
        </span>
      </header>

      <section className="intro">
        <p className="eyebrow">SEU MERCADO, EM UM SÓ LUGAR</p>
        <h1>Acompanhe o mercado.</h1>
        <p className="intro-copy">
          Uma visão simples e clara dos ativos que fazem parte do seu dia.
        </p>
      </section>

      <section className="stock-card" aria-labelledby="stock-title">
        <div className="stock-header">
          <div className="stock-identity">
            <div className="stock-avatar" aria-hidden="true">
              N
            </div>
            <div>
              <div className="stock-title-row">
                <h2 id="stock-title">Nu Holdings</h2>
                <span className="ticker-pill">B3 · BDR</span>
              </div>
              <p className="stock-subtitle">Nu Holdings Ltd. · {data?.symbol ?? "ROXO34"}</p>
            </div>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            aria-label="Atualizar cotação"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={isLoading ? "refresh-icon spinning" : "refresh-icon"}
              aria-hidden="true"
            >
              <path
                d="M16.4 8A6.5 6.5 0 0 0 5 4.2L3.5 6M3.5 6V2.8M3.5 6h3.2M3.6 12a6.5 6.5 0 0 0 11.4 3.8l1.5-1.8m0 0v3.2m0-3.2h-3.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Atualizar
          </button>
        </div>

        <div className="quote-block" aria-live="polite">
          <div className="quote-value">
            {lastPoint ? currency.format(lastPoint.price) : "—"}
          </div>
          {lastPoint && (
            <div className={isPositive ? "quote-change positive" : "quote-change negative"}>
              <span aria-hidden="true">{isPositive ? "↗" : "↘"}</span>
              {currency.format(Math.abs(change))} ({percent.format(Math.abs(changePercent))}%)
              <span className="change-context">
                {data?.previousClose ? "vs. fechamento anterior" : "no pregão"}
              </span>
            </div>
          )}
          <p className="quote-timestamp">
            {updatedAt ? `Último ponto · ${updatedAt}` : "Buscando cotação"}
          </p>
        </div>

        <div className="period-row">
          <span className="period-label">Variação do ativo</span>
          <span className="period-chip">1 dia</span>
        </div>

        {error && (
          <div className="error-state" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadData()}>
              Tentar novamente
            </button>
          </div>
        )}

        {data && !error ? (
          <PriceChart points={data.prices} />
        ) : (
          !error && (
            <div className="chart-placeholder" aria-live="polite">
              <span className="loading-spinner" />
              Carregando cotações do MSN Finance...
            </div>
          )
        )}

      </section>

      <footer className="page-footer">
        <span>Dados de mercado por <strong>MSN Finance</strong></span>
      </footer>
    </main>
  );
}
