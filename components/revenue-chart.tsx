'use client';
import { useState } from 'react';
import { peso } from '@/lib/dates';

const C_DIRECT = '#2a6fdb', C_AIRBNB = '#e0457b'; // validated: CVD ΔE 15.5, normal ΔE 30.2

export function RevenueChart({ data }: { data: { month: string; direct: number; airbnb: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.direct + d.airbnb));
  const nice = Math.ceil(max / 5000) * 5000;
  const W = 640, H = 220, L = 44, B = 24, T = 8;
  const bw = (W - L) / data.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const label = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' });
  return <div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
      <div className="flex gap-3"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_DIRECT }} />Facebook / Direct</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_AIRBNB }} />Airbnb</span></div>
      <button className="underline" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
    </div>
    {table ? <table className="w-full text-sm"><thead><tr className="text-left text-stone-500"><th>Month</th><th>Direct</th><th>Airbnb</th><th>Total</th></tr></thead><tbody>{data.map((d) => <tr key={d.month} className="border-t"><td className="py-1">{d.month}</td><td>{peso(d.direct)}</td><td>{peso(d.airbnb)}</td><td className="font-semibold">{peso(d.direct + d.airbnb)}</td></tr>)}</tbody></table> :
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue per month, last 12 months, stacked by source" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W} y1={y(nice * f)} y2={y(nice * f)} stroke="#e7e5e4" /><text x={L - 6} y={y(nice * f) + 4} textAnchor="end" fontSize="10" fill="#78716c">{nice * f >= 1000 ? `${Math.round((nice * f) / 1000)}k` : 0}</text></g>)}
          {data.map((d, i) => {
            const x = L + i * bw + bw * 0.2, w = bw * 0.6;
            const yd = y(d.direct), ya = y(d.direct + d.airbnb);
            return <g key={d.month} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill={hover === i ? '#f5f5f4' : 'transparent'} />
              {d.direct > 0 && <rect x={x} y={yd} width={w} height={Math.max(0, y(0) - yd)} fill={C_DIRECT} rx={d.airbnb > 0 ? 0 : 3} />}
              {d.airbnb > 0 && <rect x={x} y={ya} width={w} height={Math.max(0, yd - ya - 2)} fill={C_AIRBNB} rx={3} />}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#78716c">{label(d.month)}</text>
            </g>;
          })}
          <line x1={L} x2={W} y1={y(0)} y2={y(0)} stroke="#a8a29e" />
        </svg>
        {hover !== null && <div className="pointer-events-none absolute top-0 rounded-lg border bg-white px-3 py-2 text-xs shadow" style={{ left: `${Math.min(70, ((L + hover * bw) / W) * 100)}%` }}>
          <div className="font-semibold">{data[hover].month}</div>
          <div>Direct: {peso(data[hover].direct)}</div><div>Airbnb: {peso(data[hover].airbnb)}</div>
          <div className="font-semibold">Total: {peso(data[hover].direct + data[hover].airbnb)}</div>
        </div>}
      </div>}
  </div>;
}
