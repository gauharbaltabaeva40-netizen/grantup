// MediaPipe WASM файлдарын public/mediapipe/-ге көшіру (npm install кезінде автоматты, Vercel-де де).
// Файлдар үлкен (~13 МБ), сондықтан git-ке салынбайды; браузер оларды тек сынақ ҰБТ кезінде жүктеп, кэштейді.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = join(root, "public/mediapipe");

if (!existsSync(from)) {
  console.warn("copy-mediapipe: @mediapipe/tasks-vision табылмады — өткізілді");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  copyFileSync(join(from, file), join(to, file));
}
console.log("copy-mediapipe: public/mediapipe дайын");
