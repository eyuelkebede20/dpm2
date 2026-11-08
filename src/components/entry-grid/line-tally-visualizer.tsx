"use client";

import React from "react";
import { Sparkles, Grid, Touchpad } from "lucide-react";

export interface LineTallyVisualizerProps {
  plannedQty: number;
  finishedGood: number;
  rework?: number;
  reject?: number;
  scrap?: number;
  wip?: number;
  onIncrement?: (amount: number) => void;
  compact?: boolean;
  showQuickButtons?: boolean;
  className?: string;
}

export function LineTallyVisualizer({
  plannedQty,
  finishedGood,
  rework = 0,
  reject = 0,
  scrap = 0,
  wip = 0,
  onIncrement,
  compact = false,
  showQuickButtons = true,
  className = "",
}: LineTallyVisualizerProps) {
  const hasTarget = plannedQty > 0;
  const baseTarget = hasTarget ? plannedQty : Math.max(1, finishedGood + rework + reject + scrap);

  // Percentages clamped to baseTarget
  const fgPercent = hasTarget ? (finishedGood / baseTarget) * 100 : 100;
  const isOverTarget = hasTarget && finishedGood > plannedQty;
  const overTargetPercent = isOverTarget
    ? ((finishedGood - plannedQty) / plannedQty) * 100
    : 0;

  const totalFallout = reject + scrap;
  const clampedFgWidth = Math.min(100, Math.max(0, (finishedGood / baseTarget) * 100));
  const clampedRwWidth = Math.min(
    100 - clampedFgWidth,
    Math.max(0, (rework / baseTarget) * 100)
  );
  const clampedRejWidth = Math.min(
    100 - clampedFgWidth - clampedRwWidth,
    Math.max(0, (totalFallout / baseTarget) * 100)
  );

  // 20 visual dots (each dot = 5% of target)
  const totalDots = 20;
  const fgDots = Math.min(totalDots, Math.round((clampedFgWidth / 100) * totalDots));
  const rwDots = Math.min(totalDots - fgDots, Math.round((clampedRwWidth / 100) * totalDots));
  const rejDots = Math.min(
    totalDots - fgDots - rwDots,
    Math.round((clampedRejWidth / 100) * totalDots)
  );

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isOverTarget
          ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
          : "bg-slate-50/80 border-slate-200/90"
      } p-3 sm:p-4 ${className}`}
    >
      {/* Top Header: Target status & Completion */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/70">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
              isOverTarget
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-white text-slate-700 border border-slate-200 shadow-2xs"
            }`}
          >
            <Grid className="w-3 h-3 text-emerald-600" />
            <span>Tally Visualizer</span>
          </div>

          {isOverTarget ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs animate-pulse">
              <Sparkles className="w-2.5 h-2.5" />
              +{overTargetPercent.toFixed(1)}% OVER (ትርፍ)
            </span>
          ) : hasTarget ? (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                fgPercent >= 90
                  ? "bg-emerald-100 text-emerald-800"
                  : fgPercent >= 75
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {fgPercent.toFixed(0)}% of target
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400 italic">
              No target set
            </span>
          )}
        </div>

        <div className="text-right flex items-baseline gap-1.5 font-mono">
          <span className="text-xs sm:text-sm font-black text-emerald-800 tabular-nums">
            {finishedGood.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-400">/</span>
          <span className="text-xs font-bold text-slate-600 tabular-nums">
            {hasTarget ? plannedQty.toLocaleString() : "—"}
          </span>
          <span className="text-[10px] font-bold text-slate-400">pcs</span>
        </div>
      </div>

      {/* Visual Representation */}
      <div className="mt-2.5 space-y-2">
        {/* Segmented Progress Bar */}
        <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden flex shadow-inner">
          <div
            className="bg-emerald-500 h-full transition-all duration-300 rounded-l-full"
            style={{ width: `${clampedFgWidth}%` }}
            title={`Finished Good: ${finishedGood}`}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-300"
            style={{ width: `${clampedRwWidth}%` }}
            title={`Rework: ${rework}`}
          />
          <div
            className="bg-rose-500 h-full transition-all duration-300"
            style={{ width: `${clampedRejWidth}%` }}
            title={`Reject + Scrap: ${totalFallout}`}
          />
        </div>

        {/* 20-Dot Matrix Visualization (unless in compact mode) */}
        {!compact && (
          <div className="pt-1">
            <div className="grid grid-cols-10 sm:grid-cols-20 gap-1 sm:gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200/70 shadow-inner">
              {Array.from({ length: totalDots }).map((_, idx) => {
                let dotClass =
                  "bg-slate-100 border border-slate-200 text-transparent";
                let title = "Unproduced capacity";

                if (idx < fgDots) {
                  dotClass =
                    "bg-emerald-500 border border-emerald-600 shadow-2xs";
                  title = "Finished Good (ጥሩ ምርት)";
                } else if (idx < fgDots + rwDots) {
                  dotClass = "bg-amber-400 border border-amber-500 shadow-2xs";
                  title = "Rework (ድጋሚ ሥራ)";
                } else if (idx < fgDots + rwDots + rejDots) {
                  dotClass = "bg-rose-500 border border-rose-600 shadow-2xs";
                  title = "Reject / Scrap (ብልሽት)";
                }

                return (
                  <div
                    key={idx}
                    title={title}
                    className={`h-2.5 sm:h-3 rounded-sm transition-all duration-200 ${dotClass}`}
                  />
                );
              })}
            </div>

            {/* Micro Legend */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold mt-1 px-1 flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                <span>Good ({finishedGood})</span>
              </div>
              {rework > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-amber-400 inline-block" />
                  <span>Rework ({rework})</span>
                </div>
              )}
              {totalFallout > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" />
                  <span>Defect ({totalFallout})</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-xs bg-slate-200 inline-block" />
                <span>Target ({hasTarget ? plannedQty : 0})</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Tally Green Buttons Strip (just like in ../dpm) */}
      {showQuickButtons && onIncrement && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Touchpad className="w-3.5 h-3.5 text-emerald-600" />
            Quick Tally:
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onIncrement(-10)}
              className="text-[11px] font-bold font-mono px-2 py-1 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 active:scale-95 transition-all border border-slate-200/80"
              title="Minus 10"
            >
              −10
            </button>
            <button
              type="button"
              onClick={() => onIncrement(1)}
              className="text-[11px] font-black font-mono px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border-2 border-emerald-300 hover:border-emerald-600 active:scale-95 transition-all shadow-2xs hover:shadow-xs"
              title="Add 1 Good Unit"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => onIncrement(5)}
              className="text-[11px] font-black font-mono px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border-2 border-emerald-300 hover:border-emerald-600 active:scale-95 transition-all shadow-2xs hover:shadow-xs"
              title="Add 5 Good Units"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => onIncrement(10)}
              className="text-[11px] font-black font-mono px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-600 text-emerald-900 hover:text-white border-2 border-emerald-400 hover:border-emerald-600 active:scale-95 transition-all shadow-2xs hover:shadow-xs"
              title="Add 10 Good Units"
            >
              +10
            </button>
            <button
              type="button"
              onClick={() => onIncrement(50)}
              className="text-[11px] font-black font-mono px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-600 hover:border-emerald-700 active:scale-95 transition-all shadow-xs"
              title="Add 50 Good Units"
            >
              +50
            </button>
            <button
              type="button"
              onClick={() => onIncrement(100)}
              className="text-[11px] font-black font-mono px-3 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white border-2 border-emerald-700 active:scale-95 transition-all shadow-xs"
              title="Add 100 Good Units"
            >
              +100
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
