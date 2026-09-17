import { useCallback, useEffect, useState } from "react";
import { adminParticipants, adminStats, claimGoods } from "../lib/api";
import { hhmm } from "../lib/theme";
import type { AdminRow, AdminStats, GoodsResult } from "../types";

type Pane = "stats" | "people" | "goods";

/**
 * 운영자 전용 탭.
 * 전체 현황과 참가자 목록은 RLS 를 우회해야 해서 서버 함수(admin_stats / admin_participants)로 받는다.
 * 두 함수 모두 operators 소속을 확인하므로, 참가자가 이 화면을 억지로 열어도 아무 데이터도 오지 않는다.
 */
export default function Admin() {
  const [pane, setPane] = useState<Pane>("stats");

  return (
    <>
      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={pane === "stats"} onClick={() => setPane("stats")}>
          현황
        </button>
        <button role="tab" aria-selected={pane === "people"} onClick={() => setPane("people")}>
          참가자
        </button>
        <button role="tab" aria-selected={pane === "goods"} onClick={() => setPane("goods")}>
          굿즈 지급
        </button>
      </div>

      <div className="scroll">
        {pane === "stats" ? <StatsPane /> : pane === "people" ? <PeoplePane /> : <GoodsPane />}
      </div>
    </>
  );
}

/* ---------------- 현황 ---------------- */

function StatsPane() {
  const [st, setSt] = useState<AdminStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSt(await adminStats());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000); // 행사 중에는 30초마다 갱신
    return () => clearInterval(t);
  }, [load]);

  if (err) return <div className="admin"><div className="res">{err}</div></div>;
  if (!st) return <div className="boot"><div className="spin" /></div>;
  if (!st.ok) return <div className="admin"><div className="res">운영자 계정이 아닙니다.</div></div>;

  const max = Math.max(1, ...st.booths.map((b) => b.count));

  return (
    <div className="admin">
      {/* 추첨에 필요한 건 "번호가 몇 번까지 나갔는가" 하나다 */}
      <div className="ticketbox">
        <div className="k">발급된 응모권</div>
        <div className="v">{st.tickets.toLocaleString()}<span className="u">장</span></div>
        <div className="s">
          {st.last_serial > 0 ? <>번호 <b>1 ~ {st.last_serial}</b> 사용 중</> : "아직 발급 전"}
        </div>
      </div>

      <div className="statgrid">
        <Stat k="참가자" v={st.participants} />
        <Stat k="굿즈 지급" v={st.goods_claimed} />
        <Stat k="굿즈 미수령" v={st.goods_pending} />
      </div>

      <div className="pills">
        <span className={`pill${st.stamp_open ? " on" : ""}`}>
          {st.stamp_open ? "적립 진행 중" : "적립 시간 아님"}
        </span>
        <span className={`pill${st.tickets_open ? " on" : ""}`}>
          {st.tickets_open ? "응모권 발급 중" : "응모권 마감 · 굿즈만"}
        </span>
      </div>

      {st.no_serial > 0 && (
        <p className="note">
          {st.no_serial}명은 19:30 이후에 13회를 채워 응모권 번호 없이 굿즈만 받습니다.
          추첨 대상에는 들어가지 않습니다.
        </p>
      )}

      <div>
        <div className="sechead" style={{ marginBottom: 10 }}>부스별 적립</div>
        <div className="boothstats">
          {st.booths.map((b) => (
            <div className="brow" key={b.no}>
              <span className="bno">{b.no}</span>
              <span className="bnm">{b.name}</span>
              <span className="btrack">
                <span className="bfill" style={{ width: `${(b.count / max) * 100}%` }} />
              </span>
              <span className="bcnt">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: number; sub?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v.toLocaleString()}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

/* ---------------- 참가자 ---------------- */

function PeoplePane() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await adminParticipants(q);
        if (alive) { setRows(r); setErr(null); }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "불러오지 못했습니다.");
      }
    }, 220); // 입력할 때마다 때리지 않도록 잠깐 모아서 보낸다
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  return (
    <div className="admin">
      <div className="field">
        <label htmlFor="pq">닉네임 검색</label>
        <input
          id="pq"
          value={q}
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {err && <div className="res">{err}</div>}
      {!rows ? (
        <div className="boot" style={{ height: 120 }}><div className="spin" /></div>
      ) : rows.length === 0 ? (
        <div className="emptystate">해당하는 참가자가 없습니다.</div>
      ) : (
        <>
          <div className="sechead">{rows.length}명</div>
          <div className="ptable">
            {rows.map((r) => (
              <div className="prow" key={r.nickname}>
                <span className="pnick">
                  {r.nickname}
                  {r.operator && <span className="tagop">운영자</span>}
                </span>
                <span className="pstamp">{r.stamps}개</span>
                <span className="ptick">
                  {r.t7 !== null && <span className="tk">7회 {r.t7}번</span>}
                  {r.has13 && (
                    <span className="tk">{r.t13 !== null ? `13회 ${r.t13}번` : "13회 (번호없음)"}</span>
                  )}
                </span>
                <span className="pgoods">
                  {!r.has13 ? "" : r.goods ? `수령 ${hhmm(r.goods)}` : "굿즈 미수령"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- 굿즈 지급 ---------------- */

function GoodsPane() {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GoodsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nick.trim() || busy) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      setRes(await claimGoods(nick));
      setNick("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin">
      <p className="note" style={{ marginTop: 0 }}>
        참가자가 말한 닉네임을 입력하세요. 13회를 채운 참가자만 지급 대상이며,
        이미 받아 간 경우 다시 지급되지 않습니다.
      </p>

      <form onSubmit={submit} className="field">
        <label htmlFor="opnick">닉네임</label>
        <input
          id="opnick"
          value={nick}
          autoComplete="off"
          placeholder="참가자 닉네임"
          onChange={(e) => setNick(e.target.value)}
        />
        <button className="primary" type="submit" disabled={!nick.trim() || busy}>
          {busy ? "확인 중…" : "지급 처리"}
        </button>
      </form>

      {err && <div className="res">{err}</div>}

      {res &&
        (res.ok ? (
          <div className="res ok">
            <b>{res.nickname}</b> 지급 완료
            <br />
            {res.serial === null ? "19:30 이후 달성 — 응모권 없이 굿즈만" : `13회 응모권 ${res.serial}번`}
          </div>
        ) : (
          <div className="res">
            {res.error === "ALREADY_CLAIMED" && (
              <>이미 수령했습니다{res.claimed_at && <> · {hhmm(res.claimed_at)}</>}</>
            )}
            {res.error === "NOT_ELIGIBLE" && (
              <>아직 지급 대상이 아닙니다 · 현재 스탬프 {res.stamp_count ?? 0}개 (13개 필요)</>
            )}
            {res.error === "NO_SUCH_USER" && <>그런 닉네임이 없습니다. 철자를 확인해 주세요.</>}
            {res.error === "NOT_OPERATOR" && <>이 계정은 운영자로 등록되어 있지 않습니다.</>}
          </div>
        ))}
    </div>
  );
}
