// module/sheets/daemon-sheet.mjs
// Лист демона — производный от листа персонажа (та же машинерия характеристик/
// боя/способностей), но с демонической шапкой (сигил бога, ранг, форма,
// Нестабильность, Истинное Имя) и урезанным набором вкладок.

import { WarhammerCharacterSheet } from "./actor-sheet.mjs";
import { DEMON_ALLEGIANCES, DEMON_RANKS, DEMON_FORMS, DEMON_WEAPON_PROPS, DEMON_KEY_TRAITS,
         allegianceMeta, formDuration } from "../constants/demon-mechanics.mjs";
import { esc } from "../helpers/utils.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { onConvertToHorde } from "../apps/horde-convert.mjs";

// Действия листа демона; всё общее — от листа персонажа: ApplicationV2 склеивает
// DEFAULT_OPTIONS по цепочке классов, поэтому его карта действий здесь в силе.
function onInstability() { return this._rollInstability(); }
function onInfamy()      { return this._rollInfamy(); }
function onAvatar()      { return this._pickAvatar(); }

export class WarhammerDaemonSheet extends WarhammerCharacterSheet {
  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "sheet", "actor", "daemon", "wh-holo", "wh-daemon"],
    position: { width: 820, height: 880 },
    actions: {
      // Навигация по вкладкам — своя разметка, общий обработчик.
      tab: onTab,
      daemonInstability: whenEditable(onInstability),
      daemonInfamy:      whenEditable(onInfamy),
      daemonAvatar:      whenEditable(onAvatar),
      // Кнопка «В Орду» стоит в своей шапке, поэтому и действие объявлено
      // здесь: карта действий проверяется у каждого класса своя.
      convertToHorde:    whenEditable(onConvertToHorde)
    }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/actor/daemon-sheet.hbs",
      root: true,
      scrollable: [".sheet-body", ".skills-advance-scroll"]
    }
  };

  // Вкладок меньше, чем у персонажа: ни Тела, ни Одержимости, ни Гемункула,
  // зато своя — справочник демонических механик.
  static TABS = {
    primary: {
      initial: "stats",
      tabs: [
        { id: "stats",      label: "ПОКАЗАТЕЛИ" },
        { id: "combat",     label: "БОЙ" },
        { id: "abilities",  label: "СПОСОБНОСТИ" },
        { id: "social",     label: "СОЦИУМ" },
        { id: "psy",        label: "ПСИ" },
        { id: "gear",       label: "СНАРЯЖЕНИЕ" },
        { id: "advance",    label: "РАЗВИТИЕ" },
        { id: "daemonlore", label: "ДЕМОНОЛОГИЯ" },
        { id: "notes",      label: "ЗАПИСИ" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system;

    // У демонов Inf — это Бесчестие (независимо от alignment).
    const inf = context.chars?.find(c => c.key === "inf");
    if (inf) inf.label = "Бесчестие";

    const alg = allegianceMeta(s.allegiance || "undivided");
    const isKhorne = (s.allegiance || "undivided") === "khorne";
    context.daemon = {
      allegiance: s.allegiance || "undivided",
      alg,
      canPsyker: !isKhorne,                       // Кхорн ненавидит колдовство
      isPsykerRaw: !!s.isPsyker,
      showPsy: !!s.isPsyker && !isKhorne,
      allegianceOptions: DEMON_ALLEGIANCES.map(a => ({ key: a.key, label: a.label, selected: a.key === (s.allegiance || "undivided") })),
      rank: s.rank || "lesser",
      rankOptions: DEMON_RANKS.map(r => ({ key: r.key, label: r.label, selected: r.key === (s.rank || "lesser") })),
      rankMeta: DEMON_RANKS.find(r => r.key === (s.rank || "lesser")) || null,
      form: s.form || "trueForm",
      formOptions: DEMON_FORMS.map(f => ({ key: f.key, label: f.label, selected: f.key === (s.form || "trueForm") })),
      formDur: formDuration(s.form || "trueForm"),
      formMeta: DEMON_FORMS.find(f => f.key === (s.form || "trueForm")) || null,
      instability: s.instabilityRating ?? 1,
      trueName: s.trueName || "",
      trueNameKnown: !!s.trueNameKnown,
      portfolio: s.portfolio || "",
      weaponProps: DEMON_WEAPON_PROPS,
      keyTraits: DEMON_KEY_TRAITS,
      // Аватар вместо сигила бога, если арт заменён на пользовательский.
      customImg: !SIGIL_PATHS.has(this.actor.img),
      img: this.actor.img
    };
    // Селектор Бога-покровителя из Записей — только для персонажей-Хаоситов, не для демонов.
    context.showPatronPicker = false;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;
    // Клик по аватару — действие daemonAvatar; ПКМ действием не выражается:
    // у ApplicationV2 действие — это клик.
    this.element?.querySelectorAll(".daemon-sigil").forEach(n =>
      n.addEventListener("contextmenu", ev => { ev.preventDefault(); this._resetAvatar(); }));
  }

  _pickAvatar() {
    const FP = filePicker();
    new FP({ type: "image", current: this.actor.img, callback: p => this._setAvatar(p) }).render(true);
  }
  _resetAvatar() {
    this._setAvatar(allegianceMeta(this.actor.system.allegiance || "undivided").sigil);
  }
  // Свой арт → без заливки (тинта); сигил бога → тинт цвета бога (красит силуэт).
  async _setAvatar(path) {
    const custom = !SIGIL_PATHS.has(path);
    const tint = custom ? null : allegianceMeta(this.actor.system.allegiance || "undivided").color;
    await this.actor.update({ img: path, "prototypeToken.texture.src": path, "prototypeToken.texture.tint": tint });
    for (const t of this.actor.getActiveTokens()) await t.document.update({ "texture.src": path, "texture.tint": tint });
  }

  // Тест Варп-Нестабильности (W+0). Провал → урон/изгнание в Варп (по решению ГМа).
  async _rollInstability() {
    const wp = this.actor.system.characteristics?.wp?.total ?? 0;
    const rating = this.actor.system.instabilityRating ?? 1;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const success = rv <= wp;
    const deg = Math.floor(Math.abs(rv - wp) / 10) + 1;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result wh-daemon-card">
          <div class="roll-header">🌀 Тест Нестабильности — ${esc(this.actor.name)}</div>
          <div class="roll-threshold">Сила Воли: <b>${wp}</b> · Warp Instability (${rating})</div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${success
            ? `<span class="roll-success">Удержался — ${deg} ст.</span>`
            : `<span class="roll-failure">Дестабилизация — ${deg} ст.: варп-урон / изгнание в Варп (по решению ГМа).</span>`}</div>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // Генерация Бесчестия по формуле ранга.
  async _rollInfamy() {
    const rank = DEMON_RANKS.find(r => r.key === (this.actor.system.rank || "lesser"));
    const f = rank?.infamy;
    if (!f) { ui.notifications.info("Для этого ранга Бесчестие не генерируется формулой."); return; }
    const roll = await new Roll(f).evaluate();
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result wh-daemon-card">
          <div class="roll-header">👑 Бесчестие демона — ${esc(this.actor.name)}</div>
          <div class="roll-threshold">${rank.label}: ${f}</div>
          <div class="roll-dice">Результат: <b>${roll.total}</b> Inf</div>
          <div class="roll-threshold" style="font-size:0.85em;">Впишите в характеристику Inf (при желании).</div>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }
}

// ── Токен/арт демона = сигил бога (по умолчанию Неделимый), тинт по богу ─────
const SIGIL_PATHS = new Set(DEMON_ALLEGIANCES.map(a => allegianceMeta(a.key).sigil));

Hooks.on("preCreateActor", (actor, data) => {
  if ((data?.type || actor?.type) !== "daemon") return;
  const alg = data?.system?.allegiance || "undivided";
  const m = allegianceMeta(alg);
  // Демоны по умолчанию — Демонические псайкеры (кроме Кхорна: он ненавидит колдовство).
  const isKhorne = alg === "khorne";
  actor.updateSource({
    img: m.sigil,
    prototypeToken: { texture: { src: m.sigil, tint: m.color }, actorLink: true },
    system: { isPsyker: !isKhorne, psyker: { class: "daemonic" } }
  });
});

Hooks.on("updateActor", async (actor, changes) => {
  if (actor.type !== "daemon" || changes?.system?.allegiance === undefined) return;
  // Кхорн ненавидит колдовство — демон Кхорна не может быть псайкером.
  if (actor.system.allegiance === "khorne" && actor.system.isPsyker)
    await actor.update({ "system.isPsyker": false });
  const m = allegianceMeta(actor.system.allegiance);
  const upd = {};
  // Кастомный арт/токен не трогаем — синкаем только если стоит один из сигилов.
  if (SIGIL_PATHS.has(actor.img) && actor.img !== m.sigil) upd.img = m.sigil;
  if (SIGIL_PATHS.has(actor.prototypeToken?.texture?.src)) {
    upd["prototypeToken.texture.src"] = m.sigil;
    upd["prototypeToken.texture.tint"] = m.color;
  } else if (actor.prototypeToken?.texture?.tint) {
    upd["prototypeToken.texture.tint"] = null;   // свой арт — без заливки
  }
  if (Object.keys(upd).length) await actor.update(upd);
  for (const t of actor.getActiveTokens()) {
    if (SIGIL_PATHS.has(t.document.texture?.src))
      await t.document.update({ "texture.src": m.sigil, "texture.tint": m.color });
    else if (t.document.texture?.tint)
      await t.document.update({ "texture.tint": null });   // свой арт — снять заливку
  }
});
