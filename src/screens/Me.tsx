import type { Booth, Ticket } from "../types";
import { hhmm } from "../lib/theme";

interface Props {
  nickname: string;
  booths: Booth[];
  stamps: Map<string, string>;
  tickets: Ticket[];
  isOperator: boolean;
  onOpenAdmin: () => void;
}

function TicketCard({ tier, ticket, nickname }: { tier: 7 | 13; ticket?: Ticket; nickname: string }) {
  const label = `${tier}회 응모권`;

  if (!ticket) {
    return (
      <div className="ticket empty">
        <div className="meta">
          <div className="tier">{label}</div>
          <div className="desc">
            {tier}회 달성 시 발급{tier === 13 ? " · 굿즈 포함" : ""}
          </div>
        </div>
        <div className="serial" style={{ opacity: 0.35 }}>
          —
        </div>
      </div>
    );
  }

  return (
    <div className="ticket">
      <div className="meta">
        <div className="tier">{label}</div>
        <div className="desc">
          {ticket.serial === null
            ? "19:30 이후 달성 — 응모권 없이 굿즈 수령 대상"
            : `${hhmm(ticket.issued_at)} 발급`}
        </div>
        {tier === 13 && (
          <div className="goods">
            {ticket.goods_claimed_at ? (
              <>굿즈 수령 완료 · {hhmm(ticket.goods_claimed_at)}</>
            ) : (
              <>
                굿즈는 총학생회 본부에서 수령 가능합니다.
              </>
            )}
          </div>
        )}
      </div>
      <div className="serial serif">
        {ticket.serial === null ? (
          "—"
        ) : (
          <>
            {ticket.serial}
            <small>번</small>
          </>
        )}
      </div>
    </div>
  );
}

export default function Me({
  nickname,
  booths,
  stamps,
  tickets,
  isOperator,
  onOpenAdmin,
}: Props) {
  const t7 = tickets.find((t) => t.tier === 7);
  const t13 = tickets.find((t) => t.tier === 13);
  const mine = booths
    .map((b, i) => ({ b, no: i + 1 }))
    .filter(({ b }) => stamps.has(b.id));

  return (
    <div className="me">
      <div className="idcard">
        <div className="k">닉네임</div>
        <div className="v">{nickname}</div>
      </div>

      <TicketCard tier={7} ticket={t7} nickname={nickname} />
      <TicketCard tier={13} ticket={t13} nickname={nickname} />

      <div>
        <div className="sechead" style={{ marginBottom: 8 }}>
          획득한 스탬프 {mine.length}개
        </div>
        {mine.length ? (
          <div className="stamplist">
            {mine.map(({ b, no }) => (
              <div key={b.id}>
                {no}. {b.name || b.team}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: "20px 0" }}>
            아직 없습니다. 지도에서 부스를 골라 미션을 시작하세요.
          </div>
        )}
      </div>

      {isOperator && (
        <button className="ghost" onClick={onOpenAdmin}>
          굿즈 지급 화면 열기
        </button>
      )}
    </div>
  );
}
