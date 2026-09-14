import { supabase, nicknameToEmail } from "../supabase";
import type {
  AdminRow,
  AdminStats,
  Booth,
  ClaimResult,
  EventConfig,
  GoodsResult,
  Stamp,
  Ticket,
} from "../types";

/* ---------------- 인증 ---------------- */

/**
 * 시작하기 버튼 하나로 처리한다.
 *  - 처음이면 계정을 만들고,
 *  - 이미 쓰던 닉네임이면 같은 비밀번호로 이어서 들어간다.
 * 기기를 바꾸거나 캐시를 지운 사람도 똑같이 닉네임+비밀번호만 넣으면 복구된다.
 */
export async function startOrResume(nickname: string, pin: string) {
  const nick = nickname.trim();
  const email = nicknameToEmail(nick);

  const { data, error } = await supabase.auth.signUp({ email, password: pin });

  // 이미 있는 닉네임. Supabase 는 설정에 따라 에러를 주기도 하고,
  // 이메일 열거 방지 때문에 세션 없는 응답을 주기도 해서 둘 다 처리한다.
  const taken = !!error && /already|registered|exists/i.test(error.message);
  if (taken || (!error && !data.session)) {
    const { error: inErr } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (inErr) {
      throw new Error(
        "이미 쓰고 있는 닉네임입니다. 본인 것이면 비밀번호를 확인하고, 아니면 다른 닉네임을 써 주세요."
      );
    }
    return; // 기존 계정으로 이어하기 성공
  }

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("계정을 만들지 못했습니다. 다시 시도해 주세요.");

  const { error: pErr } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, nickname: nick });
  // 23505 = 닉네임 중복. 위에서 이어하기로 걸러지므로 여기 오면 드문 경합 상황이다.
  if (pErr && pErr.code !== "23505") throw new Error(pErr.message);
}

export async function myNickname(): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("nickname").maybeSingle();
  return data?.nickname ?? null;
}

export async function amOperator(): Promise<boolean> {
  const { data } = await supabase.from("operators").select("user_id").maybeSingle();
  return !!data;
}

/* ---------------- 조회 ---------------- */

export async function fetchBooths(): Promise<Booth[]> {
  const { data, error } = await supabase
    .from("booths")
    .select(
      "id,name,team,category,description,menu,minigame,map_x,map_y,map_w,map_h,sort_order"
    )
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as Booth[];
}

export async function fetchConfig(): Promise<EventConfig> {
  const { data, error } = await supabase
    .from("event_config")
    .select("stamp_opens_at,stamp_closes_at,ticket_deadline")
    .single();
  if (error) throw new Error(error.message);
  return data as EventConfig;
}

export async function fetchMyStamps(): Promise<Stamp[]> {
  const { data, error } = await supabase
    .from("stamps")
    .select("booth_id,earned_at")
    .order("earned_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Stamp[];
}

export async function fetchMyTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("tier,serial,issued_at,goods_claimed_at")
    .order("tier");
  if (error) throw new Error(error.message);
  return (data ?? []) as Ticket[];
}

/* ---------------- 적립 ---------------- */

/**
 * 스탬프 적립. 부스 일치 확인, 중복 방지, 임계치 도달 시 응모권 발급까지
 * 서버 함수 한 번에 처리된다 (schema.sql 의 claim_stamp).
 */
export async function claimStamp(
  boothId: string,
  token: string
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_stamp", {
    p_booth_id: boothId,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data as ClaimResult;
}

/**
 * QR 토큰이 어느 부스 것인지 조회. 휴대폰 기본 카메라로 QR을 찍어
 * /s/<토큰> 으로 들어왔을 때, 해당 부스 팝업을 열어 주기 위해 쓴다.
 */
export async function peekBooth(
  token: string
): Promise<{ ok: true; booth_id: string; name: string } | { ok: false }> {
  const { data, error } = await supabase.rpc("peek_booth", { p_token: token });
  if (error) throw new Error(error.message);
  return data;
}

export async function claimGoods(nickname: string): Promise<GoodsResult> {
  const { data, error } = await supabase.rpc("claim_goods", {
    p_nickname: nickname.trim(),
  });
  if (error) throw new Error(error.message);
  return data as GoodsResult;
}

/* ---------------- 운영자 전용 조회 ---------------- */

/** 전체 현황. RLS 를 우회해야 해서 서버 함수로 받고, 함수가 운영자 여부를 확인한다. */
export async function adminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) throw new Error(error.message);
  return data as AdminStats;
}

export async function adminParticipants(query: string): Promise<AdminRow[]> {
  const { data, error } = await supabase.rpc("admin_participants", {
    p_query: query.trim() || null,
    p_limit: 300,
  });
  if (error) throw new Error(error.message);
  const r = data as { ok: boolean; rows?: AdminRow[] };
  return r.ok ? (r.rows ?? []) : [];
}

/* ---------------- QR 페이로드 ---------------- */

/**
 * QR 에는 https://<도메인>/s/<토큰> 이 들어간다.
 * 휴대폰 기본 카메라로 찍어도 웹으로 연결되도록 URL 형태를 쓰고,
 * 앱 안에서 스캔했을 때는 여기서 토큰만 뽑아낸다.
 * 수동 입력 코드는 onManual 경로로 따로 전달된다.
 */
export function extractToken(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const m = text.match(/\/s\/([A-Za-z0-9]{8,})\/?$/);
  if (m) return m[1];
  if (/^[a-f0-9]{32}$/i.test(text)) return text;
  return null;
}
