// Выносит сборку разметки окна атаки в sheets/attack/markup.mjs (wdbc-uh56).
// Границы — из разбора acorn: самописный подсчёт скобок обрезал шаблон на 28
// строках вместо 118.
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "acorn";

const FILE = "module/sheets/attack-dialog.mjs";
const src = readFileSync(FILE, "utf8");
const NL = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(NL);

const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const decl = n => (n.type === "ExportNamedDeclaration" ? n.declaration : n);
const fn = ast.body.map(decl).find(n => n?.type === "FunctionDeclaration" && n.id?.name === "showAttackDialog");

const stmt = fn.body.body.find(s => s.type === "VariableDeclaration"
  && s.declarations[0]?.id?.name === "content");
// Сторож против повторного запуска: после первого прогона на месте шаблона
// стоит вызов buildAttackContent, и второй прогон вынес бы наружу его — ровно
// это и случилось однажды, оставив разметку пустой заглушкой.
if (stmt?.declarations[0]?.init?.type !== "TemplateLiteral")
  throw new Error("const content уже не шаблон — разметка, похоже, вынесена; повторный запуск отменён");
const [from, to] = [stmt.loc.start.line, stmt.loc.end.line];
const block = lines.slice(from - 1, to);

// Имена, которые надо передать внутрь, НЕ угадываются разбором: сбор
// «всё, что упомянуто и объявлено где-то в функции» захватывает и параметры
// вложенных функций (disabled, k, label, m — поймано на первой попытке).
// Список задаётся снаружи, а сверяет его eslint (no-undef).
const used = JSON.parse(process.argv[2] ?? "[]");

const body = block.map(l => (l.startsWith("  ") ? l.slice(2) : l)).join(NL)
  .replace("const content = `", "return `");

writeFileSync("module/sheets/attack/markup.mjs",
  [
    "// module/sheets/attack/markup.mjs",
    "// " + "═".repeat(74),
    "//  СБОРКА РАЗМЕТКИ ОКНА АТАКИ из готовых кусков (wdbc-uh56).",
    "//",
    "//  Второй односторонний шов функции showAttackDialog: сюда значения только",
    "//  входят, наружу идёт одна строка разметки. Ничего не считает — все куски",
    "//  собраны выше; здесь только порядок и обрамление.",
    "//",
    "//  Разрезать функцию поперёк нельзя (замер: 90–106 значений через границу в",
    "//  середине), поэтому режется вдоль: расчёт остаётся в attack-dialog.mjs,",
    "//  вёрстка уходит сюда, подключение окна — в attack/dialog.mjs.",
    "// " + "═".repeat(74),
    "",
    'import { CHARACTERISTICS } from "../../constants/characteristics.mjs";',
    'import { WEAPON_CLASSES } from "../../constants/items.mjs";',
    'import { esc } from "../../helpers/utils.mjs";',
    'import { diceModeHtml } from "../../rules/test-kind-widget.mjs";',
    'import { hasDeathDance } from "../../combat/death-dance.mjs";',
    "",
    "/** @param {object} v готовые куски разметки и значения для подстановки */",
    "export function buildAttackContent(v) {",
    "  const {",
    ...used.map(n => `    ${n},`),
    "  } = v;",
    "",
    body,
    "}",
    ""
  ].join(NL), "utf8");

const call = [
  "  // Сборка разметки вынесена в sheets/attack/markup.mjs (wdbc-uh56): второй",
  "  // односторонний шов — значения только входят, наружу идёт одна строка.",
  "  const content = buildAttackContent({",
  ...used.map(n => `    ${n},`),
  "  });"
];
const out = [...lines];
out.splice(from - 1, to - from + 1, ...call);
let result = out.join(NL);
const anchor = 'import { openAttackDialog } from "./attack/dialog.mjs";';
result = result.replace(anchor, anchor + NL + 'import { buildAttackContent } from "./attack/markup.mjs";');
writeFileSync(FILE, result, "utf8");
console.log(`вынесено ${to - from + 1} строк, значений на входе: ${used.length}`);
