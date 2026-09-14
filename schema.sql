-- 달빛제 스탬프투어 Supabase 스키마 (Postgres 16 검증 완료)
-- 적용: Supabase Dashboard > SQL Editor 에 그대로 붙여넣기
-- v0.6 — 응모권 번호를 티어별이 아닌 전체 공용 1개 시퀀스로 변경
-- v0.5 — 행사일 2026-09-18(금), 적립 15:00~22:00,
--        응모권 발급은 19:30 마감 (이후 13회 달성자는 굿즈만 수령)
--        운영자 권한을 operators 테이블로 관리 (service_role 키를 브라우저에 두지 않기 위함)

-- 행사 시간 규칙 (행사 당일 코드 수정 없이 조정 가능)
create table event_config (
  id              int primary key default 1,
  stamp_opens_at  timestamptz not null,   -- 스탬프 적립 시작
  stamp_closes_at timestamptz not null,   -- 스탬프 적립 종료
  ticket_deadline timestamptz not null,   -- 응모권 발급 마감 (럭키드로우 추첨 시각)
  constraint event_config_single_row check (id = 1)
);
insert into event_config (stamp_opens_at, stamp_closes_at, ticket_deadline) values
  ('2026-09-18 15:00+09', '2026-09-18 22:00+09', '2026-09-18 19:30+09');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text unique not null,
  created_at  timestamptz not null default now()
);

create table booths (
  id           text primary key,          -- 'food-01'
  name         text not null,             -- 부스명 (현수막 이름)
  team         text not null,             -- 동아리/팀명
  category     text not null,             -- food | bar | activity | promotion
  description  text,                      -- 소개글
  menu         text,                      -- 대표 메뉴
  minigame     text,                      -- 미니게임 설명
  map_x numeric, map_y numeric,           -- 지도 비율 좌표 (0~1)
  map_w numeric, map_h numeric,
  is_active    boolean not null default true,
  sort_order   int
);

-- 부스 QR 비밀 토큰 (클라이언트 접근 전면 차단)
create table booth_secrets (
  booth_id   text primary key references booths(id) on delete cascade,
  qr_token   text unique not null,        -- 난수 32자
  short_code text unique not null         -- 수동 입력용 6자리 (카메라 실패 대비)
);

-- 스탬프: 유저 × 부스 1회
create table stamps (
  user_id   uuid not null references profiles(id) on delete cascade,
  booth_id  text not null references booths(id),
  earned_at timestamptz not null default now(),
  source    text not null default 'qr',   -- qr | manual
  primary key (user_id, booth_id)
);

-- 응모권 발급대장 (1인 최대 2장: tier 7, tier 13)
-- tier 는 "어떻게 받았는지"만 뜻하고, 번호(serial)는 전체에서 하나의 연속 수열이다.
create table tickets (
  id              bigserial primary key,
  user_id         uuid not null references profiles(id) on delete cascade,
  tier            smallint not null,      -- 7 | 13
  serial          int,                    -- 1부터 순서대로. NULL = 19:30 이후 달성 → 응모권 없이 굿즈 자격만
  issued_at       timestamptz not null default now(),
  goods_claimed_at timestamptz,           -- tier 13 굿즈 수령 시각 (총학 본부에서 체크)
  constraint tickets_tier_chk check (tier in (7, 13)),
  unique (user_id, tier)                  -- 1인 1티어 1장 (최대 2장)
);

-- 럭키드로우를 한 통에 모아 한 번에 뽑으므로 번호는 전체에서 고유해야 한다.
-- (티어별로 따로 매기면 "7회 1번"과 "13회 1번"이 동시에 존재해 추첨 때 가릴 수 없다)
-- serial 이 NULL 인 행(19:30 이후 달성)은 여러 개 있어도 되므로 부분 유니크 인덱스를 쓴다.
create unique index tickets_serial_key on tickets (serial) where serial is not null;

-- 운영자 (굿즈 지급 창구). 여기 등록된 계정만 claim_goods 를 호출할 수 있다.
create table operators (
  user_id  uuid primary key references profiles(id) on delete cascade,
  memo     text,
  added_at timestamptz not null default now()
);

-- 응모권 번호 카운터. 전체 공용 한 줄만 쓴다 (tier 0 = 전체).
-- 7회로 받든 13회로 받든 같은 통에 들어가므로 번호도 하나의 연속 수열이다.
create table ticket_counters (
  tier        smallint primary key,       -- 0 = 전체 공용
  last_serial int not null default 0,
  max_serial  int                         -- 응모권 상한 (없으면 null)
);
insert into ticket_counters (tier) values (0);


-- ===== 스탬프 적립 RPC =====
-- 모달에서 연 부스(p_booth_id)와 스캔한 QR(p_token)이 같은 부스여야 인정
create or replace function claim_stamp(p_booth_id text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_token_of  text;
  v_count     int;
  v_tier      smallint;
  v_serial    int;
  v_new       jsonb := '[]'::jsonb;
  v_goods     boolean := false;
  cfg         event_config%rowtype;
  v_open      boolean;          -- 응모권 발급 가능 시간인가
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;

  select * into cfg from event_config where id = 1;
  if now() < cfg.stamp_opens_at then
    return jsonb_build_object('ok', false, 'error', 'NOT_STARTED',
                              'opens_at', cfg.stamp_opens_at);
  end if;
  if now() > cfg.stamp_closes_at then
    return jsonb_build_object('ok', false, 'error', 'EVENT_CLOSED',
                              'closed_at', cfg.stamp_closes_at);
  end if;
  v_open := now() <= cfg.ticket_deadline;

  -- 같은 유저의 동시 요청을 직렬화
  -- (버튼 연타, 두 기기 동시 사용, 서로 다른 부스 QR 동시 스캔 대비)
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- 1) QR 토큰(또는 수동 입력 코드)이 어느 부스 것인지 확인
  --    단축코드는 카메라가 안 될 때를 위한 대체 경로다. 4자리 숫자로 두면
  --    1만 가지라 추측이 가능해 토큰 보안이 무의미해지므로 6자리 영숫자를 쓴다.
  select s.booth_id into v_token_of
    from booth_secrets s join booths b on b.id = s.booth_id
   where (s.qr_token = p_token or s.short_code = upper(p_token)) and b.is_active;

  if v_token_of is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QR');
  end if;

  -- 2) 모달에서 연 부스와 일치하는지 확인
  if v_token_of is distinct from p_booth_id then
    return jsonb_build_object('ok', false, 'error', 'BOOTH_MISMATCH',
      'scanned_booth', (select name from booths where id = v_token_of));
  end if;

  -- 3) 스탬프 적립 (중복은 조용히 무시)
  insert into stamps (user_id, booth_id) values (v_uid, p_booth_id)
  on conflict do nothing;

  select count(*) into v_count from stamps where user_id = v_uid;

  -- 4) 임계치 도달 시 보상 지급
  foreach v_tier in array array[7, 13]::smallint[] loop
    if v_count >= v_tier
       and not exists (select 1 from tickets where user_id = v_uid and tier = v_tier)
    then
      if v_open then
        -- 19:30 이전: 응모권 번호 발급
        -- 전체 공용 카운터 한 줄(tier 0)을 올린다. 행 잠금이 동시 요청을 줄 세운다.
        update ticket_counters
           set last_serial = last_serial + 1
         where tier = 0
           and (max_serial is null or last_serial < max_serial)
        returning last_serial into v_serial;

        if v_serial is not null then
          insert into tickets (user_id, tier, serial) values (v_uid, v_tier, v_serial);
          v_new := v_new || jsonb_build_object('tier', v_tier, 'serial', v_serial);
          if v_tier = 13 then v_goods := true; end if;
        end if;
        v_serial := null;

      elsif v_tier = 13 then
        -- 19:30 이후 13회 달성: 응모권 없이 굿즈 자격만 (serial = NULL)
        insert into tickets (user_id, tier, serial) values (v_uid, 13, null);
        v_new := v_new || jsonb_build_object('tier', 13, 'serial', null);
        v_goods := true;
      end if;
      -- 19:30 이후 7회 달성: 보상 없음
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true, 'booth_id', p_booth_id,
    'stamp_count', v_count, 'new_tickets', v_new,
    'goods_unlocked', v_goods, 'tickets_open', v_open
  );
end $$;


-- ===== QR 토큰이 어느 부스 것인지 조회 =====
-- 휴대폰 기본 카메라로 QR을 찍으면 https://<도메인>/s/<토큰> 으로 들어온다.
-- 인앱 브라우저에서 앱 내 카메라가 막히는 경우가 많아, 이 경로가 중요한 대체 수단이다.
-- 토큰을 이미 가진 사람에게 부스 이름만 알려주므로 추가로 새는 정보가 없다.
create or replace function peek_booth(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'booth_id', b.id, 'name', b.name)
       from booth_secrets s join booths b on b.id = s.booth_id
      where (s.qr_token = p_token or s.short_code = upper(p_token)) and b.is_active),
    jsonb_build_object('ok', false)
  )
$$;


-- ===== 굿즈 수령 처리 (총학 본부 운영자 전용) =====
-- 응모권 번호가 아니라 닉네임으로 조회한다.
-- 19:30 이후 13회를 달성한 참가자는 응모권 번호가 없기 때문.
-- operators 에 등록된 계정만 호출할 수 있으므로 운영자 페이지도 anon 키로 동작한다.
-- (service_role 키를 브라우저에 넣으면 누구나 전체 DB를 조작할 수 있게 된다)
create or replace function claim_goods(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_id     bigint;
  v_prev   timestamptz;
  v_serial int;
begin
  if not exists (select 1 from operators where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'NOT_OPERATOR');
  end if;

  select id into v_uid from profiles where nickname = p_nickname;
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'NO_SUCH_USER');
  end if;

  -- 조건부 UPDATE 한 문장으로 처리해야 동시 요청에서 중복 지급이 없음
  -- (SELECT 로 확인한 뒤 UPDATE 하면 두 창구가 동시에 조회했을 때 둘 다 통과함)
  update tickets set goods_claimed_at = now()
   where user_id = v_uid and tier = 13 and goods_claimed_at is null
  returning id, serial into v_id, v_serial;

  if v_id is not null then
    return jsonb_build_object('ok', true, 'nickname', p_nickname, 'serial', v_serial);
  end if;

  select goods_claimed_at into v_prev
    from tickets where user_id = v_uid and tier = 13;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_ELIGIBLE',
      'stamp_count', (select count(*) from stamps where user_id = v_uid));
  end if;
  return jsonb_build_object('ok', false, 'error', 'ALREADY_CLAIMED', 'claimed_at', v_prev);
end $$;


-- ===== 운영자 전용 현황 조회 =====
-- RLS 가 참가자를 본인 행으로 묶어 두므로, 전체를 보려면 security definer 함수를 써야 한다.
-- 두 함수 모두 operators 소속을 먼저 확인하므로, 참가자가 직접 호출해도 아무것도 나오지 않는다.

create or replace function admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare cfg event_config%rowtype;
begin
  if not exists (select 1 from operators where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'NOT_OPERATOR');
  end if;

  select * into cfg from event_config where id = 1;

  return jsonb_build_object(
    'ok', true,
    'participants',   (select count(*) from profiles),
    -- 추첨 준비에 필요한 건 "몇 장 나갔고 번호가 몇 번까지 갔는가" 두 개다.
    -- 번호가 전체 연속이라 last_serial 이 곧 준비해야 할 최대 숫자가 된다.
    'tickets',        (select count(*) from tickets where serial is not null),
    'last_serial',    (select coalesce(max(serial), 0) from tickets),
    'reached7',       (select count(*) from tickets where tier = 7),
    'reached13',      (select count(*) from tickets where tier = 13),
    -- 19:30 이후 13회 달성 → 번호 없이 굿즈만. 추첨 대상 아님.
    'no_serial',      (select count(*) from tickets where serial is null),
    'goods_claimed',  (select count(*) from tickets where tier = 13 and goods_claimed_at is not null),
    'goods_pending',  (select count(*) from tickets where tier = 13 and goods_claimed_at is null),
    'tickets_open',   (now() <= cfg.ticket_deadline),
    'stamp_open',     (now() between cfg.stamp_opens_at and cfg.stamp_closes_at),
    'booths', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'no', b.sort_order,
               'name', coalesce(nullif(b.name,''), b.team),
               'count', (select count(*) from stamps s where s.booth_id = b.id))
             order by b.sort_order), '[]'::jsonb)
      from booths b where b.is_active
    )
  );
end $$;


-- 참가자 목록. p_query 로 닉네임 부분검색, 없으면 스탬프 많은 순.
create or replace function admin_participants(p_query text default null, p_limit int default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from operators where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'NOT_OPERATOR');
  end if;

  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(r order by r->>'stamps' desc)
    from (
      select jsonb_build_object(
               'nickname', p.nickname,
               'stamps',   (select count(*) from stamps s where s.user_id = p.id),
               't7',       (select serial from tickets t where t.user_id = p.id and t.tier = 7),
               't13',      (select serial from tickets t where t.user_id = p.id and t.tier = 13),
               'has13',    exists (select 1 from tickets t where t.user_id = p.id and t.tier = 13),
               'goods',    (select goods_claimed_at from tickets t where t.user_id = p.id and t.tier = 13),
               'operator', exists (select 1 from operators o where o.user_id = p.id)
             ) as r
        from profiles p
       where p_query is null or p_query = '' or p.nickname ilike '%'||p_query||'%'
       order by (select count(*) from stamps s where s.user_id = p.id) desc, p.created_at
       limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) x
  ), '[]'::jsonb));
end $$;


-- ===== RLS =====
alter table event_config    enable row level security;
alter table operators       enable row level security;
alter table profiles        enable row level security;
alter table booths          enable row level security;
alter table booth_secrets   enable row level security;
alter table stamps          enable row level security;
alter table tickets         enable row level security;
alter table ticket_counters enable row level security;

-- 부스 정보는 전체 공개 (토큰 컬럼 없음)
create policy booths_read on booths for select using (is_active);

-- 행사 시간 규칙은 앱이 읽어 배너·마감 안내에 사용
create policy config_read on event_config for select using (true);

-- 본인 것만 읽기
create policy profiles_self on profiles for select using (id = auth.uid());
create policy stamps_self   on stamps   for select using (user_id = auth.uid());
create policy tickets_self  on tickets  for select using (user_id = auth.uid());

-- 가입 시 본인 프로필 1행만 생성 허용
create policy profiles_insert_self on profiles for insert with check (id = auth.uid());

-- 운영자 본인 여부만 확인 가능 (운영자 페이지에서 권한 체크용)
create policy operators_self on operators for select using (user_id = auth.uid());

-- booth_secrets / ticket_counters: 정책 없음 = 전면 차단
-- stamps / tickets INSERT 정책 없음 = 직접 삽입 불가, RPC 경유만 가능

-- PUBLIC 이 함수 EXECUTE 를 기본으로 갖는다. anon 에서만 revoke 하면 남으므로
-- 반드시 public 에서 회수한 뒤 authenticated 에만 부여할 것.
revoke execute on function claim_stamp(text, text) from public;
revoke execute on function peek_booth(text)        from public;
revoke execute on function claim_goods(text)       from public;

grant execute on function claim_stamp(text, text) to authenticated;
grant execute on function peek_booth(text)        to authenticated;

-- 관리자 탭 조회 함수도 내부에서 operators 를 확인하므로 authenticated 에 부여해도 안전하다
revoke execute on function admin_stats()                 from public;
revoke execute on function admin_participants(text, int) from public;
grant  execute on function admin_stats()                 to authenticated;
grant  execute on function admin_participants(text, int) to authenticated;
-- claim_goods 는 함수 내부에서 operators 소속을 확인하므로 authenticated 에 부여해도 안전하다
grant execute on function claim_goods(text)       to authenticated;

-- 운영자 계정 등록 예시 (닉네임으로 가입시킨 뒤 실행)
--   insert into operators (user_id, memo)
--   select id, '본부 1창구' from profiles where nickname = '본부1';
