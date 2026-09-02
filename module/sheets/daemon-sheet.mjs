// module/sheets/daemon-sheet.mjs
// Лист демона — производный от листа персонажа (та же машинерия характеристик/
// боя/способностей), но с демонической шапкой (сигил бога, ранг, форма,
// Нестабильность, Истинное Имя) и урезанным набором вкладок.

import { WarhammerCharacterSheet, onSkillRoll } from "./actor-sheet.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { resolveKindOutcome } from "../rules/kind-outcome.mjs";
import { testKindHtml, readTestKind, wireTestKindLive, rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { DEMON_ALLEGIANCES, DEMON_RANKS, DEMON_FORMS, DEMON_WEAPON_PROPS, DEMON_KEY_TRAITS,
         allegianceMeta, formDuration } from "../constants/demon-mechanics.mjs";
import { esc } from "../helpers/utils.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { onConvertToHorde } from "../apps/horde-convert.mjs";
import { onMinionCreate } from "../apps/minion-creator.mjs";

// Действия листа демона; всё общее — от листа персонажа: ApplicationV2 склеивает
// DEFAULT_OPTIONS по цепочке классов, поэтому его карта действий здесь в силе.
function onInstability() { return this._rollInstability(); }
function onVsExorcism()  { return this._rollVsExorcism(); }
function onInfamy()      { return this._rollInfamy(); }
function onAvatar()      { return this._pickAvatar(); }

export class WarhammerDaemonSheet extends WarhammerCharacterSheet {
  static DEFAULT_OPTIONS = {
    // "daemon-sheet" — не дублирующий синоним "daemon": daemon-sheet.css
    // скоупит цвет Патрона/фон/hue-rotate именно на .daemon-sheet (тот же
    // класс, что раньше писался мёртвым кодом в hbs, см. _applyDaemonTheme).
    classes: ["warhammer-dbc", "sheet", "actor", "daemon", "daemon-sheet", "wh-holo", "wh-daemon"],
    position: { width: 820, height: 880 },
    actions: {
      // Навигация по вкладкам — своя разметка, общий обработчик.
      tab: onTab,
      daemonInstability: whenEditable(onInstability),
      daemonVsExorcism:  whenEditable(onVsExorcism),
      daemonInfamy:      whenEditable(onInfamy),
      daemonAvatar:      whenEditable(onAvatar),
      // Кнопка «В Орду» стоит в своей шапке, поэтому и действие объявлено
      // здесь: карта действий проверяется у каждого класса своя.
      convertToHorde:    whenEditable(onConvertToHorde),
      // Карта действий у каждого класса своя — «+» Миньонов объявляем и здесь.
      minionCreate:      whenEditable(onMinionCreate),
      // Вкладка СОЦИУМ — общая часть (tab-social.hbs), клик по названию Навыка
      // требует того же обработчика, что и на вкладке ПОКАЗАТЕЛИ.
      skillRoll:         whenEditable(onSkillRoll)
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
    const canPsyker = alg.canPsyker !== false;      // Кхорн (canPsyker:false) ненавидит колдовство
    context.daemon = {
      allegiance: s.allegiance || "undivided",
      alg,
      canPsyker,
      isPsykerRaw: !!s.isPsyker,
      showPsy: !!s.isPsyker && canPsyker,
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
    this._applyDaemonTheme();
    if (!this.isEditable) return;
    // Клик по аватару — действие daemonAvatar; ПКМ действием не выражается:
    // у ApplicationV2 действие — это клик.
    this.element?.querySelectorAll(".daemon-sigil").forEach(n =>
      n.addEventListener("contextmenu", ev => { ev.preventDefault(); this._resetAvatar(); }));
  }

  /**
   * Цвет Патрона на реальный DOM (wdbc-nzn7 — найдено при переносе обшивки):
   * daemon-sheet.hbs раньше писал daemon-god-{key}/--gc/--gc2/--glow/--dp-hue
   * прямо на корневой <div> шаблона, но PARTS.body.root=true отбрасывает
   * классы/инлайн-стиль корня — этот код НИКОГДА не применялся, и лист любого
   * демона визуально красился в дефолт «Неделимый» (см. .warhammer-dbc.
   * daemon-sheet fallback в daemon-sheet.css) независимо от system.allegiance.
   * Симметрично _applyChaosPatronTheme() у Персонажа.
   */
  _applyDaemonTheme() {
    const root = this.element;
    if (!root) return;
    const meta = allegianceMeta(this.actor.system.allegiance || "undivided");
    root.style.setProperty("--gc", meta.color);
    root.style.setProperty("--gc2", meta.gc2);
    root.style.setProperty("--glow", meta.glow);
    root.style.setProperty("--dp-hue", meta.hue);
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

  /**
   * Диалог перед тестом Нестабильности: Вид теста/Сложность — но БЕЗ Кубика.
   * Книга даёт этому тесту максимум один автоматический переброс (см.
   * _rollInstability ниже) — ручной выбор Преимущества/Помехи противоречил бы
   * этому «не из чего выбирать», поэтому здесь только diceModeHtml не зовём.
   */
  async _showInstabilityDialog() {
    const wp = this.actor.system.characteristics?.wp?.total ?? 0;
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Тест Нестабильности" },
      classes: ["wh-roll-dialog-window"],
      position: { width: 340 },
      content: `
        <div class="wh-skill-roll-form">
          <div class="roll-dlg-header"><span>Тест Нестабильности</span></div>
          <div class="roll-dlg-row"><label>Сила Воли:</label><span>${wp}</span></div>
          ${testKindHtml({ defaultKind: "base", label: "Нестабильность" })}
          <div id="auto-outcome-note" class="roll-dlg-note"></div>
        </div>`,
      buttons: [
        {
          action: "roll", icon: "fas fa-dice-d10", label: "Бросок", default: true,
          callback: (event, button) => readTestKind(sel => button.form.querySelector(sel)?.value ?? null, { label: "Нестабильность" })
        },
        { action: "cancel", label: "Отмена", callback: () => false }
      ],
      render: (event, dialog) => wireTestKindLive(dialog.element, {
        actor: this.actor, label: "Нестабильность",
        getBaseEff: () => wp + (parseInt(dialog.element.querySelector("#test-difficulty")?.value) || 0)
      }),
      rejectClose: false
    });
  }

  // Тест Варп-Нестабильности (W+0). Провал → урон/изгнание в Варп (по решению ГМа).
  //
  // Идёт через общий конвейер правил (kind:"instability"), а не мимо него: иначе
  // Локус Цепей («+Inf герольда на все тесты Нестабильности») и всё, что книга
  // даст к этому тесту позже, до броска бы не доехало. Модификаторы предлагаются
  // игроку так же, как в прочих тестах, — молча система их не применяет.
  async _rollInstability() {
    const tk = await this._showInstabilityDialog();
    if (!tk) return;

    const wp = this.actor.system.characteristics?.wp?.total ?? 0;
    const rating = this.actor.system.instabilityRating ?? 1;
    const ctx = { actor: this.actor, kind: "instability" };
    const { mods, rerolls } = resolveTest({ actor: this.actor, ...ctx });
    const bonus = mods.reduce((n, m) => n + (Number(m.value) || 0), 0);
    const threshold = wp + bonus + tk.difficulty;

    // Переброс берём первый доступный: выбирать не из чего — на тест
    // Нестабильности книга даёт максимум один (Локус Цепей его не даёт вовсе).
    const rr = rerolls[0] || null;
    const { roll, rv, rolls: rolled, rerollNote } = await rollD100WithReroll(rr);

    const outcome = await resolveKindOutcome(this.actor, {
      kind: tk.kind, baseEff: threshold, rv, combined: tk.combined, extended: tk.extended, opposed: tk.opposed, ctx
    });
    const { success, deg } = outcome;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result wh-daemon-card">
          <div class="roll-header">🌀 Тест Нестабильности${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(this.actor.name)}</div>
          <div class="roll-threshold">Сила Воли: <b>${wp}</b>${
            bonus ? ` ${bonus > 0 ? "+" : ""}${bonus} (${mods.map(m => m.label).join(", ")})` : ""
          }${tk.difficulty !== 0 ? ` ${tk.difficulty >= 0 ? "+" : ""}${tk.difficulty} (📊 Сложность)` : ""} → Порог: <b>${threshold}</b>
            · Warp Instability (${rating})</div>
          ${outcome.combinedLine}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          ${rerollNote}
          ${outcome.critLine}
          <div class="roll-outcome">${success
            ? `<span class="roll-success">Удержался — ${deg} ст.</span>`
            : `<span class="roll-failure">Дестабилизация — ${deg} ст.: варп-урон / изгнание в Варп (по решению ГМа).</span>`}</div>
          ${outcome.extendedLine}
          ${outcome.opposedLine}
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  /**
   * Диалог перед встречным тестом против Экзорцизма/Чистой Демонологии
   * (Локус Цепей, wdbc-smc) — тот же виджет Вида теста, что у Нестабильности,
   * но по умолчанию сразу открыт на "Встречный": книга формулирует исход
   * («демон должен набрать больше Успехов, чем Ритуалист») как обычный
   * встречный тест (module/rules/test-kind.mjs), не особый случай.
   */
  async _showVsExorcismDialog() {
    const wp = this.actor.system.characteristics?.wp?.total ?? 0;
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Против Экзорцизма / Чистой Демонологии" },
      classes: ["wh-roll-dialog-window"],
      position: { width: 340 },
      content: `
        <div class="wh-skill-roll-form">
          <div class="roll-dlg-header"><span>Против Экзорцизма / Чистой Демонологии</span></div>
          <div class="roll-dlg-row"><label>Сила Воли:</label><span>${wp}</span></div>
          ${testKindHtml({ defaultKind: "opposed", label: "Против Экзорцизма" })}
          <div id="auto-outcome-note" class="roll-dlg-note"></div>
        </div>`,
      buttons: [
        {
          action: "roll", icon: "fas fa-dice-d10", label: "Бросок", default: true,
          callback: (event, button) => readTestKind(sel => button.form.querySelector(sel)?.value ?? null, { label: "Против Экзорцизма" })
        },
        { action: "cancel", label: "Отмена", callback: () => false }
      ],
      render: (event, dialog) => wireTestKindLive(dialog.element, {
        actor: this.actor, label: "Против Экзорцизма",
        getBaseEff: () => wp + (parseInt(dialog.element.querySelector("#test-difficulty")?.value) || 0)
      }),
      rejectClose: false
    });
  }

  // Встречный тест демона против Экзорцизма (стр. 393-425, ритуал типа
  // "exorcism": «Демон в Хосте должен пройти тест на W+0 и набрать больше
  // Успехов, чем Ритуалист, иначе его немедленно изгоняет») и против Чистой
  // Демонологии (Локус Цепей группирует оба в одну книжную фразу). Идёт через
  // общий конвейер правил (kind:"vsExorcism") тем же приёмом, что Нестабильность
  // выше, — иначе бонус Локуса Цепей до броска бы не доехал.
  async _rollVsExorcism() {
    const tk = await this._showVsExorcismDialog();
    if (!tk) return;

    const wp = this.actor.system.characteristics?.wp?.total ?? 0;
    const ctx = { actor: this.actor, kind: "vsExorcism" };
    const { mods, rerolls } = resolveTest({ actor: this.actor, ...ctx });
    const bonus = mods.reduce((n, m) => n + (Number(m.value) || 0), 0);
    const threshold = wp + bonus + tk.difficulty;

    const rr = rerolls[0] || null;
    const { roll, rv, rolls: rolled, rerollNote } = await rollD100WithReroll(rr);

    const outcome = await resolveKindOutcome(this.actor, {
      kind: tk.kind, baseEff: threshold, rv, combined: tk.combined, extended: tk.extended, opposed: tk.opposed, ctx
    });
    const { success, deg } = outcome;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result wh-daemon-card">
          <div class="roll-header">🕯️ Против Экзорцизма / Чистой Демонологии${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(this.actor.name)}</div>
          <div class="roll-threshold">Сила Воли: <b>${wp}</b>${
            bonus ? ` ${bonus > 0 ? "+" : ""}${bonus} (${mods.map(m => m.label).join(", ")})` : ""
          }${tk.difficulty !== 0 ? ` ${tk.difficulty >= 0 ? "+" : ""}${tk.difficulty} (📊 Сложность)` : ""} → Порог: <b>${threshold}</b></div>
          ${outcome.combinedLine}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          ${rerollNote}
          ${outcome.critLine}
          <div class="roll-outcome">${success
            ? `<span class="roll-success">Устоял — ${deg} ст.</span>`
            : `<span class="roll-failure">Провален — ${deg} ст.</span>`}</div>
          ${outcome.extendedLine}
          ${outcome.opposedLine}
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
  // Демоны по умолчанию — Демонические псайкеры (кроме Богов с canPsyker:false, напр. Кхорна).
  actor.updateSource({
    img: m.sigil,
    prototypeToken: { texture: { src: m.sigil, tint: m.color }, actorLink: true },
    system: { isPsyker: m.canPsyker !== false, psyker: { class: "daemonic" } }
  });
});

Hooks.on("updateActor", async (actor, changes) => {
  if (actor.type !== "daemon" || changes?.system?.allegiance === undefined) return;
  const m = allegianceMeta(actor.system.allegiance);
  // Бог с canPsyker:false (Кхорн ненавидит колдовство) — его демон не может быть псайкером.
  if (m.canPsyker === false && actor.system.isPsyker)
    await actor.update({ "system.isPsyker": false });
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
