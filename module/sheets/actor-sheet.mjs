import { activateEliteListeners } from "./elite-picker.mjs";
import { buyEliteArchetype } from "../apps/elite-buy.mjs";
import { activateHaemonculusListeners } from "./tabs/haemonculus.mjs";
import { openItemPicker, talentCategory } from "./item-picker.mjs";
import { openGearPicker } from "./gear-picker.mjs";
// module/sheets/actor-sheet.mjs

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }    from "../constants/skills.mjs";
import { ITEM_TYPES, GEAR_ITEM_TYPES } from "../constants/items.mjs";
import { _degWord, splitTopLevel, esc } from "../helpers/utils.mjs";
import { ruSpec } from "../apps/creation.mjs";
import { openCharacterWizard } from "../apps/character-wizard.mjs";
import { onConvertToHorde } from "../apps/horde-convert.mjs";
import { buildGetData } from "./sheet-helpers.mjs";
import { characterContext, charLabel } from "./character-context.mjs";
import { showAttackDialog, showAttackDialogNoWeapon } from "./attack-dialog.mjs";
import { rollMutationOrGift, openMutationPicker } from "./tabs/mutations.mjs";
import { createDisorderItem, activateDisorderListeners } from "./tabs/disorders.mjs";
import { activateDiseaseListeners } from "./tabs/diseases.mjs";
import { fatiguePenalty, activateConditionsListeners } from "./tabs/conditions.mjs";
import { painChatMsg } from "./tabs/pain.mjs";
import { applyHealing } from "./tabs/healing.mjs";
import { activateDrugListeners } from "./tabs/drugs.mjs";
import { activatePsychicListeners, activateNavigatorPower, executePsychotest,
         resolvePsyCastAttr, rollPsyWpTest, rollPsyniscience, showManifestDialog,
         wirePsyManifestPreview } from "./tabs/psychic.mjs";
import { activateTechListeners, activateTechMiracle, techGenResource } from "./tabs/tech.mjs";
import { activateGearListeners } from "./tabs/gear.mjs";
import { activateAspirationListeners } from "./tabs/aspirations.mjs";
import { socialContext, activateSocialListeners } from "./tabs/social.mjs";
import { minionsPanelContext, activateMinionPanelListeners } from "./tabs/minions-panel.mjs";
import { onMinionCreate } from "../apps/minion-creator.mjs";
import { isMinionTalent, minionSlotOf } from "../rules/minion-build.mjs";
import { promptMinionSlot, applyMinionSlot } from "../apps/minion-talent.mjs";
import { refundXP, talentCost, talentReason } from "../apps/duplicate-refund.mjs";
import { activateRitualListeners } from "./tabs/rituals.mjs";
import { activatePathListeners } from "./tabs/paths.mjs";
import { activateCombatListeners } from "./tabs/combat.mjs";
import { mountPanelContext, activateMountPanelListeners } from "./tabs/mount-panel.mjs";
import { dreadnoughtPanelContext } from "./tabs/dreadnought-panel.mjs";
import { SANITY_RECOVERY_TALENTS, sanityRecoveryTalentsOf, dailyWillTestOutcome,
         electrostimulatorBoost, ferumInfernusActive } from "../rules/dreadnought.mjs";
import { computeWoundDamage } from "./tabs/wounds.mjs";
import { activateBodyListeners } from "./tabs/body.mjs";
import { activatePossessionListeners } from "./tabs/possession.mjs";
import { activateAdvanceListeners } from "./tabs/advance.mjs";
import { activateItemContextMenu } from "./context-menu.mjs";
import { _resolveSoulBurn }                 from "../hooks.mjs";
import { openRigManager }                   from "../apps/rig-manager.mjs";
import { infamyContext, changeInfamy, restoreInfamy, spendInfamy } from "../apps/infamy-points.mjs";
import { promptStatAdd } from "../apps/stat-log.mjs";
import { CHAOS_PATRONS, chaosPatronMeta } from "../constants/chaos-patron.mjs";
import { applyArchetype } from "../apps/archetypes.mjs";
import { homeworldRollMods, matchesContext } from "../constants/homeworlds.mjs";
import { ruleRollModsHtml, ruleRerollsHtml } from "../rules/roll-mods.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { assistRejection, assistThresholdBonus, assistDegrees, DEFAULT_ASSIST_MAX,
         assistsBeyondCap, countedAssists }
  from "../rules/assists.mjs";
import { specOptions, specDef } from "../constants/skill-specializations.mjs";
import { applyHomeworld, actorHomeworldKey } from "../apps/homeworlds.mjs";
import { applyDivination } from "../apps/divinations.mjs";
import { applyRace, applySubrace, clearRace, clearSubrace,
         actorRaceItem, actorSubraceItem,
         applyLegion, applyYnnari, applyHarlequin } from "../apps/races.mjs";
import { raceDef, raceKeyOf } from "../apps/race-library.mjs";
import { openRacePicker } from "./race-picker.mjs";
import { HELMETLESS_FEL_BONUS } from "../constants/power-armour-lore.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { actorFactionsContext, activateFactionFieldListeners } from "../apps/actor-factions.mjs";
import { toggleAbility } from "../apps/toggle-abilities.mjs";

// Псевдонимы коротких имён талантов из данных рас/архетипов → имена в библиотеке
// (по англ. части, в нижнем регистре). Покрывает расхождения «Minion» →
// «Minion of Chaos», дефисы, мн.ч. и опечатки.
// Экспортируются: та же таблица и регулярка нужны Этапу 3 нового мастера
// (character-wizard.mjs) — там разбор списка талантов на «выбор» продублирован
// без диалога, но по тем же правилам.
export const TALENT_ALIAS = {
  "minion":               "minion of chaos",
  "erudite infernal":     "erudite-infernal",
  "clues from the crowd": "clues from the crowds",
  "sure stitch":          "sure strike"
};
// Разделители вариантов выбора в данных: « или » и «/».
export const TALENT_CHOICE_SEP = /\s+или\s+|\s*\/\s*/i;

// ── Действия листа ───────────────────────────────────────────────────────────
// ApplicationV2 зовёт обработчик [data-action] с this = лист и элементом-
// источником вторым аргументом. Здесь только СВОИ кнопки листа: всё, что уже
// вынесено во вкладки (module/sheets/tabs/), навешивают их модули, и в карту
// действий оно не попадает. Общая обвязка — в v2-helpers.mjs.

function onPortrait() {
  const FP = filePicker();
  return new FP({
    type: "image", current: this.actor.img || "",
    callback: path => this.actor.update({ img: path })
  }).render(true);
}

// ── Очки Бесчестия (общая полоса infamy-strip) ──
function onInfamyMinus()   { return this._ipChange(-1); }
function onInfamyPlus()    { return this._ipChange(+1); }
function onInfamyRestore() { return this._ipRestore(); }
function onInfamySpend(event, target) { return this._ipSpend(target.dataset.ability); }

// ── Свёртки: состояние ОКНА, а не актора — без ре-рендера ──
function onCombatCollapse(event, target) {
  const key = target.dataset.collapse;
  this._combatCollapse[key] = !this._combatCollapse[key];
  target.closest(".combat-collapsible")?.classList.toggle("collapsed", this._combatCollapse[key]);
}

function onGearCat(event, target) {
  if (event.target.closest("button, select, input, a")) return;   // не по контролам внутри
  const key = target.dataset.gearCat;
  this._gearCollapse[key] = !this._gearCollapse[key];
  target.closest(".gear-cat")?.classList.toggle("collapsed", this._gearCollapse[key]);
}

function onGearModsToggle(event, target) {
  event.preventDefault(); event.stopPropagation();
  const hid = target.dataset.hostId;
  if (this._gearHostCollapse.has(hid)) this._gearHostCollapse.delete(hid);
  else this._gearHostCollapse.add(hid);
  this._applyGearHostCollapse(hid);
}

function onPathsToggle(event, target) {
  event.preventDefault();
  const nowOpen = this._pathsOpen === false;             // был свёрнут → разворачиваем
  this._pathsOpen = nowOpen;
  this.element?.querySelectorAll(".paths-collapse")
    .forEach(n => n.classList.toggle("collapsed", !nowOpen));
  target.textContent = (nowOpen ? "▾" : "▸") + " Пути";
}

// Раскрытие описания таланта/черты/мутации в выпадающей строке под основной.
// Строка описания всегда идёт СЛЕДУЮЩИМ <tr> сразу за строкой с кнопкой — берём
// её так, а не поиском по data-item-id: на одном листе таблицы талантов, черт,
// имплантов и органов Геносемени независимы, и если бы где-то совпал id,
// раскрытие по атрибуту открыло бы сразу все совпадения.
function onAbilityDetail(event, target) {
  event.preventDefault(); event.stopPropagation();
  const tr  = target.closest("tr");
  const row = tr?.nextElementSibling;
  if (!row?.classList.contains("ability-detail-row")) return;
  const shown = row.style.display === "none";
  row.style.display = shown ? "" : "none";
  target.textContent = shown ? "▾" : "▸";
  tr.classList.toggle("ability-row-open", shown);
}

// Кнопка «вкл./выкл.» у подспособности переключаемой способности (Локус
// Герольда и подобные «раз в Ход выбери один из N»). Что именно станет
// включённым — считает module/rules/toggle-abilities.mjs, применяет
// module/apps/toggle-abilities.mjs; лист перерисуется сам по updateItem.
async function onToggleAbility(event, target) {
  event.preventDefault(); event.stopPropagation();
  await toggleAbility(this.actor, target.dataset.parentId, target.dataset.itemId);
}



// ── Кнопки «+» показателей: Безумие/Порча (число или XdY+Z), Опыт,
//    Благосклонность Бога-покровителя (ЗАПИСИ) — общий диалог+лог в чат ──
async function onStatAdd(event, target) {
  event.preventDefault();
  event.stopPropagation();
  const stat = target.dataset.stat;
  if (stat === "insanity") {
    await promptStatAdd(this.actor, { label: "Безумие", path: "system.insanity.value", allowDice: true });
  } else if (stat === "corruption") {
    await promptStatAdd(this.actor, { label: "Порча", path: "system.corruption.value", allowDice: true });
  } else if (stat === "xpTotal") {
    // Ловит на Лету (X) / Fast Learner: +X% к прибавляемому опыту, читаем
    // живой процент с актора (module/documents/actor.mjs, system.fastLearnerBonus).
    await promptStatAdd(this.actor, {
      label: "Опыт (Всего)", path: "system.experience.total",
      bonusPercent: this.actor.system?.fastLearnerBonus || 0
    });
  } else if (stat === "patronFavor") {
    const god = target.dataset.god;
    const meta = chaosPatronMeta(god);
    await promptStatAdd(this.actor, { label: `Благосклонность — ${meta.label}`, path: `system.patronFavor.${god}` });
  } else if (stat === "sanity") {
    // Единственная кнопка покрывает и потерю (урон Дредноуту, провал теста
    // Воли — отрицательное число), и все способы восстановления книги
    // (Гибернация — 1dX за неделю, Электростимуляторы, Таланты на кубах):
    // они разные по РИТУАЛУ, но одинаковы по РЕЗУЛЬТАТУ — число с причиной.
    // Максимум читается заново при каждом клике: он производный и меняется
    // вместе с W.b и количеством «Ядро Воспоминаний».
    const max = this.actor.system.sanity?.max ?? null;
    await promptStatAdd(this.actor, {
      label: "Здравомыслие", path: "system.sanity.value", allowDice: true, clampMax: max
    });
  }
}

// Четыре Таланта пилота Дредноута (стр. 58): исполненное условие — на
// усмотрение стола, кнопка лишь считает результат — трату 1 Очка Бесчестия
// и бросок 2d10 в Здравомыслие. Путь/максимум ОБ — те же геттеры, что и у
// общей траты Хаосита (_infamyPath/_infamyMax/_ipChange), Талант просто
// открывает доступ к ним ещё с одной стороны.
async function onSanityTalentRecover(event, target) {
  event.preventDefault();
  const talent = SANITY_RECOVERY_TALENTS.find(t => t.key === target.dataset.talent);
  if (!talent) return;
  if (!sanityRecoveryTalentsOf(this.actor.items).some(t => t.key === talent.key)) return;

  const ip = Math.max(0, Number(foundry.utils.getProperty(this.actor, this._infamyPath)) || 0);
  if (!this._infamyEnabled || ip < 1)
    return ui.notifications.warn("Нет Очков Бесчестия для восстановления Здравомыслия.");

  await this._ipChange(-1);
  const roll = await new Roll("2d10").evaluate();
  const max = this.actor.system.sanity?.max ?? null;
  const cur = Number(this.actor.system.sanity?.value) || 0;
  const next = max != null ? Math.min(max, cur + roll.total) : cur + roll.total;
  await this.actor.update({ "system.sanity.value": next });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `<b>${esc(talent.label)}</b>: −1 Очко Бесчестия, +<b>${roll.total}</b> Здравомыслия `
      + `(${cur} → ${next}).`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, rollMode));
}

// Суточный тест бодрствования пилота Дредноута (стр. 57): фиксированный
// W+0 без модификаторов (саркофаг), Провал сразу списывает Здравомыслие на
// число Провалов — книга не оставляет тут выбора, поэтому в отличие от
// общей кнопки «±» причина не спрашивается.
async function onDreadnoughtDailyTest(event) {
  event.preventDefault();
  const wp = Number(this.actor.system.characteristics?.wp?.total) || 0;
  const roll = await new Roll("1d100").evaluate();
  const { success, degrees, sanityLoss } = dailyWillTestOutcome(roll.total, wp);

  let next = null;
  if (sanityLoss > 0) {
    const cur = Number(this.actor.system.sanity?.value) || 0;
    next = Math.max(0, cur - sanityLoss);
    await this.actor.update({ "system.sanity.value": next });
  }

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Тест бодрствования — W+0</div>
        <div class="roll-threshold">Порог: <b>${wp}</b></div>
        <div class="roll-dice">Бросок: <b>${roll.total}</b></div>
        <div class="roll-outcome">
          ${success
            ? `<span class="roll-success">Успех — ${degrees} ${_degWord(degrees)}</span>`
            : `<span class="roll-failure">Провал — ${degrees} ${_degWord(degrees)}, `
              + `−${sanityLoss} Здравомыслия (${next})</span>`}
        </div>
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, rollMode));
}

// Электростимуляторы Дредноута (стр. 58): разовый буст Здравомыслия, откат —
// вручную (тикающего таймера в системе нет, тот же случай, что и Пост-эффект
// Препаратов в drugs.mjs). Сумму буста храним на пилоте (system.electrostim),
// чтобы «Откат» знал, сколько снимать, даже после перерисовки листа.
async function onElectrostimActivate(event) {
  event.preventDefault();
  if (this.actor.system.electrostim?.active) return;
  const wpBonus = Number(this.actor.system.characteristics?.wp?.bonus) || 0;
  const { amount, delayMinutes } = electrostimulatorBoost(wpBonus);
  const max = this.actor.system.sanity?.max ?? null;
  const cur = Number(this.actor.system.sanity?.value) || 0;
  const next = max != null ? Math.min(max, cur + amount) : cur + amount;

  await this.actor.update({
    "system.sanity.value": next,
    "system.electrostim.active": true,
    "system.electrostim.amount": amount
  });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Электростимуляторы</div>
        <div class="roll-outcome"><span class="roll-success">+${amount} Здравомыслия (${cur} → ${next})</span></div>
        <div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">
          Через ~${delayMinutes} мин. нажмите «Откат»: буст снимется, придёт 1d5 непоглощаемого урона.
        </div>
      </div>`
  }, rollMode));
}

async function onElectrostimRollback(event) {
  event.preventDefault();
  const es = this.actor.system.electrostim;
  if (!es?.active) return;
  const amount = Number(es.amount) || 0;
  const cur = Number(this.actor.system.sanity?.value) || 0;
  const next = Math.max(0, cur - amount);

  const roll = await new Roll("1d5").evaluate();
  const woundUpdates = computeWoundDamage(this.actor.system, roll.total);

  await this.actor.update({
    "system.sanity.value": next,
    "system.electrostim.active": false,
    "system.electrostim.amount": 0,
    ...woundUpdates
  });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Электростимуляторы — откат</div>
        <div class="roll-outcome"><span class="roll-failure">−${amount} Здравомыслия (${cur} → ${next})</span></div>
        <div class="roll-dice">Непоглощаемый урон: <b>${roll.total}</b></div>
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, rollMode));
}

// «Ферум Инфернус» (стр. 58): пока Здравомыслие ниже ½Inf+5, раз в игровой
// час +1. В системе нет тикающего хука по игровому времени (нашёлся только
// updateWorldTime, который лишь перерисовывает виджет календаря), поэтому
// кнопка — ручной «тик», который игрок жмёт сам по прошествии часа.
async function onFerumInfernusTick(event) {
  event.preventDefault();
  const infTotal = Number(this.actor.system.characteristics?.inf?.total) || 0;
  const cur = Number(this.actor.system.sanity?.value) || 0;
  if (!ferumInfernusActive(cur, infTotal)) {
    return ui.notifications.info("Ферум Инфернус: Здравомыслие уже не ниже порога — восстановления нет.");
  }
  const max = this.actor.system.sanity?.max ?? null;
  const next = max != null ? Math.min(max, cur + 1) : cur + 1;
  await this.actor.update({ "system.sanity.value": next });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Ферум Инфернус</div>
        <div class="roll-outcome"><span class="roll-success">+1 Здравомыслия (${cur} → ${next})</span></div>
      </div>`
  }, rollMode));
}

// Гибернация (стр. 57) — основной способ восстановить Здравомыслие: часовой
// техноритуал (комбинированный тест Tech-Use-40 + Medicae-40, 2-8
// ассистентов — тесты кидают обычными кнопками Навыков, отдельного диалога
// для комбинированного теста в системе нет) переводит пилота в кому, и раз в
// полную неделю в ней восстанавливается 1d10. Выход — тот же ритуал. Кнопки
// листа только держат флаг и напоминают условие входа/выхода в чате.
async function onHibernationEnter(event) {
  event.preventDefault();
  if (this.actor.system.hibernation?.active) return;
  await this.actor.update({ "system.hibernation.active": true });
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Гибернация — вход</div>
        <div class="roll-outcome"><span class="roll-success">Пилот погружён в Гибернацию.</span></div>
        <div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">
          Ритуал: часовой техноритуал, комбинированный тест Tech-Use−40 + Medicae−40 (2-8 ассистентов).
          Раз в полную неделю — «Тик недели» на панели.
        </div>
      </div>`
  }, rollMode));
}

async function onHibernationExit(event) {
  event.preventDefault();
  if (!this.actor.system.hibernation?.active) return;
  await this.actor.update({ "system.hibernation.active": false });
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Гибернация — выход</div>
        <div class="roll-outcome"><span class="roll-success">Пилот выведен из Гибернации.</span></div>
        <div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">
          Ритуал: тот же порядок, что и вход (часовой техноритуал, Tech-Use−40 + Medicae−40).
        </div>
      </div>`
  }, rollMode));
}

async function onHibernationWeekTick(event) {
  event.preventDefault();
  if (!this.actor.system.hibernation?.active) return;
  const roll = await new Roll("1d10").evaluate();
  const max = this.actor.system.sanity?.max ?? null;
  const cur = Number(this.actor.system.sanity?.value) || 0;
  const next = max != null ? Math.min(max, cur + roll.total) : cur + roll.total;
  await this.actor.update({ "system.sanity.value": next });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Гибернация — полная неделя</div>
        <div class="roll-dice">Бросок: <b>${roll.total}</b></div>
        <div class="roll-outcome"><span class="roll-success">+${roll.total} Здравомыслия (${cur} → ${next})</span></div>
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, rollMode));
}

// ── Инициатива ──
// Бросок идёт в трекер, поэтому вне боя он невозможен: без комбатанта результат
// некуда положить. initiativeMod уже учтён формулой через @initiativeMod
// (см. CONFIG.Combat.initiative).
async function onInitiativeRoll() {
  if (!this.actor.inCombat) {
    ui.notifications.warn(`${this.actor.name} не участвует в бою — добавьте токен в трекер инициативы.`);
    return;
  }
  await this.actor.rollInitiative({ createCombatants: false, rerollInitiative: true });
}

// ── Броски характеристики и навыка ──
function onCharRoll(event, target) {
  const key = target.dataset.char;
  if (key === "pf") {                       // Фактор Прибыли — не характеристика
    const pf = Number(this.actor.system.aspirations?.profitFactor) || 0;
    return this._rollCharacteristic("Фактор Прибыли", "PF", pf, "pf", true);
  }
  const meta  = CHARACTERISTICS[key];
  const total = this.actor.system.characteristics[key]?.total ?? 0;
  return this._rollCharacteristic(charLabel(key, this.actor.system.alignment), meta.abbr, total, key);
}

// Экспортирован: вкладка СОЦИУМ подключается частью и к Демону, и к
// Демону-Принцу (tab-social.hbs), а карта действий ApplicationV2 у каждого
// класса своя — обработчику нужно быть доступным для их собственных actions.
export function onSkillRoll(event, target) {
  if (target.dataset.group === "true") {
    const groupKey = target.dataset.groupkey;
    const idx      = parseInt(target.dataset.index);
    const entry    = this.actor.system.groupSkills?.[groupKey]?.[idx];
    const def      = GROUP_SKILLS_DEF[groupKey];
    if (!entry || !def) return;
    return this._rollSkill(`${def.label}: ${entry.specialty}`, entry.total ?? -20, entry.char || def.char,
      { group: groupKey, specialty: entry.specialty });
  }
  const key = target.dataset.skill;
  const def = SKILLS_DEF[key];
  const sk  = this.actor.system.skills?.[key];
  return this._rollSkill(def?.label ?? key, sk?.total ?? -20, def?.char ?? "ag", { skill: key });
}

// ── Снаряжение и пикеры ──
function onItemAdd() { return this._showAddItemDialog(); }
function onRigOpen()  { return openRigManager(this.actor); }
function onGearLib(event) { event.preventDefault(); return this._openGearPicker(); }

// Добавление Черт/Талантов — через пикер с листа (группировка по типам, поиск,
// описание по стрелке). ПКМ — создать пустую (для своих/книжных), см. _onRender.
function onTraitAdd(event)  { event.preventDefault(); return this._openItemPicker("trait"); }
function onTalentAdd(event) { event.preventDefault(); return this._openItemPicker("talent"); }

// ＋ Мутация/Дар — общий пул (см. tabs/mutations.mjs): выбор ЛЮБОЙ записи из
// Общих Мутаций ИЛИ Даров любого Бога, не только покровителя.
async function onMutgiftAdd(event) {
  event.preventDefault();
  if (event.shiftKey) {   // Shift — пустая мутация с нуля
    const item = await Item.create({ name: "Новая мутация", type: "mutation" }, { parent: this.actor });
    return item?.sheet?.render(true);
  }
  return openMutationPicker(this.actor);
}

// 🎲 Бросок по общему пулу (Общие Мутации ИЛИ Дар Бога — тип выбирается в
// диалоге). Бросок можно сдвинуть на ±Inf.b (если результат не от Провала).
function onMutgiftRoll(event) {
  event.preventDefault();
  return rollMutationOrGift(this.actor);
}

// ── Раса, Прошлое и легион ── (apps/races.mjs держит применение, лист даёт
// только разбор текстовых списков колбэком createTraits — его зовёт и Мастер
// создания персонажа)
//
// Находка I1 общего ревью (wdbc-n1k): applyRace выдаёт только Черты
// (Конструктором, с предмета-носителя) — поле talents в схеме расы читает
// один потребитель, Мастер создания (apps/creation.mjs). Кнопка «Применить
// расовые бонусы» раньше (applyRaceData) выдавала и таланты — без этого шага
// она перестала бы выдавать 9 стартовых талантов Астартес. _applyStartingTalents
// сама зовёт splitTopLevel — строку из библиотеки резать самим не нужно.
async function onGeneApply() {
  await applyRace(this.actor, "astartes");
  const def = raceDef("astartes");
  return this._applyStartingTalents(def?.talents ? [def.talents] : [], def?.label || "Астартес");
}
function onLegionApply()    { return applyLegion(this.actor, { createTraits: (l, s) => this._createTraitsFromList(l, s) }); }
function onYnnariApply()    { return applyYnnari(this.actor, { createTraits: (l, s) => this._createTraitsFromList(l, s) }); }
function onHarlequinApply() { return applyHarlequin(this.actor, { createTraits: (l, s) => this._createTraitsFromList(l, s) }); }

// ── Слоты Расы и Субрасы в шапке: пикер из библиотеки, открытие носителя,
//    снятие. onRaceApply/onSubraceApply — единственный путь ручного переезда
//    персонажей, созданных до этой работы: у них system.race/system.subrace
//    заполнены, а предмета-носителя ещё нет (см. брифа задачи 7, уточнение 1;
//    раунд правок 1, находка 2 — та же дыра была и у субрасы).
function onRacePick()    { return openRacePicker(this.actor, { subrace: false }); }
function onSubracePick() { return openRacePicker(this.actor, { subrace: true }); }
function onRaceOpen()    { return actorRaceItem(this.actor)?.sheet?.render(true); }
function onSubraceOpen() { return actorSubraceItem(this.actor)?.sheet?.render(true); }
function onRaceClear()   { return clearRace(this.actor); }
function onSubraceClear(){ return clearSubrace(this.actor); }
function onRaceApply()   { return applyRace(this.actor, this.actor.system.race || ""); }
function onSubraceApply(){ return applySubrace(this.actor, this.actor.system.subrace || ""); }

export class WarhammerCharacterSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "sheet", "actor", "character", "wh-holo"],
    position: { width: 1000, height: 940 },
    window: {
      resizable: true,
      // Кнопка «Мастер» раньше стояла в шапке листа (header.hbs) рядом с
      // Мировоззрением; перенесена сюда, чтобы не путать с кнопкой «Начать
      // создание персонажа» на панели Актёры (apps/character-start.mjs) —
      // та заводит НОВОГО актора, а этот пункт лишь перезапускает Мастера
      // на уже существующем.
      controls: [{
        icon: "fa-solid fa-hat-wizard",
        label: "Перезапустить мастера создания",
        action: "charWizard"
      }]
    },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      // Вкладки и свёртки доступны и тому, кто лист только смотрит.
      tab: onTab,
      combatCollapse: onCombatCollapse,
      gearCat: onGearCat,
      gearModsToggle: onGearModsToggle,
      // Ниже — то, что в V1 стояло после общей проверки isEditable.
      portrait: whenEditable(onPortrait),
      infamyMinus: whenEditable(onInfamyMinus),
      infamyPlus: whenEditable(onInfamyPlus),
      infamyRestore: whenEditable(onInfamyRestore),
      infamySpend: whenEditable(onInfamySpend),
      // Мастера зовут из двух мест: панель «Актёры» — для нового персонажа,
      // пункт «Перезапустить мастера создания» в window.controls (выше) —
      // чтобы пройти его заново на уже созданном.
      charWizard: whenEditable(function () { this.openCreationWizard(); }),
      convertToHorde: whenEditable(onConvertToHorde),
      // «+» в блоке МИНЬОНЫ на вкладке СОЦИУМ — генератор слуги (стр. 111-113).
      minionCreate:   whenEditable(onMinionCreate),
      abilityDetail: whenEditable(onAbilityDetail),
      toggleAbility: whenEditable(onToggleAbility),
      pathsToggle: whenEditable(onPathsToggle),
      statAdd: whenEditable(onStatAdd),
      sanityTalentRecover: whenEditable(onSanityTalentRecover),
      dreadnoughtDailyTest: whenEditable(onDreadnoughtDailyTest),
      electrostimActivate: whenEditable(onElectrostimActivate),
      electrostimRollback: whenEditable(onElectrostimRollback),
      ferumInfernusTick: whenEditable(onFerumInfernusTick),
      hibernationEnter: whenEditable(onHibernationEnter),
      hibernationExit: whenEditable(onHibernationExit),
      hibernationWeekTick: whenEditable(onHibernationWeekTick),
      initiativeRoll: whenEditable(onInitiativeRoll),
      charRoll: whenEditable(onCharRoll),
      skillRoll: whenEditable(onSkillRoll),
      itemAdd: whenEditable(onItemAdd),
      rigOpen: whenEditable(onRigOpen),
      gearLib: whenEditable(onGearLib),
      traitAdd: whenEditable(onTraitAdd),
      talentAdd: whenEditable(onTalentAdd),
      mutgiftAdd: whenEditable(onMutgiftAdd),
      mutgiftRoll: whenEditable(onMutgiftRoll),
      geneApply:      whenEditable(onGeneApply),
      legionApply:    whenEditable(onLegionApply),
      ynnariApply:    whenEditable(onYnnariApply),
      harlequinApply: whenEditable(onHarlequinApply),
      racePick:     whenEditable(onRacePick),
      raceOpen:     onRaceOpen,
      raceClear:    whenEditable(onRaceClear),
      raceApply:    whenEditable(onRaceApply),
      subracePick:  whenEditable(onSubracePick),
      subraceOpen:  onSubraceOpen,
      subraceClear: whenEditable(onSubraceClear),
      subraceApply: whenEditable(onSubraceApply)
    }
  };

  // Прокрутку вкладок и таблицы Развития между перерисовками держит сам
  // ApplicationV2 (scrollable) — этим и заменена ручная пара
  // _saveScrollPositions/_restoreScrollPositions.
  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/actor/character-sheet.hbs",
      root: true,
      scrollable: [".sheet-body", ".skills-advance-scroll"]
    }
  };

  static TABS = {
    primary: {
      initial: "stats",
      tabs: [
        { id: "stats",       label: "ПОКАЗАТЕЛИ" },
        { id: "combat",      label: "БОЙ" },
        { id: "effects",     label: "ТЕЛО" },
        { id: "possession",  label: "ОДЕРЖИМОСТЬ" },
        { id: "haemonculus", label: "ГЕМУНКУЛ" },
        { id: "abilities",   label: "СПОСОБНОСТИ" },
        { id: "social",      label: "СОЦИУМ" },
        { id: "psy",         label: "ПСИ" },
        { id: "tech",        label: "ТЕХ" },
        { id: "nav",         label: "НАВ" },
        { id: "gear",        label: "СНАРЯЖЕНИЕ" },
        { id: "advance",     label: "РАЗВИТИЕ" },
        { id: "notes",       label: "ЗАПИСИ" }
      ]
    }
  };

  _savedScrollTops = {};
  _combatCollapse = { stance: false, base: false, tech: false };
  // Свёрнутые категории вкладки снаряжения (ключ категории → свёрнута?).
  _gearCollapse = {};
  // Носители (оружие/броня), у которых свёрнут список установленных улучшений.
  _gearHostCollapse = new Set();
  _wizardPrompted = false;

  // Показать/скрыть под-строки установленных улучшений конкретного носителя
  // (оружия/брони) на вкладке снаряжения. Строки-описания при сворачивании
  // прячутся; при разворачивании остаются скрытыми (раскрываются кнопкой ▸).
  _applyGearHostCollapse(hid) {
    const el = this.element;
    if (!el) return;
    const collapsed = !!this._gearHostCollapse?.has(hid);
    el.querySelectorAll(`.gear-modsub-row[data-host-id="${hid}"]`)
      .forEach(n => { n.style.display = collapsed ? "none" : ""; });
    if (collapsed) el.querySelectorAll(`.ability-detail-row[data-host-id="${hid}"]`)
      .forEach(n => { n.style.display = "none"; });
    el.querySelectorAll(`.gear-mods-toggle[data-host-id="${hid}"]`)
      .forEach(n => n.classList.toggle("collapsed", collapsed));
  }

  // Foundry титулует окно как «<тип документа>: <имя>», где тип берётся из
  // ключа перевода TYPES.Actor.<type>. В мире на английском ключ остаётся
  // непереведённым и стоит в заголовке как есть. Тип и так виден по самому
  // листу — в заголовке нужно имя.
  get title() { return this.actor.name; }

  // ── Контекст шаблона ──────────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    // this.constructor, а не свой класс: у Демона и Демон-Принца вкладки свои.
    context.tab   = this.tabGroups?.primary ?? this.constructor.TABS.primary.initial;
    // Поле «Фракция» в шапке — общее для всех листов (apps/actor-factions.mjs).
    Object.assign(context, actorFactionsContext(this.actor));

    // Контекст шаблона собирают два модуля: sheet-helpers.mjs — списки вкладок,
    // character-context.mjs — самого персонажа. Здесь остаётся только то, что
    // знает окно, а не актор.
    Object.assign(context, buildGetData(this.actor), characterContext(this.actor));

    // Вкладка СОЦИУМ: Навыки, Таланты, Особенности, Модификаторы, Назначения,
    // Фракции, Миньоны и Отношения. Назначения ищутся по миру — привязка живёт
    // у той стороны, к которой персонажа прицепили, а не у него самого.
    Object.assign(context, socialContext(this.actor, [...(game.actors ?? [])]));

    // Блок «МИНЬОНЫ» там же: слоты купленных Талантов, счётчик по группам и
    // максимум, а при свободном Таланте — кнопка «+» в генератор.
    Object.assign(context, minionsPanelContext(this.actor, [...(game.actors ?? [])]));

    // Блок «ВЕРХОМ» на вкладке БОЙ: скакун ищется по списку акторов мира —
    // ссылку на него хранит сам всадник (rules/mount.mjs).
    Object.assign(context, mountPanelContext(this.actor, [...(game.actors ?? [])]));

    // Блок «ЗДРАВОМЫСЛИЕ» там же: видим, только если какой-то Дредноут в мире
    // держит этого персонажа своим пилотом (rules/dreadnought.mjs, стр. 57-58).
    Object.assign(context, dreadnoughtPanelContext(this.actor, [...(game.actors ?? [])]));

    // ── Сворачивание секций: состояние окна, переживает перерисовку ─────────
    context.combatStanceCollapsed = !!this._combatCollapse?.stance;
    context.combatBaseCollapsed   = !!this._combatCollapse?.base;
    context.combatTechCollapsed   = !!this._combatCollapse?.tech;
    context.gearCollapse = this._gearCollapse || {};

    // ── Очки Бесчестия (корбук 438): доступны Хаоситам ─────────────────────
    // Путь к счётчику и его максимум задают геттеры листа: у Демон-Принца это
    // не Судьба, а собственные ОБ, поэтому расчёт остаётся здесь.
    if (context.isHeretic && this._infamyEnabled) {
      const ip = Math.max(0, Number(foundry.utils.getProperty(this.actor, this._infamyPath)) || 0);
      context.infamy = infamyContext(this.actor, this._infamyKey,
        { ip, ipMax: this._infamyMax, showCounter: this._infamyShowCounter });
      context.chaosPatron = chaosPatronMeta(this._infamyKey);
      // Отметка радиокнопки — по ХРАНИМОМУ полю, а не по _infamyKey: тот
      // подставляет Неделимого, когда Бог не выбран, и селектор показывал бы
      // выбранным то, чего в акторе нет (wdbc-osz).
      const patronChosen = this.actor.system.patronGod || "";
      context.chaosPatrons = CHAOS_PATRONS.map(p => ({ ...p, selected: p.key === patronChosen,
        favor: Number(foundry.utils.getProperty(this.actor, `system.patronFavor.${p.key}`)) || 0 }));
      // Селектор Бога в ЗАПИСЯХ — только там, где патрон не выбирается иначе.
      // У Демон-Принца патрон = «Патрон» в шапке (allegiance) → селектор скрыт.
      context.showPatronPicker = this._showPatronPicker;
    }

    return context;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Штраф усталости для броска.
   * Освобождены: T, Inf, Cog
   */
  /**
   * Категория таланта для расчёта цены: раса может делать талант всегда
   * Дружественным (Total Recall у Астартес), иначе решает культура легиона.
   */
  _talentCat(name, folder = "") {
    return talentCategory(this.actor, name, folder);
  }

  /**
   * Снятый шлем силовой брони: +5 ко всем тестам на основе Товарищества.
   * Правило безусловное, поэтому применяется само, а не галочкой в диалоге.
   */
  _getHelmetlessBonus(charKey) {
    if (!this.actor.system.helmetlessActive) return 0;
    return (charKey ?? "").toLowerCase() === "fel" ? HELMETLESS_FEL_BONUS : 0;
  }

  _getFatiguePenalty(charKey) {
    return fatiguePenalty(this.actor, charKey);
  }

  /**
   * Определяет актора-цель для «Применить на другом».
   * Приоритет: нацеленные токены (target), иначе выделенные (controlled).
   * Токены самого применяющего исключаются. Требуется ровно одна цель.
   */
  _resolveOtherTargetActor() {
    const targets = [...(game.user.targets ?? [])];
    let candidates = targets.length ? targets : [...(canvas.tokens?.controlled ?? [])];
    candidates = candidates.filter(t => {
      const a = t.actor ?? t.document?.actor;
      return a && a.id !== this.actor.id;
    });

    if (candidates.length === 0) {
      ui.notifications.warn("🎯 Нацельтесь на токен цели (или выделите его), чтобы применить препарат на другом.");
      return null;
    }
    if (candidates.length > 1) {
      ui.notifications.warn("🎯 Выберите ровно одну цель (один нацеленный/выделенный токен).");
      return null;
    }
    const actor = candidates[0].actor ?? candidates[0].document?.actor;
    if (!actor) {
      ui.notifications.warn("Не удалось определить актора цели.");
      return null;
    }
    return actor;
  }

  // Модификаторы характеристик от препаратов теперь применяются централизованно
  // в WarhammerActor.prepareDerivedData() — они уже входят в char.total, поэтому
  // отдельно в бросках их прибавлять НЕ нужно (иначе двойной учёт).

  /**
   * Навешивает на корень листа классы темы: раса / мировоззрение / класс.
   * Используется CSS для акцентов и баннера (wh-align-*, wh-race-*, wh-class-*).
   */
  _applyThemeClasses() {
    const root = this.element;
    if (!root) return;
    const sys = this.actor.system;
    const cls = sys.isTechpriest ? "techpriest" : (sys.isPsyker ? "psyker" : "adept");
    root.classList.remove(...[...root.classList].filter(c => /^wh-(align|race|class)-/.test(c)));
    root.classList.add(`wh-align-${sys.alignment || "loyalist"}`,
      `wh-race-${sys.race || "none"}`, `wh-class-${cls}`);
  }

  /**
   * Мастер создания персонажа (module/apps/character-wizard.mjs) — пять
   * этапов в одном окне. Зовётся из панели «Актёры» (apps/character-start.mjs
   * — для нового персонажа) и из пункта «Перезапустить мастера создания» в
   * window.controls этого листа (для уже существующего). Коллбеки Черт/
   * стартовых Талантов новому мастеру не нужны — он читает их с
   * `actor.sheet` сам (`_createTraitsFromList`/`_applyStartingTalents`,
   * методы ниже); тема листа обновляется сама через обычный ре-рендер
   * (`_applyThemeClasses()` в `activateListeners`, вызывается на каждом
   * рендере), явный вызов не нужен.
   */
  openCreationWizard() {
    return openCharacterWizard(this.actor);
  }

  /** Создаёт Черты из списка {name,benefit,rating,hasRating,effects}, пропуская существующие по имени. */
  async _createTraitsFromList(list, source = "") {
    if (!Array.isArray(list) || !list.length) return 0;
    const existing = new Set(this.actor.items.filter(i => i.type === "trait").map(i => i.name));
    const toCreate = list.filter(t => t?.name && !existing.has(t.name)).map(t => ({
      name: t.name,
      type: "trait",
      system: {
        benefit:   t.benefit || "",
        source,
        hasRating: t.hasRating || false,
        rating:    t.rating || 0,
        effects: { charBonusStat:"", charBonusValue:0, armourAll:0, fearRating:0, sizeMod:0, ...(t.effects || {}) }
      }
    }));
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
    return toCreate.length;
  }

  /**
   * Создаёт Таланты по списку имён. Полное описание/уровень/Бог подтягивается из
   * библиотеки талантов по совпадению английской части имени; скобочная часть
   * («Resistance (Cold, Heat)») идёт в Специализацию. Дубликаты — по имени+спец.
   */
  async _createTalentsFromList(list, source = "") {
    if (!Array.isArray(list) || !list.length) return 0;
    const keyOf    = (n, s) => `${n}|${s || ""}`;
    const existing = new Set(this.actor.items.filter(i => i.type === "talent")
      .map(i => keyOf(i.name, i.system?.specialization)));
    let lib = [];
    try {
      const pack = game.packs.get("warhammer-dbc.talents");
      if (pack) lib = await pack.getDocuments();
    } catch(e) { /* библиотека недоступна — создадим заглушки */ }
    const norm  = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const byEng = new Map();
    for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    const toCreate = [];
    const seen = new Set();
    // Таланты, которые у персонажа уже есть: за каждый вернётся его цена.
    const refunds = [];
    for (const raw of list) {
      if (!raw) continue;
      const m        = String(raw).match(/^([^(]+?)\s*(?:\(([^)]*)\))?\s*$/);
      const baseName = (m ? m[1] : raw).trim();
      const spec     = (m && m[2]) ? m[2].trim() : "";
      const hit      = byEng.get(norm(baseName)) || byEng.get(TALENT_ALIAS[norm(baseName)] || "\0");
      const fullName = hit ? hit.name : String(raw);
      const key      = keyOf(fullName, spec);
      // Повтор внутри одного списка — просто описка источника, за него ничего
      // не полагается. А вот Талант, который у персонажа уже есть от другого
      // источника, повторить нечем: вместо копии возвращается его цена
      // (rules/duplicate-grants.mjs).
      if (seen.has(key)) continue;
      if (existing.has(key)) {
        const same = this.actor.items.find(i => i.type === "talent" && keyOf(i.name, i.system?.specialization) === key);
        if (same) refunds.push(same);
        seen.add(key);
        continue;
      }
      seen.add(key);
      if (hit) {
        const sys = foundry.utils.deepClone(hit.system);
        if (spec) sys.specialization = spec;
        if (source) sys.notes = `Стартовый талант: ${source}`;
        toCreate.push({ name: fullName, type: "talent", img: hit.img, system: sys });
      } else {
        toCreate.push({ name: String(raw), type: "talent", system: {
          tier: 1, specialization: spec,
          benefit: source ? `Стартовый талант (${source}) — уточните выбор вручную.` : ""
        }});
      }
    }
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);

    // Возврат — после создания: цена Таланта считается по Склонностям
    // персонажа, а их мог поднять Талант, выданный этим же списком.
    for (const same of refunds) {
      await refundXP(this.actor, talentCost(this.actor, same),
        talentReason(same.name, same.system?.specialization));
    }

    return toCreate.length;
  }

  /**
   * Применяет стартовые таланты (список строк/строк-через-запятую). Записи-выборы
   * «X или Y» и «(любые N)» собираются в один диалог выбора; всё остальное
   * создаётся сразу. Возвращает число созданных талантов.
   */
  async _applyStartingTalents(rawList, source = "") {
    const entries = [];
    for (const r of (rawList || [])) for (const e of splitTopLevel(String(r))) entries.push(e);
    // Отсев «строительных» записей (не таланты): ассигнования опыта и счётчики
    // вида «1000 xp на Психосилы», «12 Талантов 1 уровня».
    const real = entries.filter(e => !/\d\s*(xp|хр)/i.test(e) && !/талант/i.test(e));
    if (!real.length) return 0;

    // Опции специализаций берём из библиотеки талантов.
    let lib = [];
    try { const p = game.packs.get("warhammer-dbc.talents"); if (p) lib = await p.getDocuments(); } catch(e) {}
    const norm   = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const byEng  = new Map(); for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    const find   = base => byEng.get(norm(base)) || byEng.get(TALENT_ALIAS[norm(base)] || "\0");
    // Перевод часто-английских специализаций (чувства, типы оружия, сопротивления…),
    // если компендиум ещё засеян по-английски.
    const optsOf = base => {
      const s = find(base)?.system?.specialization || "";
      if (!s || /люб|кажд|для каждого|организац/i.test(s)) return null;
      return s.split(",").map(x => ruSpec(x.trim())).filter(Boolean);
    };

    const fixed = [], choices = [];
    for (const e of real) {
      if (TALENT_CHOICE_SEP.test(e)) {
        choices.push({ type: "or", raw: e, options: e.split(TALENT_CHOICE_SEP).map(s => s.trim()).filter(Boolean) });
      } else {
        const m = e.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        if (m && /люб/i.test(m[2])) {
          const count = parseInt((m[2].match(/\d+/) || ["1"])[0], 10) || 1;
          choices.push({ type: "wild", raw: e, base: m[1].trim(), count, opts: optsOf(m[1].trim()) });
        } else fixed.push(e);
      }
    }

    // Локализатор: «English (спец.) — Русское» по данным компендиума талантов.
    const nameOf = raw => {
      const m = String(raw).match(/^(.*?)\s*(\([^)]*\))?\s*$/);
      const base = (m ? m[1] : raw).trim();
      const spec = m && m[2] ? " " + m[2] : "";
      const d = find(base);
      if (!d) return String(raw);
      const parts = String(d.name).split("/");
      const ru = parts.length > 1 ? parts[1].trim() : "";
      return ru ? `${base}${spec} — ${ru}` : `${base}${spec}`;
    };

    const chosen = await this._promptTalentChoices(choices, nameOf);
    return await this._createTalentsFromList([...fixed, ...chosen], source);
  }

  _openItemPicker(kind) {
    return openItemPicker(this.actor, kind);
  }

  /** Диалог выбора для «или»/«любые N». Резолвится массивом строк-имён талантов. */
  _promptTalentChoices(choices, nameOf = (s => String(s))) {
    if (!choices || !choices.length) return Promise.resolve([]);
    const rows = choices.map((c, i) => {
      if (c.type === "or") {
        const opts = c.options.map(o => `<option value="${esc(o)}">${esc(nameOf(o))}</option>`).join("");
        return `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Выбор:</label><select class="wtc-sel" data-ci="${i}" data-cj="0">${opts}</select></div>`;
      }
      // wild
      let inputs = "";
      for (let j = 0; j < c.count; j++) {
        if (c.opts) {
          const opts = c.opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
          inputs += `<select class="wtc-sel wtc-mini" data-ci="${i}" data-cj="${j}">${opts}</select>`;
        } else {
          inputs += `<input type="text" class="wtc-inp" data-ci="${i}" data-cj="${j}" placeholder="специализация"/>`;
        }
      }
      return `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">${nameOf(c.base)} <span class="wtc-x">×${c.count}</span></label><div class="wtc-inputs">${inputs}</div></div>`;
    }).join("");

    return foundry.applications.api.DialogV2.wait({
      window: { title: "Выбор стартовых талантов" },
      classes: ["warhammer-dbc", "wh-holo", "wh-talent-dialog"],
      position: { width: 480 },
      content: `<div class="wh-talent-choices"><p class="wtc-hint">Уточните таланты-выборы:</p>${rows}</div>`,
      buttons: [{
        action: "ok", label: "Применить", default: true,
        callback: (event, button) => {
          const result = [];
          for (const el of button.form.querySelectorAll("[data-ci]")) {
            const c = choices[Number(el.dataset.ci)];
            const v = String(el.value || "").trim();
            if (!v) continue;
            result.push(c.type === "wild" ? `${c.base} (${v})` : v);
          }
          return result;
        }
      }],
      // Закрыли окно, не выбрав, — считаем, что таланты-выборы пропущены.
      rejectClose: false
    }).then(res => res ?? []);
  }


  _openGearPicker() {
    return openGearPicker(this.actor);
  }

  /** Создаёт предмет-расстройство на акторе из записи библиотеки (без дублей по имени). */
  async _createDisorderItem(entry) {
    return createDisorderItem(this.actor, entry);
  }

  // ── Очки Бесчестия (корбук 438) — переопределяется листом Демон-Принца ────
  // Хаосит: пул = поле «Очки Бесчестья» в шапке (system.fate), счётчик в полосе
  // скрыт; тема/сигил — по выбранному Богу-покровителю (system.patronGod).
  get _infamyEnabled() { return true; }
  get _showPatronPicker() { return true; }   // Демон-Принц переопределяет на false (патрон в шапке)
  get _infamyPath() { return "system.fate.value"; }
  get _infamyMax()  { return Math.max(0, Number(this.actor.system.fate?.max) || 0); }
  get _infamyShowCounter() { return false; }
  get _infamyKey()  { return this.actor.system.patronGod || "undivided"; }
  _infamyMeta()     { const p = chaosPatronMeta(this._infamyKey); return { gc: p.color, gc2: p.gc2, sigil: p.sigil }; }
  _ipChange(delta)  { return changeInfamy(this.actor, this._infamyPath, this._infamyMax, delta); }
  _ipRestore()      { return restoreInfamy(this.actor, this._infamyPath, this._infamyMax, this._infamyMeta()); }
  _ipSpend(key)     { return spendInfamy(this.actor, key, { godKey: this._infamyKey, ipFullPath: this._infamyPath, ipMax: this._infamyMax, meta: this._infamyMeta() }); }

  // ── Слушатели ─────────────────────────────────────────────────────────────
  //
  // Кнопки листа переехали в карту действий выше. Здесь осталось то, что
  // действием не выражается:
  //
  // 1. Вызовы `activate*Listeners` модулей вкладок. Те, что уже сняты с jQuery
  //    (wdbc-z0z), получают корень DOM; остальным по-прежнему нужна обёртка —
  //    её и делаем одну на весь метод.
  // 2. Изменение полей (`change`) и ПКМ: у ApplicationV2 действие — это клик.
  // 3. Состояние ОКНА, а не актора: тема листа, восстановление свёрток,
  //    зрачок Третьего Глаза, драг предметов с листа.

  /**
   * Раса и субраса на листе — не предмет в списке, а происхождение персонажа:
   * дроп уходит в применение, а обычное создание предмета не выполняется.
   * Бросить можно в любое место листа, слот лишь подсказывает куда целиться.
   */
  async _onDropItem(event, data) {
    const src = await Item.implementation.fromDropData(data);
    if (src?.type === "race" || src?.type === "subrace") {
      // Ключ — тем же правилом, что и кэш библиотеки (raceKeyOf): пустой
      // system.key нельзя молча читать как «снять расу» (Находка C1, wdbc-n1k) —
      // на этом пути пустой ключ означает ошибку данных, а не команду игрока.
      // «Снять» остаётся доступным только крестиком слота (raceClear/subraceClear).
      const key = raceKeyOf(src);
      if (!key) {
        ui.notifications?.error(
          `Не удалось определить ключ ${src.type === "race" ? "расы" : "субрасы"} у «${src.name}» — перетаскивание отменено.`);
        return;
      }
      return src.type === "race" ? applyRace(this.actor, key) : applySubrace(this.actor, key);
    }

    // Элитный архетип брошенный прямо на лист (в обход своего пикера, elite-
    // picker.mjs) обязан пройти ту же покупку, что и кнопка: иначе предмет
    // создаётся обычным дропом с paidCost по умолчанию 0 — множитель за уже
    // взятые архетипы не считается, требования не проверяются, опыт не
    // списывается и не попадает в блок «Опыт» (system.experience.spentElite
    // складывает paidCost по предметам, а у голого дропа он пуст).
    if (src?.type === "eliteArchetype") {
      return buyEliteArchetype(this.actor, src);
    }

    // «Миньон Хаоса» — Талант на двадцать разных слуг (стр. 111). Перетащенный
    // без пары «группа + сила» он оставался бы слотом «непонятно чей», поэтому
    // спрашиваем то же самое, что спрашивает покупка на вкладке «Развитие».
    if (isMinionTalent(src) && !minionSlotOf(src).group) {
      const pick = await promptMinionSlot(this.actor, src);
      if (!pick) return;                        // отменили — предмет не создаём
      const obj = applyMinionSlot(src.toObject(), pick);
      return this.actor.createEmbeddedDocuments("Item", [obj]);
    }

    return super._onDropItem(event, data);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;

    // Модулям вкладок, ещё не снятым с jQuery (wdbc-z0z), нужна обёртка; тем,
    // что уже сняты, — корень DOM. Одна обёртка на весь метод, а не на модуль.
    const html = globalThis.$(el);
    const root = el;

    /** Слушатель на все узлы по селектору — замена jQuery-обхода из V1. */
    const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));
    // Поле «Фракция» в шапке — общее для всех листов.
    activateFactionFieldListeners(el, this.actor);

    // ── Элитный архетип в шапке ───────────────────────────────────────────
    activateEliteListeners(html, this.actor);

    // ── Происхождение (Родные миры) ───────────────────────────────────────
    // Смена мира снимает всё, что дал прежний, и выдаёт новое (с диалогом
    // выбора, если мир его требует). Сам <select> не привязан к system.*.
    on(".hw-select", "change", ev => applyHomeworld(this.actor, ev.currentTarget.value));
    on(".arch-select", "change", ev => applyArchetype(this.actor, ev.currentTarget.value));
    on(".dv-select", "change", ev => applyDivination(this.actor, ev.currentTarget.value));

    // ── Вкладка ГЕМУНКУЛ ──────────────────────────────────────────────────
    activateHaemonculusListeners(html, this.actor);

    // ── Визуальная темизация листа по расе / мировоззрению / классу ─────────
    this._applyThemeClasses();

    // ── Третий Глаз навигатора: зрачок следит за курсором ──────────────────
    const eyeMove = el.querySelector(".nav-eye-move");
    const eyeSvg  = el.querySelector(".nav-eye");
    if (eyeMove && eyeSvg) {
      const MAX = 11; // user-units (svg)
      el.addEventListener("mousemove", ev => {
        const r = eyeSvg.getBoundingClientRect();
        if (!r.width) return;
        let dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        eyeMove.style.transform = `translate(${(dx * MAX).toFixed(2)}px, ${(dy * MAX).toFixed(2)}px)`;
      });
    }

    // ── Восстановление свёрток после ре-рендера ────────────────────────────
    for (const hid of this._gearHostCollapse) this._applyGearHostCollapse(hid);
    if (this._pathsOpen === false) {
      el.querySelectorAll(".paths-collapse").forEach(n => n.classList.add("collapsed"));
      el.querySelectorAll(".paths-toggle-btn").forEach(n => { n.textContent = "▸ Пути"; });
    }

    // ── Драг предметов из листа (напр. оружие → «Осквернение» в Завесе) ─────
    el.querySelectorAll(".item-row[data-item-id]").forEach(n => {
      const item = this.actor.items.get(n.dataset.itemId);
      if (!item) return;
      n.setAttribute("draggable", "true");
      n.addEventListener("dragstart", ev => {
        ev.stopPropagation();
        ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
        ev.dataTransfer.effectAllowed = "copy";
      });
    });

    // ── Подсветка слотов Расы/Субрасы при перетаскивании ────────────────────
    for (const slot of el.querySelectorAll(".wh-slot")) {
      slot.addEventListener("dragenter", () => slot.classList.add("drop-hint"));
      slot.addEventListener("dragleave", () => slot.classList.remove("drop-hint"));
      slot.addEventListener("drop",      () => slot.classList.remove("drop-hint"));
    }

    if (!this.isEditable) return;

    // Длительность теперь бросается автоматически при применении препарата.

    // ── Страх / Безумие / Порча и Болезни ──────────────────────────────────
    activateDisorderListeners(html, this.actor, {
      rollCharacteristic: (label, abbr, threshold, charKey) =>
        this._rollCharacteristic(label, abbr, threshold, charKey)
    });
    activateDiseaseListeners(html, this.actor);

    // ── Вкладка РАЗВИТИЕ ──────────────────────────────────────────────────
    // Выбор специализации остаётся тут: пикер — часть листа, а не вкладки.
    activateAdvanceListeners(html, this.actor, {
      addGroupSkill: groupKey => this._addGroupSkill(groupKey)
    });

    // ПКМ на «＋» Черты/Таланта — создать пустую (для своих/книжных).
    on(".trait-add-btn", "contextmenu", async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новая черта", type: "trait" }, { parent: this.actor });
      item?.sheet?.render(true);
    });
    on(".talent-add-btn", "contextmenu", async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новый талант", type: "talent" }, { parent: this.actor });
      item?.sheet?.render(true);
    });

    // ── Стремления и Пути Аэльдари ─────────────────────────────────────────
    activateAspirationListeners(html, this.actor);
    activatePathListeners(html, this.actor);

    // ── Миньоны (стр. 111-113) ─────────────────────────────────────────────
    // Карточки слуг в блоке «МИНЬОНЫ» на вкладке СОЦИУМ: клик открывает лист.
    activateMinionPanelListeners(html);

    // ── СОЦИУМ: Отношения (правка и дроп), переходы на предметы и акторов ──
    activateSocialListeners(html, this.actor, { editable: this.isEditable });

    // ── Ритуалы (стр. 393-425) ─────────────────────────────────────────────
    activateRitualListeners(html, this.actor);

    activatePsychicListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts),
      resolveSoulBurn: _resolveSoulBurn
    });

    activateTechListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts)
    });

    activateGearListeners(root, this.actor);

    // ── Вкладка БОЙ ───────────────────────────────────────────────────────
    activateCombatListeners(root, this.actor);

    // ── Блок «ВЕРХОМ» там же (стр. 477-478) ───────────────────────────────
    activateMountPanelListeners(root, this.actor, { editable: this.isEditable });

    // ── Контекстное меню предметов ────────────────────────────────────────
    activateItemContextMenu(html, this.actor);

    // ── Препараты ─────────────────────────────────────────────────────────────
    activateDrugListeners(html, this.actor, {
      resolveOtherTargetActor: () => this._resolveOtherTargetActor()
    });
    // ── Состояния и Усталость ─────────────────────────────────────────────
    activateConditionsListeners(root, this.actor);

    // ── Вкладка ТЕЛО ──────────────────────────────────────────────────────
    activateBodyListeners(root, this.actor);

    // ── Вкладка ОДЕРЖИМОСТЬ ───────────────────────────────────────────────
    activatePossessionListeners(html, this.actor);
  }

  // ── Диалог атаки ─────────────────────────────────────────────────────────

  // Сам диалог живёт в attack-dialog.mjs. Точки входа остаются здесь: их зовут
  // кнопки листа и HUD (module/apps/hud.mjs) — через actor.sheet.
  _showAttackDialog(item, techniqueOpts = {}) {
    return showAttackDialog(this.actor, item, techniqueOpts);
  }

  _showAttackDialogNoWeapon(techDef) {
    return showAttackDialogNoWeapon(this.actor, techDef);
  }

  // ── Добавление предмета ───────────────────────────────────────────────────

  _showAddItemDialog() {
    // Только снаряжение — без талантов/черт/психосил/расстройств и пр.
    const options = GEAR_ITEM_TYPES
      .map(type => `<option value="${type}">${ITEM_TYPES[type]}</option>`).join("");
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Добавить предмет" },
      classes: ["wh-add-item-dialog", "warhammer-dbc", "wh-holo"],
      position: { width: 320 },
      content: `<div style="padding:8px;">
        <select id="new-item-type" class="wh-add-item-select" style="width:100%;padding:5px 6px;
          background:#0c2418;color:#d8ffe8;border:1px solid #2f9e6a;
          font-family:inherit;font-size:1em;">${options}</select>
      </div>`,
      buttons: [
        {
          action: "create", icon: "fas fa-plus", label: "Создать", default: true,
          callback: async (event, button) => {
            const type  = button.form.querySelector("#new-item-type").value;
            const label = ITEM_TYPES[type] || "Новый предмет";
            await Item.create({ name: `New ${label}`, type }, { parent: this.actor });
          }
        },
        { action: "cancel", label: "Отмена" }
      ],
      rejectClose: false
    });
  }

  // ── Диалоги броска ────────────────────────────────────────────────────────

  async _addGroupSkill(groupKey) {
    const def = GROUP_SKILLS_DEF[groupKey];
    if (!def) return;
    const picked = await this._showSpecPicker(groupKey, def);
    if (!picked?.specialty) return;

    const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[groupKey] ?? []);
    const entry = { specialty: picked.specialty, rank: "untrained", cost: 0, total: -20 };
    // Ключ каталога — на него ссылаются механики; своя специализация без ключа.
    if (picked.specKey) entry.specKey = picked.specKey;
    // Своя Характеристика специализации (Operate(Voidship) — Интеллект).
    const sd = picked.specKey ? specDef(groupKey, picked.specKey) : null;
    if (sd?.char) entry.char = sd.char;
    entries.push(entry);
    this.actor.update({ [`system.groupSkills.${groupKey}`]: entries });
  }

  /**
   * Выбор специализации Группы Навыков: список из книги (стр. 58-61) плюс
   * своя. У специализаций с подстановкой (<Регион>, <Раса>) спрашиваем,
   * чем её заполнить.
   */
  _showSpecPicker(groupKey, def) {
    const opts = specOptions(groupKey);
    const rows = opts.map(o =>
      `<option value="${esc(o.key)}" data-free="${o.free ? 1 : 0}">${esc(o.display)}</option>`).join("");

    return foundry.applications.api.DialogV2.wait({
      window: { title: `${def.label}: специализация` },
      classes: ["warhammer-dbc", "wh-holo", "wh-spec-dialog"],
      position: { width: 460 },
      content: `<div class="wh-spec-picker">
          <div class="spec-row"><label>Из книги</label>
            <select id="spec-key"><option value="">— своя —</option>${rows}</select></div>
          <div class="spec-row" id="spec-fill-row" style="display:none;">
            <label id="spec-fill-label">Уточнение</label>
            <input type="text" id="spec-fill" placeholder="Например: Коронус"/></div>
          <div class="spec-row" id="spec-own-row"><label>Своя</label>
            <input type="text" id="spec-own" placeholder="Название специализации"/></div>
          <div class="spec-hint" id="spec-hint"></div>
        </div>`,
      buttons: [
        { action: "ok", icon: "fas fa-check", label: "Добавить", default: true, callback: (event, button) => {
          const val = sel => String(button.form.querySelector(sel)?.value || "");
          const key = val("#spec-key");
          if (!key) return { specialty: val("#spec-own").trim() };
          const sd = specDef(groupKey, key);
          let specialty = sd?.label || key;
          if (sd?.free) {
            const fill = val("#spec-fill").trim();
            // «Xenos (<Раса>)» + «Eldar» → «Xenos (Eldar)»
            specialty = fill ? specialty.replace(/<[^>]*>/, fill) : specialty.replace(/\s*\(<[^>]*>\)/, "");
          }
          return { specialty, specKey: key };
        }},
        { action: "cancel", label: "Отмена" }
      ],
      render: (event, dialog) => {
        const root = dialog.element;
        const sel  = root.querySelector("#spec-key");
        const upd = () => {
          const key  = String(sel.value || "");
          const free = sel.selectedOptions[0]?.dataset.free === "1";
          root.querySelector("#spec-fill-row").style.display = free ? "" : "none";
          root.querySelector("#spec-own-row").style.display  = key ? "none" : "";
          const sd = key ? specDef(groupKey, key) : null;
          const bits = [];
          if (sd?.char)  bits.push(`Характеристика: ${CHARACTERISTICS[sd.char]?.abbr || sd.char}`);
          if (sd?.chars) bits.push(`Часто используемые: ${sd.chars.map(c => CHARACTERISTICS[c]?.abbr || c).join(", ")}`);
          if (sd?.psykerOnly) bits.push("Только для псайкеров");
          if (sd?.combines)   bits.push("Заменяет каждое из входящих знаний и двигается как одно");
          root.querySelector("#spec-hint").textContent = bits.join(" · ");
        };
        sel.addEventListener("change", upd); upd();
      },
      rejectClose: false
    });
  }

  /**
   * Галочки Особенности Происхождения для диалога броска.
   * Модификатор не применяется молча: игрок сам решает, уместен ли он здесь.
   *
   * Выключенная подсистема убирает Происхождение и отсюда: иначе выбор пропадал
   * из шапки листа (homeworldSheetContext), а галочки Особенности у персонажа с
   * уже применённым Происхождением оставались в диалоге броска.
   */
  _homeworldModsHtml(context) {
    if (!isFeatureEnabled("homeworlds")) return { html: "", mods: [] };
    const mods = homeworldRollMods(actorHomeworldKey(this.actor), context);
    if (!mods.length) return { html: "", mods };
    const rows = mods.map((m, i) => {
      const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
      return `<label class="attack-mod-check hw-roll-mod">
        <input type="checkbox" class="hw-mod" data-idx="${i}" data-value="${m.value || 0}"
               ${m.halvePenalty ? 'data-halve="1"' : ""}/>
        <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
    }).join("");
    return {
      mods,
      html: `<div class="atk-dlg-modifiers hw-mods">
        <div class="atk-mods-title">Родной мир — ${mods[0].world}</div>
        <div class="atk-mods-list">${rows}</div></div>`
    };
  }

  /**
   * Галочки ситуативных модификаторов, объявленных прямо на предметах актора
   * (flags.warhammer-dbc.rollMods — тот же формат записей, что и у
   * HOMEWORLDS[].rollMods: {when, value, label, halvePenalty}). Заполняется
   * записью kind:"rollmod" Конструктора (module/apps/mechanics.mjs) при
   * получении предмета. Один блок на предмет-источник, чтобы игрок видел,
   * откуда галочка.
   */
  _itemRollModsHtml(context) {
    const groups = [];
    for (const it of this.actor.items) {
      const mods = it.getFlag("warhammer-dbc", "rollMods");
      if (!Array.isArray(mods) || !mods.length) continue;
      const hits = mods.filter(m => matchesContext(m.when, context));
      if (hits.length) groups.push({ item: it, mods: hits });
    }
    if (!groups.length) return { html: "", mods: [] };
    const allMods = [];
    let idx = 0;
    const blocks = groups.map(g => {
      const rows = g.mods.map(m => {
        const gi = idx++;
        allMods.push(m);
        const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
        return `<label class="attack-mod-check item-roll-mod">
          <input type="checkbox" class="item-mod" data-idx="${gi}" data-value="${m.value || 0}"
                 ${m.halvePenalty ? 'data-halve="1"' : ""}/>
          <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
      }).join("");
      return `<div class="atk-dlg-modifiers item-mods">
        <div class="atk-mods-title">${esc(g.item.name)}</div>
        <div class="atk-mods-list">${rows}</div></div>`;
    }).join("");
    return { mods: allMods, html: blocks };
  }

  // Галочки от реестра правил: разметку читает и диалог атаки, поэтому она
  // живёт в rules/roll-mods.mjs.
  _ruleRollModsHtml(context) {
    return ruleRollModsHtml(this.actor, context);
  }

  _showSkillRollDialog(label, baseTotal, defaultChar, hideCharSelect = false, rollContext = null) {
    const rollCtx = { kind: "skill", char: defaultChar, ...(rollContext || {}) };
    const hw = this._homeworldModsHtml(rollCtx);
    const im = this._itemRollModsHtml(rollCtx);
    const rl = this._ruleRollModsHtml(rollCtx);
    // Перебросы (Локусы Герольдов и прочие «перебросить тест X») — отдельным
    // блоком, а не галочкой среди модификаторов: их не с чем складывать.
    const rr = ruleRerollsHtml(this.actor, rollCtx);
    const defaultCharTotal = this.actor.system.characteristics[defaultChar]?.total ?? 0;
    const rankBonus        = baseTotal - defaultCharTotal;

    // Ассистенты (стр. 25). Список держится в замыкании диалога, а не на
    // акторе: это выбор на ОДИН бросок, а не постоянное состояние. Правила
    // «кто вправе помогать» и «во что это превращается в числах» лежат в
    // module/rules/assists.mjs и проверяются без Foundry.
    const assistMax = DEFAULT_ASSIST_MAX;
    const assistants = [];   // { uuid, name, beyondCap }

    const charOptions = Object.entries(CHARACTERISTICS).map(([key, meta]) => {
      const v = this.actor.system.characteristics[key]?.total ?? 0;
      return `<option value="${key}" ${key === defaultChar ? "selected" : ""}>${meta.abbr} — ${meta.label} (${v})</option>`;
    }).join("");

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Проверка: ${label}` },
      classes: ["wh-roll-dialog-window"],
      position: { width: 340 },
      content: `
          <div class="wh-skill-roll-form">
            <div class="roll-dlg-header"><span>${label}</span></div>
            ${hideCharSelect ? "" : `<div class="roll-dlg-row">
              <label>Бросок с:</label>
              <select id="skill-char-select">${charOptions}</select>
            </div>`}
            <div class="roll-dlg-row">
              <label>Цель:</label>
              <input id="skill-target" type="number" value="${baseTotal}"/>
            </div>
            <div class="roll-dlg-row">
              <label>Модификатор:</label>
              <input id="skill-modifier" type="number" value="0"/>
            </div>
            <div class="roll-dlg-row assist-row">
              <label>Ассистенты:</label>
              <span id="assist-count">0/${assistMax}</span>
            </div>
            <div id="assist-dropzone" class="assist-dropzone">Перетащите актора-помощника сюда</div>
            <div id="assist-list" class="assist-list"></div>
            ${hw.html}
            ${im.html}
            ${rl.html}
            ${rr.html}
          </div>`,
      buttons: [
        {
          action: "roll", icon: "fas fa-dice-d10", label: "Бросок", default: true,
          callback: (event, button) => {
            const form = button.form;
            let modifier = parseInt(form.querySelector("#skill-modifier").value) || 0;
            // Особенности родного мира: плюсы складываются, «Закалка» Схолы
            // Прогениум ополовинивает итоговый штраф. Ситуативные модификаторы
            // предметов (flags.warhammer-dbc.rollMods) и реестр правил
            // (module/rules/) считаются по той же логике.
            let halve = false;
            for (const sel of [".hw-mod:checked", ".item-mod:checked", ".rule-mod:checked"]) {
              for (const cb of form.querySelectorAll(sel)) {
                modifier += parseInt(cb.dataset.value) || 0;
                if (cb.dataset.halve === "1") halve = true;
              }
            }
            if (halve && modifier < 0) modifier = -Math.floor(Math.abs(modifier) / 2);
            // Ассистенты: +10 к порогу за каждого идут в общий модификатор, а
            // прибавка к степени — отдельным полем: она применяется только при
            // успехе, и решать это должен вызывающий код.
            modifier += assistThresholdBonus(assistants.length);
            // Выбранный переброс: −1 значит «без переброса».
            const rerollEl = form.querySelector(".rule-reroll-opt:checked");
            const rerollIdx = parseInt(rerollEl?.dataset.idx ?? "-1");
            return {
              charKey:  form.querySelector("#skill-char-select")?.value,
              target:   parseInt(form.querySelector("#skill-target").value) || 0,
              modifier,
              assistCount: assistants.length,
              reroll: rerollIdx >= 0
                ? { mode: rerollEl.dataset.mode, rolls: parseInt(rerollEl.dataset.rolls) || 2,
                    label: rerollEl.parentElement?.textContent?.trim() || "Переброс" }
                : null
            };
          }
        },
        // Без callback DialogV2 вернул бы строку "cancel" вместо null — она
        // непустая, проходит проверку `if (!result) return` у вызывающих
        // (_rollSkill/_rollCharacteristic), и деструктуризация полей из строки
        // молча даёт undefined всюду: бросок всё равно уходит, с порогом NaN.
        // callback обязан вернуть именно false, не null/undefined: DialogV2
        // резолвит результат как `(await callback(...)) ?? button.action`
        // (scripts/foundry.mjs, DialogV2#_onSubmit) — null/undefined там же
        // подменяются на action и возвращают ровно ту же строку "cancel".
        { action: "cancel", label: "Отмена", callback: () => false }
      ],
      render: (event, dialog) => {
        const root = dialog.element;
        root.querySelector("#skill-char-select")?.addEventListener("change", ev => {
          root.querySelector("#skill-target").value =
            (this.actor.system.characteristics[ev.currentTarget.value]?.total ?? 0) + rankBonus;
        });

        // ── Ассистенты: зона дропа, чипы, счётчик ──────────────────────────
        const zone  = root.querySelector("#assist-dropzone");
        const list  = root.querySelector("#assist-list");
        const count = root.querySelector("#assist-count");
        if (!zone || !list || !count) return;

        const renderAssists = () => {
          // Помощник «сверх лимита» (Промышленный мир) слот не занимает —
          // счётчик показывает его отдельной прибавкой, а не внутри X/Y.
          const beyond = assistants.length - countedAssists(assistants);
          count.textContent = `${countedAssists(assistants)}/${assistMax}${beyond ? ` +${beyond} сверх лимита` : ""}`;
          list.innerHTML = assistants.map(a => `
            <div class="assist-chip" data-uuid="${esc(a.uuid)}">
              <span>${esc(a.name)}${a.beyondCap ? ' <em class="assist-chip-beyond">сверх лимита</em>' : ""}</span>
              <button type="button" class="assist-chip-remove" title="Убрать">✕</button>
            </div>`).join("");
          zone.classList.toggle("assist-dropzone-full", countedAssists(assistants) >= assistMax);
          list.querySelectorAll(".assist-chip-remove").forEach(btn => {
            btn.addEventListener("click", () => {
              const uuid = btn.closest(".assist-chip").dataset.uuid;
              const i = assistants.findIndex(a => a.uuid === uuid);
              if (i >= 0) assistants.splice(i, 1);
              renderAssists();
            });
          });
        };

        zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("assist-dropzone-over"); });
        zone.addEventListener("dragleave", () => zone.classList.remove("assist-dropzone-over"));
        zone.addEventListener("drop", async ev => {
          ev.preventDefault();
          zone.classList.remove("assist-dropzone-over");
          let data = null;
          try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { /* не наш дроп */ }
          if (!data || (data.type !== "Actor" && data.type !== "Token")) return;
          const uuid = data.uuid
            || (data.type === "Actor" && data.id ? `Actor.${data.id}` : null)
            || (data.type === "Token" && data.sceneId && data.tokenId
                  ? `Scene.${data.sceneId}.Token.${data.tokenId}` : null);
          if (!uuid) return;
          const doc = await fromUuid(uuid).catch(() => null);
          const candidate = doc?.actor ?? doc;
          // Почему нельзя — решают правила, диалог только показывает ответ.
          const why = assistRejection(candidate, {
            actor: this.actor, assistants, max: assistMax, ctx: rollCtx
          });
          if (why) return ui.notifications.warn(why);
          assistants.push({
            uuid: candidate.uuid, name: candidate.name,
            beyondCap: assistsBeyondCap(candidate)
          });
          renderAssists();
        });
      },
      rejectClose: false
    });
  }

  // ── Бросок навыка ─────────────────────────────────────────────────────────

  async _rollSkill(label, baseTotal, defaultChar, rollContext = null) {
    const result = await this._showSkillRollDialog(label, baseTotal, defaultChar, false, rollContext);
    if (!result) return;
    const { charKey, target, modifier, assistCount = 0, reroll = null } = result;

    const fatiguePenalty = this._getFatiguePenalty(defaultChar);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);

    // Мод препаратов уже входит в target (через char.total → итог навыка)
    const eff      = target + modifier + fatiguePenalty + helmetBonus;
    // Переброс: бросаем сколько сказано и оставляем один. Какой именно —
    // решает rules/reroll-pick.mjs: на d100 «лучший» это МЕНЬШИЙ, и это знание
    // держится в одном месте, а не переписывается на каждом месте броска.
    const rollCount = reroll ? Math.max(2, reroll.rolls) : 1;
    const rolls = [];
    for (let i = 0; i < rollCount; i++) rolls.push(await new Roll("1d100").evaluate());
    const picked = pickReroll(rolls.map(r => r.total), reroll?.mode);
    const roll   = rolls[picked.index];
    const rv     = picked.value;
    // Отброшенные броски показываем в карточке: иначе переброс выглядит как
    // «мастер что-то посчитал», а не как потраченная возможность.
    const rerollNote = reroll
      ? `<div class="roll-reroll-note">${esc(reroll.label)}: отброшено ${picked.dropped.join(", ")}</div>`
      : "";
    const charAbbr = CHARACTERISTICS[charKey]?.abbr ?? charKey;
    const rollMode = game.settings.get("core", "rollMode");
    const success  = rv <= eff;
    // Ассистенты добавляют степень только к успеху — см. rules/assists.mjs.
    const deg      = assistDegrees(
      Math.floor(Math.abs(success ? eff - rv : rv - eff) / 10) + 1, assistCount, success);
    const outcome  = success
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label}</div>
          <div class="roll-threshold">
            ${charAbbr}: <b>${target}</b>${modStr}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${eff}</b>
          </div>
          ${assistCount ? `<div class="roll-threshold">🤝 Ассистенты: <b>${assistCount}</b> (+${assistThresholdBonus(assistCount)} к порогу${success ? `, +${assistCount} к степени` : ""})</div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          ${rerollNote}
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);
  }

  /** Расчёт и применение лечения к пациенту + сообщение в чат. */
  async _applyHealing(patient, { mode, care, mod, bonus }) {
    return applyHealing(this.actor, patient, { mode, care, mod, bonus });
  }

  /** Краткое сообщение о Боли в чат. */
  async _painChatMsg(text) {
    return painChatMsg(this.actor, text);
  }

  // ── Бросок характеристики ─────────────────────────────────────────────────

  async _rollCharacteristic(label, abbr, threshold, charKey, hideCharSelect = false) {
    const result = await this._showSkillRollDialog(label, threshold, charKey, hideCharSelect);
    if (!result) return;
    const { target, modifier, assistCount = 0 } = result;

    const fatiguePenalty = this._getFatiguePenalty(charKey);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);

    // Мод препаратов уже входит в target (через char.total)
    const eff      = target + modifier + fatiguePenalty + helmetBonus;
    const roll     = await new Roll("1d100").evaluate();
    const rv       = roll.total;
    const rollMode = game.settings.get("core", "rollMode");
    const success  = rv <= eff;
    // Ассистенты добавляют степень только к успеху — см. rules/assists.mjs.
    const deg      = assistDegrees(
      Math.floor(Math.abs(success ? eff - rv : rv - eff) / 10) + 1, assistCount, success);
    const outcome  = success
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${abbr} — ${label}</div>
          <div class="roll-threshold">
            Цель: <b>${target}</b>${modStr}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${eff}</b>
          </div>
          ${assistCount ? `<div class="roll-threshold">🤝 Ассистенты: <b>${assistCount}</b> (+${assistThresholdBonus(assistCount)} к порогу${success ? `, +${assistCount} к степени` : ""})</div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);
  }

  _degWord(n) { return _degWord(n); }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ПСАЙКАНА
  // ══════════════════════════════════════════════════════════════════════════

  _resolvePsyCastAttr(sys) {
    return resolvePsyCastAttr(this.actor, sys);
  }

  _showManifestDialog(item) {
    return showManifestDialog(this.actor, item);
  }

  _wirePsyManifestPreview(html, meta) {
    return wirePsyManifestPreview(html, meta);
  }

  async _executePsychotest(item, opts) {
    return executePsychotest(this.actor, item, opts);
  }

  _rollPsyniscience() {
    return rollPsyniscience(this.actor, (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts));
  }

  /** Тест W + PR×5 (для Пси-капюшона и Выжигания Души). */
  async _rollPsyWpTest(label, note) {
    return rollPsyWpTest(this.actor, label, note);
  }

  /** Применение Силы навигатора: простой тест характеристики (без Феноменов/Прорывов). */
  async _activateNavigatorPower(item) {
    return activateNavigatorPower(this.actor, item);
  }

  /** Активация Техночуда: Когниция + Энергия + тест Tech-Use (Ментальное) + урон. */
  async _activateTechMiracle(item) {
    return activateTechMiracle(this.actor, item);
  }

  // ── Генерация Когниции/Энергии от имплантов Кибернетики Механикум ──────────
  async _techGenResource(item, opts) {
    return techGenResource(this.actor, item, opts);
  }

}

