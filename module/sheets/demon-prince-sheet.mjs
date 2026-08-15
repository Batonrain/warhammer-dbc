// module/sheets/demon-prince-sheet.mjs
// Лист Демон-Принца — производный от листа персонажа (та же машинерия
// характеристик/боя/способностей), но в эстетике чистого Варпа: шапка-апофеоз
// с сигилом патрона, Фавором и Истинным Именем, вкладка АПОФЕОЗ с реестром
// Демонических Даров (корбук 462–464). Тема окрашивается под Бога (--gc/--gc2).

import { homeworldSheetContext } from "../apps/homeworlds.mjs";
import { divinationSheetContext } from "../apps/divinations.mjs";
import { WarhammerCharacterSheet } from "./actor-sheet.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { DP_GODS, dpGodMeta, DP_ASCENSION, DP_IMMORTALITY, DP_RETINUE,
         DP_FAVOR_RULES, dpGiftsFor, dpGiftCost, DP_GIFT_NOTE,
         dpDivineTrait, DEMON_FORMS, DEMON_KEY_TRAITS, DEMON_WEAPON_PROPS,
         DP_NATURE_TRAITS, DP_MIGHT, DP_MANIFEST_STEPS, dpManifest } from "../constants/demon-prince.mjs";
import { veilTotal } from "../constants/veil.mjs";
import { infamyContext } from "../apps/infamy-points.mjs";
import { esc } from "../helpers/utils.mjs";

// Дары с полной автоматизацией (создают предметы / меняют числа при взятии).
const DP_AUTO_GIFTS = new Set([
  "vitality", "daemonName", "chaosArmour", "daemonAura", "daemonFlight", "realityAnchor",
  "immortalMight", "warpflameHalo", "soulRip", "searingGaze", "indestructible"
]);

// Метки характеристик (для Бессмертной Мощи / союзной хар-ки Возвышения).
const DP_CHAR_LABELS = { ws:"Ближний бой (WS)", bs:"Стрельба (BS)", s:"Сила (S)", t:"Стойкость (T)",
  ag:"Ловкость (Ag)", int:"Интеллект (Int)", per:"Восприятие (Per)", wp:"Сила Воли (WP)", fel:"Общение (Fel)" };

// Эффективное Истончение Завесы на текущей сцене + Якори в Реальности Принца.
function dpVeilSteps(actor) {
  let t = 0;
  try {
    const scene = canvas?.scene ?? game.scenes?.current ?? null;
    if (scene) t = veilTotal(scene.getFlag("warhammer-dbc", "veil"));
  } catch (_e) { /* сцена не готова */ }
  const anchors = (actor.system.dp?.gifts || []).filter(g => g.key === "realityAnchor").length;
  return t + anchors;
}

// Действия листа Демон-Принца; общие — от листа персонажа (ApplicationV2
// склеивает DEFAULT_OPTIONS по цепочке классов).
function onFavorPlus()   { return this._changeFavor(+1); }
function onFavorMinus()  { return this._changeFavor(-1); }
function onAvatar() {
  const FP = filePicker();
  return new FP({ type: "image", current: this.actor.img, callback: p => this._setAvatar(p) }).render(true);
}
function onInstability()  { return this._rollInstability(); }
function onFavorInfamy()  { return this._favorToInfamy(); }
function onFavorEscape()  { return this._favorEscape(); }
function onAscendFavor()  { return this._ascensionFavor(); }
function onGiftBuy(event, target)       { return this._buyGift(target); }
function onGiftSacrifice(event, target) { return this._sacrificeGift(target); }
function onManifest()     { return this._rollManifestation(); }
function onAscend()       { return this._performAscension(); }
function onUnascend()     { return this._undoAscension(); }

export class WarhammerDemonPrinceSheet extends WarhammerCharacterSheet {
  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "sheet", "actor", "demon-prince", "wh-dp"],
    position: { width: 860, height: 920 },
    actions: {
      // Навигация по вкладкам — своя разметка, общий обработчик.
      tab: onTab,
      dpFavorPlus:     whenEditable(onFavorPlus),
      dpFavorMinus:    whenEditable(onFavorMinus),
      dpAvatar:        whenEditable(onAvatar),
      dpInstability:   whenEditable(onInstability),
      dpFavorInfamy:   whenEditable(onFavorInfamy),
      dpFavorEscape:   whenEditable(onFavorEscape),
      dpAscendFavor:   whenEditable(onAscendFavor),
      dpGiftBuy:       whenEditable(onGiftBuy),
      dpGiftSacrifice: whenEditable(onGiftSacrifice),
      dpManifest:      whenEditable(onManifest),
      dpAscend:        whenEditable(onAscend),
      dpUnascend:      whenEditable(onUnascend)
    }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/actor/demon-prince-sheet.hbs",
      root: true,
      scrollable: [".sheet-body", ".skills-advance-scroll"]
    }
  };

  // Вместо Тела/Одержимости/Гемункула — своя вкладка АПОФЕОЗ с реестром Даров.
  static TABS = {
    primary: {
      initial: "stats",
      tabs: [
        { id: "stats",      label: "ПОКАЗАТЕЛИ" },
        { id: "combat",     label: "БОЙ" },
        { id: "abilities",  label: "СПОСОБНОСТИ" },
        { id: "psy",        label: "ПСИ" },
        { id: "gear",       label: "СНАРЯЖЕНИЕ" },
        { id: "advance",    label: "РАЗВИТИЕ" },
        { id: "apotheosis", label: "АПОФЕОЗ" },
        { id: "notes",      label: "ЗАПИСИ" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system;
    // Родные миры — опциональное расширение (дропдаун «Происхождение»).
    context.homeworld = homeworldSheetContext(this.actor);
    context.divination = divinationSheetContext(this.actor);
    const dp = s.dp || {};

    // У демонов Inf — это Бесчестие.
    const inf = context.chars?.find(c => c.key === "inf");
    if (inf) inf.label = "Бесчестие";

    const godKey = s.allegiance || "undivided";
    const god = dpGodMeta(godKey);
    god.divine = dpDivineTrait(godKey);   // Трейт по Книге Хаоса (Кровь Богу Крови…)
    const gifts = Array.isArray(dp.gifts) ? dp.gifts : [];
    const ownedByKey = {};
    for (const g of gifts) ownedByKey[g.key] = (ownedByKey[g.key] || 0) + 1;

    const registry = dpGiftsFor(godKey).map(g => {
      const owned = ownedByKey[g.key] || 0;
      const next = dpGiftCost(g, owned);
      return {
        ...g,
        owned,
        nextCost: next,
        costLabel: g.variable ? "X" : String(next),
        affordable: g.variable ? (dp.favor || 0) > 0 : (dp.favor || 0) >= next,
        blocked: !!(g.unique && owned),
        auto: DP_AUTO_GIFTS.has(g.key)   // дар автоматически применяет механику/предмет
      };
    });

    // ── Форма манифестации и расчёт её длительности (Книга Хаоса) ──────────
    const formKey = s.form || "trueForm";
    const wb = s.characteristics?.wp?.bonus ?? 0;
    const infb = s.characteristics?.inf?.bonus ?? 0;
    const thinSteps = dpVeilSteps(this.actor);
    const man = dpManifest(formKey, wb, infb, thinSteps);

    const favor = Math.max(0, Number(dp.favor) || 0);
    context.dp = {
      god, godKey, favor,
      customImg: !DP_SIGILS.has(this.actor.img), img: this.actor.img,
      forms: DEMON_FORMS.map(f => ({ key: f.key, label: f.label, selected: f.key === formKey })),
      formKey,
      formMeta: DEMON_FORMS.find(f => f.key === formKey) || null,
      manifest: man ? {
        formulaText: `${man.formula} + (2×W.b − Inf.b = ${2 * wb - infb}), мин. ${man.min}`,
        unit: man.unit, note: man.note
      } : null,
      thinSteps,
      keyTraits: DEMON_KEY_TRAITS,
      weaponProps: DEMON_WEAPON_PROPS,
      ascended: !!dp.ascended,
      infamy: infamyContext(this.actor, godKey, {
        ip: Math.max(0, Math.min(this._infamyMax, Number(dp.ip) || 0)),
        ipMax: this._infamyMax, showCounter: true
      }),
      favorPips: Array.from({ length: Math.max(favor, 1) }, (_, i) => i < favor),
      godOptions: DP_GODS.map(g => ({ key: g.key, label: g.label, selected: g.key === godKey })),
      trueName: s.trueName || "",
      trueNameKnown: !!s.trueNameKnown,
      syllables: Math.max(0, Number(dp.syllables) || 0),
      sylRunes: Array.from((god.runes || "⛧").repeat(3)).filter(ch => ch.trim()).slice(0, Math.max(0, Number(dp.syllables) || 0)),
      instability: s.instabilityRating ?? 1,
      banished: !!dp.banished,
      trueFormDesc: dp.trueFormDesc || "",
      mortalName: dp.mortalName || "",
      anointed: dp.anointed || "",
      retinueNotes: dp.retinueNotes || "",
      gifts: gifts.map(g => ({ ...g, xLabel: g.x ? ` (X=${g.x})` : "" })),
      giftsCommon: registry.filter(g => g.god === "common"),
      giftsGod: registry.filter(g => g.god !== "common"),
      ascension: DP_ASCENSION,
      immortality: DP_IMMORTALITY,
      retinue: DP_RETINUE,
      favorRules: DP_FAVOR_RULES,
      giftNote: DP_GIFT_NOTE,
      showPsy: !!s.isPsyker
    };
    return context;
  }

  // Происхождение (.hw-select/.dv-select) навешивает лист персонажа — своя
  // разметка Принца попадает под тот же селектор. В V1 обе привязки стояли
  // разом, и смена мира применялась дважды.
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;
    // Клик по аватару — действие dpAvatar; ПКМ возвращает сигил бога.
    this.element?.querySelectorAll(".dp-sigil").forEach(n =>
      n.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        this._setAvatar(dpGodMeta(this.actor.system.allegiance || "undivided").sigil);
      }));
  }

  // Очки Бесчестия у Принца: хранятся в system.dp.ip (макс = Inf.b), свой
  // счётчик в полосе, тема/сигил Бога-патрона.
  get _showPatronPicker() { return false; }   // патрон выбирается в шапке (Патрон/allegiance)
  get _infamyPath() { return "system.dp.ip"; }
  get _infamyMax()  { return Math.max(0, this.actor.system.characteristics?.inf?.bonus ?? 0); }
  get _infamyShowCounter() { return true; }
  get _infamyKey()  { return this.actor.system.allegiance || "undivided"; }
  _infamyMeta()     { const g = this._god; return { gc: g.color, gc2: g.gc2, sigil: g.sigil }; }

  get _god() { return dpGodMeta(this.actor.system.allegiance || "undivided"); }

  async _dpCard(title, lines) {
    const g = this._god;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-dp-card" style="--gc:${g.color};--gc2:${g.gc2};">
          <div class="wh-dp-card-h"><span class="wh-dp-card-sigil" style="-webkit-mask:url('${g.sigil}') center/contain no-repeat;mask:url('${g.sigil}') center/contain no-repeat;"></span>${title}</div>
          ${lines.map(l => `<div class="wh-dp-card-r">${l}</div>`).join("")}
        </div>`
    }, rollMode));
  }

  // Свой арт → без заливки (тинта); сигил бога → тинт цвета бога.
  async _setAvatar(path) {
    const custom = !DP_SIGILS.has(path);
    const tint = custom ? null : dpGodMeta(this.actor.system.allegiance || "undivided").color;
    await this.actor.update({ img: path, "prototypeToken.texture.src": path, "prototypeToken.texture.tint": tint });
    for (const t of this.actor.getActiveTokens()) await t.document.update({ "texture.src": path, "texture.tint": tint });
  }

  async _changeFavor(delta) {
    const cur = Math.max(0, Number(this.actor.system.dp?.favor) || 0);
    await this.actor.update({ "system.dp.favor": Math.max(0, cur + delta) });
  }

  // Фавор при вознесении: 1 за каждые полные 20 Бесчестия.
  async _ascensionFavor() {
    const infTotal = this.actor.system.characteristics?.inf?.total ?? 0;
    const favor = Math.floor(infTotal / 20);
    await this.actor.update({ "system.dp.favor": favor });
    await this._dpCard(`⛧ АПОФЕОЗ — ${this.actor.name}`, [
      `Смертная оболочка сброшена. Бесчестие <b>${infTotal}</b> → <b>${favor}</b> Фавора (1 за каждые полные 20).`,
      `<i>Плоть — лишь глина в руках ${this._god.key === "undivided" ? "Пантеона" : this._god.gen}.</i>`
    ]);
  }

  // Тест Варп-Нестабильности (W).
  async _rollInstability() {
    const wp = this.actor.system.characteristics?.wp?.total ?? 0;
    const rating = this.actor.system.instabilityRating ?? 1;
    const roll = await new Roll("1d100").evaluate();
    const success = roll.total <= wp;
    const deg = Math.floor(Math.abs(roll.total - wp) / 10) + 1;
    const g = this._god;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-dp-card" style="--gc:${g.color};--gc2:${g.gc2};">
          <div class="wh-dp-card-h">🌀 Тест Нестабильности — ${esc(this.actor.name)}</div>
          <div class="wh-dp-card-r">Сила Воли: <b>${wp}</b> · Warp Instability (${rating})</div>
          <div class="wh-dp-card-r">Бросок: <b>${roll.total}</b> — ${success
            ? `<span class="ok">Реальность держится — ${deg} ст.</span>`
            : `<span class="bad">Дестабилизация — ${deg} ст.: варп-урон / изгнание в Варп (по решению ГМа).</span>`}</div>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // 1 Фавор → +10 Бесчестия (до максимума в 60).
  async _favorToInfamy() {
    const favor = Math.max(0, Number(this.actor.system.dp?.favor) || 0);
    if (favor < 1) return ui.notifications.warn("Нет Фавора.");
    const inf = this.actor.system.characteristics?.inf ?? {};
    const total = inf.total ?? 0;
    if (total >= 60) return ui.notifications.warn("Бесчестие уже 60 или выше — обмен Фавора недоступен.");
    const gain = Math.min(10, 60 - total);
    await this.actor.update({
      "system.dp.favor": favor - 1,
      "system.characteristics.inf.base": (Number(inf.base) || 0) + gain
    });
    await this._dpCard(`👑 Фавор → Бесчестие — ${this.actor.name}`, [
      `Потрачен 1 Фавор: Бесчестие +${gain} (до максимума в 60).`,
      `Фавор Бога обменян на славу среди Разрушительных Сил.`
    ]);
  }

  // 1 Фавор → избежать изгнания в Варп.
  async _favorEscape() {
    const favor = Math.max(0, Number(this.actor.system.dp?.favor) || 0);
    if (favor < 1) return ui.notifications.warn("Нет Фавора.");
    await this.actor.update({ "system.dp.favor": favor - 1, "system.dp.banished": false });
    await this._dpCard(`🜏 Спасение Патрона — ${this.actor.name}`, [
      `Потрачен 1 Фавор: вместо изгнания в Варп Принц переносится в безопасное место.`,
      `Бесчестие не теряется.`
    ]);
  }

  // Взятие Демонического Дара.
  async _buyGift(target) {
    const key = target.closest("[data-gift]")?.dataset.gift;
    const godKey = this.actor.system.allegiance || "undivided";
    const def = dpGiftsFor(godKey).find(g => g.key === key);
    if (!def) return;

    const gifts = foundry.utils.deepClone(this.actor.system.dp?.gifts || []);
    const owned = gifts.filter(g => g.key === key).length;
    let cost = dpGiftCost(def, owned);
    let x = 0;

    if (def.variable) {
      x = Number(await foundry.applications.api.DialogV2.prompt({
        window: { title: def.label },
        content: `<p>${def.text}</p><label>X (Фавор): <input type="number" name="x" value="1" min="1" autofocus/></label>`,
        ok: { label: "Взять дар", callback: (_ev, btn) => btn.form.elements.x.value }
      }).catch(() => 0));
      if (!x || x < 1) return;
      cost = x;
    }

    // Доп. выбор для отдельных даров (спрашиваем до траты Фавора).
    const extra = {};
    if (def.key === "immortalMight") {
      extra.stat = await this._pickChoice("Бессмертная Мощь — Характеристика", DP_CHAR_LABELS);
      if (!extra.stat) return;
    }
    if (def.key === "chaosArmour") {
      extra.armourMod = await this._pickChoice("Броня Хаоса — модификация",
        { spikes: "Шипы", reflec: "Отражающая", ceramite: "Керамит", ablative: "Аблативная" }) || "ceramite";
    }

    const favor = Math.max(0, Number(this.actor.system.dp?.favor) || 0);
    if (favor < cost) return ui.notifications.warn(`Недостаточно Фавора: нужно ${cost}, есть ${favor}.`);

    const giftId = foundry.utils.randomID();

    // Unnatural одной характеристики ЗАМЕНЯЕТ прежний (не складывается) — снять старые.
    let removeItemIds = [];
    if (def.key === "immortalMight") {
      const prior = gifts.filter(g => g.key === "immortalMight" && g.stat === extra.stat);
      removeItemIds = this.actor.items
        .filter(i => prior.some(p => i.getFlag("warhammer-dbc", "dpGift") === p.id)).map(i => i.id);
      for (const p of prior) { const ix = gifts.indexOf(p); if (ix >= 0) gifts.splice(ix, 1); }
    }

    const entry = { id: giftId, key: def.key, god: def.god, name: def.label, paid: cost, x, noSacrifice: !!def.noSacrifice };
    if (def.key === "immortalMight") entry.name = `Бессмертная Мощь: Unnatural ${DP_CHAR_LABELS[extra.stat]}`;
    if (extra.stat) entry.stat = extra.stat;
    gifts.push(entry);
    const upd = { "system.dp.gifts": gifts, "system.dp.favor": favor - cost };

    // Числовая автоматика (Раны / Бесчестие / слоги).
    const notes = [];
    let woundsDelta = 0;
    if (def.key === "vitality")      { woundsDelta = 10; notes.push("Максимум Ран +10."); }
    if (def.key === "indestructible") { woundsDelta = 20; notes.push("+1 Размер, +20 Ран, Regeneration (7), −15 A, теряет полёт."); }
    if (woundsDelta) {
      entry.woundsDelta = woundsDelta;
      upd["system.wounds.max"] = (Number(this.actor.system.wounds?.max) || 0) + woundsDelta;
    }
    if (def.key === "daemonName") {
      const inf = this.actor.system.characteristics?.inf ?? {};
      if ((inf.total ?? 0) < 100) upd["system.characteristics.inf.base"] = (Number(inf.base) || 0) + Math.min(5, 100 - (inf.total ?? 0));
      upd["system.dp.syllables"] = (Number(this.actor.system.dp?.syllables) || 0) + 1;
      notes.push("Бесчестие +5 (до 100), +1 слог Истинного Имени. Эффекты, использовавшие старое Имя, разорваны.");
    }

    // Предметы-автоматика (броня / щит / оружие / трейты).
    const built = await this._buildGiftItems(def, giftId, favor, x, extra);
    (built.notes || []).forEach(n => notes.push(n));

    if (removeItemIds.length) await this.actor.deleteEmbeddedDocuments("Item", removeItemIds);
    await this.actor.update(upd);
    if (built.items?.length) await this.actor.createEmbeddedDocuments("Item", built.items);

    await this._dpCard(`⛧ ДАР ${def.god === "common" ? "ХАОСА" : this._god.gen.toUpperCase()} — ${def.label}${x ? ` (X=${x})` : ""}`, [
      `<i>${DP_GIFT_NOTE}</i>`,
      def.text,
      `Потрачено Фавора: <b>${cost}</b>. Остаток: <b>${favor - cost}</b>.`,
      ...notes.map(n => `<b>${n}</b>`)
    ]);
  }

  // Диалог выбора из словаря {value: label}. Возвращает value или null.
  async _pickChoice(title, choices) {
    const opts = Object.entries(choices).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<label>${title}: <select name="c">${opts}</select></label>`,
      ok: { label: "Выбрать", callback: (_ev, btn) => btn.form.elements.c.value }
    }).catch(() => null);
  }

  // Строит предметы, создаваемые Демоническим Даром (помечены flag dpGift=giftId).
  async _buildGiftItems(def, giftId, favorAtBuy, x, extra) {
    const flags = { "warhammer-dbc": { dpGift: giftId } };
    const trait = (name, benefit, effects = {}, rating = null, img = "icons/svg/aura.svg") => ({
      name, type: "trait", img, flags,
      system: { description: "", benefit, source: "Демонический Дар",
        hasRating: rating != null, rating: rating ?? 0, hasRating2: false, rating2: 0,
        effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
          armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0, ...effects } }
    });
    const shield = (name, ratingMax, desc) => ({
      name, type: "forcefield", img: "icons/svg/aura.svg", flags,
      system: { description: desc, shieldNature: "warp", shieldType: "dome", ratingMin: 1, ratingMax,
        overloadThreshold: 0, currentRating: ratingMax, isSpecialRating: false, equipped: true,
        status: "active", quality: "best", availability: 0, weight: 0 }
    });
    const pistol = (name, extraSys, props) => ({
      name, type: "weapon", img: "icons/svg/explosion.svg", flags,
      system: { description: "", notes: "", weaponClass: "pistol", weaponType: "psychic", range: 30,
        balance: 0, reload: "—", magazineCur: 0, magazineMax: 0, rof_single: 1, rof_semi: 0, rof_full: 0,
        damage: "", damageType: "energy", penetration: 0, quality: "best", availability: 0, weight: 0,
        attackBonus: 0, special: "Clip ∞; может использовать WS вместо BS", equipped: true,
        weaponProps: props, ...extraSys }
    });

    switch (def.key) {
      case "chaosArmour": {
        const modLabel = { spikes: "Шипы", reflec: "Отражающая", ceramite: "Керамит", ablative: "Аблативная" }[extra.armourMod] || "Керамит";
        return { items: [{
          name: `Броня Хаоса (${modLabel})`, type: "armor", img: "icons/svg/shield.svg", flags,
          system: { description: `Соткана из энергий Варпа (Daemonic Armament). Модификация: ${modLabel}. Смена модификации — свободное действие + Очко Бесчестия.`,
            notes: "", armorType: "power", stacks: false, maxAgility: 100, equipped: true,
            head: 12, body: 12, leftArm: 12, rightArm: 12, leftLeg: 12, rightLeg: 12,
            quality: "best", availability: 0, weight: 0, properties: [], strengthBonus: 0, wpBonus: 0 }
        }], notes: [`Создана Броня Хаоса 12/12/12/12 (${modLabel}).`] };
      }
      case "daemonAura":
        return { items: [shield("Демоническая Аура", 30, "Не перегружающийся сквозной чародейский щит 1-30. Вкл/выкл свободным действием.")],
          notes: ["Создан щит «Демоническая Аура» 1-30 (не перегружается)."] };
      case "warpflameHalo": {
        const rmax = 10 * Math.max(1, favorAtBuy);
        return { items: [shield("Нимб Варп-Пламени", rmax, `Не перегружающийся чародейский щит-купол 1-${rmax} (10×Фавор на момент взятия). Пока активен — все рукопашные атаки получают Flame.`)],
          notes: [`Создан щит «Нимб Варп-Пламени» 1-${rmax}.`] };
      }
      case "daemonFlight":
        return { items: [trait("Flyer (2×A.b)", "Трейт Flyer: скорость полёта = 2×A.b. Крылья декоративны и для полёта не нужны.", {}, 2, "icons/svg/wing.svg")],
          notes: ["Добавлен Трейт Flyer (2×A.b)."] };
      case "soulRip":
        return { items: [pistol("Вырывание Души — Siphon Soul",
          { weaponType: "psychic", range: 30, damage: "3d10", penetration: 0,
            description: "Пистолет-душелов Слаанеш: вырывает душу и вручает её Богу." },
          [{ key: "independent" }, { key: "shocking" }, { key: "tearing" }, { key: "warpWeapon" }])],
          notes: ["Создано оружие «Siphon Soul» (3d10 E, Pen 0, Clip ∞)."] };
      case "searingGaze":
        return { items: [pistol("Пылающий Взор — Searing Gaze",
          { weaponType: "melta", range: 120, damage: "2d10+16", penetration: 8,
            description: "Пламя гнева Кхорна в глазницах." },
          [{ key: "felling", rating: 4 }, { key: "flame" }, { key: "independent" }, { key: "melta" }, { key: "recharge" }])],
          notes: ["Создано оружие «Searing Gaze» (2d10+16 E, Pen 8, Felling 4)."] };
      case "indestructible":
        return { items: [
          trait("Size (+1) / Неуничтожимый", "Туша разбухает: +1 к Размеру.", { sizeMod: 1 }, 1),
          trait("Regeneration (7)", "Регенерация (7): авто-восстановление Ран без тестов в начале Хода.", {}, 7),
          trait("Бремя Колосса (−15 A)", "Масса лишает подвижности: −15 к Ловкости; теряет способность к полёту, если была.",
            { charValueBonuses: [{ stat: "ag", value: -15 }] })
        ], notes: ["Неуничтожимый: Size +1, Regeneration (7), A −15 применены."] };
      case "immortalMight": {
        const lbl = DP_CHAR_LABELS[extra.stat] || extra.stat;
        return { items: [trait(`Unnatural ${lbl} (+${x})`,
          `Сверхъестественная характеристика: +${x} к ${lbl}.b (бонусные Успехи). Повтор для той же характеристики заменяет старый.`,
          { charBonuses: [{ stat: extra.stat, value: x }] }, x)],
          notes: [`Unnatural ${lbl} (+${x}) применён (движок считает бонус).`] };
      }
    }
    return { items: [] };
  }

  // Жертвование даром: возврат половины (окр.▼), текущий Фавор не выше 5.
  async _sacrificeGift(target) {
    const id = target.closest("[data-gift-id]")?.dataset.giftId;
    const gifts = foundry.utils.deepClone(this.actor.system.dp?.gifts || []);
    const idx = gifts.findIndex(g => g.id === id);
    if (idx < 0) return;
    const gift = gifts[idx];
    if (gift.noSacrifice) return ui.notifications.warn("Этим даром нельзя жертвовать — лишь Бог-патрон может отнять его.");

    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Жертвование даром" },
      content: `<p>Пожертвовать даром <b>${esc(gift.name)}</b>? Вернётся половина (окр.▼) потраченного Фавора (${Math.floor((gift.paid || 0) / 2)}), но Фавор не поднимется выше 5.</p>`
    }).catch(() => false);
    if (!ok) return;

    gifts.splice(idx, 1);
    const favor = Math.max(0, Number(this.actor.system.dp?.favor) || 0);
    const refund = Math.floor((gift.paid || 0) / 2);
    const newFavor = favor >= 5 ? favor : Math.min(5, favor + refund);
    const upd = { "system.dp.gifts": gifts, "system.dp.favor": newFavor };

    if (gift.woundsDelta) {
      const wm = Number(this.actor.system.wounds?.max) || 0;
      upd["system.wounds.max"] = Math.max(0, wm - gift.woundsDelta);
    }

    // Удалить предметы, созданные этим даром (броня/щит/оружие/трейт).
    const itemIds = this.actor.items.filter(i => i.getFlag("warhammer-dbc", "dpGift") === gift.id).map(i => i.id);
    if (itemIds.length) await this.actor.deleteEmbeddedDocuments("Item", itemIds);

    await this.actor.update(upd);
    await this._dpCard(`🕯 ЖЕРТВОВАНИЕ — ${gift.name}`, [
      `Дар растворяется в эфире за считанные минуты единения с Богом.`,
      `Возвращено Фавора: <b>${newFavor - favor}</b> (половина от ${gift.paid || 0}, окр.▼, не выше 5 текущего).`
    ]);
  }

  // ── Манифестация: бросок длительности пребывания в форме (Книга Хаоса) ─────
  async _rollManifestation() {
    const s = this.actor.system;
    const formKey = s.form || "trueForm";
    const wb = s.characteristics?.wp?.bonus ?? 0;
    const infb = s.characteristics?.inf?.bonus ?? 0;
    const thin = dpVeilSteps(this.actor);
    const man = dpManifest(formKey, wb, infb, thin);
    if (!man) {
      return this._dpCard(`🩸 Вселение в живого — ${this.actor.name}`, [
        "Хост (живое тело) удерживается долговременно, пока W Принца ≥ W хоста.",
        "Если W хоста выше — выброс через 1d10 + 2×W.b − Inf.b Раундов (затем Incorporeal 10−W.b минут)."
      ]);
    }
    const roll = await new Roll(man.formula).evaluate();
    const total = Math.max(man.min, roll.total + man.addend);
    const rollMode = game.settings.get("core", "rollMode");
    const thinLine = thin > 0
      ? `Истончение Завесы/Якоря: <b>+${thin}</b> → длительность на ${thin} ступ. дольше (${man.unit}).`
      : (thin < 0 ? `<span class="bad">Уплотнённая Завеса (${thin}):</span> тесты Нестабильности при любом действии; удержаться труднее.`
                  : `Базовая плотность Завесы.`);
    const g = this._god;
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-dp-card" style="--gc:${g.color};--gc2:${g.gc2};">
          <div class="wh-dp-card-h"><span class="wh-dp-card-sigil" style="-webkit-mask:url('${g.sigil}') center/contain no-repeat;mask:url('${g.sigil}') center/contain no-repeat"></span>🌀 Проявление — ${esc(this.actor.name)}</div>
          <div class="wh-dp-card-r">${man.formula} + (2×${wb} − ${infb}) = <b>${total}</b> ${man.unit} (мин. ${man.min}).</div>
          <div class="wh-dp-card-r">${thinLine}</div>
          <div class="wh-dp-card-r" style="font-size:0.85em;opacity:0.85;">${man.note}</div>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // ── Возвышение: авто-применение Мощи и Природы предметами-Трейтами ─────────
  async _performAscension() {
    if (this.actor.system.dp?.ascended)
      return ui.notifications.warn("Возвышение уже проведено. Сначала откатите его.");

    // Выбор союзной характеристики для +10 (Демоническая Мощь).
    const CHOICES = { ws:"Ближний бой (WS)", bs:"Стрельба (BS)", s:"Сила (S)", t:"Стойкость (T)",
      ag:"Ловкость (Ag)", int:"Интеллект (Int)", per:"Восприятие (Per)", wp:"Сила Воли (WP)", fel:"Общение (Fel)" };
    const opts = Object.entries(CHOICES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const ally = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Возвышение — союзная Характеристика" },
      content: `<p>Демоническая Мощь: +10 к <b>S</b> и <b>T</b>, +20 Ран и <b>+10 к союзной Характеристике</b> (по Стереотипу).</p>
                <label>Союзная Характеристика: <select name="ally">${opts}</select></label>`,
      ok: { label: "Возвыситься", callback: (_ev, btn) => btn.form.elements.ally.value }
    }).catch(() => null);
    if (ally === null) return;

    const flag = { "warhammer-dbc": { dpAscension: true } };
    // Демоническая Мощь: значения S/T (+10) и союзная (+10) через charValueBonuses.
    const mightBonuses = [{ stat: "s", value: DP_MIGHT.s }, { stat: "t", value: DP_MIGHT.t }];
    if (ally && ally !== "s" && ally !== "t") mightBonuses.push({ stat: ally, value: DP_MIGHT.ally });
    else mightBonuses.find(b => b.stat === ally).value += DP_MIGHT.ally; // союзная = S или T → усилить

    const items = [{
      name: "Демоническая Мощь (Возвышение)", type: "trait", img: "icons/svg/aura.svg",
      flags: flag,
      system: { description: "", benefit: `+10 к S и T, +20 Ран и +10 к союзной Характеристике (${CHOICES[ally]}). Оружие Принца наносит +1 кубик урона (Могущество Принца).`,
        source: "Возвышение", hasRating: false, rating: 0, hasRating2: false, rating2: 0,
        effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: mightBonuses,
          armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0 } }
    }];
    for (const t of DP_NATURE_TRAITS) {
      items.push({
        name: t.name, type: "trait", img: "icons/svg/aura.svg", flags: flag,
        system: { description: "", benefit: t.benefit, source: "Возвышение",
          hasRating: t.rating != null, rating: t.rating ?? 0, hasRating2: false, rating2: 0,
          effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
            armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0, ...(t.effects || {}) } }
      });
    }

    await this.actor.createEmbeddedDocuments("Item", items);
    const wm = Number(this.actor.system.wounds?.max) || 0;
    const infTotal = this.actor.system.characteristics?.inf?.total ?? 0;
    await this.actor.update({
      "system.wounds.max": wm + DP_MIGHT.wounds,
      "system.dp.ascended": true,
      "system.dp.favor": Math.floor(infTotal / 20)
    });
    await this._dpCard(`⛧ ВОЗВЫШЕНИЕ — ${this.actor.name}`, [
      `<i>Смертная оболочка сброшена. Дух вплетён в ткань ${this._god.key === "undivided" ? "Пантеона" : this._god.gen}.</i>`,
      `Демоническая Мощь: <b>+10 S</b>, <b>+10 T</b>, союзная <b>${CHOICES[ally]} +10</b>, <b>+20 Ран</b>.`,
      `Демоническая Природа: Daemonic(+4), Unnatural S/T(+3), Size(2), Fear(3) — применены к Поглощению/бонусам автоматически.`,
      `Стартовый Фавор: <b>${Math.floor(infTotal / 20)}</b> (1 за каждые полные 20 Бесчестия).`
    ]);
  }

  // Откат Возвышения: удалить авто-Трейты и вернуть +20 Ран.
  async _undoAscension() {
    if (!this.actor.system.dp?.ascended) return ui.notifications.info("Возвышение не проведено.");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Откатить Возвышение" },
      content: "<p>Удалить авто-Трейты Возвышения (Мощь + Природа) и вернуть −20 Ран? Купленные Дары не затрагиваются.</p>"
    }).catch(() => false);
    if (!ok) return;
    const ids = this.actor.items.filter(i => i.getFlag("warhammer-dbc", "dpAscension")).map(i => i.id);
    if (ids.length) await this.actor.deleteEmbeddedDocuments("Item", ids);
    const wm = Number(this.actor.system.wounds?.max) || 0;
    await this.actor.update({
      "system.wounds.max": Math.max(0, wm - DP_MIGHT.wounds),
      "system.dp.ascended": false
    });
    ui.notifications.info("Возвышение откачено: авто-Трейты удалены.");
  }
}

// ── Токен/арт демон-принца = сигил бога, тинт по богу (как у демона) ─────────
const DP_SIGILS = new Set(DP_GODS.map(g => dpGodMeta(g.key).sigil));

Hooks.on("preCreateActor", (actor, data) => {
  if ((data?.type || actor?.type) !== "demonPrince") return;
  const m = dpGodMeta(data?.system?.allegiance || "undivided");
  actor.updateSource({
    img: m.sigil,
    prototypeToken: { texture: { src: m.sigil, tint: m.color }, actorLink: true }
  });
});

Hooks.on("updateActor", async (actor, changes) => {
  if (actor.type !== "demonPrince" || changes?.system?.allegiance === undefined) return;
  const m = dpGodMeta(actor.system.allegiance);
  const upd = {};
  if (DP_SIGILS.has(actor.img) && actor.img !== m.sigil) upd.img = m.sigil;
  if (DP_SIGILS.has(actor.prototypeToken?.texture?.src)) {
    upd["prototypeToken.texture.src"] = m.sigil;
    upd["prototypeToken.texture.tint"] = m.color;
  } else if (actor.prototypeToken?.texture?.tint) {
    upd["prototypeToken.texture.tint"] = null;   // свой арт — без заливки
  }
  if (Object.keys(upd).length) await actor.update(upd);
  for (const t of actor.getActiveTokens()) {
    if (DP_SIGILS.has(t.document.texture?.src))
      await t.document.update({ "texture.src": m.sigil, "texture.tint": m.color });
    else if (t.document.texture?.tint)
      await t.document.update({ "texture.tint": null });   // свой арт — снять заливку
  }
});
