# 달빛제 스탬프투어

2026년 9월 18일 금요일 · 부스 24개소 · 모바일 웹

---

## 지금 상태

| 항목 | 상태 |
| --- | --- |
| Supabase DB | **적용 완료** — 테이블·RLS·함수 3개·부스 24개소·QR 토큰까지 실제 프로젝트(`wsizteoipvslmbpnpqgk`)에 올라가 있음 |
| 앱 코드 | 완성, 타입검사·프로덕션 빌드 통과 |
| Vercel 배포 | **막힘** — 아래 참고 |

### Vercel 권한 문제

연결된 Vercel 계정이 `dgistcouncil` 팀에서 **새 프로젝트 생성은 되지만 기존 프로젝트에 재배포가 안 되는** 상태입니다.
빈 프로젝트로 두 번 시험해 확인했습니다.

```
403 forbidden — You don't have permission to create a Preview Deployment
for this Vercel project
```

Vercel → Settings → Members 에서 해당 계정 역할을 확인하세요 (Hobby 팀은 Member 역할에
배포 권한이 없습니다). 권한이 풀리면 이 폴더에서 바로 배포됩니다.

```bash
npx vercel --prod
```

한 번 배포한 뒤 **나온 도메인을 알려주시면 QR 이미지 24장을 만들어 드립니다.**
(QR 내용이 `https://<도메인>/s/<토큰>` 이라 도메인이 정해져야 확정됩니다)

---

## 행사 당일 전에 반드시 확인할 것

### 1. Supabase 인증 요청 한도 (가장 위험한 항목)

Supabase는 기본적으로 **IP당 회원가입·로그인을 5분에 30회**로 제한합니다. 축제장에서는
1,000~2,000명이 캠퍼스 와이파이와 통신사 NAT를 통해 **소수의 IP를 공유**하므로, 기본값
그대로 두면 개막 직후 대부분의 참가자가 가입 자체를 못 합니다.

> Authentication → Rate Limits 에서 sign up / sign in 한도를 최대로 올려 두세요.
> 리허설 때 여러 대로 동시에 가입해 보며 한도에 걸리지 않는지 확인해야 합니다.

### 2. 이메일 확인 끄기

이 앱은 닉네임을 `u...@stamp.dgist.ac.kr` 형태의 합성 이메일로 바꿔 Supabase Auth에
넘깁니다. `stamp.` 서브도메인에는 메일함이 없으므로 확인 메일이 켜져 있으면 가입이 실패합니다. 실제로 메일이 가면 안 되고, 확인 절차가 켜져 있으면 가입 직후 세션이 없어
프로필 생성이 실패합니다.

> Authentication → Sign In / Providers → Email 에서 **Confirm email 을 끄세요.**

### 3. HTTPS

카메라(`getUserMedia`)는 HTTPS 또는 localhost 에서만 동작합니다. Vercel 등 HTTPS 도메인에
올려야 QR 스캔이 됩니다.

### 4. 인앱 브라우저

카카오톡·인스타그램 인앱 브라우저에서는 카메라가 막히는 경우가 많습니다. 앱이 이를 감지해
안내와 수동 코드 입력 경로를 보여주지만, **홍보는 포스터·현수막 QR을 주 경로로** 잡는 편이
안전합니다.

---

## 설치

```bash
npm install
cp .env.example .env      # VITE_SUPABASE_ANON_KEY 채우기
npm run dev
```

`.env` 는 두 값만 필요합니다.

| 키 | 값 |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → anon public |

> `anon` 키는 브라우저에 노출되는 공개 키이고 RLS가 보호합니다.
> **`service_role` 키는 절대 넣지 마세요.** 모든 RLS를 무시하는 마스터 키입니다.

---

## DB 준비 (이미 적용되어 있음)

`schema.sql` 과 `seed_booths.sql` 은 이미 실제 프로젝트에 적용했습니다.
새 프로젝트에 다시 올릴 일이 있을 때만 SQL Editor 에서 순서대로 실행하세요.

1. `schema.sql` — 테이블, RLS, `claim_stamp` / `peek_booth` / `claim_goods` 함수
2. `seed_booths.sql` — 부스 24개소와 QR 토큰

`seed_booths.sql` 에는 **부스별 QR 비밀 토큰이 평문으로** 들어 있습니다.
이 파일이 유출되면 전 부스 QR이 뚫리므로 **저장소에 커밋하지 마세요.**

### 운영자 등록 (굿즈 지급 창구)

굿즈 지급 화면은 `operators` 에 등록된 계정만 쓸 수 있습니다. 창구 담당자가 앱에서
평소처럼 가입한 뒤, SQL Editor 에서 한 줄 실행하면 됩니다.

```sql
insert into operators (user_id, memo)
select id, '본부 1창구' from profiles where nickname = '본부1';
```

등록된 계정은 **내 정보 → 굿즈 지급 화면 열기** 가 보입니다.

---

## 동작 규칙

서버 함수 `claim_stamp` 안에 전부 들어 있어 클라이언트를 고쳐도 우회할 수 없습니다.

| 규칙 | 동작 |
| --- | --- |
| 부스 일치 | 부스 팝업에서 연 부스의 QR만 인정. 다른 QR은 어느 부스 것인지 알려주고 거부 |
| 중복 스캔 | 같은 부스를 다시 찍어도 스탬프는 1개 (조용히 무시) |
| 적립 시간 | 15:00–22:00 밖에서는 `NOT_STARTED` / `EVENT_CLOSED` |
| 7회 달성 | 응모권 1장, 번호는 달성 순서대로 1번부터 |
| 13회 달성 | 응모권 1장 + 굿즈 수령 자격 |
| 19:30 이후 | 응모권 발급 중단. 13회 달성자는 `serial = NULL` 로 **굿즈 자격만** 부여 |
| 굿즈 수령 | 닉네임으로 조회 (19:30 이후 달성자는 응모권 번호가 없으므로) |
| 기본 카메라 | QR을 휴대폰 기본 카메라로 찍으면 `/s/<토큰>` 으로 들어와 해당 부스 팝업이 열리고, 카메라 없이 바로 완료 처리 |

시간은 코드가 아니라 `event_config` 테이블에 있습니다. 행사 당일 일정이 밀리면
배포 없이 SQL 한 줄로 조정할 수 있습니다.

```sql
update event_config set ticket_deadline = '2026-09-18 20:00+09';
```

---

## 구조

```
src/
  supabase.ts          Supabase 클라이언트, 닉네임→이메일 변환
  types.ts             DB 행과 RPC 반환 타입
  lib/api.ts           인증·조회·적립 호출을 한곳에 모음
  lib/theme.ts         카테고리 색, 시각 표기
  App.tsx              세션 게이트, 상단 진행 표시, 탭, 오버레이 전환
  screens/Signup.tsx   가입 / 이어하기
  screens/MapView.tsx  부스 배치도 (SVG, 좌표는 DB의 map_* 값)
  screens/ListView.tsx 부스 목록
  screens/Me.tsx       응모권 2장, 스탬프 목록, 굿즈 안내
  screens/Admin.tsx    운영자 굿즈 지급
  components/BoothSheet.tsx  부스 소개·미션·미션 완료 버튼
  components/Scanner.tsx     카메라 QR 인식 + 수동 코드 입력
  components/Reward.tsx      응모권 번호 공개
```

지도는 이미지가 아니라 SVG로 그리고, 부스 위치는 `booths.map_x/map_y/map_w/map_h`
(지도 viewBox 880×1430 기준 비율)에서 읽습니다. 부스가 바뀌면 DB만 고치면 됩니다.

> 원본 손그림 지도는 부스 칩이 촘촘해 휴대폰에서 누르기 어려웠습니다. 좌·우 열과 하단
> 행이라는 배치는 유지하되 세로 간격을 넓혀 다시 그렸고, 대안 경로로 **목록** 탭을 같은
> 비중으로 넣었습니다.

`@zxing` QR 라이브러리가 번들의 절반을 차지해, 스캐너를 처음 열 때 따로 내려받도록
분리했습니다. 첫 화면은 gzip 약 112KB입니다.

---

## 배포 (Vercel)

1. 저장소를 Vercel에 연결 (Framework: Vite)
2. Environment Variables 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가
3. 배포 후 나온 도메인을 QR 주소 `https://<도메인>/s/<토큰>` 에 반영해 인쇄

---

## 리허설 체크리스트

- [ ] 인증 요청 한도 상향 후, 여러 대에서 동시 가입
- [ ] iOS Safari / Android Chrome 에서 카메라 QR 인식
- [ ] 카카오톡 인앱 브라우저에서 안내 문구와 수동 코드 입력 동작
- [ ] 다른 부스 QR을 찍었을 때 거부되는지
- [ ] 7회·13회 응모권 번호가 순서대로 나오는지
- [ ] `event_config` 를 임시로 19:30 이후로 바꿔 굿즈 전용 동작 확인
- [ ] 운영자 계정으로 굿즈 지급, 중복 지급 차단 확인
- [ ] 캐시를 지운 뒤 닉네임+비밀번호로 이어하기
# stamptour
