import type { Booth } from "../types";
import type { InfoKey } from "../components/InfoSheet";
import { CATEGORY_LABEL, LEGEND_CATEGORIES } from "../types";
import { CAT_VAR } from "../lib/theme";

/** 부스 좌표는 이 viewBox 기준 비율로 DB에 들어 있다 */
const VW = 880;
const VH = 1500;

interface Props {
  booths: Booth[];
  stamps: Map<string, string>;
  onPick: (booth: Booth) => void;
  /** 스탬프 대상이 아니지만 안내가 필요한 곳(주류 부스·총학생회) */
  onInfo: (which: InfoKey) => void;
}

/** 글자 폭을 em 단위로 어림잡는다 — 한글은 한 칸, 라틴·숫자는 반 칸 남짓 */
function em(s: string) {
  let t = 0;
  for (const c of s) {
    if (/\s/.test(c)) t += 0.3;
    else if (/[()[\].,·:!?]/.test(c)) t += 0.45;
    else if (/[A-Za-z0-9+\-/&]/.test(c)) t += 0.56;
    else t += 1;
  }
  return t;
}

/** 이름을 n줄로 나눈다. 끊을 수 있는 자리 중 가장 긴 줄이 짧아지는 조합을 고른다 */
function splitLines(name: string, n: number): string[] | null {
  if (n === 1) return [name];
  const parts = name.split(/(?<=\s)|(?<=-)/).filter(Boolean);
  if (parts.length < n) return null;

  const found: { widest: number; lines: string[] }[] = [];
  const cuts: number[] = [];
  const pick = (start: number, left: number) => {
    if (left === 0) {
      const idx = [0, ...cuts, parts.length];
      const lines: string[] = [];
      for (let i = 0; i < n; i++) lines.push(parts.slice(idx[i], idx[i + 1]).join("").trim());
      if (lines.some((l) => !l)) return;
      found.push({ widest: Math.max(...lines.map(em)), lines });
      return;
    }
    for (let i = start; i <= parts.length - left; i++) {
      cuts.push(i);
      pick(i + 1, left - 1);
      cuts.pop();
    }
  };
  pick(1, n - 1);
  if (found.length === 0) return null;
  found.sort((x, y) => x.widest - y.widest);
  return found[0].lines;
}

/**
 * 부스 이름이 잘리지 않도록 줄 수와 글자 크기를 함께 고른다.
 * 줄을 늘리면 한 줄이 짧아져 글자를 키울 수 있고, 대신 높이를 더 쓴다.
 */
function fitName(name: string, w: number, h: number, pad: number) {
  const availW = w - pad * 2;
  const availH = h - 34; // 위쪽 번호 자리를 뺀 높이
  const CAP = 26;
  const MAX_LINES = 2;
  let best = { fs: 0, lines: [name] };
  for (let n = 1; n <= MAX_LINES; n++) {
    const lines = splitLines(name, n);
    if (!lines) continue;
    const widest = Math.max(...lines.map(em));
    const fs = Math.min(CAP, availW / widest, availH / (n * 1.24));
    if (fs > best.fs + 0.01) best = { fs, lines };
  }
  return best;
}

function Inert({
  x,
  y,
  w,
  h,
  label,
  fs = 26,
  onOpen,
  tint,
  inRow,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fs?: number;
  /** 주면 눌러서 안내를 열 수 있는 칸이 된다 */
  onOpen?: () => void;
  /** 카테고리 색을 입힌다. 스탬프 부스는 아니지만 분류는 같은 곳에 쓴다 */
  tint?: string;
  /** 아래쪽 한 줄에 놓이는 칸. 부스 칩과 글자 높이를 맞춘다 */
  inRow?: boolean;
}) {
  const body = (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={tint ?? "var(--surface-2)"}
        fillOpacity={tint ? 0.42 : 1}
        stroke={tint ?? "var(--map-inert)"}
        strokeWidth={2}
      />
      <text
        x={x + w / 2}
        y={inRow ? y + 26 + (h - 34) / 2 + fs * 0.22 : y + h / 2 + fs * 0.35}
        fontSize={fs}
        textAnchor="middle"
        fill={tint ? "var(--ink-2)" : "var(--map-inert-ink)"}
      >
        {label}
      </text>
    </>
  );

  if (!onOpen) return <g>{body}</g>;
  return (
    <g
      className="chip"
      role="button"
      tabIndex={0}
      aria-label={`${label} 안내 보기`}
      color="var(--map-inert-ink)"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {body}
    </g>
  );
}

function Chip({
  booth,
  no,
  done,
  onPick,
  maxFs,
}: {
  booth: Booth;
  no: number;
  done: boolean;
  onPick: () => void;
  /** 같은 줄의 칸들끼리 글자 크기를 맞출 때 쓰는 상한 */
  maxFs?: number;
}) {
  const x = booth.map_x * VW;
  const y = booth.map_y * VH;
  const w = booth.map_w * VW;
  const h = booth.map_h * VH;
  const wide = w >= 180;
  const pad = wide ? 14 : 10;
  const name = booth.name || booth.team;
  const tint = CAT_VAR[booth.category];
  const fit = fitName(name, w, h, pad);
  const fs = Math.min(fit.fs, maxFs ?? Infinity);
  const lines = fit.lines;
  const lh = fs * 1.24;
  const top = y + 26 + Math.max(0, (h - 34 - lines.length * lh) / 2);
  const ink = done ? "var(--surface)" : "var(--ink)";
  const r = wide ? 13 : 11;

  return (
    <g
      className="chip"
      role="button"
      tabIndex={0}
      aria-label={`${name} ${done ? "완료" : "미완료"}`}
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
        fillOpacity={done ? 1 : 0.42}
        stroke={done ? "var(--stamp)" : tint}
        strokeWidth={2}
      />
      <text
        x={x + pad}
        y={y + 22}
        fontSize={16}
        fontWeight={700}
        fill={ink}
        opacity={done ? 0.85 : 0.7}
      >
        {no}
      </text>
      {lines.map((line, i) => (
        <text
          key={i}
          x={wide ? x + pad : x + w / 2}
          y={top + lh * i + fs * 0.84}
          fontSize={fs.toFixed(1)}
          textAnchor={wide ? "start" : "middle"}
          fill={done ? "var(--surface)" : "var(--ink-2)"}
        >
          {line}
        </text>
      ))}
      {done && (
        <g transform={`translate(${x + w - r - 8} ${y + r + 8}) rotate(-12)`}>
          <circle r={r} fill="none" stroke="var(--surface)" strokeWidth={2.2} />
          <path
            d={`M${(-r * 0.42).toFixed(1)} 0 L${(-r * 0.12).toFixed(1)} ${(r * 0.34).toFixed(1)} L${(r * 0.46).toFixed(1)} ${(-r * 0.34).toFixed(1)}`}
            fill="none"
            stroke="var(--surface)"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

export default function MapView({ booths, stamps, onPick, onInfo }: Props) {
  const legend = LEGEND_CATEGORIES;

  /** 아래쪽 한 줄은 칸 폭이 제각각이라, 가장 작은 글자에 맞춰 크기를 통일한다 */
  const inRow = (b: Booth) => b.map_y > 0.75 && b.map_h > 0.08;
  const rowSizes = booths
    .filter(inRow)
    .map((b) => {
      const w = b.map_w * VW;
      return fitName(b.name || b.team, w, b.map_h * VH, w >= 180 ? 14 : 10).fs;
    });
  const rowFs = rowSizes.length ? Math.min(...rowSizes) : 26;

  return (
    <div className="mapwrap">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="달빛제 부스 배치도">
        <Inert x={40} y={34} w={150} h={58} label="보건소" />
        <rect x={275} y={26} width={330} height={74} rx={8} fill="var(--stage)" />
        <text x={440} y={74} fontSize={34} textAnchor="middle" fill="#F0E6FA" letterSpacing={6}>
          STAGE
        </text>

        {legend.map((key, i) => (
          <g key={key} transform={`translate(330 ${575 + i * 50})`}>
            <rect
              width={28}
              height={28}
              rx={6}
              fill={CAT_VAR[key]}
              fillOpacity={0.42}
              stroke={CAT_VAR[key]}
              strokeWidth={2}
            />
            <text x={40} y={22} fontSize={25} fill="var(--map-inert-ink)">
              {CATEGORY_LABEL[key]} 부스
            </text>
          </g>
        ))}

        {booths.map((b, i) => (
          <Chip
            key={b.id}
            booth={b}
            no={i + 1}
            done={stamps.has(b.id)}
            onPick={() => onPick(b)}
            maxFs={inRow(b) ? rowFs : undefined}
          />
        ))}

        {/* 스탬프 대상이 아닌 곳들 */}
        <Inert
          x={493}
          y={1215}
          w={110}
          h={130}
          label="주류 판매"
          fs={rowFs}
          inRow
          onOpen={() => onInfo("liquor")}
        />
        <Inert
          x={610}
          y={1215}
          w={70}
          h={130}
          label="일화"
          fs={rowFs}
          inRow
          tint={CAT_VAR.promotion}
          onOpen={() => onInfo("ilhwa")}
        />

        <rect
          x={40}
          y={1545}
          width={290}
          height={40}
          rx={6}
          fill="var(--surface-2)"
          stroke="var(--map-inert)"
          strokeWidth={2}
        />
        <text x={185} y={1427} fontSize={24} textAnchor="middle" fill="var(--map-inert-ink)">
          관람석
        </text>
        <rect
          x={510}
          y={1545}
          width={190}
          height={40}
          rx={6}
          fill="var(--surface-2)"
          stroke="var(--map-inert)"
          strokeWidth={2}
        />
        <text x={605} y={1427} fontSize={24} textAnchor="middle" fill="var(--map-inert-ink)">
          관람석
        </text>

        {/* 굿즈를 받는 곳이라 눈에 띄어야 한다 */}
        <g
          className="chip"
          role="button"
          tabIndex={0}
          aria-label="총학생회 안내 보기"
          onClick={() => onInfo("hq")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onInfo("hq");
            }
          }}
        >
          <rect x={340} y={1370} width={160} height={90} rx={10} fill="var(--hq)" />
          <text x={420} y={1410} fontSize={27} textAnchor="middle" fill="#FFFFFF">
            총학생회
          </text>
          <text x={420} y={1440} fontSize={22} textAnchor="middle" fill="#EBDDF3">
            굿즈 수령
          </text>
        </g>

      </svg>
    </div>
  );
}
