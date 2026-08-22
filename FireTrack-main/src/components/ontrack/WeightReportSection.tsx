import React, { useState } from 'react';
import { LogEntryItem } from '../../types/ontrack';
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Minus,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';

interface WeightReportSectionProps {
  entries: LogEntryItem[];
  allEntries: LogEntryItem[];
  periodLabel: string;
  periodRangeLabel: string;
  patientName: string;
  onEditEntry?: (entry: LogEntryItem) => void;
}

interface ParsedWeightRow {
  entry: LogEntryItem;
  numericWeight: number;
  compliance: string;
  deltaFromPrev: number | null;
}

export const WeightReportSection: React.FC<WeightReportSectionProps> = ({
  entries,
  allEntries,
  periodLabel,
  periodRangeLabel,
  patientName,
  onEditEntry
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    date: string;
    weight: number;
    compliance: string;
    delta: number | null;
  } | null>(null);

  // Parse and sort entries chronologically (oldest to newest for charts & delta calculation)
  const sortedAsc = [...entries].sort((a, b) => {
    const tA = a.timestamp || new Date(a.date).getTime();
    const tB = b.timestamp || new Date(b.date).getTime();
    return tA - tB;
  });

  const parsedRows: ParsedWeightRow[] = [];
  let prevWeight: number | null = null;

  sortedAsc.forEach((e) => {
    const rawVal = parseFloat(String(e.value || '').replace(',', '.'));
    const numericWeight = !isNaN(rawVal) ? rawVal : 0;
    const delta = prevWeight !== null && numericWeight > 0 ? numericWeight - prevWeight : null;
    prevWeight = numericWeight > 0 ? numericWeight : prevWeight;

    parsedRows.push({
      entry: e,
      numericWeight,
      compliance: e.note || 'Non specificato',
      deltaFromPrev: delta
    });
  });

  // For table display (newest first)
  const tableRows = [...parsedRows].reverse();

  // Statistics calculation
  const validWeights = parsedRows.map(r => r.numericWeight).filter(w => w > 0);
  const count = validWeights.length;

  const latestWeight = tableRows.length > 0 ? tableRows[0].numericWeight : 0;
  const initialWeight = parsedRows.length > 0 ? parsedRows[0].numericWeight : 0;
  const totalChange = (latestWeight > 0 && initialWeight > 0) ? latestWeight - initialWeight : 0;
  const totalChangePct = initialWeight > 0 ? (totalChange / initialWeight) * 100 : 0;

  const minWeight = validWeights.length > 0 ? Math.min(...validWeights) : 0;
  const maxWeight = validWeights.length > 0 ? Math.max(...validWeights) : 0;
  const avgWeight = validWeights.length > 0 ? validWeights.reduce((a, b) => a + b, 0) / validWeights.length : 0;

  // Compliance counts
  const complianceStats: { [key: string]: number } = {};
  parsedRows.forEach(r => {
    const key = (r.compliance || 'Non specificato').trim();
    complianceStats[key] = (complianceStats[key] || 0) + 1;
  });

  // Chart SVG calculations
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 25, right: 35, bottom: 35, left: 55 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const yMin = minWeight > 0 ? Math.floor(minWeight - 1) : 0;
  const yMax = maxWeight > 0 ? Math.ceil(maxWeight + 1) : 100;
  const yRange = yMax - yMin || 1;

  const points = parsedRows.map((r, i) => {
    const x = padding.left + (parsedRows.length > 1 ? (i / (parsedRows.length - 1)) * innerWidth : innerWidth / 2);
    const y = padding.top + innerHeight - ((r.numericWeight - yMin) / yRange) * innerHeight;
    return {
      x,
      y,
      date: `${r.entry.date} ${r.entry.time || ''}`.trim(),
      weight: r.numericWeight,
      compliance: r.compliance,
      delta: r.deltaFromPrev
    };
  });

  const pathD = points.length > 1
    ? points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
    : '';

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
    : '';

  const avgY = padding.top + innerHeight - ((avgWeight - yMin) / yRange) * innerHeight;

  return (
    <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

      {/* Sub-Header Card (styled like Report Digiuno) */}
      <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shadow-inner shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Report Peso Corporeo
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-indigo-200">{periodLabel}</strong> ({periodRangeLabel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto text-xs text-stone-300 shrink-0">
            <span className="font-mono font-bold text-indigo-300 text-sm">{count}</span>
            <span>pesate</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Ultimo Peso */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Ultimo Peso Rilevato</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-indigo-300 font-mono">
              {latestWeight > 0 ? latestWeight.toFixed(1).replace('.', ',') : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">kg</span>
          </div>
          <span className="text-[10px] text-stone-500 font-mono block mt-1">
            {tableRows.length > 0 ? `${tableRows[0].entry.date} ${tableRows[0].entry.time || ''}` : 'Nessun dato'}
          </span>
        </div>

        {/* Variazione Periodo */}
        <div className={`p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1`}>
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
            Variazione Periodo
          </span>
          <div className="flex items-center space-x-1 mt-1">
            {totalChange < 0 ? (
              <TrendingDown className="w-5 h-5 text-emerald-400" />
            ) : totalChange > 0 ? (
              <TrendingUp className="w-5 h-5 text-amber-400" />
            ) : (
              <Minus className="w-4 h-4 text-stone-400" />
            )}
            <span className={`text-2xl font-black font-mono ${totalChange < 0 ? 'text-emerald-400' : totalChange > 0 ? 'text-amber-400' : 'text-stone-300'}`}>
              {totalChange > 0 ? `+${totalChange.toFixed(1).replace('.', ',')}` : totalChange.toFixed(1).replace('.', ',')}
            </span>
            <span className="text-xs font-semibold text-stone-400">kg</span>
          </div>
          <span className={`text-[10px] font-mono block mt-1 ${totalChange < 0 ? 'text-emerald-400/80' : totalChange > 0 ? 'text-amber-400/80' : 'text-stone-500'}`}>
            {totalChangePct !== 0 ? `(${totalChangePct > 0 ? '+' : ''}${totalChangePct.toFixed(2).replace('.', ',')}%)` : 'Stabile'}
          </span>
        </div>

        {/* Media Periodo */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Media Periodo</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-white font-mono">
              {avgWeight > 0 ? avgWeight.toFixed(1).replace('.', ',') : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">kg</span>
          </div>
          <span className="text-[10px] text-stone-500 font-mono block mt-1">
            Min: {minWeight.toFixed(1).replace('.', ',')} • Max: {maxWeight.toFixed(1).replace('.', ',')}
          </span>
        </div>

        {/* Peso Iniziale Periodo */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Peso Iniziale</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-stone-200 font-mono">
              {initialWeight > 0 ? initialWeight.toFixed(1).replace('.', ',') : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">kg</span>
          </div>
          <span className="text-[10px] text-stone-500 font-mono block mt-1">
            {parsedRows.length > 0 ? `${parsedRows[0].entry.date}` : '-'}
          </span>
        </div>
      </div>

      {/* Compliance / Aderenza Summary */}
      {Object.keys(complianceStats).length > 0 && (
        <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              Valutazione di Conformità Registrata
            </h4>
            <span className="text-[11px] text-stone-400 font-mono">
              {count} risposte nel periodo
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(complianceStats).map(([comp, num]) => {
              const pct = Math.round((num / count) * 100);
              const isGood = comp.toLowerCase().includes('buon') || comp.toLowerCase().includes('ottim');
              const isBad = comp.toLowerCase().includes('scars') || comp.toLowerCase().includes('non');

              return (
                <div
                  key={comp}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
                    isGood
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : isBad
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-black/30 border-white/10 text-stone-200'
                  }`}
                >
                  <span className="font-semibold">{comp}</span>
                  <span className="font-bold font-mono px-1.5 py-0.5 bg-black/40 rounded text-[11px] border border-white/10">
                    {num} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weight Trend Chart */}
      {points.length > 0 && (
        <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Andamento Temporale del Peso ({periodLabel})
            </h4>
            <div className="flex items-center space-x-3 text-[11px] font-mono text-stone-400">
              <span className="inline-flex items-center gap-1 text-indigo-300">
                <span className="w-3 h-0.5 bg-indigo-400 inline-block" /> Peso (kg)
              </span>
              <span className="inline-flex items-center gap-1 text-stone-400">
                <span className="w-3 h-0.5 border-b border-dashed border-stone-500 inline-block" /> Media ({avgWeight.toFixed(1)} kg)
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto bg-black/30 border border-white/10 rounded-xl p-3 relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto max-h-64 select-none"
            >
              <defs>
                <linearGradient id="weightGradDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + innerHeight * (1 - ratio);
                const val = (yMin + yRange * ratio).toFixed(1);
                return (
                  <g key={ratio}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="0.75"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94a3b8"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Average Line */}
              {avgWeight > 0 && (
                <line
                  x1={padding.left}
                  y1={avgY}
                  x2={chartWidth - padding.right}
                  y2={avgY}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}

              {/* Area */}
              {areaD && (
                <path d={areaD} fill="url(#weightGradDark)" />
              )}

              {/* Curve Line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Point Circles */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.date === p.date ? 6 : 4}
                    fill="#1e1b4b"
                    stroke="#a5b4fc"
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all hover:scale-125"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Point label for single / few entries or min/max */}
                  {(points.length <= 15 || idx === 0 || idx === points.length - 1 || p.weight === minWeight || p.weight === maxWeight) && (
                    <text
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#c7d2fe"
                      fontFamily="monospace"
                    >
                      {p.weight.toFixed(1).replace('.', ',')}
                    </text>
                  )}
                </g>
              ))}

              {/* X Axis dates (oldest and newest) */}
              {points.length > 0 && (
                <>
                  <text
                    x={points[0].x}
                    y={chartHeight - 10}
                    textAnchor="start"
                    fontSize="10"
                    fill="#94a3b8"
                    fontFamily="monospace"
                  >
                    {points[0].date.split(' ')[0]}
                  </text>
                  {points.length > 1 && (
                    <text
                      x={points[points.length - 1].x}
                      y={chartHeight - 10}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94a3b8"
                      fontFamily="monospace"
                    >
                      {points[points.length - 1].date.split(' ')[0]}
                    </text>
                  )}
                </>
              )}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute bg-stone-900 border border-stone-700 text-white text-xs p-2.5 rounded-xl shadow-2xl pointer-events-none z-10 font-mono -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredPoint.y / chartHeight) * 100}%`
                }}
              >
                <p className="font-bold text-indigo-300">{hoveredPoint.weight.toFixed(1)} kg</p>
                <p className="text-[10px] text-stone-300">{hoveredPoint.date}</p>
                {hoveredPoint.delta !== null && (
                  <p className="text-[10px] text-stone-300">
                    Delta: {hoveredPoint.delta > 0 ? `+${hoveredPoint.delta.toFixed(1)}` : hoveredPoint.delta.toFixed(1)} kg
                  </p>
                )}
                {hoveredPoint.compliance && (
                  <p className="text-[10px] text-indigo-200 mt-0.5">Conformità: {hoveredPoint.compliance}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-indigo-400" />
            Registro Dettagliato Peso ({tableRows.length} misurazioni)
          </h4>
          <span className="text-[11px] text-stone-400 font-mono">
            {periodLabel}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs text-left">
            <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
              <tr>
                <th className="p-3 border-r border-white/10">Data e Ora</th>
                <th className="p-3 border-r border-white/10 text-right">Peso (kg)</th>
                <th className="p-3 border-r border-white/10 text-center">Variazione</th>
                <th className="p-3 border-r border-white/10">Valutazione Conformità</th>
                <th className="p-3 border-r border-white/10">Note Aggiuntive</th>
                <th className="p-3 text-center print:hidden w-12">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
              {tableRows.length > 0 ? (
                tableRows.map((r, idx) => {
                  const delta = r.deltaFromPrev;
                  return (
                    <tr
                      key={r.entry.id}
                      className={`group ${idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'} hover:bg-white/5 transition-colors ${onEditEntry ? 'cursor-pointer' : ''}`}
                      onClick={() => onEditEntry && onEditEntry(r.entry)}
                    >
                      <td className="p-3 border-r border-white/10 text-[11px]">
                        {r.entry.date} <span className="text-stone-400 font-semibold">{r.entry.time || '12:00'}</span>
                      </td>
                      <td className="p-3 border-r border-white/10 text-right font-black text-indigo-300 text-sm">
                        {r.numericWeight.toFixed(1).replace('.', ',')}
                      </td>
                      <td className="p-3 border-r border-white/10 text-center text-[11px]">
                        {delta !== null ? (
                          <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                            delta < 0 ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30' : delta > 0 ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30' : 'text-stone-400'
                          }`}>
                            {delta > 0 ? `+${delta.toFixed(1).replace('.', ',')}` : delta.toFixed(1).replace('.', ',')} kg
                          </span>
                        ) : (
                          <span className="text-stone-500">-</span>
                        )}
                      </td>
                      <td className="p-3 border-r border-white/10 font-sans font-medium">
                        <span className="px-2 py-0.5 bg-black/30 border border-white/10 rounded text-stone-300 text-[11px]">
                          {r.compliance}
                        </span>
                      </td>
                      <td className="p-3 border-r border-white/10 text-stone-400 font-sans italic">
                        {r.entry.categoryName || '-'}
                      </td>
                      <td className="p-3 text-center print:hidden" onClick={(ev) => ev.stopPropagation()}>
                        {onEditEntry && (
                          <button
                            type="button"
                            onClick={() => onEditEntry(r.entry)}
                            className="p-1 text-stone-400 hover:text-indigo-300 hover:bg-white/10 rounded transition-colors inline-block cursor-pointer"
                            title="Modifica misurazione"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-stone-400 italic">
                    Nessun dato di peso registrato per il periodo selezionato ({periodLabel}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
