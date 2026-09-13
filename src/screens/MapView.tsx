import type { Booth } from "../types";
import { CAT_VAR } from "../lib/theme";

const VW = 880;
const VH = 1430;

interface Props {
  booths: Booth[];
  stamps: Map<string, string>;
  onPick: (booth: Booth) => void;
}

function Inert({
  x,
  y,
  w,
  h,
  label,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="var(--surface-2)"
        stroke="var(--line)"
        strokeWidth={2}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + (sub ? -2 : 9)}
        fontSize={26}
        textAnchor="middle"
        fill="var(--muted)"
      >
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 26} fontSize={21} textAnchor="middle" fill="var(--muted)">
          {sub}
        </text>
      )}
    </g>
  );
}

function Chip({
  booth,
  no,
  done,
  onPick,
}: {
  booth: Booth;
  no: number;
  done: boolean;
  onPick: () => void;
}) {
  const x = booth.map_x * VW;
  const y = booth.map_y * VH;
  const w = booth.map_w * VW;
  const h = booth.map_h * VH;
  const wide = w >= 150;
  const raw = booth.name || booth.team;
  const label = wide ? (raw.length > 7 ? raw.slice(0, 6) + "…" : raw) : raw.trim().slice(0, 4);
  const tint = CAT_VAR[booth.category];

  return (
    <g
      className="chip"
      role="button"
      tabIndex={0}
      aria-label={`${raw} ${done ? "완료" : "미완료"}`}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <rect
        className="bg"
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={done ? "var(--stamp)" : tint}
        fillOpacity={done ? 1 : 0.2}
        stroke={done ? "var(--stamp)" : tint}
        strokeWidth={2}
      />
      {wide ? (
        <>
          <text x={x + 13} y={y + 34} fontSize={24} fontWeight={700} fill={done ? "var(--surface)" : "var(--ink)"}>
            {no}
          </text>
          <text x={x + 13} y={y + 66} fontSize={26} fill={done ? "var(--surface)" : "var(--ink-2)"}>
            {label}
          </text>
        </>
      ) : (
        <>
          <text
            x={x + w / 2}
            y={y + 40}
            fontSize={30}
            fontWeight={700}
            textAnchor="middle"
            fill={done ? "var(--surface)" : "var(--ink)"}
          >
            {no}
          </text>
          <text
            x={x + w / 2}
            y={y + 70}
            fontSize={20}
            textAnchor="middle"
            fill={done ? "var(--surface)" : "var(--ink-2)"}
          >
            {label}
          </text>
        </>
      )}
      {done && (
        <g
          transform={
            wide
              ? `translate(${x + w - 28} ${y + 28}) rotate(-12)`
              : `translate(${x + w - 16} ${y + 16}) rotate(-12)`
          }
        >
          <circle r={wide ? 15 : 10.5} fill="none" stroke="var(--surface)" strokeWidth={wide ? 2.5 : 2} />
          <path
            d={wide ? "M-6.5 0 L-2 5.5 L7.5 -5.5" : "M-4.5 0 L-1.5 3.8 L5.2 -3.8"}
            fill="none"
            stroke="var(--surface)"
            strokeWidth={wide ? 3 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

export default function MapView({ booths, stamps, onPick }: Props) {
  const legend: [string, keyof typeof CAT_VAR][] = [
    ["Food", "food"],
    ["Bar", "bar"],
    ["Activity", "activity"],
    ["Promotion", "promotion"],
  ];

  return (
    <div className="mapwrap">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="달빛제 부스 배치도">
        <Inert x={40} y={34} w={210} h={58} label="달성군 보건소" />
        <rect x={300} y={26} width={330} height={74} rx={8} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
        <text x={465} y={72} fontSize={34} textAnchor="middle" fill="var(--ink-2)" letterSpacing={4}>
          STAGE
        </text>
        <line x1={465} y1={112} x2={465} y2={1200} stroke="var(--line)" strokeWidth={2} strokeDasharray="9 9" />

        {legend.map(([label, key], i) => (
          <g key={key} transform={`translate(348 ${560 + i * 46})`}>
            <rect
              width={26}
              height={26}
              rx={5}
              fill={CAT_VAR[key]}
              fillOpacity={0.2}
              stroke={CAT_VAR[key]}
              strokeWidth={2}
            />
            <text x={36} y={21} fontSize={25} fill="var(--muted)">
              {label}
            </text>
          </g>
        ))}

        {booths.map((b, i) => (
          <Chip key={b.id} booth={b} no={i + 1} done={stamps.has(b.id)} onPick={() => onPick(b)} />
        ))}

        <Inert x={374} y={1240} w={86} h={100} label="술" sub="판매" />
        <Inert x={576} y={1240} w={86} h={100} label="일화"/>

        <rect x={40} y={1368} width={380} height={40} rx={6} fill="none" stroke="var(--line)" strokeWidth={2} />
        <text x={230} y={1394} fontSize={24} textAnchor="middle" fill="var(--muted)">
          관람석
        </text>
        <rect x={510} y={1368} width={330} height={40} rx={6} fill="none" stroke="var(--line)" strokeWidth={2} />
        <text x={675} y={1394} fontSize={24} textAnchor="middle" fill="var(--muted)">
          관람석
        </text>
        <Inert x={424} y={1358} w={82} h={60} label="총학" sub="본부" />
      </svg>
    </div>
  );
}
