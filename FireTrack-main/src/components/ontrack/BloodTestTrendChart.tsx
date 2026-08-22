import React, { useState } from 'react';
import { BloodTestParameter, BloodTestRecord } from '../../types/ontrack';
import { formatParamRangeLabel, evaluateBloodParam } from '../../utils/ontrackStorage';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { TrendingUp, Check, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';

interface BloodTestTrendChartProps {
  records: BloodTestRecord[];
  parameters: BloodTestParameter[];
  initialParamId?: string;
}

export const BloodTestTrendChart: React.FC<BloodTestTrendChartProps> = ({
  records,
  parameters,
  initialParamId
}) => {
  const [selectedParamId, setSelectedParamId] = useState<string>(
    initialParamId || (parameters[0]?.id ?? 'glucose')
  );

  const selectedParam = parameters.find(p => p.id === selectedParamId) || parameters[0];

  if (!selectedParam) return null;

  // Prepare chronological chart data (oldest to newest)
  const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);

  const chartData = sortedRecords
    .map(r => {
      const val = r.values[selectedParam.id] ?? 
        (selectedParam.id === 'acr' ? r.values['microalbuminuria'] : undefined) ?? 
        r.values[selectedParam.name.toLowerCase()] ?? 
        null;
      if (val === null || val === undefined) return null;

      const evalRes = evaluateBloodParam(val, selectedParam);
      return {
        date: r.date,
        value: val,
        status: evalRes.status,
        isGreen: evalRes.isGreen,
        notes: r.notes || '',
        // For range visualization
        rangeMin: selectedParam.min ?? undefined,
        rangeMax: selectedParam.max ?? undefined,
      };
    })
    .filter(Boolean) as {
      date: string;
      value: number;
      status: string;
      isGreen: boolean;
      notes: string;
      rangeMin?: number;
      rangeMax?: number;
    }[];

  // Calculate domain min/max
  const values = chartData.map(d => d.value);
  const minVal = values.length > 0 ? Math.min(...values, selectedParam.min ?? 0) : 0;
  const maxVal = values.length > 0 ? Math.max(...values, selectedParam.max ?? 100) : 100;
  const yPadding = (maxVal - minVal) * 0.15 || 10;
  const yDomainMin = Math.max(0, Math.floor(minVal - yPadding));
  const yDomainMax = Math.ceil(maxVal + yPadding);

  // Latest value evaluation
  const latestItem = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
      
      {/* Parameter Selector & Status Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
              Andamento Temporale: {selectedParam.name}
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Range di riferimento: <span className="font-bold text-purple-700 dark:text-purple-400">{formatParamRangeLabel(selectedParam)}</span> {selectedParam.unit}
            </p>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 hidden sm:inline">Esame:</label>
          <select
            value={selectedParamId}
            onChange={(e) => setSelectedParamId(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-300"
          >
            {parameters.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {formatParamRangeLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Latest Value Banner */}
      {latestItem && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          latestItem.isGreen
            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            <span className="font-semibold">Ultimo Valore ({latestItem.date}):</span>
            <span className="font-mono font-bold text-sm">{String(latestItem.value).replace('.', ',')} {selectedParam.unit}</span>
          </div>
          <div className="flex items-center space-x-1 font-bold">
            {latestItem.isGreen ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Nel Range Ottimale</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>{latestItem.status === 'high' ? 'Superiore al range' : 'Inferiore al range'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-stone-50 dark:bg-stone-900 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-stone-400 text-xs">
          Nessun dato registrato per {selectedParam.name}
        </div>
      ) : (
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              
              <YAxis 
                domain={[yDomainMin, yDomainMax]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />

              {/* Target Range Green Highlight Area */}
              {selectedParam.conditionType === 'range' && selectedParam.min !== undefined && selectedParam.max !== undefined && (
                <ReferenceArea
                  {...({
                    y1: selectedParam.min,
                    y2: selectedParam.max,
                    fill: "#86efac",
                    fillOpacity: 0.25,
                    stroke: "#22c55e",
                    strokeDasharray: "2 2",
                    strokeOpacity: 0.6
                  } as any)}
                />
              )}

              {selectedParam.conditionType === 'max_only' && selectedParam.max !== undefined && (
                <ReferenceArea
                  {...({
                    y1: 0,
                    y2: selectedParam.max,
                    fill: "#86efac",
                    fillOpacity: 0.2,
                    stroke: "#22c55e",
                    strokeDasharray: "2 2",
                    strokeOpacity: 0.6
                  } as any)}
                />
              )}

              {selectedParam.conditionType === 'min_only' && selectedParam.min !== undefined && (
                <ReferenceArea
                  {...({
                    y1: selectedParam.min,
                    y2: yDomainMax,
                    fill: "#86efac",
                    fillOpacity: 0.2,
                    stroke: "#22c55e",
                    strokeDasharray: "2 2",
                    strokeOpacity: 0.6
                  } as any)}
                />
              )}

              {/* Min Reference Line */}
              {selectedParam.min !== undefined && (
                <ReferenceLine 
                  y={selectedParam.min} 
                  stroke="#16a34a" 
                  strokeDasharray="3 3" 
                  label={{ value: `Min: ${selectedParam.min}`, fill: '#16a34a', fontSize: 10, position: 'right' }} 
                />
              )}

              {/* Max Reference Line */}
              {selectedParam.max !== undefined && (
                <ReferenceLine 
                  y={selectedParam.max} 
                  stroke="#dc2626" 
                  strokeDasharray="3 3" 
                  label={{ value: `Max: ${selectedParam.max}`, fill: '#dc2626', fontSize: 10, position: 'right' }} 
                />
              )}

              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#1e293b] text-white p-2.5 rounded-xl text-xs shadow-xl border border-stone-700 space-y-1">
                        <div className="font-bold text-stone-300">{data.date}</div>
                        <div className="font-mono text-sm font-bold flex items-center space-x-1">
                          <span>{selectedParam.name}:</span>
                          <span className={data.isGreen ? 'text-emerald-400' : 'text-rose-400'}>
                            {String(data.value).replace('.', ',')} {selectedParam.unit}
                          </span>
                        </div>
                        <div className={`text-[10px] font-semibold ${data.isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {data.isGreen ? '✅ All\'interno del range' : `⚠️ ${data.status === 'high' ? 'Superiore alla soglia' : 'Inferiore alla soglia'}`}
                        </div>
                        {data.notes && (
                          <div className="text-[10px] text-stone-400 pt-1 border-t border-stone-700">
                            {data.notes}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Main Line with Custom Dots */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#9333ea"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={payload.isGreen ? '#22c55e' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 7, stroke: '#9333ea', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 pt-1 text-[11px] text-stone-500">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span>Valore nel Range</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
          <span>Valore Fuori Range</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-2 bg-emerald-200 border border-emerald-400 inline-block"></span>
          <span>Fascia di Sicurezza</span>
        </div>
      </div>

    </div>
  );
};
