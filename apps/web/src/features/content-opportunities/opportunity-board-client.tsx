"use client";

/**
 * OpportunityBoardClient (spec §5.2 / Teil 3 §G) — the interactive Opportunity
 * Board island.
 *
 * Composes:
 *   - PriorityMatrix (§4.4) — always on top (visual triage).
 *   - A view toggle (?view=matrix|kanban|table) driven by search params.
 *       · kanban — Status-Kanban (offen → in Arbeit → umgesetzt → validiert).
 *       · table  — FilterBar (§3.7, type/status/impact/effort, 0-backend,
 *                  search-param driven) + Sparkline + ConfidenceBadge.
 *   - Evidence-Chain-Drawer (§4.11) — opened by bubble/row click.
 *
 * All filtering is pure client-side (board-api helpers); search params are the
 * single source of truth so a view survives reload / can be shared.
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { nextOpportunityStatuses, type Opportunity, type OpportunityStatus } from "@seo-tool/domain-model";
import { Sparkline } from "../../components/charts/sparkline";
import { PriorityMatrix, type PriorityBubble } from "../../components/charts/priority-matrix";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { CardTabs } from "../../components/card-tabs";
import { SelectMenu } from "../../components/select-menu";
import {
  BOARD_STATUSES,
  KANBAN_COLUMNS,
  OPPORTUNITY_TYPES,
  confidenceToLevel,
  filterOpportunities,
  opportunityTypeColorKey,
  opportunityTypeLabel,
  opportunityStatusLabel,
  statusToColumn,
  type BoardFilter,
} from "../../lib/board-logic";
import { EvidenceChainDrawer } from "./evidence-chain-drawer";

type BoardView = "matrix" | "kanban" | "table";

const VIEWS: Array<{ key: BoardView; label: string }> = [
  { key: "matrix", label: "Matrix" },
  { key: "kanban", label: "Kanban" },
  { key: "table", label: "Tabelle" },
];

export interface OpportunityBoardClientProps {
  opportunities: Opportunity[];
  /** Server action: transition many opportunities to one status at once. */
  onBulkTransition?: (
    ids: string[],
    status: OpportunityStatus
  ) => Promise<{ ok: number; failed: number }>;
}

/** Status targets offered by the Bulk-Action-Bar (sensible forward moves + dismiss). */
const BULK_TARGETS: Array<{ status: OpportunityStatus; label: string }> = [
  { status: "in_progress", label: "In Arbeit" },
  { status: "implemented", label: "Umgesetzt" },
  { status: "validated", label: "Validiert" },
  { status: "dismissed", label: "Verwerfen" },
];

function parseView(value: string | null): BoardView {
  return value === "kanban" || value === "table" ? value : "matrix";
}

function toBubble(op: Opportunity): PriorityBubble {
  return {
    id: op.id,
    title: opportunityTypeLabel(op.type),
    effort: op.effort,
    expectedImpact: op.expectedImpact,
    businessValue: op.businessValue,
    priority: op.priority,
    confidenceLevel: confidenceToLevel(op.confidence),
    colorKey: opportunityTypeColorKey(op.type),
    typeLabel: opportunityTypeLabel(op.type),
  };
}

/** Build a small evidence sparkline series (before/current per evidence row). */
function evidenceSparkline(op: Opportunity): number[] {
  const values: number[] = [];
  for (const e of op.evidence) {
    if (typeof e.beforeValue === "number") values.push(e.beforeValue);
    if (typeof e.currentValue === "number") values.push(e.currentValue);
  }
  return values;
}

export function OpportunityBoardClient({
  opportunities,
  onBulkTransition,
}: OpportunityBoardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [isBulkPending, startBulk] = useTransition();

  const view = parseView(searchParams.get("view"));

  const filter: BoardFilter = useMemo(
    () => ({
      type: (searchParams.get("type") as BoardFilter["type"]) ?? "all",
      status: (searchParams.get("status") as BoardFilter["status"]) ?? "all",
      minImpact: Number(searchParams.get("minImpact")) || 0,
      maxEffort: Number(searchParams.get("maxEffort")) || 0,
    }),
    [searchParams]
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || value === "all" || value === "0") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(() => filterOpportunities(opportunities, filter), [opportunities, filter]);

  const selected = useMemo(
    () => opportunities.find((o) => o.id === selectedId) ?? null,
    [opportunities, selectedId]
  );

  // The matrix always shows the full set (triage); the toggled view below uses
  // the filtered set for table / kanban (kanban ignores the impact/effort floor
  // only insofar as those filters still apply when set).
  const bubbles = useMemo(() => opportunities.map(toBubble), [opportunities]);

  // --- Bulk selection (table view) ---
  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  const checkedInView = useMemo(
    () => filteredIds.filter((id) => checkedIds.has(id)),
    [filteredIds, checkedIds]
  );
  const allChecked = filteredIds.length > 0 && checkedInView.length === filteredIds.length;

  // Only offer bulk targets the status model allows for EVERY selected item — otherwise the bar
  // offered e.g. "Validiert" for fresh "open" items, which the server rejects, producing a
  // "0 aktualisiert, N übersprungen" dead-end. Intersection of valid next-statuses across the
  // selection.
  const statusById = useMemo(
    () => new Map(opportunities.map((o) => [o.id, o.status])),
    [opportunities]
  );
  const validBulkTargets = useMemo(() => {
    const statuses = checkedInView
      .map((id) => statusById.get(id))
      .filter((s): s is OpportunityStatus => Boolean(s));
    if (statuses.length === 0) return [];
    return BULK_TARGETS.filter((target) =>
      statuses.every((s) => nextOpportunityStatuses(s).includes(target.status))
    );
  }, [checkedInView, statusById]);

  const toggleOne = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkMessage(null);
  }, []);

  const toggleAll = useCallback(() => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      const everySelected = filteredIds.length > 0 && filteredIds.every((id) => next.has(id));
      if (everySelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setBulkMessage(null);
  }, [filteredIds]);

  const clearSelection = useCallback(() => {
    setCheckedIds(new Set());
    setBulkMessage(null);
  }, []);

  const runBulk = useCallback(
    (status: OpportunityStatus) => {
      if (!onBulkTransition || checkedInView.length === 0) return;
      const ids = [...checkedInView];
      setBulkMessage(null);
      startBulk(async () => {
        const result = await onBulkTransition(ids, status);
        // We only offer transitions valid for the whole selection, so any failure here is a real
        // error (e.g. the item changed underneath us), not a disallowed transition.
        const failedSuffix = result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : "";
        setBulkMessage(`${result.ok} aktualisiert${failedSuffix}.`);
        setCheckedIds(new Set());
        router.refresh();
      });
    },
    [onBulkTransition, checkedInView, router]
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (filter.type && filter.type !== "all") chips.push({ key: "type", label: `Typ: ${opportunityTypeLabel(filter.type)}` });
    if (filter.status && filter.status !== "all") chips.push({ key: "status", label: `Status: ${opportunityStatusLabel(filter.status)}` });
    if (filter.minImpact) chips.push({ key: "minImpact", label: `Wirkung ≥ ${filter.minImpact}` });
    if (filter.maxEffort) chips.push({ key: "maxEffort", label: `Aufwand ≤ ${filter.maxEffort}` });
    return chips;
  }, [filter]);

  return (
    <div className="board-root">
      {/* PriorityMatrix — always-on triage */}
      <section className="card board-matrix-card">
        <p className="kicker">Triage · Impact×Effort</p>
        <PriorityMatrix bubbles={bubbles} selectedId={selectedId} onSelect={setSelectedId} />
      </section>

      {/* Work-area switcher (Schicht 2): rich card-tabs with a mini-KPI preview per view. */}
      <CardTabs
        ariaLabel="Ansicht wählen"
        active={view}
        onSelect={(id) => setParam("view", id === "matrix" ? null : id)}
        tabs={VIEWS.map((v) => ({
          id: v.key,
          label: v.label,
          hint: v.key === "matrix" ? "Impact×Effort-Triage" : v.key === "kanban" ? "Status-Fluss offen → validiert" : "Filtern & bearbeiten",
          kpi: v.key === "matrix" ? `${opportunities.length} gesamt` : `${filtered.length} sichtbar`,
        }))}
      >
        {view === "kanban" ? (
          <KanbanView opportunities={filtered} onSelect={setSelectedId} />
        ) : view === "table" ? (
          <TableView
            opportunities={filtered}
            filter={filter}
            activeChips={activeChips}
            onParam={setParam}
            onSelect={setSelectedId}
            checkedIds={checkedIds}
            allChecked={allChecked}
            selectable={Boolean(onBulkTransition)}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
          />
        ) : (
          <section className="card">
            <p className="kicker">Matrix-Ansicht</p>
            <p className="muted">
              Wähle eine Chance in der Matrix oben, um die Evidenz-Kette zu öffnen. Wechsle zu „Kanban" oder „Tabelle" für die
              detaillierte Bearbeitung.
            </p>
          </section>
        )}
      </CardTabs>

      <EvidenceChainDrawer opportunity={selected} onClose={() => setSelectedId(null)} />

      {onBulkTransition && (checkedInView.length > 0 || bulkMessage) ? (
        <BulkBar
          count={checkedInView.length}
          targets={validBulkTargets}
          message={bulkMessage}
          pending={isBulkPending}
          onAction={runBulk}
          onClear={clearSelection}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk-Action-Bar (spec §3.9) — floating selection toolbar
// ---------------------------------------------------------------------------

function BulkBar({
  count,
  targets,
  message,
  pending,
  onAction,
  onClear,
}: {
  count: number;
  targets: Array<{ status: OpportunityStatus; label: string }>;
  message: string | null;
  pending: boolean;
  onAction: (status: OpportunityStatus) => void;
  onClear: () => void;
}) {
  return (
    <div className="board-bulkbar" role="region" aria-label="Massenaktionen für ausgewählte Chancen">
      <span className="board-bulkbar__count">
        {count > 0 ? <strong>{count} ausgewählt</strong> : null}
        {message ? <span className="board-bulkbar__msg muted">{message}</span> : null}
      </span>
      <div className="board-bulkbar__actions">
        {count > 0 && targets.length === 0 ? (
          <span className="board-bulkbar__msg muted">Kein gemeinsamer Statuswechsel für diese Auswahl möglich.</span>
        ) : null}
        {targets.map((target) => (
          <button
            key={target.status}
            type="button"
            className="button secondary compact"
            disabled={count === 0 || pending}
            onClick={() => onAction(target.status)}
          >
            {target.label}
          </button>
        ))}
        <button type="button" className="board-bulkbar__clear" onClick={onClear} disabled={pending}>
          Aufheben
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban view
// ---------------------------------------------------------------------------

function KanbanView({
  opportunities,
  onSelect,
}: {
  opportunities: Opportunity[];
  onSelect: (id: string) => void;
}) {
  if (opportunities.length === 0) {
    return <BoardEmpty />;
  }
  return (
    <section className="board-kanban" aria-label="Status-Kanban">
      {KANBAN_COLUMNS.map((column) => {
        const cards = opportunities.filter((o) => statusToColumn(o.status) === column.key);
        return (
          <div key={column.key} className="board-kanban__column">
            <header className="board-kanban__head">
              <span className="board-kanban__title">{column.label}</span>
              <span className="badge">{cards.length}</span>
            </header>
            <div className="board-kanban__cards">
              {cards.length === 0 ? (
                <p className="muted board-kanban__empty">—</p>
              ) : (
                cards.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    className="board-kanban__card"
                    onClick={() => onSelect(op.id)}
                    aria-label={`${opportunityTypeLabel(op.type)} — Evidenz-Kette öffnen`}
                  >
                    <span className={`badge board-cat board-cat--${opportunityTypeColorKey(op.type)}`}>
                      {opportunityTypeLabel(op.type)}
                    </span>
                    <strong className="board-kanban__prio">Priorität {op.priority}</strong>
                    <span className="board-kanban__state muted">{op.currentState || "—"}</span>
                    <ConfidenceBadge level={confidenceToLevel(op.confidence)} showLabel={false} />
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Table view + FilterBar
// ---------------------------------------------------------------------------

function TableView({
  opportunities,
  filter,
  activeChips,
  onParam,
  onSelect,
  checkedIds,
  allChecked,
  selectable,
  onToggleOne,
  onToggleAll,
}: {
  opportunities: Opportunity[];
  filter: BoardFilter;
  activeChips: Array<{ key: string; label: string }>;
  onParam: (key: string, value: string | null) => void;
  onSelect: (id: string) => void;
  checkedIds: Set<string>;
  allChecked: boolean;
  selectable: boolean;
  onToggleOne: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <section className="card">
      <p className="kicker">Tabelle · Facetten-Filter</p>

      {/* FilterBar (§3.7) */}
      <div className="filter-row board-filterbar" role="group" aria-label="Chancen filtern">
        <label>
          Typ
          <SelectMenu
            variant="pill"
            value={filter.type ?? "all"}
            onChange={(v) => onParam("type", v)}
            options={[
              { value: "all", label: "Alle" },
              ...OPPORTUNITY_TYPES.map((t) => ({ value: t, label: opportunityTypeLabel(t) })),
            ]}
            aria-label="Typ"
          />
        </label>
        <label>
          Status
          <SelectMenu
            variant="pill"
            value={filter.status ?? "all"}
            onChange={(v) => onParam("status", v)}
            options={[
              { value: "all", label: "Alle" },
              ...BOARD_STATUSES.map((s: OpportunityStatus) => ({ value: s, label: opportunityStatusLabel(s) })),
            ]}
            aria-label="Status"
          />
        </label>
        <label>
          Wirkung ≥
          <SelectMenu
            variant="pill"
            value={String(filter.minImpact ?? 0)}
            onChange={(v) => onParam("minImpact", v)}
            options={[
              { value: "0", label: "Alle" },
              ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
            ]}
            aria-label="Wirkung ≥"
          />
        </label>
        <label>
          Aufwand ≤
          <SelectMenu
            variant="pill"
            value={String(filter.maxEffort ?? 0)}
            onChange={(v) => onParam("maxEffort", v)}
            options={[
              { value: "0", label: "Alle" },
              ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
            ]}
            aria-label="Aufwand ≤"
          />
        </label>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <div className="badge-row board-chips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="badge primary board-chip"
              onClick={() => onParam(chip.key, null)}
              aria-label={`Filter entfernen: ${chip.label}`}
            >
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}

      {opportunities.length === 0 ? (
        <BoardEmpty />
      ) : (
        <div className="board-table" role="table" aria-label="Chancen-Tabelle">
          <div className="board-table__head" role="row">
            {selectable ? (
              <span role="columnheader" className="board-table__select">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  aria-label="Alle sichtbaren Chancen auswählen"
                />
              </span>
            ) : null}
            <div className="board-table__cells">
              <span role="columnheader">Typ</span>
              <span role="columnheader">Prio</span>
              <span role="columnheader">Wirkung</span>
              <span role="columnheader">Aufwand</span>
              <span role="columnheader">Konfidenz</span>
              <span role="columnheader">Evidenz-Trend</span>
              <span role="columnheader">Status</span>
            </div>
          </div>
          {opportunities.map((op) => (
            <div key={op.id} role="row" className="board-table__row">
              {selectable ? (
                <span role="cell" className="board-table__select">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(op.id)}
                    onChange={() => onToggleOne(op.id)}
                    aria-label={`${opportunityTypeLabel(op.type)} auswählen`}
                  />
                </span>
              ) : null}
              <button
                type="button"
                className="board-table__open board-table__cells"
                onClick={() => onSelect(op.id)}
                aria-label={`${opportunityTypeLabel(op.type)} — Evidenz-Kette öffnen`}
              >
                <span role="cell" className={`badge board-cat board-cat--${opportunityTypeColorKey(op.type)}`}>
                  {opportunityTypeLabel(op.type)}
                </span>
                <span role="cell">{op.priority}</span>
                <span role="cell">{op.expectedImpact}/5</span>
                <span role="cell">{op.effort}/5</span>
                <span role="cell"><ConfidenceBadge level={confidenceToLevel(op.confidence)} showLabel={false} /></span>
                <span role="cell" className="board-table__spark">
                  <Sparkline data={evidenceSparkline(op)} ariaLabel="Vorher/Nachher-Trend" height={28} />
                </span>
                <span role="cell"><span className={`status ${op.status}`}>{opportunityStatusLabel(op.status)}</span></span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared empty-state
// ---------------------------------------------------------------------------

function BoardEmpty() {
  return (
    <div className="board-empty">
      <strong>Keine Chancen im aktuellen Filter</strong>
      <span className="muted">
        Passen Sie die Filter an oder erzeugen Sie Optimierungschancen, um schnelle Erfolge
        (hohe Wirkung, wenig Aufwand) und größere Projekte zu sehen.
      </span>
    </div>
  );
}
