import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { extractToken } from "../lib/api";
import type { Booth } from "../types";

interface Props {
  booth: Booth;
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
  failure,
  onClose,
  onDecode,
  onManual,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  // 부모가 리렌더될 때마다 onDecode 의 함수 정체성이 바뀐다.
  // 그대로 의존성에 두면 30초 타이머 한 번에도 카메라가 껐다 켜져 인식이 끊긴다.
  // 콜백은 ref 로 최신값만 따라가게 하고, 카메라는 열릴 때 한 번만 시작한다.
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

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
            onDecodeRef.current(token);
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
    // 의존성 없음: 스캐너가 열려 있는 동안 카메라를 한 번만 잡는다
  }, []);

  return (
    <div className="ov">
      <div className="scanner">
        <div className="top">
          <button className="closex" onClick={onClose} aria-label="닫기">
            ✕
          </button>
          <div>
            <div className="ttl">{booth.name || booth.team}</div>
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
            placeholder="코드입력"
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
