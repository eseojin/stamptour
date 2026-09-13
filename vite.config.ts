import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 카메라(getUserMedia)는 HTTPS 또는 localhost 에서만 동작한다.
  // 휴대폰 실기기로 개발 중 확인하려면 `npm run dev -- --host` 후 https 터널을 쓸 것.
  server: { host: true },
});
