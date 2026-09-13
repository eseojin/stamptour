export type Category = "food" | "bar" | "activity" | "promotion";

export interface Booth {
  id: string;
  name: string;
  team: string;
  category: Category;
  description: string | null;
  menu: string | null;
  minigame: string | null;
  map_x: number;
  map_y: number;
  map_w: number;
  map_h: number;
  sort_order: number;
}

export interface EventConfig {
  stamp_opens_at: string;
  stamp_closes_at: string;
  ticket_deadline: string;
}

export interface Stamp {
  booth_id: string;
  earned_at: string;
}

export interface Ticket {
  tier: 7 | 13;
  /** null = 19:30 이후 달성 → 응모권 없이 굿즈 자격만 */
  serial: number | null;
  issued_at: string;
  goods_claimed_at: string | null;
}

/** claim_stamp RPC 의 반환값 */
export type ClaimResult =
  | {
      ok: true;
      booth_id: string;
      stamp_count: number;
      new_tickets: { tier: 7 | 13; serial: number | null }[];
      goods_unlocked: boolean;
      tickets_open: boolean;
    }
  | {
      ok: false;
      error:
        | "UNAUTHENTICATED"
        | "NOT_STARTED"
        | "EVENT_CLOSED"
        | "INVALID_QR"
        | "BOOTH_MISMATCH";
      scanned_booth?: string;
      opens_at?: string;
      closed_at?: string;
    };

/** claim_goods RPC 의 반환값 */
export type GoodsResult =
  | { ok: true; nickname: string; serial: number | null }
  | {
      ok: false;
      error: "NOT_OPERATOR" | "NO_SUCH_USER" | "NOT_ELIGIBLE" | "ALREADY_CLAIMED";
      claimed_at?: string;
      stamp_count?: number;
    };

export const CATEGORY_LABEL: Record<Category, string> = {
  food: "Food",
  bar: "Bar",
  activity: "Activity",
  promotion: "Promotion",
};
