interface Props {
  tier: 7 | 13;
  serial: number | null;
  nickname: string;
  onClose: () => void;
}

/** 달빛제 공지물의 이중선 프레임. 응모권을 받는 이 순간에만 쓴다 */
function Frame() {
  return (
    <div className="frame" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function Seal() {
  return (
    <div className="seal" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5 9.5 17 19 7"
          stroke="#F0E6FA"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Reward({ tier, serial, onClose }: Props) {
  const noSerial = serial === null;
  return (
    <div className="ov">
      <div className="scrim" onClick={onClose} />
      <div className="result" role="dialog" aria-modal="true">
        <Frame />
        <Seal />
        <div className="kicker">{tier}회 달성</div>

        {tier === 7 ? (
          <>
            <h3>응모권을 받았습니다</h3>
            <div className="bigserial serif">
              {serial}
              <small>번</small>
            </div>
            <p>
              19:30 럭키드로우에 이 번호로 참여합니다.
              <br />
              13회를 채우면 응모권 1장과 굿즈를 더 받습니다.
            </p>
          </>
        ) : (
          <>
            <h3>{noSerial ? "굿즈 수령 대상입니다" : "응모권과 굿즈를 받았습니다"}</h3>
            {noSerial ? (
              <p>
                응모권 발급은 19:30에 마감되어
                <br />
                굿즈만 받으실 수 있습니다.
              </p>
            ) : (
              <>
                <div className="bigserial serif">
                  {serial}
                  <small>번</small>
                </div>
                <p>19:30 럭키드로우에 이 번호로 참여합니다.</p>
              </>
            )}
            <div className="goodsbox">
              <b>굿즈 수령</b>
              <br />
              총학생회 본부에서 타투 스티커를 받으실 수 있습니다.
            </div>
          </>
        )}

        <div className="acts">
          <button className="primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
