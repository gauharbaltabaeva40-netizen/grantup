// `node --test` үшін: TypeScript файлдарын (Node-тың кірістірілген type stripping) және `@/` бүркеншік атын шешу.
import { register } from "node:module";

register("./resolve-hooks.mjs", import.meta.url);
