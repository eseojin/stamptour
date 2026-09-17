import { CATEGORY_LABEL, type Booth } from "../types";
import { CAT_VAR } from "../lib/theme";

interface Props {
  booth: Booth;
  no: number;
  done: string | null;
  stampOpen: boolean;
  beforeOpen: boolean;
  /** QR 주소(/s/<토큰>)로 들어와 토큰을 이미 아는 경우 — 카메라가 필요 없다 */
  hasToken?: boolean;
  onClose: () => void;
  onScan: () => void;
}

export default function BoothSheet({
  booth,
  no,
  done,
  stampOpen,
  beforeOpen,
  hasToken,
  onClose,
  onScan,
}: Props) {
  return (
    <div className="ov">
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={booth.name || booth.team}>
        <div className="grab" />
        <div className="hd">
          {CATEGORY_LABEL[booth.category] && (
            <span className="badge" style={{ background: CAT_VAR[booth.category] }}>
              {CATEGORY_LABEL[booth.category]} 부스
            </span>
          )}
          <button className="closex" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="bd">
          <div>
            <h3>{booth.name || "(부스명 미정)"}</h3>
            {/* 바이킹처럼 부스명과 팀명이 같으면 한 번만 보여 준다 */}
            <div className="team">
              {no}번{booth.team && booth.team !== booth.name ? ` · ${booth.team}` : ""}
            </div>
          </div>

          <div className="blk">
            <div className="k">부스 소개</div>
            {booth.description ? (
              <p>{booth.description}</p>
            ) : (
              <p style={{ color: "var(--muted)" }}>소개글이 아직 등록되지 않았습니다.</p>
            )}
          </div>

          {booth.menu && (
            <div className="blk">
              <div className="k">대표 메뉴</div>
              <p>{booth.menu}</p>
            </div>
          )}

          {/* 일화처럼 미션이 따로 없는 부스는 미션 칸 자체를 두지 않는다 */}
          {booth.minigame && (
            <div className="blk mission">
              <div className="k">미션</div>
              <p>{booth.minigame}</p>
            </div>
          )}
        </div>

        <div className="ft">
          {done ? (
            <button className="ghost" disabled style={{ opacity: 0.55 }}>
              완료됨 · {done}
            </button>
          ) : !stampOpen ? (
            <button className="ghost" disabled style={{ opacity: 0.55 }}>
              {beforeOpen ? "15:00부터 적립할 수 있습니다" : "스탬프 적립이 종료되었습니다"}
            </button>
          ) : (
            <button className="primary" onClick={onScan}>
              {booth.minigame
                ? hasToken
                  ? "QR 확인됨 · 미션 완료"
                  : "미션 완료"
                : hasToken
                  ? "QR 확인됨 · 스탬프 받기"
                  : "스탬프 받기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
