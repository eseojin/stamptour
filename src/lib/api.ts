import { supabase, nicknameToEmail, normalizeNickname } from "../supabase";
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

/** 마지막으로 시작한 닉네임. 프로필 저장이 실패했을 때 되살리는 데 쓴다 */
const NICK_KEY = "dalbit-stamp-nick";

function rememberNick(nick: string) {
  try {
    localStorage.setItem(NICK_KEY, nick);
  } catch {
    /* 사파리 시크릿 모드 등에서 막힐 수 있다. 저장이 안 돼도 흐름은 그대로 간다 */
  }
}

function rememberedNick(): string | null {
  try {
    return localStorage.getItem(NICK_KEY);
  } catch {
    return null;
  }
}

/**
 * Supabase 인증은 같은 IP 기준으로 초당 몇 건까지만 받는다.
 * 축제 와이파이나 통신사 NAT 뒤에서는 수백 명이 한 IP로 보이기 때문에
 * 15:00 직후처럼 몰리는 순간에 429 가 날 수 있다. 몇 초 안에 한도가 회복되므로
 * 사용자에게 실패를 보여주기 전에 조용히 다시 시도한다.
 */
function isRateLimited(err: { message?: string; status?: number } | null) {
  if (!err) return false;
  if (err.status === 429) return true;
  return /rate limit|too many requests/i.test(err.message ?? "");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function authWithRetry<T extends { error: { message?: string; status?: number } | null }>(
  run: () => Promise<T>,
  tries = 4
): Promise<T> {
  let res = await run();
  for (let i = 0; i < tries - 1 && isRateLimited(res.error); i++) {
    // 0.7s → 1.4s → 2.8s, 여기에 흔들림을 더해 재시도가 다시 겹치지 않게 한다
    await wait(700 * 2 ** i + Math.random() * 600);
    res = await run();
  }
  return res;
}

/**
 * 시작하기 버튼 하나로 처리한다.
 *  - 처음이면 계정을 만들고,
 *  - 이미 쓰던 닉네임이면 같은 비밀번호로 이어서 들어간다.
 * 기기를 바꾸거나 캐시를 지운 사람도 똑같이 닉네임+비밀번호만 넣으면 복구된다.
 */
export async function startOrResume(nickname: string, pin: string) {
  const nick = normalizeNickname(nickname);
  const email = nicknameToEmail(nick);
  rememberNick(nick);

  const { data, error } = await authWithRetry(() =>
    supabase.auth.signUp({ email, password: pin })
  );

  // 이미 있는 닉네임. Supabase 는 설정에 따라 에러를 주기도 하고,
  // 이메일 열거 방지 때문에 세션 없는 응답을 주기도 해서 둘 다 처리한다.
  const taken = !!error && /already|registered|exists/i.test(error.message);
  if (taken || (!error && !data.session)) {
    const { error: inErr } = await authWithRetry(() =>
      supabase.auth.signInWithPassword({ email, password: pin })
    );
    if (inErr) {
      if (isRateLimited(inErr)) throw new Error(BUSY_MSG);
      throw new Error(
        "이미 쓰고 있는 닉네임입니다. 본인 것이면 비밀번호를 확인하고, 아니면 다른 닉네임을 써 주세요."
      );
    }
    // 예전에 가입은 됐지만 프로필 저장이 끊겼던 사람을 여기서 되살린다
    await ensureProfile(nick);
    return; // 기존 계정으로 이어하기 성공
  }

  if (error) {
    if (isRateLimited(error)) throw new Error(BUSY_MSG);
    throw new Error(error.message);
  }
  if (!data.user) throw new Error("계정을 만들지 못했습니다. 다시 시도해 주세요.");

  const { error: pErr } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, nickname: nick });
  // 23505 = 닉네임 중복. 위에서 이어하기로 걸러지므로 여기 오면 드문 경합 상황이다.
  // 그 밖의 실패(네트워크 끊김 등)는 여기서 막지 않는다. 프로필이 없으면
  // 다음 실행 때 ensureProfile 이 다시 만들어 주므로, 굿즈 수령이 막히지 않는다.
  if (pErr && pErr.code !== "23505") {
    console.warn("프로필 저장 실패, 다음 실행에서 다시 시도합니다", pErr.message);
  }
}

const BUSY_MSG =
  "접속이 몰려 잠시 밀리고 있습니다. 5초쯤 뒤에 시작하기를 다시 눌러 주세요.";

/**
 * 로그인은 됐는데 profiles 행이 없는 상태를 고친다.
 * 가입 직후 네트워크가 끊기면 이 상태가 되고, 그대로 두면 닉네임이 없어
 * 운영자가 굿즈 지급 화면에서 찾을 수 없다.
 */
export async function ensureProfile(nickname?: string): Promise<string | null> {
  const existing = await myNickname();
  if (existing) {
    rememberNick(existing);
    return existing;
  }

  const nick = normalizeNickname(nickname ?? rememberedNick() ?? "");
  if (!nick) return null;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const { error } = await supabase.from("profiles").insert({ id: uid, nickname: nick });
  if (error && error.code !== "23505") return null;
  return nick;
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
    p_nickname: normalizeNickname(nickname),
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
