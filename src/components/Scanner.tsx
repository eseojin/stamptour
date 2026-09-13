import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { extractToken } from "../lib/api";
import type { Booth } from "../types";

interface Props {
  booth: Booth;
  no: number;
  failure: string | null;
  onClose: () => void;
  onDecode: (token: string) => void;
  onManual: (code: string) => void;
}

/** 인앱 브라우저(카카오톡·인스타그램 등)는 카메라가 막히는 경우가 많다. */
function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua);
}

export default function Scanner({
  booth,
  no,
  failure,
  onClose,
  onDecode,
  onManual,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 180,
    });

    (async () => {
      if (isInAppBrowser()) {
        setCamError(
          "카카오톡·인스타그램 안에서는 카메라를 쓸 수 없습니다. 오른쪽 위 메뉴에서 Safari 또는 Chrome으로 열거나, 아래에 QR 밑의 6자리 코드를 입력해 주세요."
        );
        return;
      }
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (!result || cancelled) return;
            const token = extractToken(result.getText());
            if (!token) return;
            controls.stop();
            onDecode(token);
          }
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch {
        setCamError(
          "카메라를 열 수 없습니다. 브라우저 설정에서 카메라 권한을 허용하거나, 아래에 QR 밑의 6자리 코드를 입력해 주세요."
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDecode]);

  return (
    <div className="ov">
      <div className="scanner">
        <div className="top">
          <button
            className="closex"
            onClick={onClose}
            aria-label="닫기"
            style={{ background: "#1D2026", color: "#C9CDD4" }}
          >
            ✕
          </button>
          <div>
            <div className="ttl">{booth.name || booth.team}</div>
            <div className="sb">{no}번 부스의 QR을 비춰 주세요</div>
          </div>
        </div>

        <div className="view">
          <video ref={videoRef} muted playsInline />
          <div className="reticle">
            <i />
            <i />
            <i />
            <i />
            <span className="scanline" />
          </div>
          {camError && <div className="camnote">{camError}</div>}
        </div>

        {failure && <div className="fail">{failure}</div>}

        <form
          className="manual"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) onManual(code);
          }}
        >
          <input
            id="manual-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={6}
            placeholder="6자리 코드"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            aria-label="QR 아래 6자리 코드"
          />
          <button type="submit" disabled={code.length !== 6}>
            확인
          </button>
        </form>
      </div>
    </div>
  );
}
