// ════════════════════════════════════════════════════════════════════════
//  Обзор звёздных систем + Протекторат Вольного Торговца.
//  • Системы: видимость игрокам (discovered), вход в протекторат — вручную.
//  • Протекторат: династия (герб/девиз), состав, столица (планета),
//    Экстракциумы и Улучшения по ПКМ, Доход/Расход/Баланс ресурсов.
//  • Династии: список для выбора при заселении/генерации.
// ════════════════════════════════════════════════════════════════════════

import { RESOURCE_TYPES, RESOURCE_ICONS, improvementPool, makeImprovement, improvementUpkeep,
  improvementOutput, improvementFlow, IMP_CATEGORIES, TITHE_GRADES, TITHE_RATES, titheRate, PRODUCTION_INPUTS } from "../constants/star-system.mjs";

const { Application } = foundry.appv1.api;

const RAW_KEYS = Object.entries(RESOURCE_TYPES).filter(([, d]) => d.cat === "raw").map(([k]) => k);

// Форматирует объект ресурсов в строку «Оружие +15, …».
function _resFmt(obj) {
  return Object.entries(obj || {}).filter(([, v]) => Number(v))
    .map(([k, v]) => `${RESOURCE_TYPES[k]?.label || k} ${v > 0 ? "+" : ""}${v}`).join(", ");
}
// HTML-подсказка улучшения (для data-tooltip): категория, описание, НЕТТО «даёт / тратит».
function _impTooltip(imp, cat) {
  const lines = [`<b>${imp.name}</b>${cat ? ` — <i>${cat.label}</i>` : ""}`];
  if (imp.desc) lines.push(imp.desc);
  const { gives, spends } = improvementFlow(imp);
  const g = _resFmt(gives), s = _resFmt(spends);
  if (g) lines.push(`<span style="color:#8cf0a0;">Даёт: ${g}</span>`);
  if (s) lines.push(`<span style="color:#f0968a;">Тратит: ${s}</span>`);
  return lines.join("<br>");
}
// Краткая текстовая сводка «Даёт … · Тратит …» (для title/подсказок). p — запись пула {r,c}.
function _impPlain(p) {
  const { gives, spends } = improvementFlow({ res: p.r, cat: p.c });
  const g = _resFmt(gives), s = _resFmt(spends);
  return [g ? `Даёт: ${g}` : "", s ? `Тратит: ${s}` : ""].filter(Boolean).join("  ·  ");
}
const RES_BODY_TYPES = ["planet", "gasGiant", "moon", "station", "asteroid", "belt"];

function _userIsRT() {
  if (game.user.isGM) return true;
  return game.actors.some(a => a.type === "character" && a.isOwner && a.system?.isRogueTrader);
}
function _rtUserIds() {
  const ids = [];
  for (const u of game.users) {
    if (u.isGM) continue;
    if (game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER") && a.system?.isRogueTrader)) ids.push(u.id);
  }
  return ids;
}
function _populated(s) {
  const a = s.allegiance;
  return !!a && !["", "unknown", "abandoned"].includes(a);
}
// key для пула улучшений по фракции планеты
function _impKey(s) {
  const a = s.allegiance;
  if (a === "xenos") return "xenos";
  if (a === "humans") return "humans";
  // imperial / mechanicus / astartes / chaos / rogueTrader → фракционные пулы улучшений
  return a || "imperium";
}

export class StarSystemsOverview extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wh-systems-overview",
      classes: ["warhammer-dbc", "wh-holo", "wh-systems-overview"],
      title: "Обзор звёздных систем",
      template: "systems/warhammer-dbc/templates/apps/systems-overview.hbs",
      width: 860, height: 720, resizable: true,
      // Сохраняем позицию прокрутки при перерисовке (render) — не прыгает наверх.
      scrollY: [".wh-so-body"],
      tabs: [{ navSelector: ".wh-so-tabs", contentSelector: ".wh-so-body", initial: "protectorate" }]
    });
  }

  getData() {
    const isGM      = game.user.isGM;
    const canManage = isGM || _userIsRT();
    const all       = game.actors.filter(a => a.type === "starSystem");

    // ── Системы ──
    // «Открыта игрокам» = у актёра права по умолчанию ≥ Наблюдатель (OBSERVER).
    const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const sysList = [];
    for (const a of all) {
      const open = (a.ownership?.default ?? 0) >= L.OBSERVER;
      if (!isGM && !a.testUserPermission(game.user, L.OBSERVER)) continue;
      sysList.push({ id: a.id, name: a.name, img: a.img, sector: (a.system.sector || "").trim() || "—",
        region: (a.system.region || "").trim(), discovered: open, inProt: !!a.system.inProtectorate });
    }
    const groupsMap = new Map();
    for (const s of sysList) {
      const r = s.region || "Без региона";
      if (!groupsMap.has(r)) groupsMap.set(r, []);
      groupsMap.get(r).push(s);
    }
    const regionGroups = [];
    for (const [r, list] of groupsMap.entries()) {
      list.sort((x, y) => x.name.localeCompare(y.name, "ru"));
      regionGroups.push({ regionName: r, systems: list });
    }
    regionGroups.sort((x, y) => {
      if (x.regionName === "Без региона") return 1;
      if (y.regionName === "Без региона") return -1;
      return x.regionName.localeCompare(y.regionName, "ru");
    });

    // ── Протекторат ──
    const capital   = game.settings.get("warhammer-dbc", "protectorateCapital") || ""; // "actorId.itemId"
    const otherCost = game.settings.get("warhammer-dbc", "protectorateOtherCosts") || {};
    const protActors = all.filter(a => a.system.inProtectorate);

    const income = {}, expend = {};
    const incD = {}, expD = {};
    const addInc = (k, v, src) => { if (v > 0) { income[k] = (income[k] || 0) + v; if (src) { if (!incD[k]) incD[k] = []; incD[k].push(`${src}: +${v}`); } } };
    const addExp = (k, v, src) => { if (v > 0) { expend[k] = (expend[k] || 0) + v; if (src) { if (!expD[k]) expD[k] = []; expD[k].push(`${src}: -${v}`); } } };
    const protList = [];
    for (const a of protActors) {
      const bodies = a.items.filter(i => i.type === "celestialBody" && RES_BODY_TYPES.includes(i.system.bodyType));
      const planets = [];
      for (const b of bodies) {
        const base = b.system.resources || {};
        const inst = Array.isArray(b.system.extractiums) ? b.system.extractiums : [];
        const imps = Array.isArray(b.system.improvements) ? b.system.improvements : [];
        const pop = _populated(b.system);
        const scouted = !!b.system.scouted;
        const hasBase = Object.keys(RESOURCE_TYPES).some(k => (Number(base[k]) || 0) > 0);
        // показываем тело, если оно перспективное (ресурсы/население/улучшения)
        if (!hasBase && !pop && !imps.length) continue;

        // ── ДОХОД/РАСХОД учитываем ТОЛЬКО для разведанных планет ──
        if (scouted) {
          const bName = b.name;
          // Валовая продукция мира (добыча + производство) — база для десятины.
          const prod = {};
          const addProd = (k, v, src) => { addInc(k, v, src); if (v > 0) prod[k] = (prod[k] || 0) + v; };
          // Экстракциумы качают БАЗОВОЕ изобилие сырья планеты.
          for (const k of RAW_KEYS) if (inst.includes(k)) {
            addProd(k, Number(base[k]) || 0, `${bName} (Экстракциум)`);
          }
          if (inst.length > 0) addExp("manpower", inst.length * 5, `${bName} (Экстракциумы)`);
          // Население даёт свой людской ресурс (базовый).
          if (pop) addProd("manpower", Number(base.manpower) || 0, `${bName} (Население)`);
          // Улучшения: НЕТТО по ресурсам (производство минус собственное потребление) →
          // доход/расход. Своё сырьё гасит свой же расход (нет «пласталь за пласталь»).
          for (const imp of imps) {
            const { gives, spends } = improvementFlow(imp);
            for (const k in gives)  addProd(k, gives[k],  `${bName} (${imp.name})`);
            for (const k in spends) addExp(k, spends[k], `${bName} (${imp.name})`);
          }
          // Содержание населения: провизия расходуется на ВЕСЬ доход людского ресурса
          // (население + улучшения-поставщики людей), без учёта расхода людского ресурса.
          const mpIncome = (pop ? Number(base.manpower) || 0 : 0)
            + imps.reduce((s, imp) => s + (Number(improvementOutput(imp).manpower) || 0), 0);
          if (mpIncome > 0) addExp("provisions", Math.ceil(mpIncome / 2), `${bName} (Содержание)`);
          // ── Имперская десятина: изымает долю валовой продукции по уровню мира,
          //    минус ресурсы, от которых мир освобождён (system.titheExempt). ──
          const rate = titheRate(b.system.tithe);
          if (rate > 0) {
            const exempt = new Set(b.system.titheExempt || []);
            const gradeLbl = TITHE_GRADES[b.system.tithe] || "Десятина";
            for (const k in prod) {
              if (exempt.has(k)) continue;
              const t = Math.ceil(prod[k] * rate);
              if (t > 0) addExp(k, t, `${bName} (Десятина · ${gradeLbl})`);
            }
          }
        }

        // ── карточка планеты: СОБСТВЕННОЕ сырьё планеты (только база, без улучшений),
        //    т.к. экстракциум качает именно базу; сырьё улучшений идёт в доход отдельно ──
        const raws = scouted ? RAW_KEYS.filter(k => (Number(base[k]) || 0) > 0).map(k => ({
          key: k, label: RESOURCE_TYPES[k].label, icon: RESOURCE_ICONS[k],
          value: Number(base[k]) || 0, installed: inst.includes(k) })) : [];
        const impList = scouted ? imps.map(imp => {
          const cat = IMP_CATEGORIES[imp.cat];
          return { name: imp.name, catSvg: cat ? cat.svg : "", catLabel: cat ? cat.label : "",
            cat: imp.cat || "", tip: _impTooltip(imp, cat) };
        }) : [];
        planets.push({ itemId: b.id, name: b.name, scouted, populated: pop,
          raws, hasRaws: raws.length > 0, imps: impList, hasImps: impList.length > 0,
          isCapital: capital === `${a.id}.${b.id}` });
      }
      protList.push({ id: a.id, name: a.name, sector: a.system.sector || "—",
        planets, hasPlanets: planets.length > 0 });
    }
    protList.sort((x, y) => x.name.localeCompare(y.name, "ru"));

    // прочие траты
    for (const k in otherCost) addExp(k, Number(otherCost[k]) || 0, "Прочие траты");

    // контракты (торговые соглашения): ресурсная цена уходит в расход
    const contracts = game.settings.get("warhammer-dbc", "protectorateContracts") || [];
    for (const c of contracts) {
      for (const k in (c.cost || {}))   addExp(k, Number(c.cost[k]) || 0, `Контракт: ${c.name || "?"}`);
      for (const k in (c.income || {})) addInc(k, Number(c.income[k]) || 0, `Контракт: ${c.name || "?"}`);
    }
    const chipsOf = (obj) => Object.entries(obj || {}).filter(([, v]) => Number(v))
      .map(([k, v]) => ({ label: RESOURCE_TYPES[k]?.label || k, icon: RESOURCE_ICONS[k], value: Number(v) }));
    const contractView = contracts.map(c => ({
      id: c.id, name: c.name || "Контракт", gain: c.gain || "",
      costChips: chipsOf(c.cost), incomeChips: chipsOf(c.income)
    }));

    // строки баланса, сгруппированные по категориям
    const CAT_ORDER = [
      { cat: "product", title: "ПРОДУКЦИЯ" },
      { cat: "raw",     title: "СЫРЬЁ" },
      { cat: "other",   title: "ДРУГОЕ" }
    ];
    const allBal = Object.entries(RESOURCE_TYPES).map(([key, def]) => {
      const inc = income[key] || 0, exp = expend[key] || 0;
      const incTooltip = incD[key] ? incD[key].join("\n") : "";
      const expTooltip = expD[key] ? expD[key].join("\n") : "";
      return { key, label: def.label, cat: def.cat, icon: RESOURCE_ICONS[key],
        income: inc, expend: exp, balance: inc - exp, neg: (inc - exp) < 0,
        incTooltip, expTooltip };
    }).filter(r => r.income || r.expend);
    const balGroups = CAT_ORDER.map(g => ({
      title: g.title, rows: allBal.filter(r => r.cat === g.cat)
    })).filter(g => g.rows.length > 0);

    // редактор «других трат» (все ресурсы)
    const otherList = Object.entries(RESOURCE_TYPES).map(([key, def]) =>
      ({ key, label: def.label, icon: RESOURCE_ICONS[key], value: Number(otherCost[key]) || 0 }));

    const candidates = all.filter(a => !a.system.inProtectorate && (isGM || a.system.discovered))
      .map(a => ({ id: a.id, name: a.name })).sort((x, y) => x.name.localeCompare(y.name, "ru"));

    // ── Данные для вкладки «Справка» (формулы актуальны коду) ──
    const prodChains = Object.entries(PRODUCTION_INPUTS).map(([out, inp]) => ({
      out: RESOURCE_TYPES[out]?.label || out,
      inputs: Object.entries(inp).map(([k, v]) => `${v} × ${RESOURCE_TYPES[k]?.label || k}`).join(" + ")
    }));
    const titheHelp = Object.entries(TITHE_GRADES).map(([k, v]) =>
      ({ label: v, pct: Math.round((TITHE_RATES[k] || 0) * 100) }));

    return {
      isGM, canManage,
      regionGroups, hasSystems: sysList.length > 0,
      protList, hasProt: protList.length > 0,
      balGroups, hasBal: allBal.length > 0,
      otherList,
      contracts: contractView, hasContracts: contractView.length > 0,
      prodChains, titheHelp,
      candidates, hasCandidates: candidates.length > 0,
      defSector: game.settings.get("warhammer-dbc", "defaultSector") || "",
      regions: game.settings.get("warhammer-dbc", "regions") || [],
      hasRegions: (game.settings.get("warhammer-dbc", "regions") || []).length > 0,
      dynName:  game.settings.get("warhammer-dbc", "playerDynasty") || "",
      dynCrest: game.settings.get("warhammer-dbc", "dynastyCrest") || "",
      dynMotto: game.settings.get("warhammer-dbc", "dynastyMotto") || "",
      dynasties: game.settings.get("warhammer-dbc", "dynasties") || [],
      hasDynasties: (game.settings.get("warhammer-dbc", "dynasties") || []).length > 0
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    const set = (k, v) => game.settings.set("warhammer-dbc", k, v);

    el.querySelectorAll("[data-open-system]").forEach(b => b.addEventListener("click", () =>
      game.actors.get(b.dataset.openSystem)?.sheet.render(true)));

    const canManage = game.user.isGM || _userIsRT();
    if (canManage) {
      el.querySelectorAll("[data-planet]").forEach(row => row.addEventListener("contextmenu", ev => {
        ev.preventDefault(); this._planetMenu(ev, row.dataset.actor, row.dataset.planet);
      }));
    }

    if (!game.user.isGM) return;   // управление — ГМ

    el.querySelectorAll("[data-toggle-disc]").forEach(b => b.addEventListener("click", async () => {
      const a = game.actors.get(b.dataset.toggleDisc); if (!a) return;
      const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
      const isOpen = (a.ownership?.default ?? 0) >= L.OBSERVER;
      await a.update({ "ownership.default": isOpen ? L.NONE : L.OBSERVER, "system.discovered": !isOpen });
      this.render();
    }));

    el.querySelector(".wh-so-addsys-btn")?.addEventListener("click", async () => {
      const id = el.querySelector(".wh-so-add-select")?.value;
      const a  = game.actors.get(id); if (!a) return;
      const own = foundry.utils.deepClone(a.ownership || {});
      for (const uid of _rtUserIds()) own[uid] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
      await a.update({ "system.inProtectorate": true, ownership: own });
      const pd = game.settings.get("warhammer-dbc", "playerDynasty") || "";
      if (pd) {
        const ups = a.items.filter(i => i.type === "celestialBody" && i.system.allegiance === "rogueTrader" && !i.system.dynasty)
          .map(i => ({ _id: i.id, "system.dynasty": pd }));
        if (ups.length) await a.updateEmbeddedDocuments("Item", ups);
      }
      this.render();
    });

    el.querySelectorAll("[data-prot-remove]").forEach(b => b.addEventListener("click", async () => {
      const a = game.actors.get(b.dataset.protRemove); if (!a) return;
      await a.update({ "system.inProtectorate": false });
      const cap = game.settings.get("warhammer-dbc", "protectorateCapital") || "";
      if (cap.startsWith(a.id + ".")) await set("protectorateCapital", "");
      this.render();
    }));

    // Династия игрока
    el.querySelector(".wh-so-dyn-save")?.addEventListener("click", async () => {
      await set("playerDynasty", (el.querySelector(".wh-so-dyn-input")?.value || "").trim());
      await set("dynastyMotto",  (el.querySelector(".wh-so-motto-input")?.value || "").trim());
      this.render();
    });
    el.querySelector(".wh-so-crest-pick")?.addEventListener("click", () => {
      new FilePicker({ type: "image", current: game.settings.get("warhammer-dbc", "dynastyCrest") || "",
        callback: async path => { await set("dynastyCrest", path); this.render(); } }).render(true);
    });
    el.querySelector(".wh-so-crest-clear")?.addEventListener("click", async () => { await set("dynastyCrest", ""); this.render(); });

    // Сектор и Регионы
    el.querySelector(".wh-so-sect-save")?.addEventListener("click", async () => {
      await set("defaultSector", (el.querySelector(".wh-so-sect-input")?.value || "").trim());
      this.render();
    });
    el.querySelector(".wh-so-reglist-add")?.addEventListener("click", async () => {
      const v = (el.querySelector(".wh-so-reglist-input")?.value || "").trim(); if (!v) return;
      const list = game.settings.get("warhammer-dbc", "regions") || [];
      if (!list.includes(v)) { list.push(v); list.sort((a,b) => a.localeCompare(b, "ru")); await set("regions", list); }
      this.render();
    });
    el.querySelectorAll("[data-reg-remove]").forEach(b => b.addEventListener("click", async () => {
      await set("regions", (game.settings.get("warhammer-dbc", "regions") || []).filter(d => d !== b.dataset.regRemove));
      this.render();
    }));

    // Список династий
    el.querySelector(".wh-so-dynlist-add")?.addEventListener("click", async () => {
      const v = (el.querySelector(".wh-so-dynlist-input")?.value || "").trim(); if (!v) return;
      const list = game.settings.get("warhammer-dbc", "dynasties") || [];
      if (!list.includes(v)) { list.push(v); await set("dynasties", list); }
      this.render();
    });
    el.querySelectorAll("[data-dyn-remove]").forEach(b => b.addEventListener("click", async () => {
      await set("dynasties", (game.settings.get("warhammer-dbc", "dynasties") || []).filter(d => d !== b.dataset.dynRemove));
      this.render();
    }));

    // Другие траты
    el.querySelector(".wh-so-other-save")?.addEventListener("click", async () => {
      const obj = {};
      el.querySelectorAll(".wh-so-other-input").forEach(i => { const v = Number(i.value) || 0; if (v) obj[i.dataset.res] = v; });
      await set("protectorateOtherCosts", obj);
      this.render();
    });

    // Контракты
    el.querySelector(".wh-so-contract-add")?.addEventListener("click", () => this._contractDialog(null));
    el.querySelectorAll(".wh-so-contract-edit").forEach(b => b.addEventListener("click", () => {
      const id = b.closest("[data-contract]")?.dataset.contract;
      const list = game.settings.get("warhammer-dbc", "protectorateContracts") || [];
      this._contractDialog(list.find(c => c.id === id) || null);
    }));
    el.querySelectorAll(".wh-so-contract-del").forEach(b => b.addEventListener("click", async () => {
      const id = b.closest("[data-contract]")?.dataset.contract;
      const list = (game.settings.get("warhammer-dbc", "protectorateContracts") || []).filter(c => c.id !== id);
      await set("protectorateContracts", list);
      this.render();
    }));
  }

  // Диалог контракта (создание/редактирование): название, цена (отдаёшь),
  // получаемые ресурсы и услуги/договорённости (текст).
  _contractDialog(contract) {
    const c = contract || { id: "", name: "", cost: {}, income: {}, gain: "" };
    const cost = c.cost || {}, incomeR = c.income || {};
    const grid = (cls, vals) => Object.entries(RESOURCE_TYPES).map(([k, def]) =>
      `<label class="ss-contract-res" title="${def.label}">
        <img src="${RESOURCE_ICONS[k]}"/><span>${def.label}</span>
        <input type="number" class="${cls}" data-res="${k}" value="${Number(vals[k]) || 0}" min="0"/>
      </label>`).join("");
    const style = `<style>
      .ss-contract-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; margin-top: 4px; }
      .ss-contract-res { display: flex; align-items: center; gap: 5px; font-size: 12px; }
      .ss-contract-res img { width: 15px; height: 15px; border: none; }
      .ss-contract-res span { flex: 1 1 auto; }
      .ss-contract-res input { width: 46px; }
    </style>`;
    new Dialog({
      title: contract ? `Контракт — ${c.name || ""}` : "Новый контракт",
      content: `${style}<form class="ss-gen">
        <label class="ss-gen-field"><span>Название контракта</span><input type="text" id="contract-name" value="${(c.name || "").replace(/"/g, "&quot;")}" placeholder="напр. Поставка провизии Гильдии"/></label>
        <div class="ss-gen-field"><span>Отдаёшь — ресурсы (в расход)</span><div class="ss-contract-grid">${grid("contract-cost", cost)}</div></div>
        <div class="ss-gen-field"><span>Получаешь — ресурсы (в доход)</span><div class="ss-contract-grid">${grid("contract-income", incomeR)}</div></div>
        <label class="ss-gen-field"><span>Получаешь — услуги / договорённости (текст)</span><textarea id="contract-gain" rows="3" placeholder="Впишите вручную: наёмный флот, право прохода, покровительство…">${(c.gain || "").replace(/</g, "&lt;")}</textarea></label>
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-file-signature"></i>', label: contract ? "Сохранить" : "Заключить", callback: async html => {
          const name = (html.find("#contract-name").val() || "").trim() || "Контракт";
          const gain = (html.find("#contract-gain").val() || "").trim();
          const readGrid = (cls) => { const o = {}; html.find(`.${cls}`).each((_, i) => { const v = Number(i.value) || 0; if (v) o[i.dataset.res] = v; }); return o; };
          const costObj = readGrid("contract-cost");
          const incomeObj = readGrid("contract-income");
          const list = foundry.utils.deepClone(game.settings.get("warhammer-dbc", "protectorateContracts") || []);
          if (contract && c.id) {
            const idx = list.findIndex(x => x.id === c.id);
            if (idx >= 0) list[idx] = { ...list[idx], name, cost: costObj, income: incomeObj, gain };
          } else {
            list.push({ id: foundry.utils.randomID(), name, cost: costObj, income: incomeObj, gain });
          }
          await game.settings.set("warhammer-dbc", "protectorateContracts", list);
          this.render();
        }},
        cancel: { label: "Отмена" }
      },
      default: "ok"
    }, { width: 460, classes: ["warhammer-dbc", "wh-holo"] }).render(true);
  }

  async close(options) {
    document.querySelectorAll(".wh-extr-menu").forEach(m => m.remove());
    _instance = null;
    return super.close(options);
  }

  // Контекстное меню планеты: Экстракциумы · Построить улучшение · Столица
  _planetMenu(ev, actorId, itemId) {
    const actor = game.actors.get(actorId);
    const item  = actor?.items.get(itemId);
    if (!item) return;
    const base = item.system.resources || {};
    const inst  = Array.isArray(item.system.extractiums) ? [...item.system.extractiums] : [];
    // Экстракциум качает СОБСТВЕННОЕ сырьё планеты (базовое изобилие), сырьё улучшений — отдельно.
    const avail = RAW_KEYS.filter(k => (Number(base[k]) || 0) > 0);

    document.querySelectorAll(".wh-extr-menu").forEach(m => m.remove());
    const menu = document.createElement("div");
    menu.className = "wh-extr-menu";
    menu.style.cssText = `position:fixed;top:${ev.clientY}px;left:${ev.clientX}px;z-index:10001;`;
    menu.innerHTML = `<div class="wh-extr-head">${item.name}</div>`;

    // Экстракциумы
    if (avail.length) {
      const sec = document.createElement("div"); sec.className = "wh-extr-sub"; sec.textContent = "ЭКСТРАКЦИУМЫ"; menu.appendChild(sec);
      for (const k of avail) {
        const on = inst.includes(k);
        const v = Number(base[k]) || 0;
        const it = document.createElement("div");
        it.className = "wh-extr-item" + (on ? " on" : "");
        it.innerHTML = `<img src="${RESOURCE_ICONS[k]}"/><span>${RESOURCE_TYPES[k].label} (${v})</span><b>${on ? "✓ снять" : "+ ставить"}</b>`;
        it.addEventListener("click", async () => {
          await item.update({ "system.extractiums": on ? inst.filter(x => x !== k) : [...inst, k] });
          menu.remove(); this.render();
        });
        menu.appendChild(it);
      }
    }
    // Улучшения (Изменить / Удалить) — компактный прокручиваемый список
    if (item.system.improvements && item.system.improvements.length > 0) {
      const impSec = document.createElement("div"); impSec.className = "wh-extr-sub"; impSec.textContent = `УЛУЧШЕНИЯ · ${item.system.improvements.length} (✎ · ✕)`; menu.appendChild(impSec);
      const listBox = document.createElement("div"); listBox.className = "wh-imp-list"; menu.appendChild(listBox);
      for (const imp of item.system.improvements) {
        const cat = IMP_CATEGORIES[imp.cat];
        const it = document.createElement("div");
        it.className = "wh-extr-item wh-imp-row";
        it.setAttribute("data-tooltip", _impTooltip(imp, cat));
        it.innerHTML = `<span class="wh-imp-name">${cat ? `<img src="${cat.svg}"/>` : ""}<span class="wh-imp-txt">${imp.name}</span></span><span class="wh-imp-tools"><b class="wh-imp-edit" title="Изменить улучшение">✎</b><b class="wh-imp-del" title="Удалить" style="color:#f66;">✕</b></span>`;
        it.querySelector(".wh-imp-edit").addEventListener("click", ev => {
          ev.stopPropagation(); menu.remove(); this._editImprovementDialog(actor, item, imp);
        });
        it.querySelector(".wh-imp-del").addEventListener("click", async ev => {
          ev.stopPropagation();
          await item.update({ "system.improvements": item.system.improvements.filter(x => x.id !== imp.id) });
          menu.remove(); this.render();
        });
        listBox.appendChild(it);
      }
    }

    // Построить улучшение
    const sep = document.createElement("div"); sep.className = "wh-extr-sub"; sep.textContent = "ДЕЙСТВИЯ"; menu.appendChild(sep);
    const build = document.createElement("div"); build.className = "wh-extr-item";
    build.innerHTML = `<span>🏗 Построить улучшение…</span>`;
    build.addEventListener("click", () => { menu.remove(); this._buildImprovementDialog(actor, item); });
    menu.appendChild(build);
    // Десятина
    const tithe = document.createElement("div"); tithe.className = "wh-extr-item";
    tithe.innerHTML = `<span>🏛 Десятина…</span>`;
    tithe.addEventListener("click", () => { menu.remove(); this._titheDialog(actor, item); });
    menu.appendChild(tithe);
    // Назначить столицей
    const cap = document.createElement("div"); cap.className = "wh-extr-item";
    cap.innerHTML = `<span>★ Назначить столицей</span>`;
    cap.addEventListener("click", async () => { await game.settings.set("warhammer-dbc", "protectorateCapital", `${actorId}.${itemId}`); menu.remove(); this.render(); });
    menu.appendChild(cap);

    document.body.appendChild(menu);
    const close = () => { menu.remove(); document.removeEventListener("click", close); document.removeEventListener("contextmenu", close); };
    setTimeout(() => { document.addEventListener("click", close); document.addEventListener("contextmenu", close); }, 50);
  }

  // Диалог постройки улучшения: из пула фракции/класса ИЛИ своё (с вводом эффектов)
  _buildImprovementDialog(actor, item) {
    const s = item.system;
    const pool = improvementPool({ worldClass: s.worldClass, key: _impKey(s), sp: s.xenosSpecies, bodyType: s.bodyType });
    const have = new Set((s.improvements || []).map(i => i.name));
    // Группируем пул по категориям → <optgroup> в порядке IMP_CATEGORIES.
    const byCat = {};
    pool.forEach((p, i) => { (byCat[p.c || "other"] ??= []).push({ p, i }); });
    const catOrder = [...Object.keys(IMP_CATEGORIES), "other"];
    const grouped = catOrder.filter(c => byCat[c]).map(c => {
      const label = IMP_CATEGORIES[c]?.label || "Прочее";
      const items = byCat[c].map(({ p, i }) =>
        `<option value="${i}" title="${_impPlain(p)}">${p.n}${have.has(p.n) ? " (уже есть)" : ""}</option>`).join("");
      return `<optgroup label="${label}">${items}</optgroup>`;
    }).join("");
    const opts = `<option value="custom">— Своё (вписать) —</option>` + grouped;
    // категории для «своего» улучшения
    const catOpts = `<option value="">— без категории —</option>` +
      Object.entries(IMP_CATEGORIES).map(([k, def]) => `<option value="${k}">${def.label}</option>`).join("");
    // сетка ресурсов для «своего»: что даёт / что тратит
    const resRows = Object.entries(RESOURCE_TYPES).map(([k, def]) =>
      `<div class="ss-imp-res-row" title="${def.label}">
        <div class="ss-imp-res-name"><img src="${RESOURCE_ICONS[k]}"/> <span>${def.label}</span></div>
        <div class="ss-imp-res-inputs">
          <input type="number" class="imp-give" data-res="${k}" placeholder="+" min="0" title="Сколько даёт"/>
          <input type="number" class="imp-spend" data-res="${k}" placeholder="-" min="0" title="Сколько тратит"/>
        </div>
       </div>`).join("");
       
    const customStyle = `
      <style>
      .ss-imp-res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .ss-imp-res-row { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(0, 255, 100, 0.2); }
      .ss-imp-res-name { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #aaddaa; text-transform: uppercase; }
      .ss-imp-res-name img { width: 16px; height: 16px; border: none; }
      .ss-imp-res-inputs { display: flex; gap: 4px; }
      .ss-imp-res-inputs input { width: 36px; height: 22px; text-align: center; font-size: 12px; background: rgba(0,0,0,0.4); border: 1px solid #00ff64; color: #00ff64; border-radius: 2px; transition: all 0.2s; }
      .ss-imp-res-inputs input::placeholder { color: rgba(0,255,100,0.3); }
      .ss-imp-res-inputs input:focus { background: rgba(0,255,100,0.1); outline: none; }
      </style>
    `;

    new Dialog({
      title: `Построить улучшение — ${item.name}`,
      content: `${customStyle}<form class="ss-gen">
        <label class="ss-gen-field"><span>Улучшение</span><select id="imp-pick">${opts}</select></label>
        <p class="ss-gen-hint" id="imp-desc"></p>
        <div id="imp-custom" class="ss-imp-custom">
          <label class="ss-gen-field"><span>Название</span><input type="text" id="imp-name" placeholder="Название улучшения"/></label>
          <label class="ss-gen-field"><span>Тип улучшения</span><select id="imp-cat">${catOpts}</select></label>
          <label class="ss-gen-field"><span>Описание</span><input type="text" id="imp-cdesc" placeholder="Кратко"/></label>
          <div class="ss-imp-res-grid">${resRows}</div>
        </div>
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-hammer"></i>', label: "Построить", callback: async html => {
          const val = html.find("#imp-pick").val();
          const list = foundry.utils.deepClone(item.system.improvements || []);
          if (val === "custom") {
            const name = (html.find("#imp-name").val() || "").trim() || "Своё улучшение";
            const res = {}, cost = {};
            html.find(".imp-give").each((_, i)  => { const v = Number(i.value) || 0; if (v) res[i.dataset.res]  = v; });
            html.find(".imp-spend").each((_, i) => { const v = Number(i.value) || 0; if (v) cost[i.dataset.res] = v; });
            list.push({ id: foundry.utils.randomID(), name, desc: (html.find("#imp-cdesc").val() || "").trim(),
                        cat: html.find("#imp-cat").val() || "", res, cost, hidden: false, secret: false, custom: true });
            await item.update({ "system.improvements": list });
            ui.notifications.info(`«${item.name}»: построено своё улучшение «${name}».`);
          } else {
            const p = pool[Number(val)]; if (!p) return;
            list.push(makeImprovement(p));
            await item.update({ "system.improvements": list });
            ui.notifications.info(`«${item.name}»: построено улучшение «${p.n}».`);
          }
        }},
        cancel: { label: "Отмена" }
      },
      default: "ok",
      render: html => {
        const upd = () => {
          const val = html.find("#imp-pick").val();
          const custom = val === "custom";
          html.find("#imp-custom").css("display", custom ? "" : "none");
          if (custom) {
            html.find("#imp-desc").html("Впишите название и эффекты: «Даёт» — производство, «Тратит» — содержание.");
          } else {
            const p = pool[Number(val)];
            const plain = p ? _impPlain(p) : "";
            html.find("#imp-desc").html(`${p?.d || ""}${plain ? `<br><b>${plain}</b>` : ""}`);
          }
        };
        html.find("#imp-pick").on("change", upd); upd();
      }
    }, { width: 480, classes: ["warhammer-dbc", "wh-holo"] }).render(true);
  }

  // Диалог РЕДАКТИРОВАНИЯ уже установленного улучшения (апгрейд/правка).
  _editImprovementDialog(actor, item, imp) {
    const res = imp.res || {}, cost = imp.cost || {};
    const catOpts = `<option value="">— без категории —</option>` +
      Object.entries(IMP_CATEGORIES).map(([k, def]) => `<option value="${k}" ${k === imp.cat ? "selected" : ""}>${def.label}</option>`).join("");
    const resRows = Object.entries(RESOURCE_TYPES).map(([k, def]) =>
      `<div class="ss-imp-res-row" title="${def.label}">
        <div class="ss-imp-res-name"><img src="${RESOURCE_ICONS[k]}"/> <span>${def.label}</span></div>
        <div class="ss-imp-res-inputs">
          <input type="number" class="imp-give" data-res="${k}" value="${Number(res[k]) || 0}" min="0" title="Сколько даёт"/>
          <input type="number" class="imp-spend" data-res="${k}" value="${Number(cost[k]) || 0}" min="0" title="Своя цена (0 = по формуле)"/>
        </div>
       </div>`).join("");
    const style = `<style>
      .ss-imp-res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .ss-imp-res-row { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(0,255,100,0.2); }
      .ss-imp-res-name { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #aaddaa; text-transform: uppercase; }
      .ss-imp-res-name img { width: 16px; height: 16px; border: none; }
      .ss-imp-res-inputs { display: flex; gap: 4px; }
      .ss-imp-res-inputs input { width: 40px; height: 22px; text-align: center; font-size: 12px; background: rgba(0,0,0,0.4); border: 1px solid #00ff64; color: #00ff64; border-radius: 2px; }
    </style>`;
    new Dialog({
      title: `Изменить улучшение — ${imp.name}`,
      content: `${style}<form class="ss-gen">
        <label class="ss-gen-field"><span>Название</span><input type="text" id="imp-name" value="${(imp.name || "").replace(/"/g, "&quot;")}"/></label>
        <label class="ss-gen-field"><span>Тип улучшения</span><select id="imp-cat">${catOpts}</select></label>
        <label class="ss-gen-field"><span>Описание</span><input type="text" id="imp-cdesc" value="${(imp.desc || "").replace(/"/g, "&quot;")}"/></label>
        <div class="ss-imp-chks" style="display:flex; gap:14px; margin-top:6px;">
          <label><input type="checkbox" id="imp-hidden" ${imp.hidden ? "checked" : ""}/> Скрыт до разведки</label>
          <label><input type="checkbox" id="imp-secret" ${imp.secret ? "checked" : ""}/> Тайное</label>
        </div>
        <p class="ss-gen-hint">«Даёт» — производство. «Своя цена» — расход вручную (0 = считается по формулам: цепочки + рабочая сила).</p>
        <div class="ss-imp-res-grid">${resRows}</div>
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-pen"></i>', label: "Сохранить", callback: async html => {
          const newRes = {}, newCost = {};
          html.find(".imp-give").each((_, i)  => { const v = Number(i.value) || 0; if (v) newRes[i.dataset.res]  = v; });
          html.find(".imp-spend").each((_, i) => { const v = Number(i.value) || 0; if (v) newCost[i.dataset.res] = v; });
          const updated = { ...imp,
            name: (html.find("#imp-name").val() || "").trim() || imp.name,
            desc: (html.find("#imp-cdesc").val() || "").trim(),
            cat: html.find("#imp-cat").val() || "",
            res: newRes,
            hidden: html.find("#imp-hidden").is(":checked"),
            secret: html.find("#imp-secret").is(":checked")
          };
          if (Object.keys(newCost).length) updated.cost = newCost; else delete updated.cost;   // пусто → расход по формулам
          const list = (item.system.improvements || []).map(x => x.id === imp.id ? updated : x);
          await item.update({ "system.improvements": list });
          ui.notifications.info(`«${item.name}»: улучшение «${updated.name}» изменено.`);
          this.render();
        }},
        cancel: { label: "Отмена" }
      },
      default: "ok"
    }, { width: 480, classes: ["warhammer-dbc", "wh-holo"] }).render(true);
  }

  // Диалог десятины: уровень изъятия + освобождение по отдельным ресурсам.
  _titheDialog(actor, item) {
    const s = item.system;
    const grade = s.tithe || "aptusNon";
    const exempt = new Set(s.titheExempt || []);
    // Ресурсы, которые мир реально даёт (добыча + бонусы улучшений + население).
    const base = s.resources || {};
    const impBonus = {};
    for (const imp of (s.improvements || [])) for (const k in (imp.res || {})) impBonus[k] = (impBonus[k] || 0) + Number(imp.res[k] || 0);
    const produced = Object.keys(RESOURCE_TYPES).filter(k => (Number(base[k]) || 0) > 0 || (impBonus[k] || 0) > 0);
    const gradeOpts = Object.entries(TITHE_GRADES).map(([k, v]) =>
      `<option value="${k}" ${k === grade ? "selected" : ""}>${v} — ${Math.round((TITHE_RATES[k] || 0) * 100)}%</option>`).join("");
    const resRows = produced.length ? produced.map(k =>
      `<label class="ss-tithe-res"><input type="checkbox" class="tithe-exempt" data-res="${k}" ${exempt.has(k) ? "checked" : ""}/>
        <img src="${RESOURCE_ICONS[k]}"/> <span>${RESOURCE_TYPES[k].label}</span></label>`).join("")
      : `<p class="ss-gen-hint">Мир пока ничего не производит — освобождать нечего.</p>`;
    const style = `<style>
      .ss-tithe-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 12px; margin-top: 6px; }
      .ss-tithe-res { display: flex; align-items: center; gap: 6px; font-size: 12px; }
      .ss-tithe-res img { width: 16px; height: 16px; border: none; }
    </style>`;
    new Dialog({
      title: `Десятина — ${item.name}`,
      content: `${style}<form class="ss-gen">
        <label class="ss-gen-field"><span>Уровень десятины</span><select id="tithe-grade">${gradeOpts}</select></label>
        <p class="ss-gen-hint">Указанная доля добываемых и производимых ресурсов мира изымается в имперскую десятину. «Aptus Non» — не взимается. Ниже можно освободить отдельные ресурсы, не трогая остальные.</p>
        <div class="ss-gen-field"><span>Освободить от десятины</span><div class="ss-tithe-grid">${resRows}</div></div>
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-landmark"></i>', label: "Применить", callback: async html => {
          const g = html.find("#tithe-grade").val();
          const ex = html.find(".tithe-exempt:checked").map((_, e) => e.dataset.res).get();
          await item.update({ "system.tithe": g, "system.titheExempt": ex });
          ui.notifications.info(`«${item.name}»: десятина — ${TITHE_GRADES[g]}.`);
          this.render();
        }},
        cancel: { label: "Отмена" }
      },
      default: "ok"
    }, { width: 420, classes: ["warhammer-dbc", "wh-holo"] }).render(true);
  }
}

let _instance = null;
export function openSystemsOverview() {
  if (!_instance) _instance = new StarSystemsOverview();
  _instance.render(true);
  return _instance;
}
// Авто-обновление открытого окна при изменении систем/планет
export function refreshSystemsOverview() { if (_instance?.rendered) _instance.render(false); }
