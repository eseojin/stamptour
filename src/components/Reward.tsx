interface Props {
  tier: 7 | 13;
  serial: number | null;
  nickname: string;
  onClose: () => void;
}

function Seal() {
  return (
    <svg className="seal" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g transform="rotate(-10 32 32)">
        <circle cx="32" cy="32" r="27" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="32" cy="32" r="21" stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 4" />
        <path
          d="M22 32.5 L29 40 L43 24"
          stroke="var(--ink)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export default function Reward({ tier, serial, nickname, onClose }: Props) {
  const noSerial = serial === null;
  return (
    <div className="ov">
      <div className="scrim" onClick={onClose} />
      <div className="result" role="dialog" aria-modal="true">
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
              <p style={{ marginTop: 10 }}>
                응모권 발급은 19:30에 마감되어
                <br />
                이번에는 굿즈만 받으실 수 있습니다.
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
              총학생회 본부에서 <b>{nickname}</b> 이름을 말씀하시면 됩니다. 내 정보 화면에서
              언제든 다시 확인할 수 있습니다.
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
