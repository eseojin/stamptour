import { useState } from "react";
import { startOrResume } from "../lib/api";

export default function Signup({ onDone }: { onDone: () => void }) {
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
      // 처음이면 가입, 이미 쓰던 닉네임이면 같은 비밀번호로 이어하기까지 한 번에 처리된다.
      await startOrResume(nick, pin);
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
      </div>

      {err && (
        <div className="field">
          <span className="hint bad">{err}</span>
        </div>
      )}

      <button className="primary" type="submit" disabled={!ready}>
        {busy ? "잠시만요…" : "시작하기"}
      </button>
    </form>
  );
}
