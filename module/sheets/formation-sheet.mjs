// module/sheets/formation-sheet.mjs
// ════════════════════════════════════════════════════════════════════════
//  Лист Формирования («Книга Битв») — масштабные войны.
//  Сила/Оборона, численность и боевой дух, приказы, атаки, истощение,
//  ключевые события. Оформление — как у листа персонажа.
//
//  Командир и приданные авантюристы назначаются перетаскиванием актора.
// ════════════════════════════════════════════════════════════════════════

import { TROOP_TYPES, TROOP_CATEGORIES, FORMATION_SIZES, SIZE_ORDER,
         TECH_LEVELS, TECH_ORDER, TECH_ALLOWED,
         TRAINING_LEVELS, TRAINING_ORDER, GEAR_QUALITY, GEAR_ORDER,
         TERRAIN_TYPES, TERRAIN_ORDER, ORDERS, ORDER_ORDER, DAMAGE_MODS,
         KEY_EVENTS, KEY_EVENT_ORDER, EVENT_TIERS, KEY_EVENT_REWARD, KEY_EVENT_LIMITS,
         ORBITAL_BOMBARDMENT, ORBITAL_NOTE, SPECIAL_FORMATIONS, RECRUITMENT_PATHS,
         ATTRITION, AIR_HALF_DAMAGE_NOTE, CONTACT_NOTE, FORMATION_HERO_TYPES,
         numbersFromHeadcount } from "../constants/formation.mjs";
import { SQUAD_TYPE_LABEL } from "../constants/squad.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { FEATURES, isFeatureEnabled } from "../constants/features.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { _degWord, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

/** Степени успеха/провала: |порог − бросок| / 10 + 1. */
const degrees = (threshold, roll) => Math.floor(Math.abs(threshold - roll) / 10) + 1;

export class WarhammerFormationSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc", "sheet", "actor", "formation-sheet", "wh-holo"],
      template: "systems/warhammer-dbc/templates/actor/formation-sheet.hbs",
      width: 860, height: 920, resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "unit" }]
    });
  }

  // ── Связанные акторы ──────────────────────────────────────────────────────

  _resolve(uuid) {
    if (!uuid) return null;
    try { const d = fromUuidSync(uuid); return d?.actor ?? d ?? null; }
    catch (e) { return null; }
  }

  /** Приданный командир: его умения и характеристики заменяют показатели войск. */
  _commanderData() {
    const raw = this.actor.system.posts?.commander || {};
    const doc = this._resolve(raw.uuid);
    return {
      uuid: raw.uuid || "", filled: !!raw.uuid, missing: !!raw.uuid && !doc,
      name: doc?.name || raw.name || (raw.uuid ? "(недоступен)" : ""),
      img:  doc?.img  || raw.img  || "icons/svg/mystery-man.svg",
      actor: doc,
      command: doc?.system?.skills?.command?.total ?? null,
      fel:     doc?.system?.characteristics?.fel?.total ?? null,
      int:     doc?.system?.characteristics?.int?.total ?? null
    };
  }

  /**
   * Значение теста для указанного приказа/события.
   * С приданным командиром берутся его умения; без него — Выучка войск
   * (книга: «использует показатели умения и характеристик формирования»).
   */
  _testValue(def) {
    const d = this.actor.system.derived || {};
    const cmd = this._commanderData();
    const base = { label: "", value: d.skillValue ?? 0, source: "Выучка войск" };
    if (!def) return base;

    if (cmd.filled && cmd.actor) {
      const sys = cmd.actor.system;
      let v = null, label = "";
      if (def.skill && SKILLS_DEF[def.skill]) {
        v = sys.skills?.[def.skill]?.total ?? null;
        label = SKILLS_DEF[def.skill].label + (def.spec ? ` (${def.spec})` : "");
      } else if (def.group && GROUP_SKILLS_DEF[def.group]) {
        // Групповой навык: нужная специализация ищется по каталогу (ключ,
        // английское название, русская подпись), иначе берём лучшую из имеющихся.
        const entries = Object.values(sys.groupSkills?.[def.group] || {}).filter(e => e && typeof e === "object");
        const exact = def.spec ? findGroupEntry(cmd.actor, def.group, def.spec) : null;
        const pick  = exact || entries.sort((a, b) => (b.total ?? -20) - (a.total ?? -20))[0];
        v = pick?.total ?? null;
        label = GROUP_SKILLS_DEF[def.group].label + (def.spec ? ` (${def.spec})` : "");
      } else if (def.char) {
        v = sys.characteristics?.[def.char]?.total ?? null;
        label = CHARACTERISTICS[def.char]?.label || def.char;
      }
      if (v != null) return { label, value: v, source: cmd.name };
    }
    // Без командира — плоская Выучка войск.
    const label = def.skill ? (SKILLS_DEF[def.skill]?.label || def.skill)
                : def.group ? (GROUP_SKILLS_DEF[def.group]?.label || def.group)
                : def.char  ? (CHARACTERISTICS[def.char]?.label || def.char) : "";
    return { label, value: d.skillValue ?? 0, source: "Выучка войск" };
  }

  /** Человекочитаемая запись теста приказа/события: «Command(F) −10». */
  _testLabel(def) {
    if (!def) return "без броска";
    const parts = [];
    const one = (t) => {
      const nm = t.skill ? (SKILLS_DEF[t.skill]?.label || t.skill)
               : t.group ? (GROUP_SKILLS_DEF[t.group]?.label || t.group)
               : t.char  ? (CHARACTERISTICS[t.char]?.label || t.char) : "?";
      const ch = t.char ? `(${CHARACTERISTICS[t.char]?.abbr || t.char.toUpperCase()})` : "";
      const sp = t.spec ? ` (${t.spec})` : "";
      const md = (t.mod ?? 0) === 0 ? "+0" : (t.mod > 0 ? `+${t.mod}` : `${t.mod}`);
      return `${nm}${sp}${ch} ${md}`;
    };
    parts.push(one(def));
    for (const k of ["alt", "alt2", "alt3"]) if (def[k]) parts.push(one(def[k]));
    return parts.join(" / ");
  }

  getData(options) {
    const context = super.getData(options);
    const sys = this.actor.system;
    context.system  = sys;
    context.derived = sys.derived || {};
    context.isGM    = game.user.isGM;

    // Подсистема «Книга Битв» может быть выключена в настройках системы: лист
    // уже созданного формирования продолжает работать, но об этом стоит сказать.
    context.featureOff  = !isFeatureEnabled("battleBook");
    context.featureName = FEATURES.battleBook.name;

    // ── Справочники для выпадающих списков ──
    const allowed = TECH_ALLOWED[sys.techLevel] || Object.keys(TROOP_CATEGORIES);
    context.troopGroups = Object.entries(TROOP_CATEGORIES).map(([cat, label]) => ({
      cat, label, allowed: allowed.includes(cat),
      types: Object.entries(TROOP_TYPES).filter(([, t]) => t.cat === cat)
        .map(([key, t]) => ({ key, label: t.label, selected: key === sys.troopType }))
    }));
    // Текущий род войск недоступен на этом мире — предупреждаем, но не запрещаем.
    context.troopBlocked = !allowed.includes(TROOP_TYPES[sys.troopType]?.cat);
    context.troop = TROOP_TYPES[sys.troopType] || {};

    context.sizes = SIZE_ORDER.map(k => ({ key: k, ...FORMATION_SIZES[k], selected: k === sys.size }));
    context.techLevels = TECH_ORDER.map(k => ({ key: k, ...TECH_LEVELS[k], selected: k === sys.techLevel }));
    context.trainings  = TRAINING_ORDER.map(k => ({ key: k, ...TRAINING_LEVELS[k], selected: k === sys.training }));
    context.gearLevels = GEAR_ORDER.map(k => ({ key: k, ...GEAR_QUALITY[k], selected: k === sys.gearQuality }));
    context.terrains   = TERRAIN_ORDER.map(k => ({ key: k, ...TERRAIN_TYPES[k], selected: k === sys.terrain }));

    // ── Командир и приданные герои ──
    context.commander = this._commanderData();
    context.attached  = (Array.isArray(sys.attached) ? sys.attached : []).map(a => {
      const doc = this._resolve(a.uuid);
      return {
        id: a.id, uuid: a.uuid || "",
        name: doc?.name || a.name || "(недоступен)",
        img:  doc?.img  || a.img  || "icons/svg/mystery-man.svg",
        missing: !doc, note: a.note || "",
        events: Number(a.events) || 0            // ключевых событий за игровой день
      };
    });
    context.heroTypesLabel = FORMATION_HERO_TYPES.map(t => SQUAD_TYPE_LABEL[t]).join(", ");

    // Штраф истощения бьёт и по приданному герою — по Command и Общительности.
    context.heroPenalty = context.derived.penalty || 0;

    // ── Приказы ──
    const isAir = context.derived.isAir;
    context.orders = ORDER_ORDER.map(k => {
      const o = ORDERS[k];
      return {
        key: k, label: (isAir && o.airLabel) ? o.airLabel : o.label, en: o.en,
        desc: o.desc, testLabel: this._testLabel(o.test), hasTest: !!o.test,
        current: sys.order?.key === k,
        // Окапываться авиация не может; воздушное патрулирование — только для неё.
        unavailable: (!o.air && isAir) || (o.airOnly && !isAir)
      };
    });
    context.currentOrder = sys.order?.key ? {
      key: sys.order.key,
      label: ORDERS[sys.order.key]?.label || "",
      note: sys.order.note || ""
    } : null;

    // ── Состояние ──
    const st = sys.status || {};
    context.status = st;
    context.statusFlags = [
      { key: "surprised", label: "Захвачено внезапностью", on: !!st.surprised, hint: "Атакующие наносят +10 урона в первый стратегический раунд." },
      { key: "engaged",   label: "В соприкосновении",      on: !!st.engaged,   hint: "Формирования в пределах километра друг от друга (или в дальности поражения)." },
      { key: "exhausted", label: "Вымотано маршем",        on: !!st.exhausted, hint: "−10 на все тесты и на три кости урона меньше, пока не отдохнёт стратегический ход." },
      { key: "fled",      label: "Ударилось в бегство",    on: !!st.fled,      hint: "Провален тест боевого духа или дух упал до нуля." }
    ];
    context.timedFlags = [
      { key: "flankRounds", label: "Фланговый обход (+10 урона)", value: Number(st.flankRounds) || 0 },
      { key: "feintRounds", label: "Ложный удар (+5 урона)",      value: Number(st.feintRounds) || 0 },
      { key: "reconRounds", label: "Рекогносцировка (+10 / +1к10)", value: Number(st.reconRounds) || 0 }
    ];

    // ── Ключевые события ──
    context.keyEvents = KEY_EVENT_ORDER.map(k => {
      const e = KEY_EVENTS[k];
      return { key: k, label: e.label, desc: e.desc, tier: e.tier,
               tierLabel: EVENT_TIERS[e.tier]?.label || "", testLabel: this._testLabel(e.test) };
    });
    context.eventTiers   = Object.entries(EVENT_TIERS).map(([k, v]) => ({ key: k, ...v }));
    context.eventReward  = KEY_EVENT_REWARD;
    context.eventLimits  = KEY_EVENT_LIMITS;

    // ── Справочник ──
    context.orbital        = ORBITAL_BOMBARDMENT;
    context.orbitalNote    = ORBITAL_NOTE;
    context.specialForms   = SPECIAL_FORMATIONS;
    context.recruitPaths   = RECRUITMENT_PATHS;
    context.airHalfNote    = AIR_HALF_DAMAGE_NOTE;
    context.contactNote    = CONTACT_NOTE;
    context.attrition      = ATTRITION;
    context.troopTable = Object.entries(TROOP_TYPES).map(([key, t]) => ({
      key, ...t, current: key === sys.troopType,
      rngLabel: t.rng == null ? "С" : String(t.rng),
      catLabel: TROOP_CATEGORIES[t.cat] || ""
    }));

    return context;
  }

  // ── Drag & drop: командир и приданные герои ───────────────────────────────

  _canDragDrop(_selector) { return true; }

  async _onDrop(event) {
    let data = null;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch (e) { /* нет данных */ }
    if (data && (data.type === "Token" || data.type === "Actor")) return this._onDropActor(event, data);
    return super._onDrop(event);
  }

  /** Формирование — не носитель снаряжения: всё оснащение абстрагировано качеством. */
  async _onDropItem(_event, _data) {
    ui.notifications.warn("Снаряжение формирования задаётся его качеством (низкое / среднее / хорошее), а не отдельными предметами.");
    return false;
  }

  async _persistFormation(update) {
    if (this.actor.isOwner) { await this.actor.update(update); return true; }
    const gm = game.users.activeGM;
    if (!gm) { ui.notifications.warn("Нужен активный ГМ на сессии, чтобы придать себя чужому формированию."); return false; }
    game.socket.emit("system.warhammer-dbc", {
      action: "formationRoster",
      formationUuid: this.actor.uuid,
      posts:    update["system.posts"]    ?? foundry.utils.deepClone(this.actor.system.posts    || {}),
      attached: update["system.attached"] ?? foundry.utils.deepClone(this.actor.system.attached || []),
      userId: game.user.id
    });
    return true;
  }

  async _onDropActor(event, data) {
    const uuid = data.uuid
      || (data.type === "Actor" && data.id ? `Actor.${data.id}` : null)
      || (data.type === "Token" && data.sceneId && data.tokenId ? `Scene.${data.sceneId}.Token.${data.tokenId}` : null);
    if (!uuid) return false;

    let doc = null;
    try { doc = await fromUuid(uuid); } catch (e) { doc = null; }
    const actor = doc?.actor ?? doc;
    if (!actor || actor.id === this.actor.id) return false;

    if (!this.actor.isOwner && !actor.isOwner) {
      ui.notifications.warn("К чужому формированию можно придать только своего персонажа.");
      return false;
    }
    if (!FORMATION_HERO_TYPES.includes(actor.type)) {
      ui.notifications.warn(
        `Придать формированию можно только: ${FORMATION_HERO_TYPES.map(t => SQUAD_TYPE_LABEL[t]).join(", ")}. ` +
        `«${actor.name}» — ${SQUAD_TYPE_LABEL[actor.type] || actor.type}.`);
      return false;
    }

    // Слот командира или общий список приданных.
    if (event.target?.closest?.("[data-post-slot='commander']")) {
      const posts = foundry.utils.deepClone(this.actor.system.posts || {});
      posts.commander = { uuid, name: actor.name, img: actor.img };
      const ok = await this._persistFormation({ "system.posts": posts });
      if (ok) ui.notifications.info(`${actor.name} принял командование формированием «${this.actor.name}».`);
      return ok;
    }

    const attached = foundry.utils.deepClone(this.actor.system.attached || []);
    if (attached.some(a => a.uuid === uuid)) {
      ui.notifications.info(`${actor.name} уже придан формированию.`);
      return false;
    }
    attached.push({ id: foundry.utils.randomID(), uuid, name: actor.name, img: actor.img, note: "", events: 0 });
    const ok = await this._persistFormation({ "system.attached": attached });
    if (ok) ui.notifications.info(`${actor.name} придан формированию «${this.actor.name}».`);
    return ok;
  }

  // ── Обработчики ───────────────────────────────────────────────────────────

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".fm-open").on("click", async ev => {
      const uuid = ev.currentTarget.closest("[data-uuid]")?.dataset.uuid;
      if (!uuid) return;
      const doc = await fromUuid(uuid);
      (doc?.actor ?? doc)?.sheet?.render(true);
    });

    html.find(".fm-commander-clear").on("click", async () => {
      const posts = foundry.utils.deepClone(this.actor.system.posts || {});
      if (!this.actor.isOwner) {
        const occ = posts.commander?.uuid ? await fromUuid(posts.commander.uuid) : null;
        if (!((occ?.actor ?? occ)?.isOwner)) return ui.notifications.warn("Снять с должности можно только своего персонажа.");
      }
      posts.commander = { uuid: "", name: "", img: "" };
      await this._persistFormation({ "system.posts": posts });
    });

    html.find(".fm-attached-remove").on("click", async ev => {
      const id = ev.currentTarget.closest("[data-attached-id]")?.dataset.attachedId;
      const attached = foundry.utils.deepClone(this.actor.system.attached || []);
      const a = attached.find(x => x.id === id); if (!a) return;
      if (!this.actor.isOwner) {
        const occ = a.uuid ? await fromUuid(a.uuid) : null;
        if (!((occ?.actor ?? occ)?.isOwner)) return ui.notifications.warn("Отозвать можно только своего персонажа.");
      }
      await this._persistFormation({ "system.attached": attached.filter(x => x.id !== id) });
    });

    if (!this.isEditable) {
      try {
        const el  = html[0] ?? html;
        const DDC = foundry.applications?.ux?.DragDrop ?? globalThis.DragDrop;
        if (DDC && el) new DDC({ dropSelector: null, callbacks: { drop: this._onDrop.bind(this) } }).bind(el);
      } catch (e) { console.warn("Warhammer DBC | formation DnD bind:", e); }
      return;
    }

    // Подсветка зон дропа.
    html.find("[data-post-slot], .fm-attached-dropzone").each((_, el) => {
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("fm-drop-hover"); });
      el.addEventListener("dragleave", () => el.classList.remove("fm-drop-hover"));
      el.addEventListener("drop",      () => el.classList.remove("fm-drop-hover"));
    });

    // Портрет.
    html.find(".fm-portrait").on("click", () => {
      new FilePicker({ type: "image", current: this.actor.img || "",
        callback: path => this.actor.update({ img: path }) }).render(true);
    });

    // Численность из числа людей + бросок предела боевого духа.
    html.find(".fm-calc-numbers").on("click", () => this._calcNumbers());
    html.find(".fm-roll-morale-max").on("click", () => this._rollMoraleMax());
    html.find(".fm-full-strength").on("click", () => this.actor.update({
      "system.numbers.value": Number(this.actor.system.numbers?.max) || 0,
      "system.morale.value":  Number(this.actor.system.morale?.max)  || 0
    }));

    // Приказы.
    html.find(".fm-order").on("click", ev => this._executeOrder(ev.currentTarget.dataset.order));
    html.find(".fm-order-clear").on("click", () => this.actor.update({ "system.order.key": "", "system.order.note": "" }));

    // Бой.
    html.find(".fm-attack").on("click", () => this._attackDialog());
    html.find(".fm-morale-test").on("click", () => this._moraleTest());
    html.find(".fm-take-damage").on("click", () => this._takeDamageDialog());

    // Состояние.
    html.find(".fm-status-toggle").on("click", ev => {
      const k = ev.currentTarget.dataset.flag;
      this.actor.update({ [`system.status.${k}`]: !this.actor.system.status?.[k] });
    });
    html.find(".fm-round-tick").on("click", () => this._advanceRound());
    html.find(".fm-status-reset").on("click", () => this._resetStatus());

    // Ключевые события.
    html.find(".fm-event-roll").on("click", ev => this._keyEventRoll(ev.currentTarget.dataset.event));
    html.find(".fm-event-count").on("click", ev => {
      const id = ev.currentTarget.closest("[data-attached-id]")?.dataset.attachedId;
      const attached = foundry.utils.deepClone(this.actor.system.attached || []);
      const a = attached.find(x => x.id === id); if (!a) return;
      a.events = ((Number(a.events) || 0) + 1) % 3;      // 0→1→2→0 за игровой день
      this.actor.update({ "system.attached": attached });
    });

    // Заметка приданного героя.
    html.find(".fm-attached-note").on("change", ev => {
      const id = ev.currentTarget.closest("[data-attached-id]")?.dataset.attachedId;
      const attached = foundry.utils.deepClone(this.actor.system.attached || []);
      const a = attached.find(x => x.id === id); if (!a) return;
      a.note = ev.currentTarget.value;
      this.actor.update({ "system.attached": attached });
    });
  }

  // ── Численность и боевой дух ──────────────────────────────────────────────

  /** Численность = 10% от числа людей (у астартес — впятеро выше). */
  async _calcNumbers() {
    const sys = this.actor.system;
    const n = numbersFromHeadcount(sys.headcount, sys.astartes);
    if (!n) return ui.notifications.warn("Укажите число людей в составе формирования.");
    await this.actor.update({ "system.numbers.max": n, "system.numbers.value": n });
    ui.notifications.info(`Численность формирования: ${n}${sys.astartes ? " (астартес — впятеро выше обычного)" : ""}.`);
  }

  /** Предел боевого духа: подготовка ± бросок за качество снаряжения. */
  async _rollMoraleMax() {
    const sys  = this.actor.system;
    const base = TRAINING_LEVELS[sys.training]?.morale ?? 0;
    const gear = GEAR_QUALITY[sys.gearQuality] || {};
    let gearRoll = 0, rolls = [];

    if (gear.moraleDie) {
      const r = await new Roll("1d10").evaluate();
      rolls.push(r);
      gearRoll = gear.moraleDie.startsWith("-") ? -r.total : r.total;
    }
    const max = Math.max(0, base + gearRoll);
    await this.actor.update({
      "system.morale.max": max, "system.morale.value": max, "system.morale.gearRoll": gearRoll
    });

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result fm-chat">
        <div class="roll-header">${rollIcon("crown", "#4dffa6")}Боевой дух — ${esc(this.actor.name)}</div>
        <div class="roll-threshold">${esc(TRAINING_LEVELS[sys.training]?.label || "")}: <b>${base}</b>
          ${gear.moraleDie ? ` · снаряжение ${esc(GEAR_QUALITY[sys.gearQuality].label)} ${gear.moraleDie} → <b>${gearRoll >= 0 ? "+" : ""}${gearRoll}</b>` : ""}</div>
        <div class="roll-outcome"><span class="roll-success">Предел боевого духа: <b>${max}</b></span></div>
      </div>`,
      rolls
    }, game.settings.get("core", "rollMode")));
  }

  // ── Приказы ───────────────────────────────────────────────────────────────

  /** Отдача приказа: бросок (если нужен) и запись последствий в состояние. */
  async _executeOrder(key) {
    const o = ORDERS[key]; if (!o) return;
    const d = this.actor.system.derived || {};

    if (!o.air && d.isAir) return ui.notifications.warn(`Авиация не может исполнять приказ «${o.label}».`);
    if (o.airOnly && !d.isAir) return ui.notifications.warn(`Приказ «${o.label}» доступен только авиации.`);

    // Приказ без броска — просто фиксируем.
    if (!o.test) {
      await this.actor.update({ "system.order.key": key });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="wh-roll-result fm-chat">
          <div class="roll-header">${rollIcon("shield", "#4dffa6")}Приказ: ${esc(o.label)} — ${esc(this.actor.name)}</div>
          <div class="fm-chat-effect">${esc(o.desc)}</div>
        </div>`
      });
      return;
    }

    // Варианты теста (основной и альтернативные — книга часто даёт выбор).
    const variants = [o.test, o.test.alt, o.test.alt2, o.test.alt3].filter(Boolean);
    const opts = variants.map((v, i) => {
      const t = this._testValue(v);
      const target = t.value + (v.mod ?? 0);
      return `<option value="${i}" ${i === 0 ? "selected" : ""} data-target="${target}">
        ${esc(this._testLabel({ ...v, alt: null, alt2: null, alt3: null }))} → ${target} (${esc(t.source)})</option>`;
    }).join("");

    const cmd = this._commanderData();
    const pen = d.penalty || 0;

    const content = `<form class="wh-attack-form fm-order-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(o.label)}</span><span class="atk-weapon-class">${esc(this.actor.name)}</span></div>
      <div class="fm-dlg-hint">${esc(o.desc)}</div>
      <div class="atk-dlg-row"><label>Тест:</label><select id="fm-variant">${opts}</select></div>
      <div class="atk-dlg-row"><label>Порог:</label><input id="fm-base" type="number" value="${variants.length ? (this._testValue(variants[0]).value + (variants[0].mod ?? 0)) : 0}"/></div>
      <div class="atk-dlg-row"><label>Истощение:</label><span class="fm-dlg-pen">${pen === 0 ? "нет" : pen}</span></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="fm-mod" type="number" value="0"/></div>
      <div class="atk-dlg-row atk-total-row"><label>Итоговый порог:</label><span id="fm-total">0</span></div>
      <div class="fm-dlg-src">${cmd.filled
        ? `Командует <b>${esc(cmd.name)}</b> — используются его умения и характеристики.`
        : `Командира нет: используется Выучка войск <b>${d.skillValue ?? 0}</b>.`}</div>
    </form>`;

    new Dialog({
      title: `Приказ: ${o.label}`,
      content,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!", callback: async h => {
          const base = parseInt(h.find("#fm-base").val()) || 0;
          const mod  = parseInt(h.find("#fm-mod").val()) || 0;
          await this._resolveOrder(key, base + pen + mod);
        }},
        cancel: { label: "Отмена" }
      },
      default: "roll",
      render: h => {
        const upd = () => {
          const base = parseInt(h.find("#fm-base").val()) || 0;
          const mod  = parseInt(h.find("#fm-mod").val()) || 0;
          h.find("#fm-total").text(base + pen + mod);
        };
        h.find("#fm-variant").on("change", ev => {
          h.find("#fm-base").val(ev.currentTarget.selectedOptions[0]?.dataset.target ?? 0); upd();
        });
        h.find("#fm-base, #fm-mod").on("input", upd);
        upd();
      }
    }, { classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "fm-dialog"], width: 430 }).render(true);
  }

  /** Бросок приказа и применение его последствий к состоянию формирования. */
  async _resolveOrder(key, threshold) {
    const o = ORDERS[key];
    const d = this.actor.system.derived || {};
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total, ok = rv <= threshold;
    const deg = degrees(threshold, rv);

    const update = { "system.order.key": key };
    const extra  = [];
    const rolls  = [roll];

    if (key === "digIn") {
      let cover = ok ? o.effect.coverOnSuccess : o.effect.coverOnFail;
      // Танковое формирование при окапывании получает ещё +1к10 очков укрытия.
      if (d.isArmour) {
        const r = await new Roll("1d10").evaluate(); rolls.push(r);
        cover += r.total;
        extra.push(`Бронетехника окапывается лучше: +${r.total} очков укрытия.`);
      }
      update["system.cover.dugIn"] = cover;
      extra.push(`Укрытие от окопов: <b>${cover}</b>.`);
    }
    else if (key === "flank") {
      if (ok) {
        const r = await new Roll("1d5").evaluate(); rolls.push(r);
        update["system.status.flankRounds"] = r.total;
        extra.push(`+10 к урону на <b>${r.total}</b> стратегических раунд(ов).`);
      } else extra.push("Выгодных позиций занять не удалось — бонуса нет.");
    }
    else if (key === "feint") {
      if (ok) {
        const r = await new Roll("1d5").evaluate(); rolls.push(r);
        update["system.status.feintRounds"] = r.total;
        extra.push(`+5 к урону против настоящей цели на <b>${r.total}</b> стратегических раунд(ов).`);
      } else {
        update["system.status.surprised"] = true;
        extra.push("Уловка разгадана — атакующее истинную цель формирование захвачено внезапностью.");
      }
    }
    else if (key === "charge") {
      if (ok) {
        const r = await new Roll("1d10").evaluate(); rolls.push(r);
        extra.push(`Враг теряет <b>${r.total}</b> боевого духа и до конца раунда наносит нам на 1к10 урона меньше.`);
      } else extra.push("Натиск не устрашил врага.");
    }
    else if (key === "disengage" || key === "withdrawal") {
      if (ok) {
        if (key === "disengage") {
          update["system.cover.dugIn"] = 10;
          extra.push("Вышли из соприкосновения; в начале следующего хода считаемся окопавшимися (10 очков укрытия).");
        } else extra.push("Отходим с половиной скорости. Все атаки по нам наносят +5 урона.");
        update["system.status.engaged"] = false;
      } else {
        update["system.status.disorder"] = -10;
        extra.push("Организованно выйти не вышло — хаос и паника: <b>−10</b> на все тесты" +
          (key === "withdrawal" ? " на два следующих стратегических раунда." : "."));
      }
    }
    else if (key === "pushThrough") {
      const r = await new Roll(ok ? "1d10" : "2d10").evaluate(); rolls.push(r);
      extra.push(ok
        ? `Прорыв удался, но враг наносит дополнительные <b>${r.total}</b> урона.`
        : `Прорыв отбит: враг наносит дополнительные <b>${r.total}</b> урона.`);
    }
    else if (key === "forcedMarch") {
      if (ok) {
        update["system.status.exhausted"] = true;
        extra.push("Километраж за ход удвоен. Солдаты вымотаны: −10 на тесты и на три кости урона меньше, пока не отдохнут стратегический ход.");
      } else extra.push("Марш-бросок сорвался — двигаемся с обычной скоростью.");
    }

    await this.actor.update(update);

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result fm-chat">
        <div class="roll-header">${rollIcon("shield", "#4dffa6")}Приказ: ${esc(o.label)} — ${esc(this.actor.name)}</div>
        <div class="roll-threshold">${esc(this._testLabel(o.test))} → Порог <b>${threshold}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${ok
          ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
          : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}</div>
        ${extra.length ? `<div class="fm-chat-effect">${extra.join("<br/>")}</div>` : ""}
      </div>`,
      rolls, sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }

  // ── Атака ─────────────────────────────────────────────────────────────────

  /** Диалог атаки: цель, модификаторы урона, укрытие цели. */
  async _attackDialog() {
    const d = this.actor.system.derived || {};
    if (d.broken) return ui.notifications.warn("Формирование разбито — вести бой оно не может, пока не будет пополнено.");

    // Цель: помеченный токен или выбор из формирований мира.
    const targeted = [...(game.user.targets ?? [])].map(t => t.actor).find(a => a?.type === "formation");
    const targets  = game.actors.filter(a => a.type === "formation" && a.id !== this.actor.id);
    const targetOpts = targets.map(a => {
      const td = a.system.derived || {};
      return `<option value="${a.id}" ${targeted?.id === a.id ? "selected" : ""}
        data-def="${td.defence ?? 0}" data-cover="${td.cover ?? 0}" data-air="${td.isAir ? 1 : 0}">
        ${esc(a.name)} — Об. ${td.defence ?? 0}, укр. ${td.cover ?? 0}</option>`;
    }).join("");

    const st = this.actor.system.status || {};
    // Предвыставляем модификаторы, о которых лист уже знает.
    const preset = new Set();
    if (st.surprised) { /* внезапность — это состояние ЦЕЛИ, не наше */ }
    if ((Number(st.flankRounds) || 0) > 0) preset.add("flank");
    if ((Number(st.feintRounds) || 0) > 0) preset.add("feint");
    if ((Number(st.reconRounds) || 0) > 0) preset.add("recon");
    if (st.exhausted) preset.add("marched");
    if (this.actor.system.order?.key === "advance") preset.add("advance");

    const modsHtml = DAMAGE_MODS.map(m => {
      const bits = [];
      if (m.value) bits.push(`${m.value > 0 ? "+" : ""}${m.value}`);
      if (m.dice)  bits.push(`${m.dice > 0 ? "+" : ""}${m.dice} кость`);
      return `<label class="attack-mod-check"><input type="checkbox" class="fm-dmg-mod" data-value="${m.value || 0}"
        data-dice="${m.dice || 0}" ${preset.has(m.key) ? "checked" : ""}/><span>${esc(m.label)} (${bits.join(", ")})</span></label>`;
    }).join("");

    const content = `<form class="wh-attack-form fm-attack-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Атака формирования</span><span class="atk-weapon-class">${esc(this.actor.name)}</span></div>
      <div class="fm-dlg-hint">Тестов не требуется — формирования просто должны находиться в дальности поражения. Урон уменьшается на Оборону и укрытие цели, остаток бьёт по её численности.</div>
      <div class="atk-dlg-row"><label>Цель:</label>
        ${targets.length ? `<select id="fm-target">${targetOpts}</select>` : `<span class="fm-dlg-none">формирований в мире нет — урон посчитается «в пустоту»</span>`}</div>
      <div class="atk-dlg-row"><label>Оборона цели:</label><input id="fm-def" type="number" value="${targeted?.system?.derived?.defence ?? 0}"/></div>
      <div class="atk-dlg-row"><label>Укрытие цели:</label><input id="fm-cover" type="number" value="${targeted?.system?.derived?.cover ?? 0}"/></div>
      <div class="atk-dlg-row"><label>Наш урон:</label><span class="fm-dlg-formula">${d.dice}к10 + ${d.strength}</span></div>
      <div class="atk-dlg-modifiers"><div class="atk-mods-title">Модификаторы урона</div><div class="atk-mods-list">${modsHtml}</div></div>
      <label class="attack-mod-check fm-dlg-air"><input type="checkbox" id="fm-vs-air" ${targeted?.system?.derived?.isAir ? "checked" : ""}/>
        <span>Цель — авиация${d.isAA ? " (мы ПВО — урон полный)" : " (наземные части наносят половину урона)"}</span></label>
      <div class="atk-dlg-row"><label>Ручной модификатор:</label><input id="fm-manual" type="number" value="0"/></div>
    </form>`;

    new Dialog({
      title: `Атака: ${this.actor.name}`,
      content,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Атака!", callback: async h => {
          const tgtId  = String(h.find("#fm-target").val() || "");
          const def    = parseInt(h.find("#fm-def").val()) || 0;
          const cover  = parseInt(h.find("#fm-cover").val()) || 0;
          const manual = parseInt(h.find("#fm-manual").val()) || 0;
          const vsAir  = h.find("#fm-vs-air").is(":checked");
          let flat = manual, diceMod = 0;
          h.find(".fm-dmg-mod:checked").each((_, cb) => {
            flat    += parseInt(cb.dataset.value) || 0;
            diceMod += parseInt(cb.dataset.dice)  || 0;
          });
          await this._executeAttack({ targetId: tgtId, def, cover, flat, diceMod, vsAir });
        }},
        cancel: { label: "Отмена" }
      },
      default: "roll",
      render: h => {
        h.find("#fm-target").on("change", ev => {
          const o = ev.currentTarget.selectedOptions[0];
          h.find("#fm-def").val(o?.dataset.def ?? 0);
          h.find("#fm-cover").val(o?.dataset.cover ?? 0);
          h.find("#fm-vs-air").prop("checked", o?.dataset.air === "1");
        });
      }
    }, { classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "fm-dialog"], width: 440 }).render(true);
  }

  /** Бросок урона, вычет Обороны и укрытия, применение к численности и духу цели. */
  async _executeAttack({ targetId, def, cover, flat, diceMod, vsAir }) {
    const d = this.actor.system.derived || {};
    const dice = Math.max(0, (d.dice || 0) + diceMod);
    const formula = dice > 0 ? `${dice}d10` : "0";

    const roll = await new Roll(formula).evaluate();
    let raw = roll.total + (d.strength || 0) + flat;

    // Обычные наземные части наносят авиации только половину урона.
    const halved = vsAir && !d.isAA;
    if (halved) raw = Math.floor(raw / 2);

    const soak = Math.max(0, def) + Math.max(0, cover);
    const dealt = Math.max(0, raw - soak);

    // Урон бьёт по численности; за каждые полные 10 потерянной численности —
    // 1к10 боевого духа.
    const target = targetId ? game.actors.get(targetId) : null;
    const rolls = [roll];
    let applied = "", moraleLoss = 0;

    if (target) {
      const tsys = target.system;
      const numBefore = Number(tsys.numbers?.value) || 0;
      const numAfter  = Math.max(0, numBefore - dealt);
      const lost      = numBefore - numAfter;

      const moraleDice = Math.floor(lost / ATTRITION.moralePerNumbers);
      if (moraleDice > 0 && !tsys.derived?.fearless) {
        const mr = await new Roll(`${moraleDice}d10`).evaluate();
        rolls.push(mr);
        moraleLoss = mr.total;
      }
      const morBefore = Number(tsys.morale?.value) || 0;
      const morAfter  = Math.max(0, morBefore - moraleLoss);

      if (target.isOwner) {
        await target.update({ "system.numbers.value": numAfter, "system.morale.value": morAfter });
        applied = `<div class="fm-chat-applied">Численность <b>${numBefore} → ${numAfter}</b>` +
          (moraleLoss ? ` · боевой дух <b>${morBefore} → ${morAfter}</b> (${moraleDice}к10 = ${moraleLoss})` : "") + `</div>`;
        if (numAfter <= 0) applied += `<div class="fm-chat-note">Численность на нуле — формирование разбито и не может вести бой, пока не будет пополнено.</div>`;
        else if (morAfter <= 0) applied += `<div class="fm-chat-note">Боевой дух на нуле — формирование ударяется в бегство.</div>`;
        else if (morAfter <= (tsys.derived?.halfMorale ?? 0)) applied += `<div class="fm-chat-note">Боевой дух ниже половины предела — нужен тест боевого духа против его изначальной величины.</div>`;
      } else {
        applied = `<div class="fm-chat-note">Нет прав на «${esc(target.name)}» — примените ${dealt} урона численности вручную${moraleLoss ? ` и ${moraleLoss} боевого духа` : ""}.</div>`;
      }
    }

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result fm-chat">
        <div class="roll-header">${rollIcon("burst", "#4dffa6")}Атака — ${esc(this.actor.name)}${target ? ` → ${esc(target.name)}` : ""}</div>
        <div class="roll-threshold">${dice}к10 + Сила ${d.strength}${flat ? ` ${flat > 0 ? "+" : ""}${flat}` : ""}
          ${halved ? " · половина (наземные по авиации)" : ""}</div>
        <div class="roll-damage-line">Урон <b>${raw}</b> − Оборона ${def} − укрытие ${cover} =
          <b class="roll-dmg-big">${dealt}</b></div>
        ${applied}
      </div>`,
      rolls, sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }

  /** Приём урона вручную (когда бьёт не формирование, а обстрел или ГМ). */
  async _takeDamageDialog() {
    const d = this.actor.system.derived || {};
    const content = `<form class="wh-attack-form fm-attack-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Получить урон</span><span class="atk-weapon-class">${esc(this.actor.name)}</span></div>
      <div class="fm-dlg-hint">Оборона (${d.defence}) и укрытие (${d.cover}) вычитаются автоматически. За каждые полные 10 потерянной численности формирование теряет 1к10 боевого духа.</div>
      <div class="atk-dlg-row"><label>Входящий урон:</label><input id="fm-raw" type="number" value="0"/></div>
      <label class="attack-mod-check"><input type="checkbox" id="fm-ignore-soak"/><span>Игнорировать Оборону и укрытие (обстрел с орбиты)</span></label>
      <div class="atk-dlg-row"><label>Источник:</label><input id="fm-src" type="text" placeholder="Кто бьёт"/></div>
    </form>`;

    new Dialog({
      title: `Урон: ${this.actor.name}`,
      content,
      buttons: {
        apply: { icon: '<i class="fas fa-burst"></i>', label: "Применить", callback: async h => {
          const raw    = parseInt(h.find("#fm-raw").val()) || 0;
          const ignore = h.find("#fm-ignore-soak").is(":checked");
          const src    = String(h.find("#fm-src").val() || "");
          const soak   = ignore ? 0 : (d.defence || 0) + (d.cover || 0);
          await this._applyDamage(Math.max(0, raw - soak), src, ignore ? 0 : soak, raw);
        }},
        cancel: { label: "Отмена" }
      },
      default: "apply"
    }, { classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "fm-dialog"], width: 420 }).render(true);
  }

  /** Применение урона к себе: численность, затем боевой дух за потери. */
  async _applyDamage(dealt, source = "", soak = 0, raw = 0) {
    const sys = this.actor.system;
    const numBefore = Number(sys.numbers?.value) || 0;
    const numAfter  = Math.max(0, numBefore - dealt);
    const lost      = numBefore - numAfter;

    const rolls = [];
    let moraleLoss = 0;
    const moraleDice = Math.floor(lost / ATTRITION.moralePerNumbers);
    if (moraleDice > 0 && !sys.derived?.fearless) {
      const mr = await new Roll(`${moraleDice}d10`).evaluate();
      rolls.push(mr); moraleLoss = mr.total;
    }
    const morBefore = Number(sys.morale?.value) || 0;
    const morAfter  = Math.max(0, morBefore - moraleLoss);

    await this.actor.update({ "system.numbers.value": numAfter, "system.morale.value": morAfter });

    const half = sys.derived?.halfMorale ?? 0;
    let note = "";
    if (numAfter <= 0) note = "Численность на нуле — формирование разбито и не может вести бой, пока не будет пополнено людьми, оружием и снаряжением.";
    else if (morAfter <= 0) note = "Боевой дух на нуле — формирование ударяется в бегство.";
    else if (morAfter <= half) note = "Боевой дух ниже половины предела — нужен тест боевого духа против его изначальной величины.";

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result fm-chat">
        <div class="roll-header">${rollIcon("blood", "#ff8a8a")}Потери — ${esc(this.actor.name)}</div>
        ${source ? `<div class="roll-threshold">Источник: ${esc(source)}</div>` : ""}
        <div class="roll-damage-line">${raw ? `${raw} − ${soak} = ` : ""}<b class="roll-dmg-big">${dealt}</b> урона численности</div>
        <div class="fm-chat-applied">Численность <b>${numBefore} → ${numAfter}</b>${moraleLoss
          ? ` · боевой дух <b>${morBefore} → ${morAfter}</b> (${moraleDice}к10 = ${moraleLoss})` : ""}</div>
        ${note ? `<div class="fm-chat-note">${note}</div>` : ""}
      </div>`,
      rolls
    }, game.settings.get("core", "rollMode")));
  }

  // ── Боевой дух ────────────────────────────────────────────────────────────

  /** Тест боевого духа против его изначальной величины. */
  async _moraleTest() {
    const sys = this.actor.system, d = sys.derived || {};
    if (d.fearless) return ui.notifications.info("Богомашины неспособны удариться в панику — все тесты боевого духа проходятся автоматически.");

    const max = Number(sys.morale?.max) || 0;
    const cmd = this._commanderData();
    // Приданный герой может сплотить бойцов тестом Command(F)+0 — это +10 к тесту.
    const content = `<form class="wh-attack-form fm-order-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Тест боевого духа</span><span class="atk-weapon-class">${esc(this.actor.name)}</span></div>
      <div class="fm-dlg-hint">Бросок против изначальной величины боевого духа. Тест нужен при падении до половины предела и повторно — при падении до 25%.</div>
      <div class="atk-dlg-row"><label>Порог (изнач. дух):</label><input id="fm-base" type="number" value="${max}"/></div>
      <label class="attack-mod-check"><input type="checkbox" id="fm-rally" ${cmd.filled ? "" : "disabled"}/>
        <span>Приданный герой сплотил бойцов (Command(F)+0) — +${ATTRITION.rallyBonus}</span></label>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="fm-mod" type="number" value="0"/></div>
    </form>`;

    new Dialog({
      title: `Боевой дух: ${this.actor.name}`,
      content,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!", callback: async h => {
          const base  = parseInt(h.find("#fm-base").val()) || 0;
          const mod   = parseInt(h.find("#fm-mod").val()) || 0;
          const rally = h.find("#fm-rally").is(":checked") ? ATTRITION.rallyBonus : 0;
          const target = base + mod + rally;

          const roll = await new Roll("1d100").evaluate();
          const rv = roll.total, ok = rv <= target;
          const deg = degrees(target, rv);
          if (!ok) await this.actor.update({ "system.status.fled": true });

          await ChatMessage.create(ChatMessage.applyRollMode({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<div class="wh-roll-result fm-chat">
              <div class="roll-header">${rollIcon("heart", ok ? "#4dffa6" : "#ff8a8a")}Тест боевого духа — ${esc(this.actor.name)}</div>
              <div class="roll-threshold">Изначальный дух <b>${base}</b>${rally ? ` +${rally} (сплочение)` : ""}${mod ? ` ${mod > 0 ? "+" : ""}${mod}` : ""} → Порог <b>${target}</b></div>
              <div class="roll-dice">Бросок: <b>${rv}</b></div>
              <div class="roll-outcome">${ok
                ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Формирование продолжает бой</span>`
                : `<span class="roll-failure">Провал — формирование ударяется в бегство</span>`}</div>
              ${ok ? `<div class="fm-chat-note">Следующий тест — при падении боевого духа до 25% от изначального (${d.quarterMorale}).</div>` : ""}
            </div>`,
            rolls: [roll], sound: CONFIG.sounds.dice
          }, game.settings.get("core", "rollMode")));
        }},
        cancel: { label: "Отмена" }
      },
      default: "roll"
    }, { classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "fm-dialog"], width: 420 }).render(true);
  }

  // ── Состояние и раунды ────────────────────────────────────────────────────

  /** Конец стратегического раунда: тикают временные эффекты, спадает беспорядок. */
  async _advanceRound() {
    const st = this.actor.system.status || {};
    const dec = k => Math.max(0, (Number(st[k]) || 0) - 1);
    await this.actor.update({
      "system.status.flankRounds": dec("flankRounds"),
      "system.status.feintRounds": dec("feintRounds"),
      "system.status.reconRounds": dec("reconRounds"),
      "system.status.surprised": false,       // внезапность действует только первый раунд
      "system.status.disorder": 0,
      "system.status.exhausted": false,       // отдых в течение хода снимает усталость
      "system.status.keyEventBonus": false
    });
    ui.notifications.info("Стратегический раунд завершён: временные эффекты сдвинуты.");
  }

  async _resetStatus() {
    await this.actor.update({
      "system.status.surprised": false, "system.status.engaged": false,
      "system.status.fled": false, "system.status.exhausted": false,
      "system.status.disorder": 0, "system.status.flankRounds": 0,
      "system.status.feintRounds": 0, "system.status.reconRounds": 0,
      "system.status.keyEventBonus": false,
      "system.cover.dugIn": 0, "system.order.key": "", "system.order.note": ""
    });
  }

  // ── Ключевые события ──────────────────────────────────────────────────────

  /** Бросок ключевого события: тест героя, затем эффект по книге. */
  async _keyEventRoll(key) {
    const e = KEY_EVENTS[key]; if (!e) return;
    const cmd = this._commanderData();
    const d   = this.actor.system.derived || {};

    const variants = [e.test, e.test?.alt, e.test?.alt2, e.test?.alt3].filter(Boolean);
    if (!variants.length) return;

    const opts = variants.map((v, i) => {
      const t = this._testValue(v);
      const target = t.value + (v.mod ?? 0);
      return `<option value="${i}" ${i === 0 ? "selected" : ""} data-target="${target}">
        ${esc(this._testLabel({ ...v, alt: null, alt2: null, alt3: null }))} → ${target} (${esc(t.source)})</option>`;
    }).join("");

    const content = `<form class="wh-attack-form fm-order-form">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(e.label)}</span>
        <span class="atk-weapon-class">${esc(EVENT_TIERS[e.tier]?.label || "")}</span></div>
      <div class="fm-dlg-hint">${esc(e.desc)}</div>
      <div class="atk-dlg-row"><label>Тест:</label><select id="fm-variant">${opts}</select></div>
      <div class="atk-dlg-row"><label>Порог:</label><input id="fm-base" type="number" value="${this._testValue(variants[0]).value + (variants[0].mod ?? 0)}"/></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="fm-mod" type="number" value="0"/></div>
      <div class="fm-dlg-src">${cmd.filled
        ? `Тест проходит <b>${esc(cmd.name)}</b>.`
        : `Командира нет — используется Выучка войск <b>${d.skillValue ?? 0}</b>.`}</div>
    </form>`;

    new Dialog({
      title: `Ключевое событие: ${e.label}`,
      content,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!", callback: async h => {
          const base = parseInt(h.find("#fm-base").val()) || 0;
          const mod  = parseInt(h.find("#fm-mod").val()) || 0;
          await this._resolveKeyEvent(key, base + mod);
        }},
        cancel: { label: "Отмена" }
      },
      default: "roll",
      render: h => {
        h.find("#fm-variant").on("change", ev =>
          h.find("#fm-base").val(ev.currentTarget.selectedOptions[0]?.dataset.target ?? 0));
      }
    }, { classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "fm-dialog"], width: 440 }).render(true);
  }

  /** Разрешение ключевого события с применением его эффектов к формированию. */
  async _resolveKeyEvent(key, threshold) {
    const e = KEY_EVENTS[key];
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total, ok = rv <= threshold;
    const deg = degrees(threshold, rv);

    const rolls = [roll];
    const update = {};
    const extra = [];

    if (key === "rally") {
      const r = await new Roll("2d10").evaluate(); rolls.push(r);
      const cur = Number(this.actor.system.morale?.value) || 0;
      const max = Number(this.actor.system.morale?.max) || 0;
      if (ok) {
        update["system.morale.value"] = Math.min(max, cur + r.total);
        extra.push(`Боевой дух восстановлен на <b>${r.total}</b> и +5 к боевым тестам в этом стратегическом раунде.`);
      } else {
        const f = await new Roll("1d10").evaluate(); rolls.push(f);
        update["system.morale.value"] = Math.max(0, cur - f.total);
        extra.push(`Неумелое враньё обрушило боевой дух на <b>${f.total}</b> и дало −5 ко всем боевым тестам в этом раунде.`);
      }
    }
    else if (key === "supplies" && ok) {
      const r = await new Roll("2d10").evaluate(); rolls.push(r);
      const max = Number(this.actor.system.morale?.max) || 0;
      const cur = Number(this.actor.system.morale?.value) || 0;
      // Поставки поднимают дух навсегда — растёт и предел.
      update["system.morale.max"]   = max + r.total;
      update["system.morale.value"] = cur + r.total;
      extra.push(`Боевой дух формирования навсегда поднят на <b>${r.total}</b>.`);
    }
    else if (key === "recon" && ok) {
      update["system.status.reconRounds"] = 2;
      extra.push("Дружественные войска атакуют с бонусом +10 и наносят +1к10 урона в текущем и следующем стратегических раундах.");
    }
    else if (key === "triage" && ok) {
      extra.push("Потери численности за прошлый раунд уменьшаются вдвое, потери боевого духа — вчетверо. Поправьте значения вручную.");
    }
    else if (key === "voxWar") {
      extra.push(ok
        ? "В следующем стратегическом раунде вражеское формирование получает −10 из-за падения боеспособности."
        : "Враг дал отпор; его вокс-связист может отследить источник помех.");
    }
    else if (key === "sabotage" && ok) {
      const n = await new Roll("2d10").evaluate(); rolls.push(n);
      const m = await new Roll("4d10").evaluate(); rolls.push(m);
      extra.push(`Жертва наносит на 2 очка урона меньше, теряет <b>${n.total}</b> численности и <b>${m.total}</b> боевого духа.`);
    }
    else if (key === "barrage") {
      extra.push(ok
        ? "Артиллеристы атакуют с уроном на 3 меньше обычного и либо лишают врага 1к10 очков укрытия, либо наносят 3к10 урона боевому духу — по выбору."
        : "Обстрел лёг не там, где нужно — ГМ определяет смещение по схеме направлений.");
    }
    else if (key === "airStrike") {
      extra.push(ok
        ? "Цель уничтожена: в следующем стратегическом раунде вражеское формирование наносит на 2 очка меньше урона, а по решению ГМа может потерять в численности."
        : "Удар не достиг цели.");
    }
    else if (key === "bombardment") {
      extra.push(ok
        ? "Обстрел накрыл цель. Урон см. в справочнике: лэнс — 75+5к10 численности, макробатареи — 40+5к10."
        : `Удар лёг в 2к10+${deg} км от заданной точки — направление определите по схеме направлений.`);
    }

    if (ok) {
      update["system.status.keyEventBonus"] = true;
      extra.push(`<i>${esc(KEY_EVENT_REWARD)}</i>`);
    }
    if (Object.keys(update).length) await this.actor.update(update);

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result fm-chat">
        <div class="roll-header">${rollIcon("spark", "#4dffa6")}${esc(e.label)} — ${esc(this.actor.name)}</div>
        <div class="roll-threshold">${esc(EVENT_TIERS[e.tier]?.label || "")} · ${esc(this._testLabel(e.test))} → Порог <b>${threshold}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${ok
          ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
          : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}</div>
        ${extra.length ? `<div class="fm-chat-effect">${extra.join("<br/>")}</div>` : ""}
      </div>`,
      rolls, sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }
}
