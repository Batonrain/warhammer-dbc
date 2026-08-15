import { BODY_TYPES, ZONES, STAR_CLASSES, STAR_CONFIGS, SYSTEM_FEATURES, BODY_SIZES, CLIMATE,
         HABITABILITY, ALLEGIANCE, XENOS_SPECIES, RESOURCE_TYPES, RESOURCE_ICONS, INHABITANTS,
         WORLD_CLASSES, WORLD_ENVIRONMENTS, TITHE_GRADES,
         generateSystem, generateAnomaly, generateEncounter,
         colonizeUpdate, ruinUpdate, genImprovements, IMP_CATEGORIES, improvementUpkeep, improvementOutput, improvementFlow } from "../constants/star-system.mjs";
import { esc } from "../helpers/utils.mjs";
import { openContextMenu } from "./context-menu.mjs";
import { whenEditable, onTab } from "./v2-helpers.mjs";

// Видно ли улучшение зрителю: secret → после раскрытия, hidden → после разведки, иначе всегда.
function impVisible(im, isGM, scouted, revealed) {
  return isGM || (im.secret ? !!revealed : (im.hidden ? !!scouted : true));
}
function visibleImps(s, isGM) {
  return (s.improvements || []).filter(im => impVisible(im, isGM, s.scouted, s.revealed));
}
// HTML-подсказка улучшения (для data-tooltip): категория, описание, НЕТТО «даёт / тратит».
function impTooltip(im, cat) {
  const lines = [`<b>${esc(im.name)}</b>${cat ? ` — <i>${cat.label}</i>` : ""}`];
  if (im.desc) lines.push(im.desc);
  const fmt = (obj) => Object.entries(obj || {}).filter(([, v]) => Number(v))
    .map(([k, v]) => `${RESOURCE_TYPES[k]?.label || k} +${v}`).join(", ");
  const { gives, spends } = improvementFlow(im);
  const g = fmt(gives), s = fmt(spends);
  if (g) lines.push(`<span style="color:#8cf0a0;">Даёт: ${g}</span>`);
  if (s) lines.push(`<span style="color:#f0968a;">Тратит: ${s}</span>`);
  return lines.join("<br>");
}
// Суммарный бонус ресурсов от заданного списка улучшений (эффективное производство:
// у военных оружие не учитывается — оно тратится, а не производится).
function bonusOf(imps) {
  const b = {};
  for (const im of (imps || [])) {
    const r = improvementOutput(im);
    for (const k of Object.keys(RESOURCE_TYPES)) if (Number(r[k])) b[k] = (b[k] || 0) + Number(r[k]);
  }
  return b;
}
// Эффективные ресурсы = база + бонус (видимых) улучшений.
function effRes(s, imps) {
  const base = s.resources || {}; const bonus = bonusOf(imps); const out = {};
  for (const k of Object.keys(RESOURCE_TYPES)) out[k] = (Number(base[k]) || 0) + (Number(bonus[k]) || 0);
  return out;
}

// Десятина взимается только с имперских миров (или потенциально — с пустых/заброшенных).
// С ксеносов, Хаоса и независимого человечества Империум десятину не взимает вовсе.
const IMPERIAL_ALLEG = ["imperial", "mechanicus", "astartes", "rogueTrader"];
function titheLabel(s) {
  const a = s.allegiance;
  const taxable = !a || a === "abandoned" || IMPERIAL_ALLEG.includes(a);
  if (!taxable) return "";                                   // ксеносы / хаос / независимые люди
  if (!["planet", "moon"].includes(s.bodyType)) return "";   // десятина — у миров, не у станций
  if (s.tithe) return TITHE_GRADES[s.tithe] || s.tithe;
  return "Aptus Non";                                        // имперский/пустой мир без заданного уровня
}

// Планета с жизнью (для особой пометки).
const LIFE_HAB = ["limitedEcosystem", "verdant"];
function isLifeWorld(s) {
  return (["planet", "moon", "gasGiant"].includes(s.bodyType) && LIFE_HAB.includes(s.habitability)) || !!s.exotic;
}

function xenosLabel(s) {
  if (!s.xenosSpecies) return "";
  return s.xenosSpecies === "other" ? (s.xenosCustom || "ксеносы") : (XENOS_SPECIES[s.xenosSpecies] || "ксеносы");
}

// Принадлежность тела: {label, key} для цветного «бейджа» владельца.
function ownerInfo(s) {
  const a = s.allegiance;
  if (!a) return null;
  if (a === "xenos") { const xl = xenosLabel(s); return { label: xl || "Ксеносы", key: "xenos" }; }
  if (a === "mechanicus") return { label: "⚙ Механикус", key: "mechanicus" };
  if (a === "astartes") return { label: "Астартес", key: "astartes" };
  if (a === "humans") return { label: "Человечество", key: "humans" };
  if (a === "abandoned") return { label: "Заброшено", key: "abandoned" };
  if (a === "unknown") return null;
  if (a === "rogueTrader") {
    // Имя династии — только явно заданное на планете (НПС-ВТ ведёт ГМ нарративно).
    const d = s.dynasty;
    return { label: d ? `⚜ ${d}` : "Вольные Торговцы", key: "rogueTrader" };
  }
  return { label: ALLEGIANCE[a] || a, key: a };
}

// Краткая сводка-строка тела (физика + ресурсы; владелец вынесен в бейдж).
// eff — эффективные ресурсы (база + видимые улучшения).
function bodySummary(b, eff) {
  const s = b.system || {};
  const t = s.bodyType;
  const parts = [];
  if (t === "star") parts.push(STAR_CLASSES[s.starClass] || "");
  if (t === "planet" || t === "gasGiant" || t === "moon") {
    if (s.worldEnv && s.worldEnv !== "temperate") parts.push(WORLD_ENVIRONMENTS[s.worldEnv]);
    if (s.bodySize) parts.push(BODY_SIZES[s.bodySize]);
    if (s.climate)  parts.push(CLIMATE[s.climate]);
    if (s.habitability && s.habitability !== "inhospitable") parts.push("🌱 " + HABITABILITY[s.habitability]);
  }
  return parts.filter(Boolean).join(" · ");   // только физика; ресурсы — отдельной строкой чипами
}
// Ресурсы тела чипами {label,value,icon} (эффективные = база + видимые улучшения).
function resourceChips(eff) {
  const r = eff || {};
  return Object.entries(RESOURCE_TYPES)
    .filter(([k]) => Number(r[k]) > 0)
    .map(([k, v]) => ({ label: v.label, value: r[k], icon: RESOURCE_ICONS[k] || "" }));
}

// Имена, уже занятые в мире (для уникальности генерации).
function worldNames() {
  const set = new Set();
  for (const a of game.actors) {
    if (a.type === "starSystem") set.add(a.name);
    for (const i of a.items) if (i.type === "celestialBody") set.add(i.name);
  }
  return set;
}

// ── Действия листа ───────────────────────────────────────────────────────────
// Как на листах Орды и техники (wdbc-ff4.10.1, wdbc-ff4.10.4): ApplicationV2
// зовёт обработчик [data-action] с this = лист и элементом-источником вторым
// аргументом. Обычные функции — чтобы карта действий сверялась с шаблоном тестом.
// Общая обвязка (whenEditable, onTab) — в v2-helpers.mjs.

// Свернуть/развернуть группу звезды и досье тела — чистая разметка, доступна
// и наблюдателю: смотреть систему может тот, кто её не правит.
function onStarToggle(event, target) {
  target.closest(".ss-star-group")?.classList.toggle("ss-collapsed");
}
function onBodyToggle(event, target) {
  target.classList.toggle("ss-open");
}

// Переключатель «показать игрокам» (только ГМ; кнопка и рисуется только ему).
function onBodyReveal(event, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  const item = this.actor.items.get(id);
  if (item) return item.update({ "system.revealed": !item.system.revealed });
}

function onBodyCreate()      { return this._createBodyDialog(); }
function onSystemGenerate()  { return this._generateDialog(); }
function onSystemAnomaly()   { return this._addAnomaly(); }
function onSystemEncounter() { return this._addEncounter(); }
function onSystemJournal()   { return this._journalPin(); }
function onSystemClear()     { return this._clearBodies(); }

export class WarhammerStarSystemSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    // star-system-sheet — на самой форме листа: CSS цепляется за
    // «.warhammer-dbc.star-system-sheet», а у V1 этот класс нёс <form> в шаблоне.
    classes: ["warhammer-dbc", "sheet", "actor", "star-system", "wh-holo", "star-system-sheet"],
    position: { width: 740, height: 740 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      tab: onTab,
      // Свернуть группу и раскрыть досье — только разметка, права не нужны.
      starToggle: onStarToggle,
      bodyToggle: onBodyToggle,
      bodyReveal:      whenEditable(onBodyReveal),
      bodyCreate:      whenEditable(onBodyCreate),
      systemGenerate:  whenEditable(onSystemGenerate),
      systemAnomaly:   whenEditable(onSystemAnomaly),
      systemEncounter: whenEditable(onSystemEncounter),
      systemJournal:   whenEditable(onSystemJournal),
      systemClear:     whenEditable(onSystemClear)
    }
  };

  static PARTS = {
    body: { template: "systems/warhammer-dbc/templates/actor/star-system-sheet.hbs", root: true }
  };

  static TABS = {
    primary: {
      initial: "overview",
      tabs: [
        { id: "overview", label: "Обзор",   icon: "fas fa-solar-panel" },
        { id: "notes",    label: "Записи",  icon: "fas fa-file-lines" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.tab = this.tabGroups?.primary ?? WarhammerStarSystemSheet.TABS.primary.initial;
    const sys = this.actor.system;
    context.system  = sys;
    context.derived = sys.derived || {};
    const isGM = game.user.isGM;
    context.isGM = isGM;

    const regions = game.settings.get("warhammer-dbc", "regions") || [];
    const currentRegion = (sys.region || "").trim();
    if (currentRegion && !regions.includes(currentRegion)) {
      regions.unshift(currentRegion);
    }
    context.regions = regions;

    const bodies = this.actor.items.filter(i => i.type === "celestialBody");
    const byId = new Map(bodies.map(b => [b.id, b]));
    const mk = (b, depth, parentName) => {
      const s = b.system || {};
      const scouted = isGM || !!s.scouted;          // разведано (общие данные видны)
      const mask = !scouted && !!s.signal;          // для игроков — «Неопознанный сигнал»
      const owner = scouted ? ownerInfo(s) : null;
      const hasSecret = !!(s.gmNotes || (s.defense && (s.defense.weapons || s.defense.garrison || s.defense.strength)));
      // Досье: описание (после разведки) + истинная природа (после раскрытия).
      const showLore = isGM || !!s.revealed;
      const dossier = {
        blocked: !scouted,
        desc: scouted ? (s.description || "") : "",
        lore: (scouted && showLore) ? (s.gmNotes || "") : "",
        descDim: isGM && !s.scouted,    // ГМ видит, но игрок ещё нет (не разведано)
        loreDim: isGM && !s.revealed    // ГМ видит тайну, игрок — нет (не раскрыто)
      };
      const hasDossier = !!(s.description || s.gmNotes);
      // Улучшения: ГМ видит все (с пометкой видимости игроку), игрок — только видимые.
      const allImps = mask ? [] : (s.improvements || []);
      const eff = effRes(s, isGM ? allImps : visibleImps(s, false));
      const impChips = (isGM ? allImps : visibleImps(s, false)).map(im => {
        const cat = IMP_CATEGORIES[im.cat];
        return {
          name: im.name,
          catSvg: cat ? cat.svg : "",
          catLabel: cat ? cat.label : "",
          cat: im.cat || "",
          tip: impTooltip(im, cat),
          dim: isGM && !impVisible(im, false, s.scouted, s.revealed),   // ещё не видно игрокам
          flag: isGM && im.secret ? "🔒" : isGM && im.hidden ? "🕵" : ""
        };
      });
      // Состояние видимости тела игроку (для ГМ-подсветки строки).
      const plState = isGM ? (!s.scouted ? "hidden" : (s.revealed ? "revealed" : "scouted")) : "";
      return {
        id: b.id, name: mask ? "Неопознанный сигнал" : b.name, depth, pad: depth * 26, isChild: depth > 0,
        parentName: parentName || "",
        icon: mask ? "📡" : (BODY_TYPES[s.bodyType]?.icon || "•"),
        typeLabel: mask ? "неопознанный сигнал" : (BODY_TYPES[s.bodyType]?.label || s.bodyType),
        owner, presence: scouted ? (s.presence || "") : "",
        lifeWorld: scouted && isLifeWorld(s),
        tithe: scouted ? titheLabel(s) : "",
        impChips, plState,
        summary: scouted ? bodySummary(b, eff) : "",
        resChips: scouted ? resourceChips(eff) : [],
        scouted: !!s.scouted, unscouted: !scouted,   // unscouted: показать «не разведано» (только у игроков)
        hasDossier, dossier,
        // Секрет (оборона / истинная природа) виден ГМу всегда; игрокам — после раскрытия.
        hasSecret, revealed: !!s.revealed,
        showLock: isGM && hasSecret,
        showScout: isGM
      };
    };
    const isStar = (b) => b.system.bodyType === "star";
    const childrenOf = (pid) => bodies.filter(b => !isStar(b) && (b.system.parentId || "") === pid)
      .sort((a, b) => a.name.localeCompare(b.name));
    const flatten = (b, depth, parentName, out) => {
      out.push(mk(b, depth, parentName));
      for (const c of childrenOf(b.id)) flatten(c, depth + 1, b.name, out);
    };
    // Зоны для набора тел, орбитирующих вокруг звезды(звёзд).
    const zoneOrder = ["innerCauldron", "primaryBiosphere", "outerReaches"];
    const buildZones = (orbiting) => {
      const zones = [];
      for (const z of [...zoneOrder, ""]) {
        const zb = orbiting.filter(b => (b.system.zone || "") === z);
        if (!zb.length) continue;
        const rows = []; zb.forEach(b => flatten(b, 0, "", rows));
        zones.push({ key: z, label: z ? ZONES[z] : "Прочие орбиты", rows });
      }
      return zones;
    };

    // Группировка по звёздам (кратные звёзды → группы; планеты под своей звездой).
    const stars = bodies.filter(isStar);
    const groupsMap = new Map();
    for (const st of stars) {
      const gi = Number(st.system.starGroup) || 0;
      if (!groupsMap.has(gi)) groupsMap.set(gi, []);
      groupsMap.get(gi).push(st);
    }
    context.starGroups = [];
    for (const [gi, gstars] of [...groupsMap.entries()].sort((a, b) => a[0] - b[0])) {
      const starIds = new Set(gstars.map(s => s.id));
      const orbiting = bodies.filter(b => !isStar(b) && starIds.has(b.system.parentId || ""));
      context.starGroups.push({
        idx: gi,
        stars: gstars.map(s => ({ id: s.id, name: s.name, classLabel: STAR_CLASSES[s.system.starClass] || s.system.starClass || "звезда" })),
        note: gstars[0]?.system.orbitalFeatures || "",
        zones: buildZones(orbiting)
      });
    }
    // Орфаны: тела без звезды-родителя (ручные, либо потерянная орбита).
    const orphans = bodies.filter(b => !isStar(b) && (!b.system.parentId || !byId.has(b.system.parentId)));
    context.orphanZones = orphans.length ? buildZones(orphans) : [];

    const active = sys.systemFeatures || [];
    context.featureOptions = Object.entries(SYSTEM_FEATURES).map(([key, label]) => ({ key, label, active: active.includes(key) }));

    const inh = sys.inhabitants || [];
    context.inhabitantLabels = inh.map(k => INHABITANTS[k]).filter(Boolean).join(", ");
    context.xenosLabel = sys.xenosSpecies ? (XENOS_SPECIES[sys.xenosSpecies] || sys.xenosSpecies) : "";

    const counts = context.derived.counts || {};
    context.typeCounts = Object.entries(counts).map(([k, v]) => ({ icon: BODY_TYPES[k]?.icon || "•", label: BODY_TYPES[k]?.label || k, count: v }));
    // Сводка ресурсов: ГМ видит всё, игроки — только по разведанным телам.
    const resBodies = bodies.filter(b => isGM || b.system.scouted);
    const sum = {};
    for (const b of resBodies) {
      const r = effRes(b.system, visibleImps(b.system, isGM));
      for (const k of Object.keys(RESOURCE_TYPES)) sum[k] = (sum[k] || 0) + (Number(r[k]) || 0);
    }
    context.resourceSummary = Object.entries(RESOURCE_TYPES).filter(([k]) => Number(sum[k]) > 0)
      .map(([k, v]) => ({ label: v.label, value: sum[k], icon: RESOURCE_ICONS[k] || "" }));

    context.hasJournal = !!sys.journalUuid;
    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;

    // ПКМ по строке тела. Наблюдателю — только «открыть лист»: полное меню
    // правит документы, и до перевода на V2 оно так же гасилось isEditable.
    el.querySelectorAll(".ss-body-row, .ss-star-line").forEach(row => {
      row.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const item = this.actor.items.get(row.dataset.itemId);
        if (!item) return;
        if (!this.isEditable) return void item.sheet.render(true);
        openContextMenu(ev, this._bodyMenuEntries(item));
      });
    });

    if (!this.isEditable) return;

    // Особенности системы — набор галок, а не действие: [data-action] сработал
    // бы и по клику мимо галки, а нужно именно новое состояние checkbox.
    el.querySelectorAll(".system-feature-cb").forEach(cb => cb.addEventListener("change", ev => {
      const key = ev.currentTarget.dataset.key;
      const set = new Set(this.actor.system.systemFeatures || []);
      ev.currentTarget.checked ? set.add(key) : set.delete(key);
      this.actor.update({ "system.systemFeatures": [...set] });
    }));
  }

  /** Пункты меню строки тела: состав зависит от прав и типа тела. */
  _bodyMenuEntries(item) {
    const isGM = game.user.isGM;
    // Экстракциумы может ставить ГМ или игрок с персонажем-Вольным Торговцем
    const canExtr = isGM || game.actors.some(a => a.type === "character" && a.isOwner && a.system?.isRogueTrader);
    const bt = item.system.bodyType;
    const extrBody = ["planet", "gasGiant", "moon", "station", "asteroid", "belt"].includes(bt);
    const scoutLbl  = item.system.scouted  ? "Скрыть разведку"   : "Разведать планету";
    const revealLbl = item.system.revealed ? "Скрыть тайны от игроков" : "Раскрыть тайны игрокам";

    const entries = [{ cls: "wh-ctx-edit", label: "📖 Открыть лист", onClick: () => item.sheet.render(true) }];
    if (isGM) entries.push(
      { cls: "wh-ctx-scout", label: `${item.system.scouted ? "🙈" : "🔭"} ${scoutLbl}`,
        onClick: () => item.update({ "system.scouted": !item.system.scouted }) },
      { cls: "wh-ctx-reveal", label: `${item.system.revealed ? "🔒" : "👁"} ${revealLbl}`,
        onClick: () => item.update({ "system.revealed": !item.system.revealed }) }
    );
    if (canExtr && extrBody) entries.push(
      { sep: true },
      { cls: "wh-ctx-extractium", label: "⛏ Мобильные Экстракциумы…", onClick: () => this._extractiumDialog(item) }
    );
    if (isGM) entries.push(
      { sep: true },
      { cls: "wh-ctx-colony",   label: "🏗 Развитие колонии",      onClick: () => this._colonyDevDialog(item) },
      { cls: "wh-ctx-colonize", label: "👥 Заселить…",             onClick: () => this._colonizeDialog(item) },
      { cls: "wh-ctx-destroy",  label: "💥 Уничтожить цивилизацию", onClick: () => this._destroyCivilization(item) },
      { cls: "wh-ctx-delete",   label: "🗑 Удалить",               onClick: () => item.delete() }
    );
    return entries;
  }

  async _addAnomaly() {
    const body = generateAnomaly({ avoid: worldNames() });
    const [it] = await this.actor.createEmbeddedDocuments("Item", [body], { keepId: true });
    ui.notifications.info("Аномалия добавлена (детали — в листе тела, раздел ГМа).");
    it?.sheet.render(true);
  }

  async _addEncounter() {
    const body = generateEncounter({ avoid: worldNames() });
    const [it] = await this.actor.createEmbeddedDocuments("Item", [body], { keepId: true });
    ui.notifications.info("Встреча добавлена (подвох — в заметках ГМа).");
    it?.sheet.render(true);
  }

  // Заселить тело выбранной фракцией (любое доступное ей присутствие).
  _colonizeDialog(item) {
    const fopts = Object.entries(INHABITANTS)
      .filter(([k]) => !["uncharted", "uninhabited"].includes(k))
      .map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const xopts = Object.entries(XENOS_SPECIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    // Династии (для Вольных Торговцев): династия игрока + список из настроек
    const playerDyn = game.settings.get("warhammer-dbc", "playerDynasty") || "";
    const dynSet = new Set([playerDyn, ...(game.settings.get("warhammer-dbc", "dynasties") || [])].filter(Boolean));
    const dopts = `<option value="">— без династии —</option>` +
      [...dynSet].map(d => `<option value="${d}" ${d === playerDyn ? "selected" : ""}>${d}</option>`).join("");
    // Класс мира (для имперских ветвей): «авто» или конкретный тип.
    const wcopts = `<option value="">— авто (по фракции/жизни) —</option>` +
      Object.entries(WORLD_CLASSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const isPlanet = (item.system.bodyType || "planet") === "planet";
    // Не <form>: содержимое DialogV2 уже лежит внутри его собственной формы,
    // вложенная сломала бы button.form, через который читаются поля.
    return foundry.applications.api.DialogV2.wait({
      window: { title: `Заселить: ${item.name}` },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 420 },
      content: `<div class="ss-gen">
        <section class="ss-gen-cols">
          <label class="ss-gen-field"><span>Фракция</span><select id="col-fac">${fopts}</select></label>
          <label class="ss-gen-field"><span>Вид ксеносов</span><select id="col-xeno">${xopts}</select></label>
          <label class="ss-gen-field ss-col-dyn" style="display:none; grid-column:1 / -1;"><span>Династия (ВТ)</span><select id="col-dyn">${dopts}</select></label>
          ${isPlanet ? `<label class="ss-gen-field ss-col-wc" style="grid-column:1 / -1;"><span>Класс мира</span><select id="col-wc">${wcopts}</select></label>` : ""}
        </section>
        <p class="ss-gen-hint">Присутствие подбирается по фракции автоматически (у Друкхари, Стиксис и Азуриан колоний не бывает — будет опорная точка). Класс мира задаётся вручную только для имперских ветвей (Империум/Механикус/Астартес/Вольный Торговец). Оборона перегенерируется.</p>
      </div>`,
      buttons: [
        {
          action: "ok", label: "Заселить", icon: "fas fa-users", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const key = form.querySelector("#col-fac").value;
            const sp = key === "xenos" ? form.querySelector("#col-xeno").value : "";
            const wc = form.querySelector("#col-wc")?.value || "";
            const upd = colonizeUpdate(key, sp, item.system, wc);
            if (key === "rogueTrader") upd["system.dynasty"] = form.querySelector("#col-dyn").value || "";
            await item.update(upd);
            ui.notifications.info(`«${item.name}» заселено: ${INHABITANTS[key]}.`);
          }
        },
        { action: "cancel", label: "Отмена" }
      ],
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        const impBranch = ["imperium", "mechanicus", "astartes", "rogueTrader"];
        const fac = form.querySelector("#col-fac");
        const toggle = () => {
          const k = fac.value;
          const dyn = form.querySelector(".ss-col-dyn");
          const wc  = form.querySelector(".ss-col-wc");
          if (dyn) dyn.style.display = k === "rogueTrader" ? "" : "none";
          if (wc)  wc.style.display  = impBranch.includes(k) ? "" : "none";
        };
        fac.addEventListener("change", toggle);
        toggle();
      }
    });
  }

  // Мобильные Экстракциумы: какие добываемые ресурсы качать в доход протектората.
  _extractiumDialog(item) {
    const base = item.system.resources || {};
    const impBonus = {};
    for (const imp of (item.system.improvements || []))
      for (const k in (imp.res || {})) impBonus[k] = (impBonus[k] || 0) + Number(imp.res[k] || 0);
    const RAW   = Object.entries(RESOURCE_TYPES).filter(([, d]) => d.cat === "raw").map(([k]) => k);
    const inst  = Array.isArray(item.system.extractiums) ? item.system.extractiums : [];
    const avail = RAW.filter(k => (Number(base[k]) || 0) > 0 || impBonus[k]);
    if (!avail.length) { ui.notifications.info(`«${item.name}»: нет добываемых ресурсов.`); return; }
    const rows = avail.map(k => {
      const v = (Number(base[k]) || 0) + (impBonus[k] || 0);
      return `<label class="ss-extr-row"><input type="checkbox" class="ss-extr-cb" data-res="${k}" ${inst.includes(k) ? "checked" : ""}/>
        <img src="${RESOURCE_ICONS[k]}"/> <span>${RESOURCE_TYPES[k].label}</span> <b>${v}</b></label>`;
    }).join("");
    return foundry.applications.api.DialogV2.wait({
      window: { title: `Мобильные Экстракциумы — ${item.name}` },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 360 },
      content: `<div class="ss-extr-form"><p class="ss-gen-hint">Отмеченные ресурсы добываются Экстракциумом и идут в доход протектората.</p>${rows}</div>`,
      buttons: [
        {
          action: "ok", label: "Сохранить", icon: "fas fa-gears", default: true,
          callback: async (event, button) => {
            const next = [...button.form.querySelectorAll(".ss-extr-cb:checked")].map(cb => cb.dataset.res);
            await item.update({ "system.extractiums": next });
            ui.notifications.info(`«${item.name}»: Экстракциумы обновлены (${next.length}).`);
          }
        },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  // Уничтожить цивилизацию на теле → руины (если масштаб предполагает).
  async _destroyCivilization(item) {
    const up = ruinUpdate(item.system);
    if (!up) { ui.notifications.warn("На этом объекте нет цивилизации, которую можно уничтожить."); return; }
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Уничтожить цивилизацию" },
      content: `<p>Уничтожить всё население и инфраструктуру на <b>${esc(item.name)}</b>? Объект превратится в руины. Действие необратимо.</p>`
    });
    if (ok) { await item.update(up); ui.notifications.info(`«${item.name}»: цивилизация уничтожена.`); }
  }

  // ── Развитие колонии: улучшения, дающие ресурсы сверх базовых ──
  _colonyDevKey(s) {
    const a = s.allegiance;
    const map = { imperial: "imperium", mechanicus: "mechanicus", astartes: "astartes", rogueTrader: "rogueTrader", humans: "humans", xenos: "xenos" };
    return map[a] || "imperium";
  }

  _colonyDevDialog(item) {
    const imps = item.system.improvements || [];
    const rowsHtml = imps.map(im => {
      const bonus = Object.entries(RESOURCE_TYPES).filter(([k]) => Number(im.res?.[k]))
        .map(([k, v]) => `${v.label} +${im.res[k]}`).join(", ");
      return `<div class="ss-imp-row" data-id="${im.id}">
        <div class="ss-imp-head">
          <b>${esc(im.name)}</b>
          <span class="ss-imp-tools">
            <button type="button" class="imp-flag${im.hidden ? " on" : ""}" data-flag="hidden" title="Скрыт до разведки">🕵</button>
            <button type="button" class="imp-flag${im.secret ? " on" : ""}" data-flag="secret" title="Тайное (видно после раскрытия)">🔒</button>
            <button type="button" class="imp-del" title="Удалить">✕</button>
          </span>
        </div>
        ${im.desc ? `<div class="ss-imp-desc">${im.desc}</div>` : ""}
        ${bonus ? `<div class="ss-imp-bonus">${bonus}</div>` : ""}
      </div>`;
    }).join("") || `<p class="ss-imp-empty">Улучшений пока нет.</p>`;
    const resInputs = Object.entries(RESOURCE_TYPES)
      .map(([k, v]) => `<label class="ss-imp-res"><span>${v.label}</span><input type="number" data-res="${k}" value="0"/></label>`).join("");
    const catOpts = `<option value="">— без категории —</option>` +
      Object.entries(IMP_CATEGORIES).map(([k, def]) => `<option value="${k}">${def.label}</option>`).join("");

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Развитие колонии — ${item.name}`, resizable: true },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 620, height: 600 },
      content: `<div class="ss-colony">
        <div class="ss-imp-list">${rowsHtml}</div>
        <div class="ss-imp-actions">
          <button type="button" class="imp-add" title="Добавить своё улучшение">＋ Улучшение</button>
          <button type="button" class="imp-gen" title="Сгенерировать по типу объекта">🎲 Сгенерировать</button>
        </div>
        <div class="ss-imp-form" style="display:none;">
          <div class="weapon-row"><input type="text" class="imp-name" placeholder="Название (указ, закон, здание, объект…)"/></div>
          <div class="weapon-row"><select class="imp-cat">${catOpts}</select></div>
          <div class="weapon-row"><input type="text" class="imp-desc" placeholder="Что оно даёт объекту"/></div>
          <div class="ss-imp-chks">
            <label class="ss-imp-chk"><input type="checkbox" class="imp-hidden"/> Скрыт до разведки</label>
            <label class="ss-imp-chk"><input type="checkbox" class="imp-secret"/> Тайное</label>
          </div>
          <div class="ss-imp-grid">${resInputs}</div>
          <div class="ss-imp-form-foot"><button type="button" class="imp-save">Добавить</button></div>
        </div>
      </div>`,
      buttons: [{ action: "close", label: "Закрыть", default: true }],
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        // Список перерисовывается пересозданием окна: строк немного, а вручную
        // сшивать разметку с флагами — тот самый дубль, из-за которого правки
        // и расходились с данными.
        const reopen = async (update) => { await item.update(update); dialog.close(); this._colonyDevDialog(item); };
        const idOf = el => el.closest(".ss-imp-row").dataset.id;

        form.querySelectorAll(".imp-del").forEach(b => b.addEventListener("click", ev =>
          reopen({ "system.improvements": imps.filter(i => i.id !== idOf(ev.currentTarget)) })));

        form.querySelectorAll(".imp-flag").forEach(b => b.addEventListener("click", ev => {
          const id = idOf(ev.currentTarget);
          const flag = ev.currentTarget.dataset.flag;
          reopen({ "system.improvements": imps.map(i => i.id === id ? { ...i, [flag]: !i[flag] } : i) });
        }));

        const impForm = form.querySelector(".ss-imp-form");
        form.querySelector(".imp-add").addEventListener("click", () => {
          impForm.style.display = impForm.style.display === "none" ? "" : "none";
        });

        form.querySelector(".imp-gen").addEventListener("click", () => {
          const add = genImprovements({ worldClass: item.system.worldClass, key: this._colonyDevKey(item.system), sp: item.system.xenosSpecies, bodyType: item.system.bodyType, size: item.system.bodySize, count: 1 });
          reopen({ "system.improvements": [...imps, ...add] });
        });

        form.querySelector(".imp-save").addEventListener("click", () => {
          const name = (form.querySelector(".imp-name").value || "").trim();
          if (!name) { ui.notifications.warn("Введите название улучшения."); return; }
          const res = {};
          form.querySelectorAll("[data-res]").forEach(el => { const v = Number(el.value) || 0; if (v) res[el.dataset.res] = v; });
          const imp = { id: foundry.utils.randomID(), name, desc: (form.querySelector(".imp-desc").value || "").trim(), res,
            cat: form.querySelector(".imp-cat").value || "",
            hidden: form.querySelector(".imp-hidden").checked, secret: form.querySelector(".imp-secret").checked };
          reopen({ "system.improvements": [...imps, imp] });
        });
      }
    });
  }

  _createBodyDialog() {
    const opts = Object.entries(BODY_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join("");
    const zopts = `<option value="">— без зоны —</option>` + Object.entries(ZONES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const popts = `<option value="">— звезда / система —</option>` +
      this.actor.items.filter(i => i.type === "celestialBody").map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
    const xopts = `<option value="">—</option>` + Object.entries(XENOS_SPECIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Добавить небесное тело" },
      classes: ["warhammer-dbc", "wh-holo"],
      content: `<div class="wh-wizard-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Тип:</label><select id="cb-type">${opts}</select></div>
        <div class="atk-dlg-row"><label>Зона:</label><select id="cb-zone">${zopts}</select></div>
        <div class="atk-dlg-row"><label>Орбита:</label><select id="cb-parent">${popts}</select></div>
        <div class="atk-dlg-row"><label>Ксеносы:</label><select id="cb-xeno">${xopts}</select></div>
      </div>`,
      buttons: [
        {
          action: "add", label: "Добавить", icon: "fas fa-plus", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const bodyType = form.querySelector("#cb-type").value;
            const system = { bodyType, zone: form.querySelector("#cb-zone").value,
                             parentId: form.querySelector("#cb-parent").value,
                             xenosSpecies: form.querySelector("#cb-xeno").value };
            const [it] = await this.actor.createEmbeddedDocuments("Item", [{ name: BODY_TYPES[bodyType]?.label || "Тело", type: "celestialBody", system }]);
            it?.sheet.render(true);
          }
        },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  _generateDialog() {
    const inhRows = Object.entries(INHABITANTS).map(([k, v]) =>
      `<label class="ss-gen-opt"><input type="checkbox" class="gen-inh" value="${k}"/><span>${v}</span></label>`).join("");
    const xopts = Object.entries(XENOS_SPECIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const scopts = `<option value="" selected>Случайно</option>` + Object.entries(STAR_CLASSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const wcopts = Object.entries(WORLD_CLASSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    // Династии (для Вольных Торговцев): династия игрока + список из настроек.
    const playerDyn = game.settings.get("warhammer-dbc", "playerDynasty") || "";
    const dynSet = new Set([playerDyn, ...(game.settings.get("warhammer-dbc", "dynasties") || [])].filter(Boolean));
    const dopts = `<option value="">— без династии —</option>` +
      [...dynSet].map(d => `<option value="${d}" ${d === playerDyn ? "selected" : ""}>${d}</option>`).join("");
    const wcList = [];   // очередь гарантированных классов миров
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Генератор звёздной системы" },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 460 },
      content: `<div class="ss-gen">
        <section class="ss-gen-sec">
          <h4>Заселённость <em>комбинируется</em></h4>
          <div class="ss-gen-grid">${inhRows}</div>
          <label class="ss-gen-field ss-gen-dyn" style="display:none; margin-top:6px;"><span>Династия Вольного Торговца</span><select id="gen-dyn">${dopts}</select></label>
        </section>
        <section class="ss-gen-sec ss-gen-cols">
          <label class="ss-gen-field"><span>Звёзд в системе</span>
            <select id="gen-stars"><option value="0" selected>Случайно (1–3)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
          <label class="ss-gen-field"><span>Класс главной</span><select id="gen-starclass">${scopts}</select></label>
          <label class="ss-gen-field"><span>Плотность тел</span>
            <select id="gen-dens"><option value="sparse">Разрежённая</option><option value="normal" selected>Обычная</option><option value="rich">Богатая</option></select></label>
        </section>
        <section class="ss-gen-sec ss-gen-cols">
          <label class="ss-gen-field"><span>Планеты с жизнью</span>
            <select id="gen-life"><option value="auto" selected>Авто</option><option value="none">Нет</option><option value="1">Одна</option><option value="few">Несколько</option><option value="many">Много</option></select></label>
          <label class="ss-gen-field"><span>Тип жизни</span>
            <select id="gen-lifetype"><option value="any" selected>Любая</option><option value="verdant">Пригодная (имперская)</option><option value="exotic">Экзотическая</option></select></label>
          <label class="ss-gen-field"><span>Вид ксеносов</span><select id="gen-xeno">${xopts}</select></label>
        </section>
        <section class="ss-gen-sec">
          <h4>Обязательные миры <em>гарантированно появятся заселёнными</em></h4>
          <div class="ss-gen-wc-add">
            <select id="gen-wc-pick">${wcopts}</select>
            <button type="button" id="gen-wc-add" class="ss-gen-wc-btn" title="Добавить обязательный мир">＋</button>
          </div>
          <div id="gen-wc-list" class="ss-gen-wc-list"></div>
        </section>
        <section class="ss-gen-sec ss-gen-cols">
          <label class="ss-gen-field"><span>Аномалии</span>
            <select id="gen-anom"><option value="auto" selected>Авто</option><option value="none">Нет</option><option value="few">Немного</option><option value="many">Много</option></select></label>
          <label class="ss-gen-field"><span>Случайные встречи</span>
            <select id="gen-enc"><option value="auto" selected>Авто</option><option value="none">Нет</option><option value="few">Немного</option><option value="many">Много</option></select></label>
          <label class="ss-gen-check" style="align-self:end;"><input type="checkbox" id="gen-names" checked/><span>Лорные названия</span></label>
        </section>
        <p class="ss-gen-hint"><b>«Новооткрытая»</b> — планеты названы по звезде (Джокарис&nbsp;I, II…). Жизнь возникает только в Первичной Биосфере (вне её — редкая экзотика). Тела <b>добавляются</b> к текущим. Обязательные миры при необходимости подселяются как Империум.</p>
      </div>`,
      buttons: [
        {
          action: "go", label: "Сгенерировать", icon: "fas fa-dice", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const val = sel => form.querySelector(sel).value;
            const inhabitants = [...form.querySelectorAll(".gen-inh:checked")].map(e => e.value);
            const xenosSpecies = val("#gen-xeno");
            const density = val("#gen-dens");
            const stars = Number(val("#gen-stars")) || 0;
            const starClass = val("#gen-starclass") || null;
            const life = val("#gen-life");
            const lifeType = val("#gen-lifetype");
            const anomalies = val("#gen-anom");
            const encounters = val("#gen-enc");
            const useNames = form.querySelector("#gen-names").checked;
            const dynasty = inhabitants.includes("rogueTrader") ? (val("#gen-dyn") || "") : "";
            const worldClasses = [...wcList];
            const avoid = worldNames();
            const { features, baseName, config, bodies } = generateSystem({ inhabitants, xenosSpecies, density, stars, starClass, life, lifeType, anomalies, encounters, useNames, avoid, dynasty, worldClasses });
            const starName = bodies.find(b => b.system.bodyType === "star")?.name || baseName;
            const update = {
              "system.dominantStar": starName,
              "system.starConfig": STAR_CONFIGS[config] || "",
              "system.inhabitants": inhabitants,
              "system.xenosSpecies": inhabitants.includes("xenos") ? xenosSpecies : this.actor.system.xenosSpecies,
              "system.systemFeatures": [...new Set([...(this.actor.system.systemFeatures || []), ...features])]
            };
            // Переименовать актора по базовому имени, если оно ещё дефолтное.
            const cur = (this.actor.name || "").trim();
            if (useNames && baseName && (!cur || /^(Звёздная система|Новый Актор|New Actor|Unnamed)/i.test(cur)))
              update.name = baseName;
            await this.actor.update(update);
            await this.actor.createEmbeddedDocuments("Item", bodies, { keepId: true });
            ui.notifications.info(`Сгенерировано тел: ${bodies.length}.`);
          }
        },
        { action: "cancel", label: "Отмена" }
      ],
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        // Династия ВТ — только когда отмечены Вольные Торговцы.
        const rt = form.querySelector('.gen-inh[value="rogueTrader"]');
        const dynBox = form.querySelector(".ss-gen-dyn");
        const toggleDyn = () => { dynBox.style.display = rt.checked ? "" : "none"; };
        rt.addEventListener("change", toggleDyn); toggleDyn();
        // Список обязательных миров (чипы с удалением).
        const box = form.querySelector("#gen-wc-list");
        const renderWc = () => {
          box.replaceChildren();
          wcList.forEach((wc, idx) => {
            const chip = document.createElement("span");
            chip.className = "ss-gen-wc-chip";
            chip.textContent = WORLD_CLASSES[wc];
            const del = document.createElement("button");
            del.type = "button"; del.title = "Убрать"; del.textContent = "✕";
            del.addEventListener("click", () => { wcList.splice(idx, 1); renderWc(); });
            chip.append(del);
            box.append(chip);
          });
        };
        form.querySelector("#gen-wc-add").addEventListener("click", () => {
          const wc = form.querySelector("#gen-wc-pick").value;
          if (wc) { wcList.push(wc); renderWc(); }
        });
      }
    });
  }

  async _clearBodies() {
    const ids = this.actor.items.filter(i => i.type === "celestialBody").map(i => i.id);
    if (!ids.length) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Очистить систему" },
      content: `<p>Удалить все небесные тела (${ids.length})?</p>`
    });
    if (ok) await this.actor.deleteEmbeddedDocuments("Item", ids);
  }

  async _journalPin() {
    const sys = this.actor.system;
    if (sys.journalUuid) {
      const existing = await fromUuid(sys.journalUuid).catch(() => null);
      if (existing) {
        // Домечаем существующий пин флагом (для прямого перехода с заметки на сцене).
        if (existing.getFlag("warhammer-dbc", "systemActorUuid") !== this.actor.uuid) {
          await existing.setFlag("warhammer-dbc", "systemActorUuid", this.actor.uuid);
        }
        existing.sheet.render(true);
        return;
      }
    }
    const link = `@UUID[${this.actor.uuid}]{${this.actor.name}}`;
    const sectorLine = sys.sector ? `<p><b>Сектор:</b> ${sys.sector}</p>` : "";
    // Папка журналов «Системы» (создаётся при отсутствии).
    let folder = game.folders.find(f => f.type === "JournalEntry" && f.name === "Системы");
    if (!folder) folder = await Folder.create({ name: "Системы", type: "JournalEntry", sorting: "a" });
    const entry = await JournalEntry.create({
      name: this.actor.name,
      folder: folder?.id ?? null,
      // Флаг связывает пин с актёром — двойной клик по заметке откроет лист напрямую.
      flags: { "warhammer-dbc": { systemActorUuid: this.actor.uuid } },
      pages: [{ name: "Система", type: "text", text: { content:
        `<h2>${esc(this.actor.name)}</h2>${sectorLine}<p>Лист системы: ${link}</p>
         <p><i>Перетащите эту запись на карту сектора (слой «Заметки»), чтобы получить кликабельный пин.</i></p>` } }]
    });
    await this.actor.update({ "system.journalUuid": entry.uuid });
    entry.sheet.render(true);
    ui.notifications.info("Журнал-пин создан. Перетащите его на карту сектора (слой «Заметки»).");
  }
}
