import { hhmm } from "../lib/theme";
import type { EventConfig } from "../types";

interface Props {
  config: EventConfig;
  onClose: () => void;
}

/** 상단 "스탬프 적립 현황" 옆 물음표로 여는 안내. 규칙을 한 곳에 모아 둔다. */
export default function Help({ config, onClose }: Props) {
  const open = hhmm(config.stamp_opens_at);
  const close = hhmm(config.stamp_closes_at);
  const dead = hhmm(config.ticket_deadline);
  const draw = hhmm(config.draw_at);

  return (
    <div className="ov">
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="스탬프 투어 안내">
        <div className="grab" />
        <div className="hd">
          <span className="badge" style={{ color: "var(--muted)" }}>
            안내
          </span>
          <button className="closex" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="bd">
          <div>
            <h3>스탬프 투어</h3>
          </div>

          <div className="blk">
            <div className="k">참여 방법</div>
            <p>
              지도나 목록에서 부스를 선택해 소개와 미션을 확인하세요
              <br />
              <b>미션 완료</b>시 스탬프 1개가 적립됩니다.
            </p>
          </div>

          <div className="blk">
            <div className="k">보상</div>
            <div className="rw">
              <div className="r">
                <span className="n">7개</span>
                <span className="d">응모권 1장</span>
              </div>
              <div className="r">
                <span className="n">13개</span>
                <span className="d">
                  응모권 1장 + 굿즈
                  <em>굿즈(타투 스티커)는 총학생회 본부에서 수령 가능합니다.</em>
                </span>
              </div>
            </div>
            <p style={{ marginTop: 10 }}>
              누적 스탬프 7개, 13개 적립 시 응모권 한장씩, 1인당 응모권은 최대 2장입니다.
            </p>
          </div>

          <div className="blk">
            <div className="k">시간</div>
            {/* 응모권 마감과 추첨 시각이 다르므로 줄을 나눠 못박는다 */}
            <div className="rw">
              <div className="r">
                <span className="n">적립</span>
                <span className="d">
                  {open} ~ {close}
                </span>
              </div>
              <div className="r">
                <span className="n">응모권</span>
                <span className="d">
                  {dead} 마감
                  <em>19시 이후 달성 시 굿즈만 받으실 수 있습니다.</em>
                </span>
              </div>
              <div className="r">
                <span className="n">추첨</span>
                <span className="d">
                  {draw}
                  <em>럭키드로우 · 아티스트 공연 직전</em>
                </span>
              </div>
            </div>
          </div>

        </div>

        <div className="ft">
          <button className="primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
