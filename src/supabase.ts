import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // 로그아웃 버튼을 두지 않으므로 세션을 localStorage 에 영구 보관한다.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "dalbit-stamp-auth",
  },
});

/**
 * 닉네임을 계정 키로 쓰기 전에 손질한다.
 * 한글은 아이폰과 안드로이드가 같은 글자를 다른 코드로 보낼 때가 있어(NFD/NFC),
 * 정규화하지 않으면 눈에는 같은 닉네임이 다른 계정으로 갈린다.
 */
export function normalizeNickname(nickname: string) {
  return nickname.normalize("NFC").trim();
}

// 닉네임을 Supabase Auth 의 이메일 형식으로 변환한다.
// 실제 메일이 발송되지 않도록 Auth 설정에서 "Confirm email" 을 꺼야 한다.
export function nicknameToEmail(nickname: string) {
  const slug = Array.from(normalizeNickname(nickname))
    .map((ch) => ch.charCodeAt(0).toString(36))
    .join("");
  return `u${slug}@stamp.dgist.ac.kr`;
}
