import { CATEGORY_LABEL, type Booth } from "../types";
import { CAT_VAR, hhmm } from "../lib/theme";

interface Props {
  booths: Booth[];
  stamps: Map<string, string>;
  onPick: (booth: Booth) => void;
}

export default function ListView({ booths, stamps, onPick }: Props) {
  return (
    <div className="list">
      {booths.map((b, i) => {
        const at = stamps.get(b.id);
        return (
          <button
            key={b.id}
            className={`litem${at ? " done" : ""}`}
            onClick={() => onPick(b)}
          >
            <span className="no">{i + 1}</span>
            <span className="dot" style={{ background: CAT_VAR[b.category] }} />
            <span style={{ minWidth: 0 }}>
              <span className="nm" style={{ display: "block" }}>
                {b.name || "(부스명 미정)"}
              </span>
              <span className="tm">
                {b.team} · {CATEGORY_LABEL[b.category]}
              </span>
            </span>
            <span className="mark">{at ? `완료 ${hhmm(at)}` : "미완료"}</span>
          </button>
        );
      })}
    </div>
  );
}
