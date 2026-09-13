import { useState } from "react";
import { signIn, signUp } from "../lib/api";

export default function Signup({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"new" | "resume">("new");
  const [nick, setNick] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ready = nick.trim().length >= 2 && pin.length === 6 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      if (mode === "new") await signUp(nick, pin);
      else await signIn(nick, pin);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "문제가 생겼습니다. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <form className="signup" onSubmit={submit}>
      <div className="moon" aria-hidden="true" />
      <div>
        <h2>달빛제 스탬프투어</h2>
        <p>
          부스를 돌며 미션을 완료하고 응모권을 모으세요.
          <br />
          9월 18일 금요일 15:00–22:00
        </p>
      </div>

      <div className="field">
        <label htmlFor="nk">닉네임</label>
        <input
          id="nk"
          maxLength={10}
          placeholder="2–10자"
          autoComplete="off"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
        />
        <span className="hint">굿즈를 받을 때 이 이름을 말하면 됩니다.</span>
      </div>

      <div className="field">
        <label htmlFor="pn">비밀번호</label>
        <input
          id="pn"
          inputMode="numeric"
          maxLength={6}
          placeholder="숫자 6자리"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <span className="hint">
          기기를 바꾸거나 캐시를 지웠을 때 이어서 하려면 필요합니다.
        </span>
      </div>

      {err && (
        <div className="field">
          <span className="hint bad">{err}</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="primary" type="submit" disabled={!ready}>
          {busy ? "잠시만요…" : mode === "new" ? "시작하기" : "이어서 하기"}
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setMode(mode === "new" ? "resume" : "new");
            setErr(null);
          }}
        >
          {mode === "new" ? "다른 기기에서 이어하기" : "처음 시작하기"}
        </button>
      </div>
    </form>
  );
}
