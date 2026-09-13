import { useState } from "react";
import { claimGoods } from "../lib/api";
import { hhmm } from "../lib/theme";
import type { GoodsResult } from "../types";

/**
 * 총학생회 본부 굿즈 지급 창구.
 * operators 테이블에 등록된 계정만 claim_goods 를 호출할 수 있으므로
 * 이 화면도 일반 anon 키로 동작한다 (service_role 키를 브라우저에 두지 않는다).
 */
export default function Admin({ onBack }: { onBack: () => void }) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GoodsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nick.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setRes(null);
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
    <>
      <div className="inbanner">
        <b>운영자 화면</b> 굿즈 지급
        <button className="linkbtn" onClick={onBack}>
          참가자 화면으로
        </button>
      </div>

      <div className="scroll">
        <div className="admin">
          <h2>굿즈 지급</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
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
                {res.serial === null
                  ? "19:30 이후 달성 — 응모권 없이 굿즈만"
                  : `13회 응모권 ${res.serial}번`}
              </div>
            ) : (
              <div className="res">
                {res.error === "ALREADY_CLAIMED" && (
                  <>
                    이미 수령했습니다
                    {res.claimed_at && <> · {hhmm(res.claimed_at)}</>}
                  </>
                )}
                {res.error === "NOT_ELIGIBLE" && (
                  <>
                    아직 지급 대상이 아닙니다 · 현재 스탬프 {res.stamp_count ?? 0}개 (13개 필요)
                  </>
                )}
                {res.error === "NO_SUCH_USER" && <>그런 닉네임이 없습니다. 철자를 확인해 주세요.</>}
                {res.error === "NOT_OPERATOR" && (
                  <>이 계정은 운영자로 등록되어 있지 않습니다.</>
                )}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
