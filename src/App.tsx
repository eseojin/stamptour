import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import {
  amOperator,
  claimStamp,
  fetchBooths,
  fetchConfig,
  fetchMyStamps,
  fetchMyTickets,
  myNickname,
  peekBooth,
} from "./lib/api";
import { hhmm, untilText } from "./lib/theme";
import type { Booth, EventConfig, Ticket } from "./types";
import Signup from "./screens/Signup";
import MapView from "./screens/MapView";
import Me from "./screens/Me";
import Admin from "./screens/Admin";
import BoothSheet from "./components/BoothSheet";
import Help from "./components/Help";
import Reward from "./components/Reward";
import InfoSheet, { type InfoKey } from "./components/InfoSheet";

// QR 인식 라이브러리(@zxing)는 번들의 대부분을 차지한다.
// 축제 현장 셀룰러에서 첫 화면이 느려지지 않도록, 스캐너를 처음 열 때 내려받는다.
const Scanner = lazy(() => import("./components/Scanner"));

/**
 * 휴대폰 기본 카메라로 QR을 찍으면 /s/<토큰> 으로 들어온다.
 * 인앱 브라우저에서 앱 내 카메라가 막히는 경우가 많아, 이 경로가 중요한 대체 수단이다.
 * 주소에서 토큰만 빼두고 주소창은 바로 정리한다.
 */
const ENTRY_TOKEN = (() => {
  const m = location.pathname.match(/^\/s\/([A-Za-z0-9]{6,})\/?$/);
  if (!m) return null;
  history.replaceState(null, "", "/");
  return m[1];
})();

type Tab = "map" | "me" | "admin";
type Overlay =
  | { kind: "sheet"; booth: Booth; token?: string }
  | { kind: "scan"; booth: Booth }
  | { kind: "reward"; tier: 7 | 13; serial: number | null }
  | { kind: "help" }
  | { kind: "info"; which: InfoKey }
  | null;

export default function App() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [isOperator, setIsOperator] = useState(false);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [stamps, setStamps] = useState<Map<string, string>>(new Map());
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [tab, setTab] = useState<Tab>("map");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [scanFail, setScanFail] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [entryToken, setEntryToken] = useState<string | null>(ENTRY_TOKEN);

  /* 1분마다 남은 시간 갱신 */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* 세션 감시 */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [nick, op, bs, cfg, st, tk] = await Promise.all([
        myNickname(),
        amOperator(),
        fetchBooths(),
        fetchConfig(),
        fetchMyStamps(),
        fetchMyTickets(),
      ]);
      setNickname(nick ?? "");
      setIsOperator(op);
      setBooths(bs);
      setConfig(cfg);
      setStamps(new Map(st.map((s) => [s.booth_id, s.earned_at])));
      setTickets(tk);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (signedIn) void loadAll();
  }, [signedIn, loadAll]);

  /* /s/<토큰> 으로 들어왔으면 해당 부스 팝업을 연다 */
  useEffect(() => {
    if (!entryToken || booths.length === 0) return;
    const token = entryToken;
    setEntryToken(null);
    void (async () => {
      try {
        const r = await peekBooth(token);
        if (!r.ok) {
          setToast("인식할 수 없는 QR입니다.");
          setTimeout(() => setToast(null), 2600);
          return;
        }
        const booth = booths.find((b) => b.id === r.booth_id);
        if (booth) setOverlay({ kind: "sheet", booth, token });
      } catch {
        /* 조회 실패는 조용히 무시하고 평소 화면을 보여준다 */
      }
    })();
  }, [entryToken, booths]);

  const boothNo = useMemo(() => {
    const m = new Map<string, number>();
    booths.forEach((b, i) => m.set(b.id, i + 1));
    return m;
  }, [booths]);

  const count = stamps.size;
  const opensAt = config ? new Date(config.stamp_opens_at).getTime() : 0;
  const closesAt = config ? new Date(config.stamp_closes_at).getTime() : 0;
  const stampOpen = !!config && now >= opensAt && now <= closesAt;
  const beforeOpen = !!config && now < opensAt;
  const untilDeadline = config ? untilText(config.ticket_deadline, now) : null;

  /* ---------- 적립 ---------- */
  async function handleToken(booth: Booth, token: string) {
    try {
      const r = await claimStamp(booth.id, token);
      if (!r.ok) {
        if (r.error === "BOOTH_MISMATCH") {
          setScanFail(
            `${r.scanned_booth ?? "다른"} 부스의 QR입니다. 이 부스의 QR을 찍어 주세요.`
          );
        } else if (r.error === "NOT_STARTED") {
          setScanFail("스탬프 적립은 15:00부터 시작됩니다.");
        } else if (r.error === "EVENT_CLOSED") {
          setScanFail("스탬프 적립이 22:00에 종료되었습니다.");
        } else {
          setScanFail("인식할 수 없는 QR입니다. 부스 운영자에게 문의해 주세요.");
        }
        return;
      }

      await loadAll();
      const earned = r.new_tickets[r.new_tickets.length - 1];
      if (earned) {
        setOverlay({ kind: "reward", tier: earned.tier, serial: earned.serial });
      } else {
        setOverlay(null);
        const n = r.stamp_count;
        const next =
          n < 7
            ? `7회까지 ${7 - n}개`
            : n < 13
              ? `13회까지 ${13 - n}개`
              : "모든 보상을 받았습니다";
        setToast(
          `${booth.name || booth.team} ${booth.minigame ? "미션 완료" : "스탬프 적립"} · ${next}` +
            (!r.tickets_open && n < 13 ? " (응모권은 마감)" : "")
        );
        setTimeout(() => setToast(null), 2600);
      }
      setScanFail(null);
    } catch (e) {
      setScanFail(e instanceof Error ? e.message : "처리하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  /* ---------- 화면 ---------- */
  if (!ready) {
    return (
      <div className="app">
        <div className="boot">
          <div className="spin" />
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="app">
        <Signup onDone={() => setSignedIn(true)} />
      </div>
    );
  }

  if (fatal) {
    return (
      <div className="app">
        <div className="boot">
          <div className="errbox">
            불러오지 못했습니다.
            <br />
            {fatal}
          </div>
          <button className="ghost" style={{ maxWidth: 200 }} onClick={() => location.reload()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!config || booths.length === 0) {
    return (
      <div className="app">
        <div className="boot">
          <div className="spin" />
          <p>부스 정보를 불러오는 중입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 럭키드로우 안내와 진행 막대를 한 덩어리로 묶는다 */}
      <div className="hero">
        <div className="herotop">
          <span className="t serif">{hhmm(config.ticket_deadline)}</span>
          <span className="lab">
            럭키드로우 추첨 <span className="paren">(아티스트 공연 직전)</span>
          </span>
          <span className="left">
            {untilDeadline ? <>마감까지 {untilDeadline}</> : "응모권 마감"}
          </span>
        </div>

        <div className="herobars">
          <div className="barhead">
            <span className="lb">
              스탬프 적립 현황
              <button
                className="whatis"
                aria-label="스탬프 투어 안내"
                onClick={() => setOverlay({ kind: "help" })}
              >
                ?
              </button>
            </span>
            <span className="cnt">{count} / 13</span>
          </div>
          {/* 0~13 하나의 막대. 7회 지점에 홈을 내어 첫 보상 위치를 표시한다 */}
          <div className="onebar">
            <span className="track">
              <span
                className={`fill${count >= 13 ? " done" : ""}`}
                style={{ width: `${(Math.min(count, 13) / 13) * 100}%` }}
              />
              <span className="notch" />
            </span>
            <span className={`mark7${count >= 7 ? " hit" : ""}`}>7회</span>
          </div>
        </div>
      </div>

      {tab === "admin" && isOperator ? (
        <Admin />
      ) : (
      <div className={tab === "map" ? "scroll mapscroll" : "scroll"}>
        {tab === "me" ? (
          <Me
            nickname={nickname}
            booths={booths}
            stamps={stamps}
            tickets={tickets}
          />
        ) : (
          <MapView
            booths={booths}
            stamps={stamps}
            onPick={(b) => setOverlay({ kind: "sheet", booth: b })}
            onInfo={(which) => setOverlay({ kind: "info", which })}
          />
        )}
      </div>
      )}

      <div className="tabbar">
        <button aria-current={tab === "map" ? "page" : "false"} onClick={() => setTab("map")}>
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
            <path d="M9 4v14M15 6v14" />
          </svg>
          지도
        </button>
        <button aria-current={tab === "me" ? "page" : "false"} onClick={() => setTab("me")}>
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
            <path d="M2.5 10.5h19" strokeDasharray="2 2" />
          </svg>
          내 정보
        </button>
        {isOperator && (
          <button aria-current={tab === "admin" ? "page" : "false"} onClick={() => setTab("admin")}>
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 19V9M9.3 19V4M14.7 19v-8M20 19v-5" strokeLinecap="round" />
            </svg>
            관리자
          </button>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {overlay?.kind === "sheet" && (
        <BoothSheet
          booth={overlay.booth}
          no={boothNo.get(overlay.booth.id) ?? 0}
          done={stamps.get(overlay.booth.id) ? hhmm(stamps.get(overlay.booth.id)!) : null}
          stampOpen={stampOpen}
          beforeOpen={beforeOpen}
          onClose={() => setOverlay(null)}
          hasToken={!!overlay.token}
          onScan={() => {
            setScanFail(null);
            // QR 주소로 들어온 경우엔 토큰을 이미 아니까 카메라를 열지 않는다
            if (overlay.token) void handleToken(overlay.booth, overlay.token);
            else setOverlay({ kind: "scan", booth: overlay.booth });
          }}
        />
      )}

      {overlay?.kind === "scan" && (
        <Suspense
          fallback={
            <div className="ov">
              <div className="scanner">
                <div className="view">
                  <div className="spin" />
                </div>
              </div>
            </div>
          }
        >
          <Scanner
          booth={overlay.booth}
          failure={scanFail}
          onClose={() => {
            setOverlay(null);
            setScanFail(null);
          }}
          onDecode={(token) => void handleToken(overlay.booth, token)}
          onManual={(code) => void handleToken(overlay.booth, code)}
          />
        </Suspense>
      )}

      {overlay?.kind === "info" && (
        <InfoSheet which={overlay.which} onClose={() => setOverlay(null)} />
      )}

      {overlay?.kind === "help" && (
        <Help config={config} boothCount={booths.length} onClose={() => setOverlay(null)} />
      )}

      {overlay?.kind === "reward" && (
        <Reward
          tier={overlay.tier}
          serial={overlay.serial}
          nickname={nickname}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}
