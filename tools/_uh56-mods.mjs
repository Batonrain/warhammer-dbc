// Выносит список ситуативных модификаторов окна атаки в sheets/attack/mods.mjs
// (wdbc-uh56). Границы и ширина шва — из tools/_uh56-seam.mjs: 12 значений на
// входе, 4 на выходе на 117 строк.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse } from "acorn";

const FILE = "module/sheets/attack-dialog.mjs";
const OUT = "module/sheets/attack/mods.mjs";
if (existsSync(OUT)) throw new Error("mods.mjs уже существует — повторный запуск отменён");

const src = readFileSync(FILE, "utf8");
const NL = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(NL);
const [FROM, TO] = [950, 1095];

const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const fn = ast.body.map(n => (n.type === "ExportNamedDeclaration" ? n.declaration : n))
  .find(n => n?.type === "FunctionDeclaration" && n.id?.name === "showAttackDialog");
const first = fn.body.body.find(s => s.loc.start.line >= FROM);
const last = [...fn.body.body].reverse().find(s => s.loc.end.line <= TO);
if (first.loc.start.line !== FROM || last.loc.end.line !== TO)
  throw new Error(`границы разъехались: ${first.loc.start.line}–${last.loc.end.line}`);

const IN = ["attackCtx", "attackerToken", "gripRange", "hasFatigue", "hasLostEyes",
  "isBlinded", "isMelee", "measured", "targetHelpless", "targetToken", "wProps", "wp"];
const OUTN = ["bandKey", "charSwapWhy", "commonMods", "specificMods"];

const body = lines.slice(FROM - 1, TO).map(l => (l.startsWith("  ") ? l.slice(2) : l));

writeFileSync(OUT, [
  "// module/sheets/attack/mods.mjs",
  "// " + "═".repeat(74),
  "//  СИТУАТИВНЫЕ МОДИФИКАТОРЫ окна атаки (wdbc-uh56).",
  "//",
  "//  Список галочек «Общие» и «Рукопашные/Стрелковые» — тот, что живёт в",
  "//  свёрнутом блоке диалога. Ничего не рисует: отдаёт данные, вёрстку из них",
  "//  собирает markup.mjs.",
  "//",
  "//  Шов узкий по замеру (tools/_uh56-seam.mjs): 12 значений внутрь, 4 наружу",
  "//  на 117 строк. Поперёк функции такого места больше нет — в середине через",
  "//  границу идёт 90–106 значений.",
  "// " + "═".repeat(74),
  "",
  "/**",
  " * @param {object} v состояние броска: оружие, токены, замеренная дистанция",
  " * @returns {{commonMods: object[], specificMods: object[], charSwapWhy: string[], bandKey: string|null}}",
  " */",
  "export function situationalMods(v) {",
  "  const {",
  ...IN.map(n => `    ${n},`),
  "  } = v;",
  "",
  ...body.map(l => (l ? "  " + l : l)),
  "",
  `  return { ${OUTN.join(", ")} };`,
  "}",
  ""
].join(NL), "utf8");

const call = [
  "  // Ситуативные модификаторы вынесены в sheets/attack/mods.mjs (wdbc-uh56):",
  "  // данные без вёрстки, шов замерен (12 внутрь, 4 наружу).",
  `  const { ${OUTN.join(", ")} } = situationalMods({`,
  ...IN.map(n => `    ${n},`),
  "  });"
];
const out = [...lines];
out.splice(FROM - 1, TO - FROM + 1, ...call);
const anchor = 'import { buildAttackContent } from "./attack/markup.mjs";';
writeFileSync(FILE, out.join(NL).replace(anchor,
  anchor + NL + 'import { situationalMods } from "./attack/mods.mjs";'), "utf8");
console.log(`вынесено ${TO - FROM + 1} строк; вход ${IN.length}, выход ${OUTN.length}`);
