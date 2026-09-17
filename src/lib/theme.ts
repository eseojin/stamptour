import type { Category } from "../types";

export const CAT_VAR: Record<Category, string> = {
  food: "var(--food)",
  bar: "var(--bar)",
  activity: "var(--act)",
  promotion: "var(--promo)",
  ride: "var(--viking)",
};

/** 09/18 18:40 → "18:40" (행사 당일 기준이라 날짜는 생략) */
export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

/** 마감까지 남은 시간을 "2시간 10분" / "35분" 으로 */
export function untilText(deadline: string, now: number) {
  const left = Math.floor((new Date(deadline).getTime() - now) / 60000);
  if (left <= 0) return null;
  const h = Math.floor(left / 60);
  return h >= 1 ? `${h}시간 ${left % 60}분` : `${left}분`;
}
