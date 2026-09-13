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

// 닉네임을 Supabase Auth 의 이메일 형식으로 변환한다.
// 실제 메일이 발송되지 않도록 Auth 설정에서 "Confirm email" 을 꺼야 한다.
export function nicknameToEmail(nickname: string) {
  const slug = Array.from(nickname.trim())
    .map((ch) => ch.charCodeAt(0).toString(36))
    .join("");
  return `u${slug}@stamp.dgist.ac.kr`;
}
