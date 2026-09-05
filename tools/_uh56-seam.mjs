// Замер ширины шва в showAttackDialog (wdbc-uh56): сколько значений придётся
// протащить через границу, если вырезать операторы с такой-то строки по такую.
// Считает по разбору acorn, а не на глаз — на глаз уже дважды ошиблись.
//
//   node tools/_uh56-seam.mjs 950 1095
//
// Оценка ВХОДОВ намеренно завышена: имена, объявленные во вложенных областях
// куска, не отличаются от одноимённых внешних. Точный список даёт eslint после
// настоящего выреза; здесь — быстрый отсев кандидатов.
import { readFileSync } from "node:fs";
import { parse } from "acorn";

const src = readFileSync("module/sheets/attack-dialog.mjs", "utf8");
const NL = src.includes("\r\n") ? "\r\n" : "\n";
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const fn = ast.body.map(n => (n.type === "ExportNamedDeclaration" ? n.declaration : n))
  .find(n => n?.type === "FunctionDeclaration" && n.id?.name === "showAttackDialog");

const [FROM, TO] = [Number(process.argv[2]), Number(process.argv[3])];

const names = (pat, out = []) => {
  if (!pat) return out;
  if (pat.type === "Identifier") out.push(pat.name);
  else if (pat.type === "ObjectPattern") pat.properties.forEach(p =>
    names(p.type === "RestElement" ? p.argument : p.value, out));
  else if (pat.type === "ArrayPattern") pat.elements.forEach(e => names(e, out));
  else if (pat.type === "AssignmentPattern") names(pat.left, out);
  else if (pat.type === "RestElement") names(pat.argument, out);
  return out;
};

const declaredBy = new Map();          // имя → индекс оператора, где объявлено
// Параметры самой функции — тоже вход шва: без них замер пропустил actor,
// и eslint потом нашёл его в шести местах вырезанного куска.
for (const p of fn.params) names(p).forEach(n => declaredBy.set(n, -1));
fn.body.body.forEach((s, i) => {
  if (s.type === "VariableDeclaration") s.declarations.forEach(d => names(d.id).forEach(n => declaredBy.set(n, i)));
  if (s.type === "FunctionDeclaration") declaredBy.set(s.id.name, i);
});

const refs = (node, out = new Set()) => {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) { node.forEach(n => refs(n, out)); return out; }
  if (node.type === "Identifier") { out.add(node.name); return out; }
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end") continue;
    if (node.type === "MemberExpression" && k === "property" && !node.computed) continue;
    if (node.type === "Property" && k === "key" && !node.computed) continue;
    refs(node[k], out);
  }
  return out;
};

const inBlock = i => {
  const s = fn.body.body[i];
  return s.loc.start.line >= FROM && s.loc.end.line <= TO;
};
const idx = fn.body.body.map((_, i) => i);
const blockIdx = idx.filter(inBlock);
if (!blockIdx.length) { console.log("в этих строках нет целых операторов верхнего уровня"); process.exit(1); }

const blockDecl = new Set();
for (const i of blockIdx) for (const [n, j] of declaredBy) if (j === i) blockDecl.add(n);

const blockRefs = new Set();
for (const i of blockIdx) refs(fn.body.body[i], blockRefs);
const ins = [...blockRefs].filter(n => declaredBy.has(n) && !blockDecl.has(n)).sort();

const outsideRefs = new Set();
for (const i of idx) if (!blockIdx.includes(i)) refs(fn.body.body[i], outsideRefs);
const outs = [...blockDecl].filter(n => outsideRefs.has(n)).sort();

const lines = blockIdx.reduce((a, i) =>
  a + fn.body.body[i].loc.end.line - fn.body.body[i].loc.start.line + 1, 0);
console.log(`строки ${FROM}–${TO}: операторов ${blockIdx.length}, строк ${lines}`);
console.log(`ВХОД  ${ins.length}: ${ins.join(" ")}`);
console.log(`ВЫХОД ${outs.length}: ${outs.join(" ")}`);
