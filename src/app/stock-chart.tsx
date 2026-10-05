"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getStockChart, resolveMsnId } from "@/lib/finance-client";
import { loadStockCatalog, saveStockCatalog } from "@/lib/stock-catalog";
import type {
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";
import type {
  StockCatalog,
  StockCatalogEntry,
  StockChartData,
  StockSection,
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
  const hasPreviousClose = data.previousClose !== null;
  const plottedPrices = [
    ...(data.previousClose !== null ? [data.previousClose] : []),
    ...chartPoints.map((point) => point.price),
  ];
  const minimum = Math.min(...plottedPrices, baseline);
  const maximum = Math.max(...plottedPrices, baseline);
  const padding = (maximum - minimum) * 0.16 || maximum * 0.01;
  const lowerBound = minimum - padding;
  const upperBound = maximum + padding;
  const baselineY =
    top + ((upperBound - baseline) / (upperBound - lowerBound)) * (bottom - top);
  const trendColor = isPositive ? "#13865e" : "#cf4756";
  const coordinates = plottedPrices.map((price, index) => ({
    x: left + (index / (plottedPrices.length - 1)) * (right - left),
    y:
      top +
      ((upperBound - price) / (upperBound - lowerBound)) * (bottom - top),
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
      x: coordinates[pointIndex + (hasPreviousClose ? 1 : 0)].x,
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
        aria-label={`Gráfico intradiário${hasPreviousClose ? " iniciado pelo fechamento anterior e" : ""} com ${chartPoints.length} cotações de ${data.symbol}`}
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
            fillOpacity={0.7}
          />
          <text x={right - 20} y={baselineY + 4} textAnchor="middle">
            {priceNumber.format(baseline)}
          </text>
        </g>

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
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  entry: StockCatalogEntry;
  onRemove: (msnId: string) => void;
  draggable: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  const [data, setData] = useState<StockChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  function handleCardMouseDown(event: MouseEvent<HTMLElement>) {
    if (!cardRef.current) return;
    cardRef.current.draggable = !(
      event.target instanceof Element &&
      event.target.closest(".stock-header h2, .quote-value")
    );
  }

  function restoreCardDragging() {
    if (cardRef.current) cardRef.current.draggable = draggable;
  }

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
  const msnUrl = `https://www.msn.com/pt-br/dinheiro/stockdetails/fi-${encodeURIComponent(entry.msnId)}?ocid=msedgntp&id=${encodeURIComponent(entry.msnId)}`;

  return (
    <section
      ref={cardRef}
      data-msn-id={entry.msnId}
      className={`stock-card${isDragOver ? " drag-over" : ""}`}
      aria-labelledby={`stock-title-${entry.msnId}`}
      aria-busy={isLoading}
      draggable={draggable}
      onMouseDown={handleCardMouseDown}
      onMouseUp={restoreCardDragging}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => {
        restoreCardDragging();
        onDragEnd();
      }}
    >
      <div className="stock-header">
        <h2 id={`stock-title-${entry.msnId}`}>
          {data ? `${data.symbol} - ${data.displayName}` : entry.symbol}
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
        <a
          className="chart-link"
          href={msnUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${data.symbol} no MSN Finance em uma nova aba`}
          title="Abrir no MSN Finance"
        >
          <PriceChart
            data={data}
            baseline={baseline}
            isPositive={isPositive}
          />
        </a>
      )}
    </section>
  );
}

function SectionHeading({
  section,
  initiallyEditing,
  canDelete,
  onRename,
  onFinishEditing,
  onAddAsset,
  onDelete,
}: {
  section: StockSection;
  initiallyEditing: boolean;
  canDelete: boolean;
  onRename: (sectionId: string, name: string) => void;
  onFinishEditing: () => void;
  onAddAsset: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  const [name, setName] = useState(section.name);
  const skipNextBlur = useRef(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    skipNextBlur.current = true;
    if (normalizedName) onRename(section.id, normalizedName);
    else setName(section.name);
    setIsEditing(false);
    onFinishEditing();
  }

  function blurInput() {
    if (skipNextBlur.current) {
      skipNextBlur.current = false;
      return;
    }

    const normalizedName = name.trim();
    if (normalizedName) onRename(section.id, normalizedName);
    else setName(section.name);
    setIsEditing(false);
    onFinishEditing();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      skipNextBlur.current = true;
      setName(section.name);
      setIsEditing(false);
      onFinishEditing();
    }
  }

  if (isEditing) {
    return (
      <form className="section-rename-form" onSubmit={submit}>
        <input
          aria-label="Nome da seção"
          autoFocus
          maxLength={40}
          value={name}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)}
          onBlur={blurInput}
          onKeyDown={handleKeyDown}
        />
      </form>
    );
  }

  return (
    <div className="section-heading">
      <h2>
        <button
          className="section-title"
          type="button"
          onClick={() => {
            setName(section.name);
            setIsEditing(true);
          }}
          aria-label={`Alterar nome da seção ${section.name}`}
          title="Clique para alterar o nome"
        >
          {section.name}
        </button>
      </h2>
      <button
        className="section-action"
        type="button"
        onClick={() => onAddAsset(section.id)}
        aria-label={`Adicionar ativo`}
        title={`Adicionar ativo`}
      >
        +
      </button>
      <button
        className="section-action section-delete"
        type="button"
        onClick={() => onDelete(section.id)}
        aria-label={`Excluir seção ${section.name} e seus ativos`}
        title={
          canDelete
            ? `Excluir seção ${section.name} e seus ativos`
            : "É necessário manter pelo menos uma seção"
        }
        disabled={!canDelete}
      >
        ×
      </button>
    </div>
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
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={mode === "symbol" ? "Ex.: BOVA11" : "Ex.: bgmb3m"}
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
  const [catalog, setCatalog] = useState<StockCatalog | null>(null);
  const [dragOverMsnId, setDragOverMsnId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [isAddSectionDragOver, setIsAddSectionDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<{
    sectionId: string;
    index: number;
    targetMsnId?: string;
  } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addAssetSectionId, setAddAssetSectionId] = useState<string | null>(null);
  const [newSectionId, setNewSectionId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const draggedMsnId = useRef<string | null>(null);

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
      const existing = catalog.entries.some(
        (entry) => entry.msnId.toLocaleLowerCase() === msnId.toLocaleLowerCase(),
      );

      if (existing) {
        throw new Error("Esse ativo já está no seu catálogo.");
      }

      const targetSectionId =
        addAssetSectionId ?? catalog.sections[0]?.id;
      if (!targetSectionId) {
        throw new Error("Crie uma seção antes de adicionar um ativo.");
      }

      const entry = {
        symbol:
          mode === "symbol"
            ? normalizedValue.toLocaleUpperCase("pt-BR")
            : normalizedValue,
        msnId,
        sectionId: targetSectionId,
      };
      const nextCatalog = {
        ...catalog,
        entries: [...catalog.entries, entry],
      };
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setIsAddOpen(false);
      setAddAssetSectionId(null);
    } catch (error) {
      setDialogError(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function removeAsset(msnId: string) {
    if (!catalog) return;

    const nextCatalog = {
      ...catalog,
      entries: catalog.entries.filter((entry) => entry.msnId !== msnId),
    };

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  function startDragging(event: DragEvent<HTMLElement>, msnId: string) {
    draggedMsnId.current = msnId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", msnId);
  }

  function allowDrop(event: DragEvent<HTMLElement>, msnId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverMsnId(msnId);
    setDragOverSectionId(null);
  }

  function allowSectionDrop(
    event: DragEvent<HTMLElement>,
    sectionId: string,
  ) {
    if (!catalog) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverMsnId(null);

    const sectionEntries = catalog.entries.filter(
      (entry) => entry.sectionId === sectionId,
    );
    if (sectionEntries.length === 0) {
      setDragOverSectionId(sectionId);
      setDropPosition({ sectionId, index: 0 });
      return;
    }

    setDragOverSectionId(null);
    setDropPosition({ sectionId, index: sectionEntries.length });
  }

  function allowGridDrop(
    event: DragEvent<HTMLDivElement>,
    sectionId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverSectionId(null);
    if (!catalog) return;

    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(".stock-card"),
    );
    const targetCard =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(".stock-card")
        : null;
    const targetIndex = targetCard ? cards.indexOf(targetCard) : -1;

    if (targetIndex >= 0) {
      const targetMsnId = catalog.entries.find(
        (entry) =>
          entry.sectionId === sectionId &&
          entry.msnId === targetCard?.dataset.msnId,
      )?.msnId;
      setDragOverMsnId(targetMsnId ?? null);
      setDropPosition({ sectionId, index: targetIndex, targetMsnId });
      return;
    }

    setDragOverMsnId(null);
    if (cards.length === 0) {
      setDragOverSectionId(sectionId);
      setDropPosition({ sectionId, index: 0 });
      return;
    }

    const pointerX = event.clientX;
    const pointerY = event.clientY;
    const cuts = cards.map((card, index) => {
      const rect = card.getBoundingClientRect();
      return {
        index,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });
    let insertionIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index <= cuts.length; index += 1) {
      const previous = cuts[index - 1];
      const next = cuts[index];
      const boundary = previous && next
        ? { x: (previous.x + next.x) / 2, y: (previous.y + next.y) / 2 }
        : previous ?? next;
      if (!boundary) continue;

      const distance = Math.hypot(pointerX - boundary.x, pointerY - boundary.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        insertionIndex = index;
      }
    }

    setDropPosition({ sectionId, index: insertionIndex });
  }

  async function dropAsset(
    event: DragEvent<HTMLElement>,
    targetSectionId: string,
    targetMsnId?: string,
    targetPosition?: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverMsnId(null);
    setDragOverSectionId(null);
    setDropPosition(null);

    const sourceMsnId = draggedMsnId.current;
    draggedMsnId.current = null;

    if (!catalog || !sourceMsnId || sourceMsnId === targetMsnId) return;

    const sourceEntry = catalog.entries.find(
      (entry) => entry.msnId === sourceMsnId,
    );
    if (!sourceEntry) return;

    const sourceEntries = catalog.entries.filter(
      (entry) => entry.sectionId === sourceEntry.sectionId,
    );
    const sourceIndex = sourceEntries.findIndex(
      (entry) => entry.msnId === sourceMsnId,
    );
    const targetEntries = catalog.entries.filter(
      (entry) => entry.sectionId === targetSectionId,
    );
    let targetIndex = targetMsnId
      ? targetEntries.findIndex((entry) => entry.msnId === targetMsnId)
      : targetPosition ?? targetEntries.length;

    if (targetIndex < 0) return;
    if (
      sourceEntry.sectionId === targetSectionId &&
      sourceEntries[targetIndex]?.msnId === sourceMsnId
    ) {
      return;
    }

    const nextSourceEntries = sourceEntries.filter(
      (entry) => entry.msnId !== sourceMsnId,
    );
    if (
      !targetMsnId &&
      sourceEntry.sectionId === targetSectionId &&
      sourceIndex < targetIndex
    ) {
      targetIndex -= 1;
    }
    const nextTargetEntries =
      sourceEntry.sectionId === targetSectionId
        ? nextSourceEntries
        : [...targetEntries];
    nextTargetEntries.splice(targetIndex, 0, {
      ...sourceEntry,
      sectionId: targetSectionId,
    });

    const entries = catalog.sections.flatMap((section) =>
      section.id === sourceEntry.sectionId && section.id !== targetSectionId
        ? nextSourceEntries
        : section.id === targetSectionId
          ? nextTargetEntries
          : catalog.entries.filter((entry) => entry.sectionId === section.id),
    );

    const nextCatalog = { ...catalog, entries };

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  async function addSection() {
    if (!catalog) return;

    const section = {
      id: crypto.randomUUID(),
      name: `Seção ${catalog.sections.length + 1}`,
    };
    const nextCatalog = {
      ...catalog,
      sections: [...catalog.sections, section],
    };

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setNewSectionId(section.id);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  async function dropOnAddSection(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsAddSectionDragOver(false);
    setDragOverMsnId(null);
    setDragOverSectionId(null);
    setDropPosition(null);

    const sourceMsnId = draggedMsnId.current;
    draggedMsnId.current = null;
    if (!catalog || !sourceMsnId) return;

    const section = {
      id: crypto.randomUUID(),
      name: `Seção ${catalog.sections.length + 1}`,
    };
    const nextCatalog = {
      sections: [...catalog.sections, section],
      entries: catalog.entries.map((entry) =>
        entry.msnId === sourceMsnId
          ? { ...entry, sectionId: section.id }
          : entry,
      ),
    };

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setNewSectionId(section.id);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  async function renameSection(sectionId: string, name: string) {
    if (!catalog) return;

    const nextCatalog = {
      ...catalog,
      sections: catalog.sections.map((section) =>
        section.id === sectionId ? { ...section, name } : section,
      ),
    };

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  async function deleteSection(sectionId: string) {
    if (!catalog) return;

    const section = catalog.sections.find((item) => item.id === sectionId);
    if (!section) return;

    const numero_ativos = catalog.entries.filter((entry) => entry.sectionId === sectionId).length;

    if (numero_ativos > 3) {
      const shouldDelete = window.confirm(
        `Excluir "${section.name}" e todos os ativos dessa seção?`,
      );
      if (!shouldDelete) return;
    }

    const nextCatalog = {
      sections: catalog.sections.filter((item) => item.id !== sectionId),
      entries: catalog.entries.filter((entry) => entry.sectionId !== sectionId),
    };

    try {
      await saveStockCatalog(nextCatalog);
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    }
  }

  function openAddDialog(sectionId: string) {
    setDialogError(null);
    setAddAssetSectionId(sectionId);
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

      <div className="sections-list">
        {catalog?.sections.map((section) => (
          <section
            className={`asset-section${dragOverSectionId === section.id ? " drag-over" : ""}`}
            key={section.id}
            onDragOver={(event) => allowSectionDrop(event, section.id)}
            onDrop={(event) => void dropAsset(event, section.id)}
          >
            <SectionHeading
              section={section}
              initiallyEditing={section.id === newSectionId}
              canDelete
              onRename={renameSection}
              onFinishEditing={() => setNewSectionId(null)}
              onAddAsset={openAddDialog}
              onDelete={(sectionId) => void deleteSection(sectionId)}
            />
            <div
              className="watchlist-grid"
              onDragOver={(event) => allowGridDrop(event, section.id)}
              onDrop={(event) => {
                const position =
                  dropPosition?.sectionId === section.id
                    ? dropPosition
                    : null;
                if (position) {
                  void dropAsset(
                    event,
                    section.id,
                    position.targetMsnId,
                    position.index,
                  );
                } else {
                  void dropAsset(event, section.id);
                }
              }}
            >
              {catalog.entries
                .filter((entry) => entry.sectionId === section.id)
                .map((entry) => (
                  <StockCard
                    key={entry.msnId}
                    entry={entry}
                    onRemove={(msnId) => void removeAsset(msnId)}
                    draggable
                    onDragStart={(event) => startDragging(event, entry.msnId)}
                    onDragOver={(event) => allowDrop(event, entry.msnId)}
                    onDrop={(event) =>
                      void dropAsset(event, section.id, entry.msnId)
                    }
                    onDragEnd={() => {
                      draggedMsnId.current = null;
                      setDragOverMsnId(null);
                      setDragOverSectionId(null);
                      setDropPosition(null);
                      setIsAddSectionDragOver(false);
                    }}
                    isDragOver={dragOverMsnId === entry.msnId}
                  />
                ))}
            </div>
          </section>
        ))}
        {catalog !== null && (
          <button
            type="button"
            onClick={() => void addSection()}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setIsAddSectionDragOver(true);
            }}
            onDragLeave={() => setIsAddSectionDragOver(false)}
            onDragEnd={() => setIsAddSectionDragOver(false)}
            onDrop={dropOnAddSection}
            className={`add-section${isAddSectionDragOver ? " drag-over" : ""}`}
          >
            + Seção
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
          onClose={() => {
            setIsAddOpen(false);
            setAddAssetSectionId(null);
          }}
          onAdd={addAsset}
        />
      )}
    </main>
  );
}
