// tools/sahara-tasks.mjs
// Читает задачи воркспейса Sahara Studio «Doom Crusade» прямо с диска — у
// Sahara MCP есть только createTask/commentOnTask, списка и стадий он не
// отдаёт. Только чтение: журнал событий Studio неизменяемый и с контрольными
// суммами, писать в него мимо Studio/MCP нельзя.
//
// Состояние = последний чекпоинт (snapshots/<head>/pack-tasks.json.gz) плюс
// все события из .studio/events/<device>/, свёрнутые по пути в порядке
// (время, устройство, sequence): file-put/file-delete заменяют запись целиком,
// record-patch ставит поля фронтматтера поверх (см. ARCHITECTURE.md Studio).
//
//   node tools/sahara-tasks.mjs                 # открытые задачи
//   node tools/sahara-tasks.mjs --all           # включая закрытые
//   node tools/sahara-tasks.mjs --project crb   # один проект (dept)
//   node tools/sahara-tasks.mjs --json          # для скриптов
//   node tools/sahara-tasks.mjs wdbc-1rno.3     # одна задача целиком (номер bd или id Studio)
//
// Путь к воркспейсу — SAHARA_WORKSPACE или по умолчанию Documents пользователя.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const WS = process.env.SAHARA_WORKSPACE
  ?? path.join(os.homedir(), "Documents/Alersteam/SaharaStudio/personal-workspaces/Doom Crusade/workspace");
const STUDIO = path.join(WS, ".studio");
const CLOSED = new Set(["Done", "By Design", "Rejected"]);

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const wantId = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--project");

/** path → { text, deleted } */
const records = new Map();

function loadSnapshot() {
  const headFile = path.join(STUDIO, "head.json");
  if (!fs.existsSync(headFile)) return;
  const head = JSON.parse(fs.readFileSync(headFile, "utf8"));
  const pack = path.join(STUDIO, head.folder ?? `snapshots/${head.snapshot}`, "pack-tasks.json.gz");
  if (!fs.existsSync(pack)) return;
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(pack)).toString("utf8"));
  // Формат пака: либо { path: text }, либо { records: [{ path, content, encoding }] }.
  const rows = Array.isArray(data?.records) ? data.records
    : Object.entries(data?.files ?? data).map(([p, v]) => (typeof v === "string" ? { path: p, content: v } : { path: p, ...v }));
  for (const r of rows) if (r?.path?.startsWith("work/")) records.set(r.path, { text: r.content ?? r.text ?? "" });
}

function loadEvents() {
  const dir = path.join(STUDIO, "events");
  if (!fs.existsSync(dir)) return [];
  const events = [];
  for (const dev of fs.readdirSync(dir)) {
    const devDir = path.join(dir, dev);
    if (!fs.statSync(devDir).isDirectory()) continue;
    for (const f of fs.readdirSync(devDir)) {
      const raw = fs.readFileSync(path.join(devDir, f), "utf8");
      // В сегменте берём только завершённые строки: последняя без \n ещё пишется.
      const lines = f.endsWith(".jsonl") ? raw.split("\n").slice(0, -1) : [raw];
      for (const l of lines) {
        if (!l.trim()) continue;
        try { events.push(JSON.parse(l)); } catch { /* битая строка — Studio её тоже игнорирует */ }
      }
    }
  }
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.device < b.device ? -1 : a.device > b.device ? 1 : a.sequence - b.sequence));
  return events;
}

function splitRecord(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return m ? { fm: m[1], body: m[2] } : { fm: "", body: text };
}

function applyPatch(text, set = {}, body) {
  const { fm, body: oldBody } = splitRecord(text);
  const lines = fm ? fm.split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(set)) {
    const line = `${k}: ${JSON.stringify(v)}`;
    const i = lines.findIndex((l) => l.startsWith(`${k}:`));
    if (i >= 0) {
      // Снести и продолжение многострочного значения (строки с отступом).
      let j = i + 1;
      while (j < lines.length && /^\s/.test(lines[j])) j++;
      lines.splice(i, j - i, line);
    } else lines.push(line);
  }
  return `---\n${lines.join("\n")}\n---\n${body ?? oldBody}`;
}

function parseFrontmatter(fm) {
  const out = {};
  for (const l of fm.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(l);
    if (!m) continue;
    try { out[m[1]] = JSON.parse(m[2]); } catch { out[m[1]] = m[2]; }
  }
  return out;
}

loadSnapshot();
for (const e of loadEvents()) {
  if (!e.path?.startsWith("work/")) continue;
  if (e.kind === "file-put") records.set(e.path, { text: e.encoding === "base64" ? Buffer.from(e.content, "base64").toString("utf8") : e.content });
  else if (e.kind === "file-delete") records.set(e.path, { deleted: true });
  else if (e.kind === "record-patch") {
    // Поля патча лежат JSON-строкой в content: { set: {...}, body?: "..." }.
    let patch = {};
    try { patch = typeof e.content === "string" ? JSON.parse(e.content) : (e.content ?? {}); } catch { continue; }
    const cur = records.get(e.path);
    if (cur && !cur.deleted) cur.text = applyPatch(cur.text, patch.set, patch.body);
  }
}

const tasks = [];
for (const [p, r] of records) {
  if (r.deleted || !p.endsWith(".md")) continue;
  const { fm, body } = splitRecord(r.text);
  const f = parseFrontmatter(fm);
  tasks.push({ id: f.id ?? path.basename(p, ".md"), name: f.name ?? "", project: f.dept ?? "", stage: f.stage ?? "", priority: f.priority ?? "", parent: f.parent ?? "", tags: f.tags ?? [], comments: Array.isArray(f.comments) ? f.comments : [], body });
}
tasks.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

if (wantId) {
  // Искать и по id Studio, и по номеру bd из названия.
  const t = tasks.find((x) => x.id === wantId) ?? tasks.find((x) => x.name.startsWith(`[${wantId}]`));
  if (!t) { console.error(`Нет задачи ${wantId} в ${WS}`); process.exit(1); }
  const comments = t.comments.map((c) => `\n— ${c.date ?? ""} ${c.author ?? ""}\n${c.text ?? ""}`).join("\n");
  console.log(flag("--json") ? JSON.stringify(t, null, 2) : `${t.id} · ${t.stage} · ${t.priority} · ${t.project}${t.parent ? ` · родитель ${t.parent}` : ""}\n${t.name}\n\n${t.body}${comments ? `\n\n## Комментарии\n${comments}` : ""}`);
  process.exit(0);
}

let list = tasks;
if (!flag("--all")) list = list.filter((t) => !CLOSED.has(t.stage));
const proj = opt("--project");
if (proj) list = list.filter((t) => t.project === proj);

if (flag("--json")) console.log(JSON.stringify(list.map(({ body, comments, ...t }) => ({ ...t, comments: comments.length })), null, 2));
else {
  // id Studio — латинская выжимка из названия, а не номер bd; номер bd стоит
  // в самом названии «[wdbc-…] …», поэтому печатаем название, id — последним.
  for (const t of list) console.log(`${t.stage.padEnd(11)} ${t.priority.padEnd(6)} ${t.project.padEnd(7)} ${t.name}  (${t.id})`);
  console.log(`— ${list.length} из ${tasks.length}`);
}
