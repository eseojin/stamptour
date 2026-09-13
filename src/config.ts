/**
 * Supabase 접속 정보.
 *
 * Vite 는 VITE_ 로 시작하는 환경변수를 빌드 시점에 번들에 그대로 박아 넣는다.
 * 즉 anon 키는 어느 쪽을 쓰든 브라우저에서 보이는 공개 값이고, RLS 가 보호한다.
 * 그래서 여기에 기본값을 두고, 환경변수가 있으면 그쪽을 우선한다.
 *
 * service_role 키는 절대 이 파일에도 .env 에도 넣지 말 것. 모든 RLS 를 무시한다.
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://wsizteoipvslmbpnpqgk.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzaXp0ZW9pcHZzbG1icG5wcWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjI2NDIsImV4cCI6MjEwNDg5ODY0Mn0.Tt5i9Racr_TtFLn5ca08qIesLBEmLBykl5dqWxaZCQY";
