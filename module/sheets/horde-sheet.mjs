// module/sheets/horde-sheet.mjs
// Лист Орды — множество слабых врагов, действующих как один персонаж.
// Магнитуда вместо Ран, Размер по Магнитуде, психологический урон, состояние.

import { CHARACTERISTICS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES } from "../constants/items.mjs";
import { HIT_LOCATIONS } from "../constants/combat.mjs";
import { degreesOfSuccess } from "../constants/craft.mjs";
import { resolveCharFormula, _degWord, esc } from "../helpers/utils.mjs";
import { resolveWeaponPropsList, aggregateAuto, applyDamageDiceMods,
         buildPropertyChatBlock, buildTargetEffectButtons } from "../combat/weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries } from "../combat/weapon-mods.mjs";
import { meleeStrengthBonus } from "../combat/attack-outcome.mjs";
import { rollHordePsychTest, psychHealLocked, PSYCH_TESTS } from "../combat/horde-psych.mjs";
import { hordeContacts, hordeMeleeTargets } from "../combat/horde-tokens.mjs";
import { attachItemPicker } from "./item-picker.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { activateFactionFieldListeners } from "../apps/actor-factions.mjs";
import { WarhammerStructuralSheet } from "./structural-sheet.mjs";
import { convertHordeToActor } from "../apps/horde-convert.mjs";
import { openContextMenu } from "./context-menu.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";

const CHAR_ORDER = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];
// Общие модификаторы атаки Орды (без Прицеливания и Избирательных — их у Орд нет).
const HORDE_COMMON_MODS = [
  { label: "Слабый свет",   melee: -10, ranged: -10 },
  { label: "Дым / туман",   melee: -10, ranged: -20 },
  { label: "Тьма",          melee: -20, ranged: -30 },
  { label: "Цель лежит",    melee:  20, ranged: -20 },
  { label: "Цель бежит",    melee:  20, ranged: -20 },
  { label: "Цель Оглушена", melee:  20, ranged:  20 },
  { label: "Цель Врасплох", melee:  30, ranged:  30 }
];
const HORDE_RANGED_MODS = [
  { label: "Дистанция в упор (+30)",   value:  30 },
  { label: "Короткая дистанция (+10)", value:  10 },
  { label: "Боевая дистанция (±0)",    value:   0 },
  { label: "Дальняя дистанция (−10)",  value: -10 },
  { label: "Экстрем. дистанция (−30)", value: -30 }
];

// ── Действия листа ───────────────────────────────────────────────────────────
// ApplicationV2 зовёт обработчик [data-action] с this = лист и вторым аргументом
// — элементом, на котором действие объявлено. Обычные функции, а не приватные
// методы: так их видно из DEFAULT_OPTIONS.actions, и тест сверяет карту действий
// с шаблоном. Общая обвязка (whenEditable, onTab, filePicker) — в v2-helpers.mjs;
// whenEditable здесь стоит почти везде: у V1 весь блок activateListeners был под
// if (!this.isEditable) return.

/** Кнопка → сколько снять/добавить Магнитуды и психологического урона. */
const MAG_STEPS = {
  dmg:       step => [-step, 0],
  heal:      step => [ step, 0],
  psych:     step => [-step, step],
  psychheal: step => [ step, -step]
};

function onEditImage() {
  return new (filePicker())({
    type: "image",
    current: this.actor.img || "",
    callback: path => this.actor.update({ img: path })
  }).render(true);
}

function onMag(event, target) {
  const kind = target.dataset.mag;
  if (kind === "reset") return this._magReset();
  // Shift/Ctrl — шаг ×5.
  const [dMag, dPsych] = MAG_STEPS[kind]((event.shiftKey || event.ctrlKey) ? 5 : 1);
  return this._magChange(dMag, dPsych);
}

/** Итоговый порог атаки Орды: база + доп. модификатор + отмеченные галочки. */
function hordeThreshold(form) {
  const num = sel => parseInt(form.querySelector(sel)?.value) || 0;
  let sum = 0;
  form.querySelectorAll(".h-mod:checked").forEach(cb => { sum += parseInt(cb.dataset.value) || 0; });
  return num("#h-threshold") + num("#h-modifier") + sum;
}

function onRollChar(event, target)  { return this._rollChar(target.dataset.char); }
function onRollSkill(event, target) { return this._rollSkill(target.dataset.skill); }
function onRollGroupSkill(event, target) {
  return this._rollGroupSkill(target.dataset.group, Number(target.dataset.index));
}
function onGroupAdd(event, target) {
  const group = target.closest(".horde-gskill-add")?.querySelector("select")?.value
             || target.dataset.group;
  return this._groupSkillAdd(group);
}
function onGroupRemove(event, target) {
  return this._groupSkillRemove(target.dataset.group, Number(target.dataset.index));
}
function onItemCreate(event, target){ return this._createItem(target.dataset.type); }
function onItemEdit(event, target)  { this.actor.items.get(target.dataset.itemId)?.sheet.render(true); }
function onItemDelete(event, target){ return this._deleteItem(target.dataset.itemId); }
function onWeaponRoll(event, target){ return this._hordeAttackDialog(target.dataset.itemId); }
/** Надеть/снять броню: у Орды это простой переключатель на предмете. */
function onItemEquip(event, target) {
  const it = this.actor.items.get(target.dataset.itemId);
  return it?.update({ "system.equipped": !it.system?.equipped });
}
function onPick(event, target)      { return this._openItemPicker(target.dataset.kind); }
/** Психологический тест: массивные потери, Страх, Запугивание. */
function onPsychTest(event, target) { return this._psychTestDialog(target.dataset.kind); }

export class WarhammerHordeSheet extends WarhammerStructuralSheet {

  static DEFAULT_OPTIONS = {
    // wh-horde — на самой форме листа: у V1 её нёс <form> в шаблоне, и вся
    // вёрстка (.wh-horde { height: 100% }) считает этот элемент корнем.
    classes: ["warhammer-dbc", "sheet", "actor", "horde", "wh-holo", "wh-horde"],
    position: { width: 720, height: 820 },
    window: { resizable: true },
    // Как у V1 ActorSheet: правка поля сразу уходит в документ, окно не закрывается.
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      // Переключение вкладок доступно и тем, кто лист только смотрит.
      tab: onTab,
      editImage:  whenEditable(onEditImage),
      mag:        whenEditable(onMag),
      rollChar:   whenEditable(onRollChar),
      rollSkill:  whenEditable(onRollSkill),
      rollGroupSkill: whenEditable(onRollGroupSkill),
      groupAdd:       whenEditable(onGroupAdd),
      groupRemove:    whenEditable(onGroupRemove),
      itemCreate: whenEditable(onItemCreate),
      itemEdit:   whenEditable(onItemEdit),
      itemDelete: whenEditable(onItemDelete),
      itemEquip:  whenEditable(onItemEquip),
      weaponRoll: whenEditable(onWeaponRoll),
      pick:       whenEditable(onPick),
      psychTest:  whenEditable(onPsychTest)
    }
  };

  // Один шаблон целиком: лист небольшой, дробить его на части нечего.
  // root: содержимое кладётся прямо в форму, без промежуточной обёртки — иначе
  // между .wh-horde и её потомками появляется div, и height: 100% рвётся.
  static PARTS = {
    body: { template: "systems/warhammer-dbc/templates/actor/horde-sheet.hbs", root: true }
  };

  static TABS = {
    primary: {
      initial: "battle",
      tabs: [
        { id: "battle", label: "БОЙ" },
        // id вкладки прежний: он лежит в сохранённом состоянии окон у мастера,
        // а по содержимому это теперь Навыки + Черты и Таланты.
        { id: "traits", label: "ПОКАЗАТЕЛИ" },
        { id: "notes",  label: "ЗАМЕТКИ" },
        { id: "rules",  label: "ПРАВИЛА" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    // ── Заметки: prose-mirror с переключаемым режимом (как у Journal Entries).
    context.notesEnriched   = await this._enrich(system.notes);
    context.gmNotesEnriched = await this._enrich(system.gmNotes);

    context.chars = CHAR_ORDER.map(k => {
      const total = system.characteristics?.[k]?.total ?? 0;
      const bonus = system.characteristics?.[k]?.bonus ?? 0;
      // Показать Бонус надстрочно только если он реально модифицирован
      // (отличается от обычного floor(Итог/10)) — см. лист Персонажа.
      const naturalBonus = Math.floor(total / 10);
      return {
        key: k, abbr: CHARACTERISTICS[k]?.abbr || k.toUpperCase(),
        label: CHARACTERISTICS[k]?.label || k,
        total, bonus,
        bonusModified: bonus !== naturalBonus,
        base:  system.characteristics?.[k]?.base ?? 0,
        advance: system.characteristics?.[k]?.advance ?? 0,
        charDamage: system.charDamage?.[k] ?? 0
      };
    });

    // Навыки — тем же блоком, что у персонажа, но ранг ставится прямо здесь:
    // покупки за опыт у орды нет, поэтому вместо ранга-цены — выпадающий список.
    // Одним списком: на две колонки его раскладывает вёрстка (column-count),
    // делить в коде незачем.
    context.skills = Object.keys(SKILLS_DEF).map(k => ({
      key:   k,
      label: SKILLS_DEF[k].label,
      rank:  system.skills?.[k]?.rank ?? "untrained",
      total: system.skills?.[k]?.total ?? -20
    }));
    context.skillRanks = Object.entries(SKILL_RANKS)
      .map(([key, def]) => ({ key, label: def.label, bonus: def.bonus }));

    // Групповые навыки: записи со специализацией. Строкой идут все заведённые,
    // а список групп нужен кнопке «добавить».
    context.groupSkills = Object.entries(GROUP_SKILLS_DEF).flatMap(([groupKey, def]) =>
      (system.groupSkills?.[groupKey] ?? []).map((entry, idx) => ({
        groupKey, idx,
        groupLabel: def.label,
        specialty:  entry.specialty || "",
        rank:       entry.rank || "untrained",
        total:      entry.total ?? -20
      })));
    context.groupSkillDefs = Object.entries(GROUP_SKILLS_DEF)
      .map(([key, def]) => ({ key, label: def.label }));

    context.d = system.derived || {};
    context.weapons = this.actor.items.filter(i => i.type === "weapon")
      .map(i => ({ id: i.id, name: i.name, img: i.img, sys: i.system }));
    // Броня Орды: все попадания идут в торс, поэтому в списке показывается AP
    // тела — остальные зоны у Орды ни на что не влияют.
    context.armors = this.actor.items.filter(i => i.type === "armor")
      .map(i => ({ id: i.id, name: i.name, img: i.img,
        ap: i.system?.body ?? 0, equipped: !!i.system?.equipped }));
    context.talents = this.actor.items.filter(i => i.type === "talent" || i.type === "trait")
      .map(i => ({ id: i.id, name: i.name, img: i.img, type: i.type,
        summary: i.system?.summary || i.system?.description || "" }));

    context.stateLabel = { steady: "Боеспособна", weakened: "Ослаблена потерями", broken: "Сломлена — рассыпается" }[context.d.state] || "";

    // Психологические тесты: три кнопки с уже посчитанным порогом.
    context.psychTests = Object.entries(PSYCH_TESTS)
      .map(([key, def]) => ({ key, label: def.label, hint: def.sub }));
    context.psychLock = psychHealLocked(this.actor);

    // Орда против Орды: соседние Орды и за сколько персонажей каждая считается.
    // Токена на сцене может не быть — тогда панель просто молчит.
    context.hordeContacts = this._contacts();

    return context;
  }

  /**
   * Кнопка-меню «Настройки листа» в шапке — тот же приём, что у
   * WarhammerCharacterSheet (actor-sheet.mjs), но своя копия: у Орды другой
   * базовый класс листа. Единственный пункт — «В Персонажа», обратное
   * превращение (см. apps/horde-convert.mjs, convertHordeToActor).
   */
  _attachFrameListeners() {
    super._attachFrameListeners();
    if (!this.hasFrame) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "header-control icon wh-mechanicus-control";
    btn.dataset.tooltip = "Настройки листа";
    btn.setAttribute("aria-label", "Настройки листа");
    btn.innerHTML = `<img src="systems/warhammer-dbc/assets/ui-icons/adeptus-mechanicus.webp" alt=""/>`;
    this.window.close.insertAdjacentElement("beforebegin", btn);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.isEditable) return;
      openContextMenu(event, [{
        cls: "wh-ctx-tocharacter",
        label: "🧍 В Персонажа",
        onClick: () => convertHordeToActor(this.actor)
      }]);
    });
  }

  /**
   * Поле «Фракция» в шапке. Своими слушателями, а не через actions: у него
   * есть зона дропа, а перетаскивание объявлением [data-action] не описать.
   */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;
    activateFactionFieldListeners(el, this.actor);

    // Поля записей групповых навыков: у них нет `name`, потому что запись
    // лежит в массиве — форма сложила бы её в объект с числовыми ключами, и
    // схема такой массив не приняла бы. Пишем сами.
    if (this.isEditable) el.querySelectorAll("[data-gskill-field]").forEach(node =>
      node.addEventListener("change", ev => this._groupSkillSet(
        node.dataset.group, Number(node.dataset.index),
        node.dataset.gskillField, ev.currentTarget.value)));

    // Перетаскивание предметов на лист: у ApplicationV2 своей привязки нет, а
    // без неё на Орду нельзя было положить ни броню, ни оружие из компендиума —
    // предметы заводились только кнопками самого листа.
    this._bindManualDragDrop(el, "horde");
  }

  _canDragDrop(_selector) { return this.isEditable; }

  async _magChange(dMag, dPsych) {
    const s = this.actor.system;
    const start = Number(s.magnitude?.start) || 0;
    const cur   = Number(s.magnitude?.value) || 0;
    const psych = Number(s.psychDamage) || 0;

    // Орда, автоматически проходящая тесты на Страх и Запугивание, иммунна к
    // психологическому урону — кнопка не должна снимать ей Магнитуду.
    if (dPsych > 0 && s.immuneFear) {
      return ui.notifications.info(
        "Эта Орда автоматически проходит тесты на Страх и Запугивание — психологического урона она не получает.");
    }
    // Лечится только психологический урон и только тот, что действительно есть:
    // обычные потери восполняются рекрутами и отдыхом, а не речью.
    if (dPsych < 0) {
      const lock = psychHealLocked(this.actor);
      if (lock) {
        return ui.notifications.warn(
          `⚠️ Орда потеряла больше половины состава: психологический урон не восстанавливается ещё ${lock.hoursLeft} ч.`);
      }
      const healable = Math.min(-dPsych, psych);
      if (!healable) return ui.notifications.info("Психологического урона у Орды нет.");
      dPsych = -healable;
      dMag   = healable;
    }

    const newVal   = Math.max(0, cur + dMag);
    const cap = start > 0 ? start : Infinity;
    const clamped  = Math.min(newVal, cap);
    const newPsych = Math.max(0, psych + dPsych);
    await this.actor.update({ "system.magnitude.value": clamped, "system.psychDamage": newPsych });
  }

  /**
   * Соседние Орды по расстановке токенов: в рукопашной чужая Орда считается за
   * столько персонажей, сколько клеток базового контакта она выставила.
   * Без сцены и токена панель пуста — считать нечего.
   */
  _contacts() {
    const token = this.actor.getActiveTokens?.()?.[0];
    if (!token) return [];
    try { return hordeContacts(token); }
    catch (e) { console.warn("Warhammer DBC | horde contacts:", e); return []; }
  }

  /** Целей в рукопашной с учётом соседних Орд (см. rules/horde-geometry.mjs). */
  _meleeTargets(magnitudeTargets) {
    const token = this.actor.getActiveTokens?.()?.[0];
    if (!token) return { targets: magnitudeTargets, note: "" };
    try { return hordeMeleeTargets(token, { magnitudeTargets }); }
    catch (e) {
      console.warn("Warhammer DBC | horde melee targets:", e);
      return { targets: magnitudeTargets, note: "" };
    }
  }

  /** Диалог психологического теста: порог считается сам, ГМ вводит модификатор. */
  async _psychTestDialog(kind) {
    const def = PSYCH_TESTS[kind];
    if (!def) return;
    const d = this.actor.system.derived || {};
    const mod = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${def.label} — ${this.actor.name}` },
      classes: ["warhammer-dbc", "wh-holo"],
      content: `<div class="wh-attack-form">
        <div class="atk-horde-info">${esc(def.sub)}</div>
        <div class="atk-dlg-row"><label>Базовый порог:</label>
          <span>W + Магнитуда${d.wpPenalty ? ` ${d.wpPenalty} (Ослаблена)` : ""} = <b>${d.psychTestThreshold ?? 0}</b></span></div>
        <div class="atk-dlg-row"><label>Модификатор:</label>
          <input id="h-psych-mod" type="number" value="0" data-tooltip="Рейтинг Страха, степень Запугивания и прочее"/></div>
      </div>`,
      ok: { label: "Бросок!", icon: "fas fa-dice-d10",
            callback: (event, button) => parseInt(button.form.querySelector("#h-psych-mod")?.value) || 0 }
    }).catch(() => null);
    if (mod === null || mod === undefined) return;
    return rollHordePsychTest(this.actor, kind, { mod });
  }

  async _magReset() {
    const start = Number(this.actor.system.magnitude?.start) || 0;
    await this.actor.update({ "system.magnitude.value": start, "system.psychDamage": 0 });
  }

  async _createItem(type) {
    const label = { weapon: "Оружие", armor: "Броня" }[type] || "Черта";
    const [it] = await this.actor.createEmbeddedDocuments("Item", [{ name: `Новое: ${label}`, type }]);
    it?.sheet.render(true);
  }

  async _deleteItem(id) {
    const it = this.actor.items.get(id); if (!it) return;
    const ok = await Dialog.confirm({ title: "Удалить", content: `<p>Удалить «${esc(it.name)}»?</p>` });
    if (ok) await it.delete();
  }

  async _rollChar(key) {
    const meta = CHARACTERISTICS[key];
    // Ослабленная Орда (потеряно больше половины) катит Волю с −10.
    const penalty = (key === "wp") ? (this.actor.system.derived?.wpPenalty || 0) : 0;
    return this._rollTest({
      label:     meta?.label || key,
      threshold: (this.actor.system.characteristics?.[key]?.total ?? 0) + penalty,
      prefix:    penalty ? `${meta?.abbr || key} (Ослаблена ${penalty})` : (meta?.abbr || key),
      ctx:       { kind: "skill", char: key }
    });
  }

  /** Тест Навыка Орды — тот же d100 против значения навыка. */
  async _rollSkill(key) {
    const def = SKILLS_DEF[key];
    return this._rollTest({
      label:     def?.label || key,
      threshold: this.actor.system.skills?.[key]?.total ?? -20,
      prefix:    "Навык",
      ctx:       { kind: "skill", skill: key, char: def?.char }
    });
  }

  /** Тест группового Навыка: «Управление (Наземный транспорт)». */
  async _rollGroupSkill(group, idx) {
    const entry = this.actor.system.groupSkills?.[group]?.[idx];
    if (!entry) return;
    const def = GROUP_SKILLS_DEF[group];
    return this._rollTest({
      label:     `${def?.label || group}${entry.specialty ? ` (${entry.specialty})` : ""}`,
      threshold: entry.total ?? -20,
      prefix:    "Навык",
      ctx:       { kind: "skill", group, specialty: entry.specialty, char: def?.char }
    });
  }

  /** Записи группы правятся целиком: массив в схеме — один объект. */
  async _writeGroup(group, entries) {
    return this.actor.update({ [`system.groupSkills.${group}`]: entries });
  }

  async _groupSkillAdd(group) {
    if (!GROUP_SKILLS_DEF[group]) return;
    const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[group] ?? []);
    entries.push({ specialty: "", rank: "untrained", total: -20 });
    return this._writeGroup(group, entries);
  }

  async _groupSkillRemove(group, idx) {
    const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[group] ?? []);
    if (!entries[idx]) return;
    entries.splice(idx, 1);
    return this._writeGroup(group, entries);
  }

  /** Правка поля записи: специализация — текстом, ранг — списком. */
  async _groupSkillSet(group, idx, field, value) {
    const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[group] ?? []);
    if (!entries[idx]) return;
    entries[idx] = { ...entries[idx], [field]: value };
    return this._writeGroup(group, entries);
  }

  /** Общая карточка теста d100 против порога. */
  /**
   * @param {object} o
   * @param {object} [o.ctx] контекст теста для реестра правил (wdbc-kok3):
   *   бросает сама Орда, поэтому и правила берутся её — Черты Орды, её
   *   предметы, её Состояния. Штрафы состояния тела на ней безвредны по
   *   построению: ни Усталости, ни шлема, ни инвентаря у Орды нет, и каждый
   *   честно возвращает 0.
   */
  async _rollTest({ label, threshold: baseThreshold, prefix, ctx = null }) {
    const ruleMods = collectTestMods(this.actor, ctx ?? { kind: "skill" });
    const threshold = baseThreshold + ruleMods.total;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total, success = rv <= threshold;
    const deg = Math.floor(Math.abs(rv - threshold) / 10) + 1;
    // Строка Порога у Орды начинается не с числа, а с подписи вида теста
    // («Навык» / «Хар-ка»), а подписи модификаторов идут через «·» — под
    // общий формат thresholdLine она не ложится и оставлена своей.
    await postTestCard(this.actor, {
      title: `${esc(this.actor.name)} — ${esc(label)}`,
      threshold: `<div class="roll-threshold">${esc(prefix)}${ruleMods.parts.map(p => ` · ${p}`).join("")}: Порог <b>${threshold}</b></div>`,
      rv,
      outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} (${deg} ст.)`)
    }, { rolls: [roll], sound: false });
  }

  // ── Диалог атаки Орды (по образцу атаки персонажа, с поправкой на правила Орд) ──
  _hordeAttackDialog(id) {
    const w = this.actor.items.get(id); if (!w) return;
    const sys = w.system || {};
    const isMelee = ["melee", "unarmed", "thrown"].includes(sys.weaponClass);
    const key = isMelee ? "ws" : "bs";
    const meta = CHARACTERISTICS[key];
    const charVal = this.actor.system.characteristics?.[key]?.total ?? 0;
    const d = this.actor.system.derived || {};
    // В рукопашной с другой Ордой целей столько, сколько клеток базового
    // контакта чужой строй выставил, — но не больше, чем позволяет Магнитуда.
    const melee = isMelee ? this._meleeTargets(d.meleeTargets) : null;
    const targets = isMelee ? melee.targets : d.rangedShots;

    // Свойства оружия — напоминание.
    const modFx  = getModEffects(this.actor, w);
    const wProps = resolveWeaponPropsList(mergeWeaponPropEntries(w, modFx));
    const wpBadges = wProps.map(p => {
      const r = p.def.rating ? ` (${p.rating ?? 0})` : "";
      return `<span class="atk-wprop-badge" title="${esc(p.def.desc)}">${p.def.label}${r}</span>`;
    }).join("");

    const rangedModsHtml = !isMelee ? HORDE_RANGED_MODS.map((m, i) =>
      `<label class="attack-mod-check"><input type="radio" name="h-range" class="h-mod" data-value="${m.value}" ${i === 2 ? "checked" : ""}/><span>${m.label}</span></label>`).join("") : "";
    const commonModsHtml = HORDE_COMMON_MODS.map(m => {
      const v = isMelee ? m.melee : m.ranged;
      return `<label class="attack-mod-check"><input type="checkbox" class="h-mod" data-value="${v}"/><span>${m.label} (${v >= 0 ? "+" : ""}${v})</span></label>`;
    }).join("");

    const hordeVsNote = melee?.note ? `<div class="atk-horde-info">${esc(melee.note)}</div>` : "";
    const rangeInfo = (!isMelee && sys.range > 0)
      ? `<div class="atk-range-info"><div class="atk-range-title">Дистанции (Rng = ${sys.range}м)</div>
          <div class="atk-range-grid"><span class="atr-zone atr-pb">В упор →+30</span><span class="atr-zone atr-sh">Кор. →+10</span><span class="atr-zone atr-cb">Боевая →±0</span><span class="atr-zone atr-lg">Дальняя →−10</span><span class="atr-zone atr-ex">Экстр. →−30</span></div></div>` : "";

    // Без <form>: DialogV2 сам оборачивает содержимое в форму, и вложенная
    // ломала бы button.form, через который читаются поля.
    const content = `<div class="wh-attack-form wh-horde-attack">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(w.name)}</span><span class="atk-weapon-class">${WEAPON_CLASSES[sys.weaponClass] || ""}</span></div>
      <div class="atk-horde-info">Орда · целей: <b>${targets}</b> · Магнитуда даёт <b>${d.magDamageStr}</b> к урону при попадании. Прицеливания и Избирательных атак у Орд нет.</div>
      ${hordeVsNote}
      ${wpBadges ? `<div class="atk-dlg-modifiers"><div class="atk-mods-title">Свойства оружия</div><div class="atk-wprops-list">${wpBadges}</div></div>` : ""}
      ${rangeInfo}
      <div class="atk-dlg-row"><label>Характеристика:</label><span class="atk-horde-char">${meta?.abbr || key} (${charVal})</span></div>
      <div class="atk-dlg-row"><label>Базовый порог:</label><input id="h-threshold" type="number" value="${charVal}"/></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="h-modifier" type="number" value="0"/></div>
      ${!isMelee ? `<div class="atk-dlg-modifiers"><div class="atk-mods-title">Дистанция</div><div class="atk-mods-list">${rangedModsHtml}</div></div>` : ""}
      <div class="atk-dlg-modifiers"><div class="atk-mods-title">Модификаторы</div><div class="atk-mods-list">${commonModsHtml}</div></div>
      <div class="atk-dlg-row atk-total-row"><label>Итоговый порог:</label><span id="h-total">${charVal}</span></div>
    </div>`;

    return foundry.applications.api.DialogV2.wait({
      // Без esc: заголовок окна рисуется текстом, экранированное имя показало
      // бы в шапке сам «&amp;».
      window: { title: `Атака Орды: ${w.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 380 },
      content,
      buttons: [
        {
          action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", default: true,
          callback: (event, button) =>
            this._executeHordeAttack(w, key, hordeThreshold(button.form), isMelee, targets)
        },
        { action: "cancel", label: "Отмена" }
      ],
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        const total = form.querySelector("#h-total");
        const upd = () => { total.textContent = hordeThreshold(form); };
        form.querySelectorAll("#h-threshold, #h-modifier").forEach(i => i.addEventListener("input", upd));
        form.querySelectorAll(".h-mod").forEach(i => i.addEventListener("change", upd));
        upd();
      }
    }).catch(() => null);
  }

  // ── Исполнение атаки Орды: попадание, урон (+кубы Магнитуды), карточка с защитой ──
  async _executeHordeAttack(w, key, threshold, isMelee, targets) {
    const sys = w.system;
    const actor = this.actor;
    const d = actor.system.derived || {};
    const chars = actor.system.characteristics;

    const modFx  = getModEffects(actor, w);
    const wProps = resolveWeaponPropsList(mergeWeaponPropEntries(w, modFx));
    const wp     = aggregateAuto(wProps);

    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const hit = rv <= threshold;                       // «промах» у Орды — тоже урон, но без кубов Магнитуды и его можно Избегать
    const deg = Math.abs(degreesOfSuccess(rv, threshold));

    // Место попадания (по перевёрнутым цифрам, как в обычной атаке).
    const rvStr = String(rv).padStart(2, "0");
    const locRoll = Math.min(Math.max(parseInt(rvStr.split("").reverse().join("")) || 1, 1), 100);
    const hitLoc = (HIT_LOCATIONS.find(l => locRoll >= l.min && locRoll <= l.max)?.label) || "Торс";

    // Урон: база + S.b (рукопашная) + кубы Магнитуды (только при попадании).
    const pen = (sys.penetration || 0) + (modFx.penMod || 0);
    const sb  = chars.s?.bonus ?? 0;
    // Могучее ×2, Сдержанное 0 — общее правило с обычной атакой. Хватов у Орды
    // нет, поэтому sbHalf не передаётся.
    const sbEff = meleeStrengthBonus({ sb, wp });
    const flat = (isMelee ? sbEff : 0) + (modFx.damageMod || 0);
    const rawDmg = String(sys.damage || "").replace(/\s+[REIXРЕИ](?:\([^)]*\))?\s*$/i, "").trim();
    const baseDmg = rawDmg || (isMelee ? "0" : "1d10");
    let formula = flat !== 0 ? `${baseDmg} + ${flat}` : baseDmg;
    formula = applyDamageDiceMods(resolveCharFormula(formula, chars, actor.system.corruptionBonus ?? 0), wp);
    const magDice = hit ? (d.magDamageDice || 0) : 0;
    // Отдельный бросок для кубов Магнитуды — не общей формулой: цель ещё не
    // выбрана (карточка применяется позже кнопкой), а «Серый Человек избегает
    // атак Орды как одиночная цель» (wdbc-gzuf) должен вычесть РОВНО эту
    // надбавку из готового урона на шаге применения, не весь бросок целиком.
    const magRoll = magDice ? await new Roll(`${magDice}d10`).evaluate() : null;
    const dmgRoll = await new Roll(formula).evaluate();
    const totalDamage = dmgRoll.total + (magRoll?.total || 0);
    const allDice = [...(dmgRoll.dice || []), ...(magRoll?.dice || [])];
    const dtLabel = DAMAGE_TYPES[sys.damageType] || sys.damageType || "";
    const dtype = sys.damageType || "impact";

    // Дистанции дайсов урона для наглядности.
    const diceParts = allDice.map(die => `${die.number}d${die.faces} [${die.results.map(r => r.result).join(",")}]`).join(" + ");

    // Кнопки: применить урон всегда (попадание или «промах»); Уклонение — только при промахе
    // (обычное попадание Орды Избегать нельзя — это шквал/навал).
    // Свойства, дающие лишние попадания, едут и отсюда: Орда против Орды —
    // обычный случай, и Взрывное с Распылением там работают так же.
    const applyBtn = `<button class="wh-apply-dmg-btn" type="button"
      data-damage="${totalDamage}" data-penetration="${pen}" data-damage-type="${dtype}"
      data-hit-location="${hitLoc}" data-weapon-name="${w.name}" data-attacker="${actor.name}"
      data-attacker-uuid="${actor.uuid || ""}"
      data-felling="${wp.fellingRating || 0}" data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}" data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-blast="${wp.blastRating || 0}" data-flame="${wp.flame ? 1 : 0}"
      data-power-field="${wp.powerField ? 1 : 0}" data-spray="${wp.spray ? 1 : 0}"
      data-devastating="${wp.devastatingRating || 0}"
      data-mag-dice-bonus="${magRoll?.total || 0}"
      data-weapon-range="${Number(sys.range) || 0}" data-melee="${isMelee ? 1 : 0}">
      Применить урон: <b>${totalDamage}</b> → ${hitLoc}</button>`;
    const dodgeBtn = !hit
      ? `<div class="roll-defense-section"><div class="roll-section-head">Защита цели <span class="roll-head-hint">— промах Орды можно Избегать</span></div>
           <div class="roll-defense-btns"><button class="wh-dodge-btn" type="button" data-extra-mod="0" data-attack-deg="${deg}">Уклонение</button>
           ${isMelee && !wp.flexible ? `<button class="wh-parry-btn" type="button" data-extra-mod="0" data-attack-deg="${deg}">Парирование</button>` : ""}</div></div>`
      : `<div class="roll-defense-note">Попадание Орды нельзя Избегать (шквал / навал).</div>`;

    const targetEffectBtns = buildTargetEffectButtons(wProps, { hit, netDamageKnown: false });
    const magNote = magDice ? ` · <span class="horde-chip">Магнитуда +${magDice}d10</span>` : "";
    const meta = CHARACTERISTICS[key];

    // Карточка АТАКИ (wdbc-kuun): на общий сборщик теста сознательно не
    // переводится — у атак своя большая разметка (попадания, локации,
    // урон, кнопки защиты), общая с attack-card.mjs.
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result horde-atk">
        ${buildPropertyChatBlock(wProps)}
        <div class="roll-header">${esc(actor.name)} — ${esc(w.name)}</div>
        <div class="roll-threshold">${meta?.abbr || key}: Порог <b>${threshold}</b> · целей: <b>${targets}</b> · бросок <b>${rv}</b></div>
        <div class="roll-outcome">${hit
          ? `<span class="roll-success">Попадание — ${deg} ${_degWord(deg)}, шквал накрывает цель</span>`
          : `<span class="roll-failure">Промах = попадание без бонусов Магнитуды (можно Избегать)</span>`}</div>
        <div class="roll-damage-section">
          <div class="roll-damage-meta">${dtLabel} · Пробитие ${pen}${isMelee ? `, S.b +${sbEff}` : ""}${magNote}</div>
          <div class="roll-damage-line"><b>${hitLoc}</b>: <b class="roll-dmg-big">${totalDamage}</b> <span class="horde-dmg-formula">= ${formula}${magDice ? ` + ${magDice}d10` : ""}${diceParts ? ` → ${diceParts}` : ""}</span></div>
        </div>
        ${targetEffectBtns}
        <div class="roll-apply-dmg-section"><div class="roll-section-head">Применить к цели <span class="roll-head-hint">— выберите токен</span></div>${applyBtn}</div>
        ${dodgeBtn}
      </div>`,
      rolls: [roll, dmgRoll, ...(magRoll ? [magRoll] : [])],
      sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }
}

// Орда не наследует лист персонажа — подключаем окно выбора отдельно.
attachItemPicker(WarhammerHordeSheet);
