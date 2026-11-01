"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; views: number; uniques: number };

const fmtDay = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

/** Série única: título do card nomeia a série, sem legenda. Crosshair + tooltip no hover. */
export function ViewsChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="date" tickFormatter={fmtDay} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} minTickGap={24} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={48} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-medium">{fmtDay(p.date)}</p>
                  <p className="text-foreground">
                    <span className="tabular-nums font-semibold">{p.views.toLocaleString("pt-BR")}</span> visualizações
                  </p>
                  <p className="text-muted-foreground">
                    <span className="tabular-nums">{p.uniques.toLocaleString("pt-BR")}</span> visitantes únicos
                  </p>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} fill="url(#viewsFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
