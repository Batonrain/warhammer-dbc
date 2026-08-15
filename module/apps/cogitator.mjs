// ════════════════════════════════════════════════════════════════════════
//  Когитаторы — постоянные терминалы-консоли (Warhammer DBC).
//  • Каждый когитатор = JournalEntry с данными во флаге warhammer-dbc.cogitator.
//  • Менеджер: список/создание/правка/доступ игрокам/удаление.
//  • Консоль: терминальный вид (моно, CRT), навигация по страницам через
//    кликабельные токены [1]/[0] в тексте; режимы Просмотр / Правка (ГМ).
//  Фаза 2: пароль, вход по броску, скрапкод/повреждение, вид техножреца.
// ════════════════════════════════════════════════════════════════════════
import { esc } from "../helpers/utils.mjs";

const { Application } = foundry.appv1.api;
const NS = "warhammer-dbc";
const FLAG = "cogitator";

const rid = () => foundry.utils.randomID(8);
function newPage(name = "Новая страница") {
  return { id: rid(), name, title: name.toUpperCase(),
    body: "=========================================\n  " + name.toUpperCase() + "\n=========================================\n\n  Текст страницы...\n",
    color: "", prompt: "ВВЕДИТЕ КОМАНДУ:", links: [],
    image: "", input: false, inputShared: false, inputText: "", entries: {} };
}
// Команда ссылки: явная `command`, иначе выводим из токена (без скобок/пробелов).
function linkCommand(link) {
  const c = (link?.command || "").trim();
  if (c) return c.toLowerCase();
  return (link?.token || "").replace(/[\[\]\s]/g, "").toLowerCase();
}
function defaultCogitator(title = "НОВЫЙ КОГИТАТОР") {
  const p = newPage("Главное меню");
  return { title, theme: { fg: "#33ff66", bg: "#020a04", accent: "#8dffb0", crt: true },
    clickableTokens: false, binaryAccess: { techpriest: true, users: [] },
    startPage: p.id, pages: [p] };
}

// Кодирование текста в двоичный код (Бинарный Кант).
function toBinary(str) {
  return String(str ?? "").split("").map(ch => ch.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
}

// ── Скрапкод: случайная еретическая мешанина (перегенерируется в реальном времени) ──
const SCRAP_WORDS = ["YOURS", "MINE", "DARK", "GODS", "FALL", "HERESY", "BLOOD", "CHAOS", "DEATH",
  "FEAR", "RUIN", "FLESH", "SOUL", "KNEEL", "OBEY", "DESPAIR", "DAMNED", "HELL", "VOID", "WARP",
  "SLAY", "BURN", "DECAY", "CORRUPT", "REPENT", "MALICE", "TORMENT", "SCREAM", "WE SEE YOU",
  "JOIN US", "NO ESCAPE", "THE END", "BLOOD GOD", "ALL IS DUST", "TURN BACK", "TOO LATE",
  "YOUR SOUL", "IS OURS", "HERETIC", "TZEENTCH", "KHORNE", "NURGLE", "SLAANESH", "THE FALLEN"];
const SCRAP_GLYPHS = "ABCDEFGHKLMNPQRSTUVWXYZ0123456789@#$%&*!?/\\|~^<>{}[]=+±§¤×÷¬";
function scrapChar() { return SCRAP_GLYPHS[Math.floor(Math.random() * SCRAP_GLYPHS.length)]; }
function scrapText(len) {
  len = Math.min(Math.max(len | 0, 24), 300);
  let out = "";
  while (out.length < len) {
    if (Math.random() < 0.10) out += SCRAP_WORDS[Math.floor(Math.random() * SCRAP_WORDS.length)];
    else { const n = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) out += scrapChar(); }
  }
  return out.slice(0, len);
}
// Видит ли текущий пользователь защищённый (техножрец) текст? ГМ — всегда; иначе
// техножрец (по умолчанию) или явно допущенный «знаток Бинарного Канта».
function userQualifiesBinary(cog) {
  if (game.user.isGM) return true;
  const acc = cog?.binaryAccess || {};
  if (Array.isArray(acc.users) && acc.users.includes(game.user.id)) return true;
  if (acc.techpriest !== false)
    return game.actors.some(a => a.type === "character" && a.isOwner && a.system?.isTechpriest);
  return false;
}
// Все команды страницы: скрытые (links) + встроенные маркер-ссылки 【L:page:cmd】текст【/L】.
function pageCommands(page) {
  const cmds = [];
  for (const l of (page?.links || [])) if (l.target) cmds.push({ cmd: linkCommand(l), target: l.target });
  const re = /【L:([^:】]+):([^】]*)】([\s\S]*?)【\/L】/g; let m;
  while ((m = re.exec(page?.body || ""))) {
    const cmd = (m[2] || "").trim().toLowerCase() || m[3].replace(/[\[\]\s]/g, "").toLowerCase();
    cmds.push({ cmd, target: m[1] });
  }
  return cmds;
}

export function getCog(journal) { return journal?.getFlag(NS, FLAG) || null; }
export function isCog(j) { return !!j?.getFlag?.(NS, FLAG); }
export function listCogitators() {
  return game.journal.filter(j => isCog(j) && (game.user.isGM || j.testUserPermission(game.user, "OBSERVER")));
}
// Корневая папка «КОГИТАТОРЫ» (флаг cogRoot). Создаёт при отсутствии (ГМ), сливает
// возможные дубли (гонка), переносит «бесхозные» когитаторы под неё. Блокировка от
// параллельных вызовов (кнопка контроля может сработать дважды).
let _cogRootPromise = null;
async function ensureCogRoot() {
  if (!game.user.isGM) return cogRoot();
  if (_cogRootPromise) return _cogRootPromise;
  _cogRootPromise = (async () => {
    const all = game.folders.filter(f => f.type === "JournalEntry" && f.getFlag(NS, "cogRoot"));
    let root = all[0] || await Folder.create({ name: "КОГИТАТОРЫ", type: "JournalEntry", flags: { [NS]: { cogRoot: true } } });
    // Слить дубли корня в один: их подпапки и когитаторы → в root, дубли удалить.
    for (const dup of all.filter(f => f.id !== root.id)) {
      const childFolders = game.folders.filter(f => f.folder?.id === dup.id);
      if (childFolders.length) await Folder.updateDocuments(childFolders.map(f => ({ _id: f.id, folder: root.id })));
      const js = game.journal.filter(j => j.folder?.id === dup.id);
      if (js.length) await JournalEntry.updateDocuments(js.map(j => ({ _id: j.id, folder: root.id })));
      await dup.delete();
    }
    // Бесхозные когитаторы → в root.
    const valid = new Set([root.id, ...game.folders.filter(f => f.folder?.id === root.id).map(f => f.id)]);
    const strays = game.journal.filter(j => isCog(j) && !(j.folder && valid.has(j.folder.id)));
    if (strays.length) await JournalEntry.updateDocuments(strays.map(j => ({ _id: j.id, folder: root.id })));
    return root;
  })();
  try { return await _cogRootPromise; } finally { _cogRootPromise = null; }
}
function cogRoot() { return game.folders.find(f => f.type === "JournalEntry" && f.getFlag(NS, "cogRoot")) || null; }
function cogSubfolders(root) { return root ? game.folders.filter(f => f.folder?.id === root.id) : []; }

async function createCogitator(folderId) {
  const root = await ensureCogRoot();
  const data = defaultCogitator();
  return JournalEntry.create({ name: "Когитатор: " + data.title, folder: folderId || root?.id || null, flags: { [NS]: { [FLAG]: data } } });
}

// Обычный сегмент: экранируем; при clickable — легаси-токены links → кликабельные.
function renderPlain(text, links, clickable) {
  let html = esc(text);
  if (clickable) {
    for (const link of links) {
      const tok = (link.token || "").trim();
      if (!tok || !link.target) continue;
      const safe = esc(tok);
      html = html.split(safe).join(`<a class="cog-link" data-target="${esc(link.target)}">${safe}</a>`);
    }
  }
  return html;
}
// Рендер тела: маркеры 【L:page:cmd】текст【/L】 (ссылка) и 【TP】текст【/TP】 (техножрец →
// прочим двоичный код). opts: { clickable, qualifies }.
function renderBody(page, opts = {}) {
  const clickable = !!opts.clickable;
  const qualifies = opts.qualifies !== false;
  const gmView = !!opts.gmView;   // ГМ видит исходник скрапкода
  const raw = page?.body || "";
  const links = page?.links || [];
  const re = /【L:([^:】]+):([^】]*)】([\s\S]*?)【\/L】|【TP】([\s\S]*?)【\/TP】|【S】([\s\S]*?)【\/S】|【B】([\s\S]*?)【\/B】/g;
  let out = "", last = 0, m;
  while ((m = re.exec(raw))) {
    out += renderPlain(raw.slice(last, m.index), links, clickable);
    if (m[3] !== undefined) {                       // ссылка
      const inner = esc(m[3]);
      out += clickable ? `<a class="cog-link" data-target="${esc(m[1])}">${inner}</a>` : inner;
    } else if (m[4] !== undefined) {                // техножрец → бинарь
      out += qualifies ? `<span class="cog-tp">${esc(m[4])}</span>`
                       : `<span class="cog-binary" title="Бинарный Кант">${esc(toBinary(m[4]))}</span>`;
    } else if (m[5] !== undefined) {                // скрапкод (повреждение)
      const inner = m[5];
      if (gmView) out += `<span class="cog-scrapcode cog-scrap-real">${esc(inner)}</span>`;
      else { const L = Math.min(Math.max(inner.length, 24), 300); out += `<span class="cog-scrapcode" data-len="${L}">${esc(scrapText(L))}</span>`; }
    } else {                                         // заблокировано (редакция)
      const inner = m[6];
      out += gmView ? `<span class="cog-locked cog-locked-real" title="Виден только ГМ">${esc(inner)}</span>`
                    : `<span class="cog-locked" title="Доступ закрыт">[ЗАБЛОКИРОВАНО]</span>`;
    }
    last = re.lastIndex;
  }
  out += renderPlain(raw.slice(last), links, clickable);
  return out;
}

// ── Менеджер когитаторов ────────────────────────────────────────────────────
export class CogitatorManager extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wh-cogitator-manager", classes: ["warhammer-dbc", "wh-holo", "wh-cog-manager"],
      title: "Когитаторы", template: "systems/warhammer-dbc/templates/apps/cogitator-manager.hbs",
      width: 560, height: 520, resizable: true
    });
  }
  getData() {
    const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const isGM = game.user.isGM;
    const root = cogRoot();
    const rootId = root?.id || null;
    const subs = cogSubfolders(root).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const validIds = new Set([rootId, ...subs.map(f => f.id)].filter(Boolean));

    const rows = listCogitators()
      .filter(j => j.folder && validIds.has(j.folder.id))
      .map(j => {
        const d = getCog(j);
        return { id: j.id, title: d?.title || j.name, pages: d?.pages?.length || 0,
          playerAccess: (j.ownership?.default ?? 0) >= L.OBSERVER, folderId: j.folder?.id || "" };
      });

    const mkGroup = (id, name, deletable) => ({ id, name, deletable, rows: rows.filter(r => r.folderId === (id || "")) });
    const groups = [ mkGroup(rootId, "КОГИТАТОРЫ", false),
      ...subs.map(f => mkGroup(f.id, f.name, true)) ]
      .filter(g => isGM || g.rows.length);

    return { isGM, groups, hasRoot: !!root };
  }
  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    el.querySelector("[data-act=create]")?.addEventListener("click", async () => {
      const root = await ensureCogRoot();
      const folderId = await this._promptCreate(root);
      if (folderId === undefined) return;
      const j = await createCogitator(folderId); this.render(false); openCogitator(j.id, true);
    });
    el.querySelector("[data-act=createfolder]")?.addEventListener("click", async () => {
      const name = await this._promptFolderName();
      if (name) { const root = await ensureCogRoot(); await Folder.create({ name, type: "JournalEntry", folder: root?.id || null }); this.render(false); }
    });

    // ── Drag-and-drop: тащим когитатор за ручку в папку ──
    el.querySelectorAll(".wh-cog-drag[data-cogid]").forEach(h => {
      h.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", h.dataset.cogid); e.dataTransfer.effectAllowed = "move"; h.closest(".wh-cog-mgr-row")?.classList.add("dragging"); });
      h.addEventListener("dragend", () => h.closest(".wh-cog-mgr-row")?.classList.remove("dragging"));
    });
    el.querySelectorAll("[data-dropfolder]").forEach(zone => {
      zone.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; zone.classList.add("drop-hover"); });
      zone.addEventListener("dragleave", e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("drop-hover"); });
      zone.addEventListener("drop", async e => {
        e.preventDefault(); zone.classList.remove("drop-hover");
        const j = game.journal.get(e.dataTransfer.getData("text/plain")); if (!j) return;
        const fid = zone.dataset.dropfolder || null;
        if ((j.folder?.id || "") !== (fid || "")) { await j.update({ folder: fid || null }); this.render(false); }
      });
    });
    el.querySelectorAll("[data-delfolder]").forEach(b => b.addEventListener("click", async () => {
      const f = game.folders.get(b.dataset.delfolder); if (!f) return;
      const ok = await Dialog.confirm({ title: "Удалить папку?", content: `<p>Удалить папку «${esc(f.name)}»? Когитаторы переместятся в корень.</p>` });
      if (ok) { await f.delete(); this.render(false); }
    }));
    el.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => openCogitator(b.dataset.open, false)));
    el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openCogitator(b.dataset.edit, true)));
    el.querySelectorAll("[data-access]").forEach(b => b.addEventListener("click", async () => {
      const j = game.journal.get(b.dataset.access); if (!j) return;
      const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
      const cur = j.ownership?.default ?? 0;
      await j.update({ "ownership.default": cur >= L.OBSERVER ? L.NONE : L.OBSERVER });
      this.render(false);
    }));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      const j = game.journal.get(b.dataset.del); if (!j) return;
      const ok = await Dialog.confirm({ title: "Удалить когитатор?", content: `<p>Удалить «${esc(j.name)}» безвозвратно?</p>` });
      if (ok) { await j.delete(); this.render(false); }
    }));
  }
  _promptFolderName() {
    return new Promise(resolve => {
      new Dialog({
        title: "Новая папка",
        content: `<div class="cog-dlg"><label>Название папки<input name="fn" autofocus/></label></div>`,
        buttons: {
          ok: { label: "Создать", callback: h => resolve(((h[0] ?? h).querySelector("[name=fn]").value || "").trim()) },
          cancel: { label: "Отмена", callback: () => resolve(null) }
        }, default: "ok"
      }).render(true);
    });
  }
  _promptCreate(root) {
    const subs = cogSubfolders(root).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const opts = [`<option value="${root?.id || ""}">КОГИТАТОРЫ (корень)</option>`,
      ...subs.map(f => `<option value="${f.id}">${esc(f.name)}</option>`)].join("");
    return new Promise(resolve => {
      new Dialog({
        title: "Новый когитатор",
        content: `<div class="cog-dlg"><label>Папка<select name="folder">${opts}</select></label></div>`,
        buttons: {
          ok: { label: "Создать", callback: h => resolve((h[0] ?? h).querySelector("[name=folder]").value) },
          cancel: { label: "Отмена", callback: () => resolve(undefined) }
        }, default: "ok"
      }).render(true);
    });
  }
}

// ── Консоль (просмотр / правка) ─────────────────────────────────────────────
export class CogitatorConsole extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc", "wh-cog"],
      template: "systems/warhammer-dbc/templates/apps/cogitator.hbs",
      width: 680, height: 640, resizable: true
    });
  }
  constructor(journalId, edit = false, options = {}) {
    super(options);
    this.options.id = "wh-cog-" + journalId;   // уникальный DOM-id на каждый когитатор
    this.journalId = journalId;
    this.mode = "view";
    this.currentPageId = null;
    this.selectedPageId = null;
    this.draft = null;
    this.cmdMsg = "";
    this.asPlayer = false;   // ГМ: смотреть глазами игрока (бинарь/скрапкод)
    if (edit && game.user.isGM) this._initDraft();
  }
  _initDraft() {
    this.draft = foundry.utils.deepClone(getCog(this.journal)) || defaultCogitator();
    this.selectedPageId = this.draft.startPage || this.draft.pages[0]?.id;
    this.mode = "edit";
  }
  _getHeaderButtons() {
    const btns = super._getHeaderButtons();
    if (game.user.isGM) {
      // Одна кнопка-тумблер: поведение определяется режимом в момент клика
      // (шапка appv1 не перестраивается при render(false)).
      btns.unshift({ label: "Правка ⇄ Консоль", class: "cog-hdr", icon: "fas fa-pen",
        onclick: () => {
          if (this.mode === "edit") { this.draft = null; this.mode = "view"; this.currentPageId = null; }
          else { this._initDraft(); }
          this.render(false);
        } });
      // Тумблер «глазами игрока»: бинарь/скрапкод как у игроков.
      btns.unshift({ label: "Глазами игрока ⇄ ГМ", class: "cog-hdr-eye", icon: "fas fa-eye",
        onclick: () => {
          if (this.mode === "edit") { this.draft = null; this.mode = "view"; this.currentPageId = null; }
          this.asPlayer = !this.asPlayer;
          this.render(false);
        } });
    }
    return btns;
  }

  // ── ПКМ-меню авторинга по телу страницы ──
  _showBodyMenu(ev, el) {
    const ta = el.querySelector("[name=page-body]");
    if (!ta) return;
    const d = this.draft;
    const page = this._page(d, this.selectedPageId);
    const s = ta.selectionStart, e = ta.selectionEnd;   // фиксируем выделение
    const hasSel = s !== e;
    document.querySelectorAll(".cog-ctxmenu").forEach(n => n.remove());
    const menu = document.createElement("div");
    menu.className = "cog-ctxmenu";
    const item = (label, fn, disabled = false) => {
      const b = document.createElement("div");
      b.className = "cog-ctxitem" + (disabled ? " disabled" : "");
      b.textContent = label;
      if (!disabled) b.addEventListener("mousedown", ie => { ie.preventDefault(); menu.remove(); fn(); });
      menu.appendChild(b);
    };
    const wrapSel = (pre, post) => {
      ta.value = ta.value.slice(0, s) + pre + ta.value.slice(s, e) + post + ta.value.slice(e);
      page.body = ta.value; this.render(false);
    };
    item("🔗 Сделать ссылкой…", () => this._linkDialog(ta, page, s, e), !hasSel);
    item("⚙ Требует техножреца (двоичный код)", () => wrapSel("【TP】", "【/TP】"), !hasSel);
    item("☠ Скрапкод (красная мешанина)", () => wrapSel("【S】", "【/S】"), !hasSel);
    item("🔒 Заблокировано ([ЗАБЛОКИРОВАНО] для игроков)", () => wrapSel("【B】", "【/B】"), !hasSel);
    item("🔑 Пароль / скрытая команда…", () => this._passwordDialog(page));
    item((d.clickableTokens ? "☑ " : "☐ ") + "Кликабельные токены", () => { d.clickableTokens = !d.clickableTokens; this.render(false); });
    menu.style.left = ev.clientX + "px"; menu.style.top = ev.clientY + "px";
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 6) + "px";
    if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 6) + "px";
    const close = e2 => { if (!menu.contains(e2.target)) { menu.remove(); document.removeEventListener("mousedown", close); } };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
  }
  _linkDialog(ta, page, s, e) {
    const sel = ta.value.slice(s, e);
    const opts = this.draft.pages.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    new Dialog({
      title: "Сделать ссылкой",
      content: `<div class="cog-dlg"><label>Переход на страницу<select name="tgt">${opts}</select></label>`
        + `<label>Команда для ввода (пусто = из текста)<input name="cmd" placeholder="напр. 1"/></label>`
        + `<div class="cog-dlg-hint">Текст «${esc(sel)}» станет ссылкой (кликабельной при включённых токенах; команда работает всегда).</div></div>`,
      buttons: {
        ok: { label: "Создать", callback: h => {
          const q = h[0] ?? h;
          const tgt = q.querySelector("[name=tgt]").value;
          const cmd = q.querySelector("[name=cmd]").value.trim();
          ta.value = ta.value.slice(0, s) + `【L:${tgt}:${cmd}】` + sel + `【/L】` + ta.value.slice(e);
          page.body = ta.value; this.render(false);
        } },
        cancel: { label: "Отмена" }
      }, default: "ok"
    }).render(true);
  }
  _passwordDialog(page) {
    const opts = this.draft.pages.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    new Dialog({
      title: "Пароль / скрытая команда",
      content: `<div class="cog-dlg"><label>Пароль / команда<input name="pw" placeholder="напр. ADMIN2847"/></label>`
        + `<label>Переход на страницу<select name="tgt">${opts}</select></label>`
        + `<div class="cog-dlg-hint">Скрытая команда: не видна в тексте, срабатывает при вводе в консоли.</div></div>`,
      buttons: {
        ok: { label: "Создать", callback: h => {
          const q = h[0] ?? h;
          const pw = q.querySelector("[name=pw]").value.trim();
          if (!pw) return;
          (page.links ||= []).push({ token: "", command: pw, target: q.querySelector("[name=tgt]").value });
          this.render(false);
        } },
        cancel: { label: "Отмена" }
      }, default: "ok"
    }).render(true);
  }
  get journal() { return game.journal.get(this.journalId); }
  _page(data, id) { return data?.pages?.find(p => p.id === id) || data?.pages?.[0] || null; }

  // Ввод команды/пароля: ищем ссылку, чья команда совпадает с введённым.
  _submitCommand(raw) {
    const cmd = (raw || "").trim();
    if (!cmd) return;
    const d = getCog(this.journal);
    const page = this._page(d, this.currentPageId);
    const norm = cmd.toLowerCase();
    const link = pageCommands(page).find(c => c.target && c.cmd === norm);
    if (link) { this.cmdMsg = ""; this.currentPageId = link.target; this.render(false); return; }
    // Универсальная команда «назад в меню», если не перехвачена явной ссылкой.
    if (["0", "назад", "back", "меню", "menu", "exit"].includes(norm) && d?.startPage && this.currentPageId !== d.startPage) {
      this.cmdMsg = ""; this.currentPageId = d.startPage; this.render(false); return;
    }
    this.cmdMsg = `> ${cmd}: КОМАНДА НЕ РАСПОЗНАНА`;
    this.render(false);
  }

  // Сохранение записи дневника. ГМ/владелец пишет напрямую; игрок — через сокет ГМу.
  _saveDiary(text) {
    const j = this.journal; if (!j) return;
    const d = getCog(j);
    const page = this._page(d, this.currentPageId);
    if (!page?.input) return;
    const shared = !!page.inputShared;
    const val = String(text ?? "").slice(0, 20000);
    if (game.user.isGM || j.isOwner) {
      const pages = foundry.utils.deepClone(d.pages || []);
      const pg = pages.find(p => p.id === page.id); if (!pg) return;
      if (shared) pg.inputText = val;
      else { (pg.entries ||= {})[game.user.id] = val; }
      j.update({ [`flags.${NS}.${FLAG}.pages`]: pages });   // хук updateJournalEntry перерисует консоли
    } else {
      game.socket.emit("system.warhammer-dbc", {
        action: "cogitatorDiary", journalId: this.journalId,
        pageId: page.id, text: val, shared, userId: game.user.id
      });
      this.cmdMsg = "> ЗАПИСЬ ОТПРАВЛЕНА";
      this.render(false);
    }
  }

  _stopScrap() { if (this._scrapTimer) { clearInterval(this._scrapTimer); this._scrapTimer = null; } }
  async close(options) { this._stopScrap(); return super.close(options); }

  getData() {
    const j = this.journal;
    if (!j) return { missing: true };
    this.options.title = (getCog(j)?.title || "Когитатор") + (this.mode === "edit" ? " — правка" : "");
    const isGM = game.user.isGM;

    if (this.mode === "edit") {
      const d = this.draft;
      const page = this._page(d, this.selectedPageId);
      this.selectedPageId = page?.id || null;
      const acc = d.binaryAccess ||= { techpriest: true, users: [] };
      return {
        edit: true, isGM,
        title: d.title, theme: d.theme,
        clickableTokens: !!d.clickableTokens,
        binTechpriest: acc.techpriest !== false,
        players: game.users.filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name, allowed: (acc.users || []).includes(u.id) })),
        startPage: d.startPage,
        pages: d.pages.map((p, i) => ({ id: p.id, name: p.name, selected: p.id === this.selectedPageId,
          idx: i, isFirst: i === 0, isLast: i === d.pages.length - 1 })),
        page: page ? {
          ...page,
          prompt: page.prompt ?? "ВВЕДИТЕ КОМАНДУ:",
          links: (page.links || []).map((lk, i) => ({ idx: i, token: lk.token, command: lk.command || "", target: lk.target })),
          pageOptions: d.pages.map(pp => ({ id: pp.id, name: pp.name }))
        } : null,
        pageOptions: d.pages.map(pp => ({ id: pp.id, name: pp.name }))
      };
    }

    const d = getCog(j);
    if (!this.currentPageId) this.currentPageId = d?.startPage || d?.pages?.[0]?.id || null;
    const page = this._page(d, this.currentPageId);
    const fg = page?.color || d?.theme?.fg || "#33ff66";
    const asPlayer = isGM && this.asPlayer;
    const qualifies = asPlayer ? false : userQualifiesBinary(d);
    const gmView = isGM && !asPlayer;
    // Страница-дневник: значение текущего пользователя (или общий текст) + сводка для ГМ.
    const inputPage   = !!page?.input;
    const inputShared = !!page?.inputShared;
    const inputValue  = inputPage
      ? (inputShared ? (page.inputText || "") : ((page.entries || {})[game.user.id] || ""))
      : "";
    const diaryEntries = (isGM && inputPage && !inputShared)
      ? Object.entries(page.entries || {})
          .map(([uid, txt]) => ({ name: game.users.get(uid)?.name || uid, text: txt }))
          .filter(e => e.text && e.text.trim())
      : [];
    return {
      edit: false, isGM, asPlayer,
      imageUrl: page?.image || "",
      bodyHtml: renderBody(page, { clickable: !!d?.clickableTokens, qualifies, gmView }),
      inputPage, inputShared, inputValue, diaryEntries,
      prompt: (page?.prompt ?? "ВВЕДИТЕ КОМАНДУ:"),
      cmdMsg: this.cmdMsg || "",
      style: `--cog-fg:${fg}; --cog-bg:${d?.theme?.bg || "#020a04"}; --cog-accent:${d?.theme?.accent || "#8dffb0"};`,
      crt: !!d?.theme?.crt
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    this._stopScrap();   // сброс таймера скрапкода перед каждой перерисовкой

    // Навигация по ссылкам-токенам (просмотр, запасной способ — клик).
    el.querySelectorAll(".cog-link[data-target]").forEach(a => a.addEventListener("click", () => {
      this.cmdMsg = ""; this.currentPageId = a.dataset.target; this.render(false);
    }));
    el.querySelector("[data-act=back]")?.addEventListener("click", () => {
      const d = getCog(this.journal); this.cmdMsg = ""; this.currentPageId = d?.startPage; this.render(false);
    });
    el.querySelector("[data-act=edit]")?.addEventListener("click", () => this._enterEdit());

    // ── Командная строка ──
    if (this.mode === "view") {
      const cmdInput = el.querySelector(".cog-hidden-input");
      const echo = el.querySelector(".cog-echo");
      if (cmdInput) {
        const focus = () => { try { cmdInput.focus(); } catch (e) {} };
        // На странице-дневнике фокус по умолчанию — в поле ввода записи, не в командную строку.
        if (!el.querySelector(".cog-input")) setTimeout(focus, 30);
        cmdInput.addEventListener("input", () => { if (echo) echo.textContent = cmdInput.value; });
        cmdInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); this._submitCommand(cmdInput.value); }
          else if (ev.key === "Escape") { cmdInput.value = ""; if (echo) echo.textContent = ""; }
        });
        el.querySelector(".cog-screen")?.addEventListener("mousedown", (e) => {
          if (e.target.closest("a,button,input,textarea")) return; setTimeout(focus, 0);
        });
      }

      // ── Страница-дневник: ввод прямо в терминал (автосейв по потере фокуса) ──
      const diaryTa = el.querySelector(".cog-input");
      if (diaryTa) {
        diaryTa.addEventListener("mousedown", e => e.stopPropagation());  // не рефокусить командную строку
        diaryTa.addEventListener("change", () => this._saveDiary(diaryTa.value));  // change = при blur, если менялось
        diaryTa.addEventListener("keydown", ev => {
          if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); diaryTa.blur(); }
        });
        // авто-высота под содержимое
        const grow = () => { diaryTa.style.height = "auto"; diaryTa.style.height = Math.max(90, diaryTa.scrollHeight) + "px"; };
        diaryTa.addEventListener("input", grow); setTimeout(grow, 0);
      }
      // Скрапкод в реальном времени: перегенерируем мешанину.
      this._stopScrap();
      const scraps = el.querySelectorAll(".cog-scrapcode[data-len]");
      if (scraps.length) {
        this._scrapTimer = setInterval(() => {
          scraps.forEach(s => { s.textContent = scrapText(Number(s.dataset.len) || 40); });
        }, 140);
      }
    }

    if (this.mode !== "edit") return;
    // ── Правка ──
    const d = this.draft;
    const rerender = () => this.render(false);
    el.querySelector("[name=cog-title]")?.addEventListener("change", e => { d.title = e.target.value; });
    el.querySelector("[name=theme-fg]")?.addEventListener("change", e => { d.theme.fg = e.target.value; });
    el.querySelector("[name=theme-bg]")?.addEventListener("change", e => { d.theme.bg = e.target.value; });
    el.querySelector("[name=theme-accent]")?.addEventListener("change", e => { d.theme.accent = e.target.value; });
    el.querySelector("[name=theme-crt]")?.addEventListener("change", e => { d.theme.crt = e.target.checked; });
    el.querySelector("[name=start-page]")?.addEventListener("change", e => { d.startPage = e.target.value; });
    el.querySelector("[name=clickable-tokens]")?.addEventListener("change", e => { d.clickableTokens = e.target.checked; });
    d.binaryAccess ||= { techpriest: true, users: [] };
    el.querySelector("[name=bin-techpriest]")?.addEventListener("change", e => { d.binaryAccess.techpriest = e.target.checked; });
    el.querySelectorAll("[data-binuser]").forEach(cb => cb.addEventListener("change", e => {
      const uid = cb.dataset.binuser; const arr = (d.binaryAccess.users ||= []);
      if (e.target.checked) { if (!arr.includes(uid)) arr.push(uid); } else d.binaryAccess.users = arr.filter(x => x !== uid);
    }));

    // ПКМ по телу страницы — меню действий над выделением.
    el.querySelector("[name=page-body]")?.addEventListener("contextmenu", ev => { ev.preventDefault(); this._showBodyMenu(ev, el); });

    el.querySelectorAll("[data-selpage]").forEach(b => b.addEventListener("click", () => { this.selectedPageId = b.dataset.selpage; rerender(); }));
    el.querySelector("[data-act=addpage]")?.addEventListener("click", () => { const p = newPage(); d.pages.push(p); this.selectedPageId = p.id; rerender(); });

    // ── Сортировка/поиск страниц ──
    const pf = el.querySelector(".cog-b-pagefilter");
    if (pf) {
      pf.addEventListener("input", () => {
        const q = pf.value.trim().toLowerCase();
        el.querySelectorAll(".cog-b-pagerow").forEach(row => {
          const nm = (row.querySelector(".cog-b-pagebtn")?.textContent || "").toLowerCase();
          row.style.display = (!q || nm.includes(q)) ? "" : "none";
        });
      });
    }
    const movePage = (id, dir) => {
      const i = d.pages.findIndex(p => p.id === id);
      const t = i + dir;
      if (i < 0 || t < 0 || t >= d.pages.length) return;
      const [pg] = d.pages.splice(i, 1); d.pages.splice(t, 0, pg);
      rerender();
    };
    el.querySelectorAll("[data-moveup]").forEach(b => b.addEventListener("click", () => movePage(b.dataset.moveup, -1)));
    el.querySelectorAll("[data-movedown]").forEach(b => b.addEventListener("click", () => movePage(b.dataset.movedown, +1)));
    el.querySelector("[data-act=delpage]")?.addEventListener("click", () => {
      if (d.pages.length <= 1) return;
      d.pages = d.pages.filter(p => p.id !== this.selectedPageId);
      if (d.startPage === this.selectedPageId) d.startPage = d.pages[0].id;
      this.selectedPageId = d.pages[0].id; rerender();
    });

    const page = this._page(d, this.selectedPageId);
    if (page) {
      el.querySelector("[name=page-name]")?.addEventListener("change", e => { page.name = e.target.value; rerender(); });
      el.querySelector("[name=page-title]")?.addEventListener("change", e => { page.title = e.target.value; });
      el.querySelector("[name=page-prompt]")?.addEventListener("change", e => { page.prompt = e.target.value; });
      el.querySelector("[name=page-body]")?.addEventListener("change", e => { page.body = e.target.value; });
      el.querySelector("[name=page-color]")?.addEventListener("change", e => { page.color = e.target.value; });
      el.querySelector("[name=page-color-clear]")?.addEventListener("click", () => { page.color = ""; rerender(); });
      // Изображение (эффект когитатора применяется в консоли)
      el.querySelector("[name=page-image]")?.addEventListener("change", e => { page.image = e.target.value.trim(); rerender(); });
      el.querySelector("[data-act=pickimg]")?.addEventListener("click", () => {
        const FP = foundry.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;
        new FP({ type: "image", current: page.image || "", callback: path => { page.image = path; rerender(); } }).render(true);
      });
      el.querySelector("[data-act=clearimg]")?.addEventListener("click", () => { page.image = ""; rerender(); });
      // Страница-дневник
      el.querySelector("[name=page-input]")?.addEventListener("change", e => { page.input = e.target.checked; rerender(); });
      el.querySelector("[name=page-input-shared]")?.addEventListener("change", e => { page.inputShared = e.target.checked; });
      el.querySelector("[data-act=addlink]")?.addEventListener("click", () => { (page.links ||= []).push({ token: "[1]", command: "", target: d.pages[0].id }); rerender(); });
      el.querySelectorAll("[data-linktoken]").forEach(inp => inp.addEventListener("change", e => { page.links[Number(inp.dataset.linktoken)].token = e.target.value; }));
      el.querySelectorAll("[data-linkcmd]").forEach(inp => inp.addEventListener("change", e => { page.links[Number(inp.dataset.linkcmd)].command = e.target.value; }));
      el.querySelectorAll("[data-linktarget]").forEach(sel => sel.addEventListener("change", e => { page.links[Number(sel.dataset.linktarget)].target = e.target.value; }));
      el.querySelectorAll("[data-linkdel]").forEach(b => b.addEventListener("click", () => { page.links.splice(Number(b.dataset.linkdel), 1); rerender(); }));
    }

    el.querySelector("[data-act=save]")?.addEventListener("click", () => this._save());
    el.querySelector("[data-act=cancel]")?.addEventListener("click", () => { this.draft = null; this.mode = "view"; this.currentPageId = null; this.render(false); });
  }

  _enterEdit() {
    if (!game.user.isGM) return;
    this._initDraft(); this.render(false);
  }
  async _save() {
    const j = this.journal;
    await j.update({ name: "Когитатор: " + (this.draft.title || "без имени"), [`flags.${NS}.${FLAG}`]: this.draft });
    this.draft = null; this.mode = "view"; this.currentPageId = null; this.render(false);
    ui.notifications?.info("Когитатор сохранён.");
    _refreshManager();
  }
}

// ── Открытие ────────────────────────────────────────────────────────────────
let _manager = null;
const _consoles = new Map();
function _refreshManager() { if (_manager?.rendered) _manager.render(false); }

export async function openCogitatorManager() {
  if (!_manager) _manager = new CogitatorManager();
  await ensureCogRoot();          // создаём корневую папку и переносим бесхозные когитаторы
  _manager.render(true);
  return _manager;
}
export function openCogitator(journalId, edit = false) {
  let app = _consoles.get(journalId);
  if (!app) { app = new CogitatorConsole(journalId, edit); _consoles.set(journalId, app); }
  else if (edit && game.user.isGM && app.mode !== "edit") app._enterEdit();
  app.render(true);
  return app;
}

// Живое обновление открытых консолей при изменении журнала (дневники, правки ГМ).
// В режиме правки не перерисовываем — чтобы не затирать черновик.
Hooks.on("updateJournalEntry", (doc) => {
  const app = _consoles.get(doc.id);
  if (app?.rendered && app.mode !== "edit") app.render(false);
});
