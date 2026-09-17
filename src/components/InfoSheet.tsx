/** 스탬프 대상이 아니지만 현장에서 찾아가야 하는 곳들 — 지도에서 눌러 열어본다 */
export type InfoKey = "liquor" | "hq" | "viking";

interface Props {
  which: InfoKey;
  onClose: () => void;
}

function Liquor() {
  return (
    <>
      <div>
        <h3>GS25 주류 부스</h3>
        <div className="team">달빛제에서 주류를 구매할 수 있는 곳입니다</div>
      </div>

      <div className="blk">
        <div className="k">구매 안내</div>
        <p>
          부스에서 <b>신분증 확인 후</b> 주류 구매가 가능하며, 1인당 구매 개수에는 제한이
          없습니다.
        </p>
      </div>

      <div className="blk">
        <div className="k">메뉴</div>
        <ul className="pricelist">
          <li>
            <span>참이슬 640mL 페트</span>
            <em>3,300원</em>
          </li>
          <li>
            <span>TERRA 500mL 캔</span>
            <em>2,800원</em>
          </li>
          <li>
            <span>지평 생쌀 막걸리</span>
            <em>2,300원</em>
          </li>
        </ul>
      </div>
    </>
  );
}

function Hq() {
  return (
    <>
      <div>
        <h3>총학생회 첫비</h3>
        <div className="team">스탬프투어 상품 수령 · 안내 · 굿즈 판매</div>
      </div>

      <div className="blk mission">
        <div className="k">스탬프투어 상품</div>
        <p>
          13회를 채우면 이곳에서 <b>타투 스티커</b>를 받습니다. 닉네임을 말씀해 주세요.
        </p>
      </div>

      <div className="blk">
        <div className="k">첫비 본부</div>
        <p>행사 안내와 분실물 보관을 맡습니다.</p>
      </div>

      <div className="blk">
        <div className="k">첫비 STORE · 굿즈 판매</div>
        <ul className="pricelist">
          <li>
            <span>슬로건</span>
            <em>5,000원</em>
          </li>
          <li>
            <span>반다나</span>
            <em>
              납부자 5,000원
              <br />
              비납부자 6,000원
            </em>
          </li>
          <li>
            <span>스트랩 키링</span>
            <em>
              납부자 4,500원
              <br />
              비납부자 5,500원
            </em>
          </li>
        </ul>
        <p className="foot">굿즈는 입장팔찌 배부소의 첫비 STORE에서 판매합니다.</p>
      </div>
    </>
  );
}

function Viking() {
  return (
    <>
      <div>
        <h3>바이킹</h3>
        <div className="team">24번 일화 부스 이벤트</div>
      </div>

      <div className="blk mission">
        <div className="k">스탬프</div>
        <p>
          바이킹을 <b>1회 탑승</b>하면 일화 부스의 스탬프를 받을 수 있습니다.
        </p>
      </div>

      <div className="blk">
        <div className="k">탑승 요금</div>
        <ul className="pricelist">
          <li>
            <span>가격</span>
            <em>4,000원</em>
          </li>
          <li>
            <span>VIP</span>
            <em>무료 (학생회비 납부자)</em>
          </li>
        </ul>
      </div>
    </>
  );
}

export default function InfoSheet({ which, onClose }: Props) {
  return (
    <div className="ov">
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <div className="hd">
          <span className="badge plain">안내</span>
          <button className="closex" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="bd">
          {which === "liquor" ? <Liquor /> : which === "viking" ? <Viking /> : <Hq />}
        </div>

        <div className="ft">
          <button className="ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
