import React, { useState } from 'react';
import { LogEntryItem } from '../../types/ontrack';
import {
  Utensils,
  Flame,
  PieChart,
  Pencil,
  Calendar,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface NutritionReportSectionProps {
  entries: LogEntryItem[];
  periodLabel: string;
  periodRangeLabel: string;
  patientName: string;
  onEditEntry?: (entry: LogEntryItem) => void;
}

interface ParsedNutritionRow {
  entry: LogEntryItem;
  calories: number | null;
  gda: number | null;
  fats: number | null;
  proteins: number | null;
  carbs: number | null;
  exercise: number | null;
  net: number | null;
  note: string;
}

export const NutritionReportSection: React.FC<NutritionReportSectionProps> = ({
  entries,
  periodLabel,
  periodRangeLabel,
  patientName,
  onEditEntry
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Parse fields from notes or values
  const parsedRows: ParsedNutritionRow[] = entries.map((e) => {
    const note = e.note || '';
    const calMatch = note.match(/Calorie:\s*([\d.,]+)/i);
    const gdaMatch = note.match(/% GDA:\s*([\d.,]+)/i);
    const fatMatch = note.match(/Grassi:\s*([\d.,]+)/i);
    const protMatch = note.match(/Proteine:\s*([\d.,]+)/i);
    const carbMatch = note.match(/Carboidrati:\s*([\d.,]+)/i);
    const exerMatch = note.match(/Esercizio:\s*([\d.,]+)/i);
    const netMatch = note.match(/Netto:\s*([\d.,]+)/i);

    const parseNum = (str: string | undefined | null) => {
      if (!str) return null;
      const clean = str.replace(',', '.');
      const val = parseFloat(clean);
      return !isNaN(val) ? val : null;
    };

    let calories = calMatch ? parseNum(calMatch[1]) : (e.unit === 'Cal' || e.unit === 'kcal' ? parseNum(e.value) : null);
    let gda = gdaMatch ? parseNum(gdaMatch[1]) : null;
    let fats = fatMatch ? parseNum(fatMatch[1]) : null;
    let proteins = protMatch ? parseNum(protMatch[1]) : null;
    let carbs = carbMatch ? parseNum(carbMatch[1]) : (e.unit === 'g' ? parseNum(e.value) : null);
    let exercise = exerMatch ? parseNum(exerMatch[1]) : null;
    let net = netMatch ? parseNum(netMatch[1]) : null;

    return {
      entry: e,
      calories,
      gda,
      fats,
      proteins,
      carbs,
      exercise,
      net,
      note
    };
  });

  // Calculate Averages & Totals
  const calValues = parsedRows.map(r => r.calories).filter((v): v is number => v !== null && v > 0);
  const carbValues = parsedRows.map(r => r.carbs).filter((v): v is number => v !== null && v >= 0);
  const protValues = parsedRows.map(r => r.proteins).filter((v): v is number => v !== null && v >= 0);
  const fatValues = parsedRows.map(r => r.fats).filter((v): v is number => v !== null && v >= 0);
  const gdaValues = parsedRows.map(r => r.gda).filter((v): v is number => v !== null && v >= 0);

  const totalCal = calValues.reduce((a, b) => a + b, 0);
  const avgCal = calValues.length > 0 ? Math.round(totalCal / calValues.length) : 0;

  const totalCarbs = carbValues.reduce((a, b) => a + b, 0);
  const avgCarbs = carbValues.length > 0 ? (totalCarbs / carbValues.length) : 0;

  const totalProt = protValues.reduce((a, b) => a + b, 0);
  const avgProt = protValues.length > 0 ? (totalProt / protValues.length) : 0;

  const totalFat = fatValues.reduce((a, b) => a + b, 0);
  const avgFat = fatValues.length > 0 ? (totalFat / fatValues.length) : 0;

  const avgGda = gdaValues.length > 0 ? Math.round(gdaValues.reduce((a, b) => a + b, 0) / gdaValues.length) : 0;

  // Calorie Contribution from Macros (Carbs 4kcal/g, Prot 4kcal/g, Fat 9kcal/g)
  const kcalFromCarbs = avgCarbs * 4;
  const kcalFromProt = avgProt * 4;
  const kcalFromFat = avgFat * 9;
  const totalMacroKcal = kcalFromCarbs + kcalFromProt + kcalFromFat || 1;

  const pctCarbs = Math.round((kcalFromCarbs / totalMacroKcal) * 100);
  const pctProt = Math.round((kcalFromProt / totalMacroKcal) * 100);
  const pctFat = Math.max(0, 100 - pctCarbs - pctProt);

  // SVG Chart: Daily Calorie Bars
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 25, right: 25, bottom: 40, left: 55 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Sort ascending for chart
  const chartRows = [...parsedRows].reverse();
  const maxCal = calValues.length > 0 ? Math.max(...calValues) : 1000;
  const yMax = Math.ceil(maxCal * 1.15 / 100) * 100 || 1000;

  const barWidth = chartRows.length > 0 ? Math.min(36, Math.max(12, (innerWidth / chartRows.length) - 6)) : 20;

  return (
    <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

      {/* Sub-Header Card (styled like Report Digiuno) */}
      <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner shrink-0">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Report Riepilogo Nutrizionale
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-amber-200">{periodLabel}</strong> ({periodRangeLabel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto text-xs text-stone-300 shrink-0">
            <span className="font-mono font-bold text-amber-300 text-sm">{entries.length}</span>
            <span>voci registrate</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Calorie Medie */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl col-span-2 sm:col-span-1 space-y-1">
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Calorie Medie</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-amber-300 font-mono">
              {avgCal > 0 ? avgCal : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">Cal</span>
          </div>
          <span className="text-[10px] text-stone-500 font-mono block mt-1">
            Totale: {totalCal.toLocaleString('it-IT')} Cal
          </span>
        </div>

        {/* % GDA Media */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">% GDA Media</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-white font-mono">
              {avgGda > 0 ? `${avgGda}%` : '-'}
            </span>
          </div>
          <span className="text-[10px] text-stone-500 font-mono block mt-1">
            Fabbisogno Giornaliero
          </span>
        </div>

        {/* Carboidrati */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">Carboidrati</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-teal-300 font-mono">
              {avgCarbs > 0 ? avgCarbs.toFixed(1).replace('.', ',') : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">g</span>
          </div>
          <span className="text-[10px] text-teal-400/80 block mt-1 font-mono">
            {pctCarbs}% calorie
          </span>
        </div>

        {/* Proteine */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Proteine</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-indigo-300 font-mono">
              {avgProt > 0 ? avgProt.toFixed(1).replace('.', ',') : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">g</span>
          </div>
          <span className="text-[10px] text-indigo-400/80 block mt-1 font-mono">
            {pctProt}% calorie
          </span>
        </div>

        {/* Grassi */}
        <div className="p-4 bg-[#131f2d] border border-stone-800 rounded-xl space-y-1">
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">Grassi</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-orange-300 font-mono">
              {avgFat > 0 ? avgFat.toFixed(1).replace('.', ',') : '-'}
            </span>
            <span className="text-xs font-semibold text-stone-400">g</span>
          </div>
          <span className="text-[10px] text-orange-400/80 block mt-1 font-mono">
            {pctFat}% calorie
          </span>
        </div>
      </div>

      {/* Macronutrient Distribution Bar */}
      {(avgCarbs > 0 || avgProt > 0 || avgFat > 0) && (
        <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-amber-400" />
              Distribuzione Energetica dei Macronutrienti
            </h4>
            <span className="text-[11px] text-stone-400 font-mono">
              Media giornaliera stimata
            </span>
          </div>

          {/* Segmented Bar */}
          <div className="w-full h-5 rounded-full overflow-hidden flex bg-black/40 border border-white/10 shadow-inner">
            <div
              style={{ width: `${pctCarbs}%` }}
              className="bg-teal-500 h-full transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              title={`Carboidrati: ${pctCarbs}%`}
            >
              {pctCarbs >= 12 && `${pctCarbs}%`}
            </div>
            <div
              style={{ width: `${pctProt}%` }}
              className="bg-indigo-500 h-full transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              title={`Proteine: ${pctProt}%`}
            >
              {pctProt >= 12 && `${pctProt}%`}
            </div>
            <div
              style={{ width: `${pctFat}%` }}
              className="bg-orange-500 h-full transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              title={`Grassi: ${pctFat}%`}
            >
              {pctFat >= 12 && `${pctFat}%`}
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div className="flex items-center space-x-2.5 bg-black/30 p-3 rounded-xl border border-white/10">
              <span className="w-3 h-3 rounded-full bg-teal-400 shrink-0" />
              <div>
                <span className="font-bold text-white font-mono">Carboidrati: {avgCarbs.toFixed(1)}g</span>
                <p className="text-[11px] text-teal-300/80 font-mono">{pctCarbs}% ({Math.round(kcalFromCarbs)} kcal • 4 kcal/g)</p>
              </div>
            </div>
            <div className="flex items-center space-x-2.5 bg-black/30 p-3 rounded-xl border border-white/10">
              <span className="w-3 h-3 rounded-full bg-indigo-400 shrink-0" />
              <div>
                <span className="font-bold text-white font-mono">Proteine: {avgProt.toFixed(1)}g</span>
                <p className="text-[11px] text-indigo-300/80 font-mono">{pctProt}% ({Math.round(kcalFromProt)} kcal • 4 kcal/g)</p>
              </div>
            </div>
            <div className="flex items-center space-x-2.5 bg-black/30 p-3 rounded-xl border border-white/10">
              <span className="w-3 h-3 rounded-full bg-orange-400 shrink-0" />
              <div>
                <span className="font-bold text-white font-mono">Grassi: {avgFat.toFixed(1)}g</span>
                <p className="text-[11px] text-orange-300/80 font-mono">{pctFat}% ({Math.round(kcalFromFat)} kcal • 9 kcal/g)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SVG Bar Chart: Calorie Timeline */}
      {chartRows.length > 0 && calValues.length > 0 && (
        <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              Apporto Calorico per Registrazione ({periodLabel})
            </h4>
            <div className="flex items-center space-x-3 text-[11px] font-mono text-stone-400">
              <span className="inline-flex items-center gap-1 text-amber-300">
                <span className="w-3 h-3 bg-amber-400 rounded-xs inline-block" /> Calorie (Cal)
              </span>
              <span className="inline-flex items-center gap-1 text-stone-400">
                <span className="w-3 h-0.5 border-b border-dashed border-stone-500 inline-block" /> Media ({avgCal} Cal)
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto bg-black/30 border border-white/10 rounded-xl p-3 relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto max-h-64 select-none"
            >
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + innerHeight * (1 - ratio);
                const val = Math.round(yMax * ratio);
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
              {avgCal > 0 && (
                <line
                  x1={padding.left}
                  y1={padding.top + innerHeight - (avgCal / yMax) * innerHeight}
                  x2={chartWidth - padding.right}
                  y2={padding.top + innerHeight - (avgCal / yMax) * innerHeight}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}

              {/* Bars */}
              {chartRows.map((r, idx) => {
                const cal = r.calories || 0;
                const h = (cal / yMax) * innerHeight;
                const x = padding.left + (idx + 0.5) * (innerWidth / chartRows.length) - barWidth / 2;
                const y = padding.top + innerHeight - h;
                const isHovered = hoveredIndex === idx;

                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(2, h)}
                      rx={4}
                      fill={isHovered ? '#fbbf24' : '#f59e0b'}
                      className="transition-all"
                    />
                    {/* Value on top of bar */}
                    {chartRows.length <= 16 && cal > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill="#fde68a"
                        fontFamily="monospace"
                      >
                        {cal}
                      </text>
                    )}
                    {/* Date label at bottom */}
                    {(chartRows.length <= 16 || idx === 0 || idx === chartRows.length - 1 || idx % Math.ceil(chartRows.length / 8) === 0) && (
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - 12}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#94a3b8"
                        fontFamily="monospace"
                      >
                        {r.entry.date.split('-')[2] || r.entry.date.split('/')[0] || r.entry.date}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Hover details badge */}
            {hoveredIndex !== null && chartRows[hoveredIndex] && (
              <div className="mt-3 p-3 bg-stone-900 border border-stone-700 text-white rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 font-mono shadow-2xl">
                <span className="font-bold text-amber-300">
                  {chartRows[hoveredIndex].entry.date} {chartRows[hoveredIndex].entry.time || ''}
                </span>
                <span>Calorie: <strong className="text-white">{chartRows[hoveredIndex].calories || '-'} Cal</strong></span>
                <span>% GDA: <strong>{chartRows[hoveredIndex].gda !== null ? `${chartRows[hoveredIndex].gda}%` : '-'}</strong></span>
                <span>Carb: <strong className="text-teal-300">{chartRows[hoveredIndex].carbs !== null ? `${chartRows[hoveredIndex].carbs}g` : '-'}</strong></span>
                <span>Prot: <strong className="text-indigo-300">{chartRows[hoveredIndex].proteins !== null ? `${chartRows[hoveredIndex].proteins}g` : '-'}</strong></span>
                <span>Grassi: <strong className="text-orange-300">{chartRows[hoveredIndex].fats !== null ? `${chartRows[hoveredIndex].fats}g` : '-'}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-amber-400" />
            Registro Dettagliato Nutrizione ({parsedRows.length} elementi)
          </h4>
          <span className="text-[11px] text-stone-400 font-mono">
            {periodLabel}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
              <tr>
                <th className="p-3 border-r border-white/10">Data e Ora</th>
                <th className="p-3 border-r border-white/10 text-right">Alimenti (Cal)</th>
                <th className="p-3 border-r border-white/10 text-center">% GDA</th>
                <th className="p-3 border-r border-white/10 text-right">Grassi (g)</th>
                <th className="p-3 border-r border-white/10 text-right">Proteine (g)</th>
                <th className="p-3 border-r border-white/10 text-right">Carboidrati (g)</th>
                <th className="p-3 border-r border-white/10 text-right">Esercizio (Cal)</th>
                <th className="p-3 border-r border-white/10 text-right">Netto (Cal)</th>
                <th className="p-3 border-r border-white/10">Note / Dettagli</th>
                <th className="p-3 text-center print:hidden w-12">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
              {parsedRows.length > 0 ? (
                parsedRows.map((r, idx) => (
                  <tr
                    key={r.entry.id}
                    className={`group ${idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'} hover:bg-white/5 transition-colors ${onEditEntry ? 'cursor-pointer' : ''}`}
                    onClick={() => onEditEntry && onEditEntry(r.entry)}
                  >
                    <td className="p-3 border-r border-white/10 text-[11px]">
                      {r.entry.date} <span className="text-stone-400 font-semibold">{r.entry.time || '12:00'}</span>
                    </td>
                    <td className="p-3 border-r border-white/10 text-right font-black text-amber-300 text-sm">
                      {r.calories !== null ? r.calories : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-center font-bold text-stone-300">
                      {r.gda !== null ? `${r.gda}%` : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-right font-semibold text-orange-300">
                      {r.fats !== null ? r.fats.toFixed(2).replace('.', ',') : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-right font-semibold text-indigo-300">
                      {r.proteins !== null ? r.proteins.toFixed(2).replace('.', ',') : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-right font-semibold text-teal-300">
                      {r.carbs !== null ? r.carbs.toFixed(2).replace('.', ',') : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-right text-emerald-400">
                      {r.exercise !== null ? r.exercise : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-right font-bold text-white">
                      {r.net !== null ? r.net : '-'}
                    </td>
                    <td className="p-3 border-r border-white/10 text-stone-400 font-sans italic">
                      {r.entry.categoryName || r.note || '-'}
                    </td>
                    <td className="p-3 text-center print:hidden" onClick={(ev) => ev.stopPropagation()}>
                      {onEditEntry && (
                        <button
                          type="button"
                          onClick={() => onEditEntry(r.entry)}
                          className="p-1 text-stone-400 hover:text-amber-300 hover:bg-white/10 rounded transition-colors inline-block cursor-pointer"
                          title="Modifica voce"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-stone-400 italic">
                    Nessun dato nutrizionale registrato per il periodo selezionato ({periodLabel}).
                  </td>
                </tr>
              )}
            </tbody>
            {parsedRows.length > 0 && (
              <tfoot className="bg-black/60 border-t border-white/10 font-bold text-stone-200 text-xs font-mono">
                <tr>
                  <td className="p-3 border-r border-white/10 font-sans">Medie / Totali</td>
                  <td className="p-3 border-r border-white/10 text-right text-amber-300 font-black">
                    Med: {avgCal} Cal
                  </td>
                  <td className="p-3 border-r border-white/10 text-center">
                    {avgGda > 0 ? `${avgGda}%` : '-'}
                  </td>
                  <td className="p-3 border-r border-white/10 text-right text-orange-300">
                    {avgFat > 0 ? avgFat.toFixed(1).replace('.', ',') : '-'}g
                  </td>
                  <td className="p-3 border-r border-white/10 text-right text-indigo-300">
                    {avgProt > 0 ? avgProt.toFixed(1).replace('.', ',') : '-'}g
                  </td>
                  <td className="p-3 border-r border-white/10 text-right text-teal-300">
                    {avgCarbs > 0 ? avgCarbs.toFixed(1).replace('.', ',') : '-'}g
                  </td>
                  <td className="p-3 border-r border-white/10 text-right" colSpan={4}>
                    Totale Calorie: {totalCal.toLocaleString('it-IT')} Cal
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};
