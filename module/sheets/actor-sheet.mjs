import { activateEliteListeners } from "./elite-picker.mjs";
import { buyEliteArchetype } from "../apps/elite-buy.mjs";
import { activateHaemonculusListeners } from "./tabs/haemonculus.mjs";
import { openItemPicker, talentCategory } from "./item-picker.mjs";
import { openGearPicker } from "./gear-picker.mjs";
// module/sheets/actor-sheet.mjs

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { BODY_TYPES } from "../constants/body-map.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }    from "../constants/skills.mjs";
import { ITEM_TYPES, GEAR_ITEM_TYPES } from "../constants/items.mjs";
import { _degWord, splitTopLevel, esc } from "../helpers/utils.mjs";
import { ruSpec } from "../apps/creation.mjs";
import { openCharacterWizard } from "../apps/character-wizard.mjs";
import { onConvertToHorde, convertActorToHorde } from "../apps/horde-convert.mjs";
import { buildGetData } from "./sheet-helpers.mjs";
import { characterContext, charLabel } from "./character-context.mjs";
import { showAttackDialog, showAttackDialogNoWeapon } from "./attack-dialog.mjs";
import { rollMutationOrGift, openMutationPicker } from "./tabs/mutations.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { createDisorderItem, activateDisorderListeners,
         openFearDialog, openTraumaDialog, rollDisorder } from "./tabs/disorders.mjs";
import { activateDiseaseListeners } from "./tabs/diseases.mjs";
import { fatiguePenalty, marchPenalty, activateConditionsListeners, addCondition } from "./tabs/conditions.mjs";
import { disabledArmourPenalty } from "../combat/armor-mods.mjs";
import { inventoryOverloadPenalty } from "../rules/encumbrance.mjs";
import { painChatMsg } from "./tabs/pain.mjs";
import { applyHealing } from "./tabs/healing.mjs";
import { activateDrugListeners } from "./tabs/drugs.mjs";
import { activatePsychicListeners, activateNavigatorPower, executePsychotest,
         resolvePsyCastAttr, rollPsyWpTest, rollPsyniscience, showManifestDialog,
         wirePsyManifestPreview } from "./tabs/psychic.mjs";
import { activateTechListeners, activateTechMiracle, techGenResource } from "./tabs/tech.mjs";
import { activateGearListeners, toggleGearModActive } from "./tabs/gear.mjs";
import { activateRitualListeners } from "./tabs/rituals.mjs";
import { activateAspirationListeners } from "./tabs/aspirations.mjs";
import { socialContext, activateSocialListeners } from "./tabs/social.mjs";
import { minionsPanelContext, activateMinionPanelListeners } from "./tabs/minions-panel.mjs";
import { onMinionCreate } from "../apps/minion-creator.mjs";
import { isMinionTalent, minionSlotOf } from "../rules/minion-build.mjs";
import { promptMinionSlot, applyMinionSlot } from "../apps/minion-talent.mjs";
import { refundXP, talentCost, talentReason } from "../apps/duplicate-refund.mjs";
import { activatePathListeners } from "./tabs/paths.mjs";
import { activateCombatListeners } from "./tabs/combat.mjs";
import { mountPanelContext, activateMountPanelListeners } from "./tabs/mount-panel.mjs";
import { patronPanelContext, activatePatronPanelListeners } from "./tabs/patron-panel.mjs";
import { dreadnoughtPanelContext } from "./tabs/dreadnought-panel.mjs";
import { SANITY_RECOVERY_TALENTS, sanityRecoveryTalentsOf, dailyWillTestOutcome,
         electrostimulatorBoost, ferumInfernusActive } from "../rules/dreadnought.mjs";
import { woundLossUpdates } from "../rules/wounds.mjs";
import { activateBodyListeners } from "./tabs/body.mjs";
import { activatePossessionListeners } from "./tabs/possession.mjs";
import { activateAdvanceListeners } from "./tabs/advance.mjs";
import { activateItemContextMenu, openContextMenu } from "./context-menu.mjs";
import { _resolveSoulBurn }                 from "../hooks.mjs";
import { openRigManager }                   from "../apps/rig-manager.mjs";
import { infamyContext, changeInfamy, restoreInfamy, spendInfamy } from "../apps/infamy-points.mjs";
import { ruleFlagCost } from "../rules/flags.mjs";
import { spendCapabilityCost } from "../combat/capability-cost.mjs";
import { runMechScriptEntry } from "../apps/mechanics.mjs";
import { applyTouchedByFates } from "../rules/daemon-locus.mjs";
import { promptStatAdd } from "../apps/stat-log.mjs";
import { CHAOS_PATRONS, chaosPatronMeta } from "../constants/chaos-patron.mjs";
import { charStereotypesFor, effectivePricingMode, worldAdvancePricingMode, PRICING_MODES } from "../constants/patronage.mjs";
import { applyArchetype } from "../apps/archetypes.mjs";
import { homeworldRollMods, matchesContext } from "../constants/homeworlds.mjs";
import { ruleRollModsHtml, ruleRerollsHtml } from "../rules/roll-mods.mjs";
import { resolveKindOutcome } from "../rules/kind-outcome.mjs";
import { isMoraleOpposedSkill, resolveTest } from "../rules/resolve-test.mjs";
import { applyLordOfExoditesFailPenalty } from "../combat/lord-of-exodites.mjs";
import { showDelegateTestPicker, activeOwnerOf, requestDelegatedTest } from "../rules/delegate-test.mjs";
import { testKindHtml, diceModeHtml, readTestKind, readDiceChoice, mergeReroll,
         wireTestKindLive, rollD100WithReroll, opposedComparisonHtml } from "../rules/test-kind-widget.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { skillTotal } from "../combat/movement-actions.mjs";
import { assistRejection, assistThresholdBonus, assistDegrees, DEFAULT_ASSIST_MAX,
         assistsBeyondCap, countedAssists }
  from "../rules/assists.mjs";
import { specOptions, specDef } from "../constants/skill-specializations.mjs";
import { applyHomeworld, actorHomeworldKey } from "../apps/homeworlds.mjs";
import { applyDivination } from "../apps/divinations.mjs";
import { applyRace, applySubrace, clearRace, clearSubrace,
         actorRaceItem, actorSubraceItem,
         applyYnnari, applyHarlequin } from "../apps/races.mjs";
import { raceDef } from "../apps/race-library.mjs";
import { raceKeyOf, isAeldariRace } from "../apps/race-library.mjs";
import { openRacePicker } from "./race-picker.mjs";
import { HELMETLESS_FEL_BONUS } from "../constants/power-armour-lore.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { actorFactionsContext, activateFactionFieldListeners } from "../apps/actor-factions.mjs";
import { toggleAbility } from "../apps/toggle-abilities.mjs";
import { resolveArmorProps, aggregateArmorSkillMods } from "../combat/armor-properties.mjs";
import { actorHasAspectPath } from "../constants/aeldari-paths.mjs";

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

// ── Возможности сейчас: кнопка «Потратить» у записей с ценой (wdbc-1dc8) ──
// Цена не сериализуется в DOM — пересчитывается свежей ruleFlagCost на клик,
// тем же путём, что и context.activeCapabilities (sheet-helpers.mjs), чтобы
// не разъехаться со списком, отрисованным на момент рендера.
async function onCapabilitySpend(event, target) {
  const key = target.dataset.key;
  const cost = ruleFlagCost(this.actor, key, { kind: "skill" });
  // Локус Фанатизма (wdbc-smc): в отличие от остальных ценовых возможностей
  // (которые списывают цену и постят только флейвор-карточку), эта реально
  // что-то делает — cross-actor выдача Трейта демонам в радиусе Локуса.
  // Цена списывается, только если эффект нашёл хотя бы одну цель (иначе
  // список пуст, и applyTouchedByFates сама предупредила игрока — списывать
  // Очко Бесчестия «в пустоту» не должно).
  if (key === "aura.touchedByFates") {
    const applied = await applyTouchedByFates(this.actor);
    if (!applied) return false;
  }
  return spendCapabilityCost(this.actor, cost, target.dataset.label);
}

// kind:"script" запись с ценой/частотой (wdbc-suwp) — та же панель, кнопка
// «▶ Запустить» вместо «Потратить»: гейт (троттлинг+цена) и списание живут
// внутри runMechScriptEntry (module/apps/mechanics.mjs), эта функция лишь
// находит сам предмет по id, полученному из data-атрибута строки.
function onCapabilityScriptRun(event, target) {
  const item = this.actor.items.get(target.dataset.itemId);
  return runMechScriptEntry(item, target.dataset.groupId, target.dataset.entryId);
}

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
    const isEldanar = actorSubraceItem(this.actor)?.system?.key === "eldanar";
    await promptStatAdd(this.actor, {
      label: "Порча", path: "system.corruption.value", allowDice: true,
      note: isEldanar
        ? "Эльданар не получает дополнительный Cor от расы, путей и иных источников — только за то, что взято сознательно."
        : ""
    });
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
  const woundUpdates = woundLossUpdates(this.actor.system, roll.total);

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

/**
 * Лечение Саркофага (стр. 57, wdbc-drn): 1 Рана каждые 10 минут игрового
 * времени. Таймера в системе нет (тот же принцип, что Электростимуляторы/
 * Ферум Инфернус выше) — кнопка просто лечит 1 Рану до effectiveMax
 * (module/rules/character.mjs), тикать нужно вручную по факту прошедшего
 * времени.
 */
async function onSarcophagusHealTick(event) {
  event.preventDefault();
  const w = this.actor.system.wounds ?? {};
  const max = Number(w.effectiveMax ?? w.max) || 0;
  const cur = Number(w.value) || 0;
  if (cur >= max) return ui.notifications.info("Саркофаг: Раны уже на максимуме.");
  const next = Math.min(max, cur + 1);
  await this.actor.update({ "system.wounds.value": next });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Лечение Саркофага (10 мин)</div>
        <div class="roll-outcome"><span class="roll-success">+1 Рана (${cur} → ${next})</span></div>
      </div>`
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
  if (key === "cor") {                      // Порча — чистый бросок значения, не тест Воли
    const cor = Number(this.actor.system.corruption?.value) || 0;
    return this._rollCharacteristic("Порча", "COR", cor, "cor", true);
  }
  const meta  = CHARACTERISTICS[key];
  const total = this.actor.system.characteristics[key]?.total ?? 0;
  return this._rollCharacteristic(charLabel(key, this.actor.system.alignment), meta.abbr, total, key);
}

/**
 * Клик по INS (Безумие) в табличке Характеристик — своего единого броска у
 * Безумия нет (Страх/Травма/Расстройство — разные тесты), поэтому меню, а не
 * прямой бросок. По просьбе пользователя добавлен ещё и «голый» бросок
 * значения Безумия — мало ли зачем ГМ захочет именно его.
 */
function onInsanityMenu(event) {
  event.preventDefault();
  const actor  = this.actor;
  const insVal = Number(actor.system.insanity?.value) || 0;
  const entries = [
    { cls: "wh-ctx-ins-fear",     label: "😱 Страх",               onClick: () => openFearDialog(actor) },
    { cls: "wh-ctx-ins-trauma",   label: "💥 Травма",              onClick: () => openTraumaDialog(actor) },
    { cls: "wh-ctx-ins-disorder", label: "🎲 Расстройство (d100)", onClick: () => rollDisorder(actor) },
    { sep: true },
    { cls: "wh-ctx-ins-raw",      label: "🧠 Безумие (напрямую)",  onClick: () => this._rollCharacteristic("Безумие", "INS", insVal, "ins", true) }
  ];
  openContextMenu(event, entries);
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
    // «Не получает физических мутаций» (Серый Человек, wdbc-gzuf) — этот путь
    // всегда создаёт type:"mutation" в обход общего пикера, где иммунитет уже
    // фильтрует таблицу; закрыть его тем же флагом.
    if (hasRuleFlag(this.actor, "mutation.physicalImmune")) {
      return ui.notifications.warn(`${this.actor.name} не получает физических мутаций.`);
    }
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

// Вкл./выкл. у Мутации/Дара с activatable:true (wdbc-egll, напр. Живое
// Оружие — полудействие+1 Бесчестия, до конца боя/сцены). Переиспользует
// тот же тумблер, что и включаемые системы брони (module/sheets/tabs/
// gear.mjs::toggleGearModActive) — реализация не завязана на тип предмета,
// только на общее поле system.active + isItemActive().
async function onMutgiftToggleActive(event, target) {
  event.preventDefault(); event.stopPropagation();
  await toggleGearModActive(this.actor.items.get(target.dataset.itemId));
}

// ── Раса, Прошлое и легион ── (apps/races.mjs держит применение, лист даёт
// только разбор текстовых списков колбэком createTraits — его зовёт и Мастер
// создания персонажа)
//
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
// Кроме Черт (их выдаёт Механика носителя расы) — и стартовые таланты по
// констанам расы: раньше их выдавала только кнопка Геносемени (geneApply,
// снята по просьбе пользователя) и Мастер создания; для уже существующих
// персонажей ручной путь остался только здесь.
async function onRaceApply() {
  const key = this.actor.system.race || "";
  await applyRace(this.actor, key);
  const def = raceDef(key);
  if (key && def?.talents?.length) await this._applyStartingTalents([def.talents].flat(), def?.label || key);
}
function onSubraceApply(){ return applySubrace(this.actor, this.actor.system.subrace || ""); }

export class WarhammerCharacterSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "sheet", "actor", "character", "character-sheet", "wh-holo"],
    position: { width: 1000, height: 940 },
    window: {
      resizable: true
      // «Перезапустить мастера создания» и «В Орду» раньше жили здесь
      // (window.controls) и в блоке ПРЕОБРАЗОВАНИЕ на вкладке ЗАПИСИ
      // соответственно — переехали в кастомную кнопку-меню у шапки листа
      // (см. _attachFrameListeners ниже, иконка Механикум).
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
      capabilitySpend: whenEditable(onCapabilitySpend),
      capabilityScriptRun: whenEditable(onCapabilityScriptRun),
      // «Перезапустить мастера создания» больше не data-action: кнопка-меню
      // Механикум (_attachFrameListeners) зовёт this.openCreationWizard()
      // напрямую, минуя карту действий.
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
      sarcophagusHealTick: whenEditable(onSarcophagusHealTick),
      initiativeRoll: whenEditable(onInitiativeRoll),
      charRoll: whenEditable(onCharRoll),
      insanityMenu: whenEditable(onInsanityMenu),
      skillRoll: whenEditable(onSkillRoll),
      itemAdd: whenEditable(onItemAdd),
      rigOpen: whenEditable(onRigOpen),
      gearLib: whenEditable(onGearLib),
      traitAdd: whenEditable(onTraitAdd),
      talentAdd: whenEditable(onTalentAdd),
      mutgiftAdd: whenEditable(onMutgiftAdd),
      mutgiftRoll: whenEditable(onMutgiftRoll),
      mutgiftToggleActive: whenEditable(onMutgiftToggleActive),
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
        { id: "psy",         label: "МИСТИКА" },
        { id: "tech",        label: "ТЕХ" },
        { id: "nav",         label: "НАВ" },
        { id: "gear",        label: "СНАРЯЖЕНИЕ" },
        { id: "advance",     label: "РАЗВИТИЕ" },
        { id: "notes",       label: "ЗАПИСИ" }
      ]
    }
  };

  _savedScrollTops = {};
  _combatCollapse = { tech: false };
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

    // Блок «ПАТРОН» / «ПРОТЕЖЕ» на СОЦИУМ (субраса «Наследник», Трейт
    // Помазанник(X)): смертный хранит ссылку на Демона-Принца, сам Принц
    // строит свою сторону по оформленным дарам «Помазанник» (wdbc-yo6r).
    Object.assign(context, patronPanelContext(this.actor, [...(game.actors ?? [])]));

    // Блок «ЗДРАВОМЫСЛИЕ» там же: видим, только если какой-то Дредноут в мире
    // держит этого персонажа своим пилотом (rules/dreadnought.mjs, стр. 57-58).
    Object.assign(context, dreadnoughtPanelContext(this.actor, [...(game.actors ?? [])]));

    // ── ЗАПИСИ: prose-mirror с переключаемым режимом (как у Journal Entries) —
    // пока не открыт на правку, показывается обогащённый HTML (ссылки/секреты).
    context.notesEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor.system.notes, { relativeTo: this.actor, secrets: this.actor.isOwner });

    // ── ДАННЫЕ (Limited Vision): отдельное поле для ГМ — текст, который видит
    // владелец Ограниченного зрения. Заполняет и правит только ГМ; игроку
    // блок на Записях не показывается вовсе (см. limitedVisionData ниже).
    context.isGM = game.user.isGM;
    if (context.isGM) {
      context.limitedVisionDataEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.actor.system.limitedVisionData, { relativeTo: this.actor, secrets: true });
    }

    // ── Сворачивание секций: состояние окна, переживает перерисовку ─────────
    context.combatTechCollapsed   = !!this._combatCollapse?.tech;
    context.gearCollapse = this._gearCollapse || {};

    // ── Режим цены Продвижения (constants/patronage.mjs) — НЕ только для
    // Хаоситов: Лоялист/Ксенос тоже может получить personal-оверрайд «Смешанная»
    // или (реже) «Покровительство» от ГМа, поэтому считается безусловно для
    // любого Персонажа, до блока Очков Бесчестия ниже — тот читает
    // usesPatronStereotype, вычисленный здесь.
    if (this.actor.type === "character") {
      const mode = effectivePricingMode(this.actor);
      const patronChosen = this.actor.system.patronGod || "";
      context.advancePricingMode = mode;
      context.usesPatronStereotype = (mode === "patronage" || mode === "mixed") && !!patronChosen;
      // Блок 8 Склонностей на «Развитии» не нужен, когда цена персонажа
      // считается строго по Покровительству — Смешанная всё ещё их читает.
      context.usesAptitudes = mode !== "patronage";
    }

    // ── Покровитель Хаоса: выбор Бога — либо ради Очков Бесчестия (Хаосит,
    // как раньше), либо ради цены Продвижения по Покровительству/Смешанной
    // системе, которую ГМ может включить и НЕ-Хаоситу через per-actor
    // оверрайд (см. advancePricingMode выше). Раньше весь этот блок жил
    // строго внутри `isHeretic`, и Лоялист/Ренегат с таким оверрайдом не мог
    // выбрать Бога вовсе — цена молча садилась на «Нейтрально» везде.
    const needsPatronPicker = context.isHeretic ||
      context.advancePricingMode === "patronage" || context.advancePricingMode === "mixed";
    if (needsPatronPicker) {
      // Отметка радиокнопки — по ХРАНИМОМУ полю, а не по _infamyKey: тот
      // подставляет Неделимого, когда Бог не выбран, и селектор показывал бы
      // выбранным то, чего в акторе нет (wdbc-osz).
      const patronChosen = this.actor.system.patronGod || "";
      context.chaosPatrons = CHAOS_PATRONS.map(p => ({ ...p, selected: p.key === patronChosen,
        favor: Number(foundry.utils.getProperty(this.actor, `system.patronFavor.${p.key}`)) || 0 }));
      // Селектор Бога в ЗАПИСЯХ — только там, где патрон не выбирается иначе.
      // У Демон-Принца патрон = «Патрон» в шапке (allegiance) → селектор скрыт.
      context.showPatronPicker = this._showPatronPicker;

      // Стереотип Покровительства (constants/patronage.mjs) — только у
      // Персонажа (поле есть только в его схеме) и только пока режим цены
      // реально его читает (Покровительство/Смешанная), и Бог уже выбран.
      if (this.actor.type === "character" && context.usesPatronStereotype) {
        const cur = this.actor.system.patronStereotype || "";
        context.patronStereotypes = charStereotypesFor(patronChosen)
          .map(s => ({ key: s.key, label: s.label, selected: s.key === cur }));
      }
    }

    // ── Очки Бесчестия (корбук 438): доступны только Хаоситам — отдельно от
    // выбора Бога выше, Инфейми не связано с ценой Продвижения.
    // Путь к счётчику и его максимум задают геттеры листа: у Демон-Принца это
    // не Судьба, а собственные ОБ, поэтому расчёт остаётся здесь.
    if (context.isHeretic && this._infamyEnabled) {
      const ip = Math.max(0, Number(foundry.utils.getProperty(this.actor, this._infamyPath)) || 0);
      context.infamy = infamyContext(this.actor, this._infamyKey,
        { ip, ipMax: this._infamyMax, showCounter: this._infamyShowCounter });
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

  /** Марш/Бег/Форсированный марш (стр. 29): штраф на Восприятие, пока активен. */
  _getMarchPenalty(charKey) {
    return marchPenalty(this.actor, charKey);
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
    // Обшивка «инфопланшет» (wdbc-m6as Персонаж, wdbc-ri8b Миньон,
    // wdbc-nzn7 Демон, wdbc-xzvt Принц Демона) — PARTS.body.root=true
    // отбрасывает классы, написанные прямо в шаблоне (см. комментарий в
    // шапке character-sheet.hbs/minion-sheet.hbs/daemon-sheet.hbs/
    // demon-prince-sheet.hbs), поэтому cog-frame навешивается здесь же, где
    // и wh-align-*/wh-race-*.
    root.classList.toggle("cog-frame", ["character", "minion", "daemon", "demonPrince"].includes(this.actor.type));
    const sys = this.actor.system;
    const cls = sys.isTechpriest ? "techpriest" : (sys.isPsyker ? "psyker" : "adept");
    root.classList.remove(...[...root.classList].filter(c => /^wh-(align|race|class)-/.test(c)));
    root.classList.add(`wh-align-${sys.alignment || "loyalist"}`,
      `wh-race-${sys.race || "none"}`, `wh-class-${cls}`);
  }

  /** CSS-переменные, которые чинит патрон, — держим в одном месте, чтобы
   *  выставлять/снимать их симметрично. */
  static #CHAOS_PATRON_VARS = ["--gc", "--gc2", "--glow", "--dp-hue", "--dp-sat",
    "--dp-bright", "--patron-star", "--patron-sigil", "--patron-sigil-size"];

  /**
   * Навешивает на корень листа тему Бога-покровителя: класс chaos-heretic/
   * chaos-god-<key> и CSS-переменные --gc/--glow/сигил и т.п. Раньше эти
   * данные шли инлайн-стилем на корневой <div> шаблона, но ApplicationV2
   * с PARTS.body.root=true (см. _applyThemeClasses выше) отбрасывает
   * корневой элемент шаблона целиком — навешиваем сюда явно, тем же
   * источником (chaosPatronMeta по _infamyKey), что раньше шёл в шаблон.
   */
  _applyChaosPatronTheme() {
    // Только лист Персонажа: Демон и Принц Демона наследуют этот класс и тоже
    // ходят alignment="heretic" по умолчанию — без гейта их листы красились бы
    // в тему патрона поверх собственной (hue-rotate шапки и вкладок).
    if (this.actor.type !== "character") return;
    const root = this.element;
    if (!root) return;
    root.classList.remove(...[...root.classList].filter(c => /^chaos-(heretic|god-)/.test(c)));
    if (this.actor.system.alignment !== "heretic") {
      for (const v of WarhammerCharacterSheet.#CHAOS_PATRON_VARS) root.style.removeProperty(v);
      return;
    }
    const meta = chaosPatronMeta(this._infamyKey);
    root.classList.add("chaos-heretic", `chaos-god-${meta.key}`);
    root.style.setProperty("--gc", meta.color);
    root.style.setProperty("--gc2", meta.gc2);
    root.style.setProperty("--glow", meta.glow);
    root.style.setProperty("--dp-hue", meta.hue);
    root.style.setProperty("--dp-sat", meta.sat);
    root.style.setProperty("--dp-bright", meta.bright);
    root.style.setProperty("--patron-star", meta.star);
    root.style.setProperty("--patron-sigil", `url('/${meta.sigil}')`);
    root.style.setProperty("--patron-sigil-size", meta.sigilSize);
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

  /**
   * Переключатели в меню «Настройки листа» — те же поля, что раньше жили в
   * блоке СТАТУС на вкладке ЗАПИСИ (блок оттуда убран для типов, у которых
   * есть эта кнопка — дублировать было незачем). Каждый — ручной оверрайд
   * поверх автоопределения: Одержимость/Пси-Пробуждение/Техножрец открывают
   * свои вкладки и без подходящей Черты/Архетипа, «Ремёсла» нужны в первую
   * очередь НПС (у персонажей с игроком-владельцем крафт и так доступен),
   * «Фактор Прибыли» просто зеркалит system.isRogueTrader.
   *
   * @param {string[]} keys  какие из пяти показать и в каком порядке — состав
   *                         отличается по типу актора (см. _sheetSettingsEntries).
   */
  _sheetToggleEntries(keys) {
    const sys = this.actor.system;
    const toggle = (key) => this.actor.update({ [`system.${key}`]: !sys[key] });
    const all = {
      possessed:      { cls: "wh-ctx-tog-possessed", label: "Одержимость" },
      isPsyker:       { cls: "wh-ctx-tog-psyker", label: "Пси-Пробуждение" },
      isTechpriest:   { cls: "wh-ctx-tog-techpriest", label: "Техножрец" },
      craftAvailable: { cls: "wh-ctx-tog-craft", label: "Доступен для ремёсел" },
      isRogueTrader:  { cls: "wh-ctx-tog-rogue", label: "Фактор Прибыли" }
    };
    return keys.map(key => ({
      ...all[key], checkbox: true, checked: !!sys[key], onClick: () => toggle(key)
    }));
  }

  /**
   * Мировоззрение (Лоялист/Ренегат/Хаосит) — переехало из <select> в шапке
   * (wdbc, 23.08.2026) в три взаимоисключающих пункта меню «Настройки листа»:
   * галочка отмечает текущее значение, клик по любому пункту ставит его.
   * Только для Персонажа — у Аэльдари (и ветвей) Мировоззрения нет вовсе,
   * как и раньше не было select'а в шапке.
   */
  _alignmentEntries() {
    const cur = this.actor.system.alignment || "loyalist";
    const set = (value) => this.actor.update({ "system.alignment": value });
    return [
      ["loyalist", "Лоялист"], ["renegade", "Ренегат"], ["heretic", "Хаосит"]
    ].map(([key, label]) => ({
      cls: `wh-ctx-align-${key}`, label,
      checkbox: true, checked: cur === key, onClick: () => set(key)
    }));
  }

  /** Мировоззрение как один каскадный пункт (вместо трёх плоских). */
  _alignmentSubmenu() {
    return { cls: "wh-ctx-align", label: "🎭 Мировоззрение", submenu: this._alignmentEntries() };
  }

  /**
   * Телосложение (Мужское/Женское/Другое) — каскадный пункт вместо кнопки,
   * открывавшей отдельный Dialog. Общий для Персонажа и Миньона (оба
   * показывают его в _sheetSettingsEntries).
   */
  _bodyTypeSubmenu() {
    if (this.actor.system.race === "astartes") return null;   // Астартес всегда мужчины
    const cur = this.actor.system.bodyType || "male";
    return {
      cls: "wh-ctx-bodytype", label: "🧍 Телосложение",
      submenu: Object.entries(BODY_TYPES).map(([key, label]) => ({
        cls: `wh-ctx-bodytype-${key}`, label,
        checkbox: true, checked: cur === key,
        onClick: () => this.actor.update({ "system.bodyType": key })
      }))
    };
  }

  /** Одержимость/Техножрец/Пси-Пробуждение — под одним каскадным пунктом
   * «Открыть доступ»: все три открывают вкладку листа вручную, минуя
   * автоопределение по Черте/Архетипу, и логически принадлежат вместе. */
  _accessSubmenu(keys) {
    const entries = this._sheetToggleEntries(keys);
    if (!entries.length) return null;
    return { cls: "wh-ctx-access", label: "🔓 Открыть доступ", submenu: entries };
  }

  /**
   * Своя система цены Продвижения для ЭТОГО персонажа (constants/patronage.mjs,
   * pricingModeOverride) — на случай, если ГМ разрешает конкретному игроку
   * систему, отличную от мировой настройки. Пустая строка (первый пункт) —
   * наследовать от мира. Мьютекс-пункты, тот же паттерн, что _alignmentEntries().
   */
  _advancePricingEntries() {
    const cur = this.actor.system.pricingModeOverride || "";
    const world = worldAdvancePricingMode();
    const set = (value) => this.actor.update({ "system.pricingModeOverride": value });
    return [
      ["", `Как у мира (${PRICING_MODES[world]})`],
      ...Object.entries(PRICING_MODES)
    ].map(([key, label]) => ({
      cls: `wh-ctx-pricing-${key || "world"}`, label: `Система продвижения: ${label}`,
      checkbox: true, checked: cur === key, onClick: () => set(key)
    }));
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
  // Хаосит: текущее значение хранится в том же поле, что и Судьба
  // (system.fate.value — то же самое поле, реально видит его только полоса
  // «ОЧКИ БЕСЧЕСТИЯ», в шапке ячейка Судьбы скрыта {{#unless infamy}}), а
  // максимум — Inf.b (Влияние), а не system.fate.max: тот у обычного
  // Персонажа просто ручное число Судьбы (роллится при создании, для
  // Хаосита к делу отношения не имеет), максимум ОБ Демон-Принца точно так
  // же считается от Inf.b — расхождение с system.fate.max было багом, а не
  // альтернативной механикой. Тема/сигил — по выбранному Богу-покровителю
  // (system.patronGod).
  get _infamyEnabled() { return true; }
  get _showPatronPicker() { return true; }   // Демон-Принц переопределяет на false (патрон в шапке)
  get _infamyPath() { return "system.fate.value"; }
  get _infamyMax()  { return Math.max(0, Number(this.actor.system.characteristics?.inf?.bonus) || 0); }
  // Счётчик Очков Бесчестия переехал из шапки листа в саму полосу
  // «ОЧКИ БЕСЧЕСТИЯ» (infamy-strip.hbs, showCounter) — как у Демон-Принца.
  get _infamyShowCounter() { return true; }
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
   * Пилюля состояния из карточки успешного Ритуала (module/apps/ritual-cast.mjs,
   * module/hooks.mjs dragstart) — перехватываем свой payload type:"wh-condition"
   * до штатных _onDropItem/_onDropActor: это не Item и не Actor, а просто ключ
   * CONDITIONS_DEF. Неизвестный ключ и не-JSON payload молча уходят к super —
   * штатному дропу Item/Actor/Folder.
   */
  async _onDrop(event) {
    let payload;
    try {
      payload = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch { payload = null; }

    if (payload?.type === "wh-condition") {
      event.preventDefault();
      return addCondition(this.actor, payload.key, payload.level || null);
    }

    return super._onDrop(event);
  }

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

  /**
   * Кнопка-меню «Настройки листа» в шапке — рядом со штатным «Toggle Controls»
   * (this.window.close.insertAdjacentElement("beforebegin", …) ставит её
   * между ним и крестиком закрытия). У всех типов, что проходят через этот
   * класс (Персонаж, Демон, Принц Демона, Миньон) — но состав пунктов у
   * каждого свой (_sheetSettingsEntries), и если для типа пунктов нет вовсе,
   * кнопка не рисуется — незачем открывать пустое меню. У Формирования,
   * Отряда, Корабля, Техники и Звёздной системы этот класс не используется
   * вовсе (свои классы листов) — там пунктов и не просили.
   *
   * Once, не на каждый рендер: вызывается ядром только при isFirstRender
   * (см. ApplicationV2._render), как и родная привязка ContextMenu к
   * «Toggle Controls» в том же месте.
   */
  _attachFrameListeners() {
    super._attachFrameListeners();
    if (!this.hasFrame || !this._sheetSettingsEntries().length) return;
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
      const entries = this._sheetSettingsEntries();
      if (entries.length) openContextMenu(event, entries);
    });
  }

  /**
   * Состав меню «Настройки листа» по типу актора (таблица от пользователя).
   * Мировоззрение, Телосложение и «Одержимость/Пси-Пробуждение/Техножрец» —
   * каскадные подпункты (submenu, раскрываются наведением, см. _alignmentSubmenu/
   * _bodyTypeSubmenu/_accessSubmenu), а не плоский список, как раньше:
   *  - Персонаж — Мастер, Телосложение▸, [разделитель], Мировоззрение▸ (кроме
   *    Аэльдари), [разделитель], Система продвижения, [разделитель], Открыть
   *    доступ▸ (Одержимость/Пси-Пробуждение/Техножрец), Доступен для ремёсел,
   *    Фактор Прибыли (кроме Аэльдари), В Орду.
   *  - Демон — Пси-Пробуждение, Доступен для ремёсел, В Орду. Нет ни Мастера,
   *    ни поля system.bodyType, ни подменю «Открыть доступ».
   *  - Принц Демона — Фактор Прибыли, Пси-Пробуждение, Доступен для ремёсел.
   *    Без «В Орду»: своя кнопка уже есть на вкладке ЗАПИСИ, дублировать не
   *    просили.
   *  - Миньон — Открыть доступ▸ (Пси-Пробуждение/Одержимость/Техножрец), В
   *    Орду, Телосложение▸, Доступен для ремёсел. Без Мастера и Фактора Прибыли.
   * Пустой массив ⇒ кнопка в шапке вообще не рисуется (см. _attachFrameListeners) —
   * у Формирования/Отряда/Корабля/Техники/Звёздной системы этот класс не
   * используется (свои классы листов), там пунктов и не просили.
   */
  _sheetSettingsEntries() {
    const type = this.actor.type;
    const wizard = {
      cls: "wh-ctx-charwizard", label: "🧙 Перезапустить мастера создания",
      onClick: () => this.openCreationWizard()
    };
    const horde = {
      cls: "wh-ctx-tohorde", label: "☠ Превратить в Орду",
      onClick: () => convertActorToHorde(this.actor)
    };

    if (type === "character") {
      // Техножрец/Фактор Прибыли — имперские понятия; у Аэльдари (и ветвей)
      // их не показывали и в старом блоке СТАТУС (там же — Мировоззрение).
      const aeldari = isAeldariRace(this.actor.system.race);
      const accessKeys = ["possessed", "isPsyker", ...(aeldari ? [] : ["isTechpriest"])];
      return [
        wizard, this._bodyTypeSubmenu(), { sep: true },
        ...(aeldari ? [] : [this._alignmentSubmenu(), { sep: true }]),
        ...this._advancePricingEntries(), { sep: true },
        this._accessSubmenu(accessKeys),
        ...this._sheetToggleEntries(["craftAvailable", ...(aeldari ? [] : ["isRogueTrader"])]),
        horde
      ].filter(Boolean);
    }
    if (type === "daemon") {
      return [...this._sheetToggleEntries(["isPsyker", "craftAvailable"]), horde];
    }
    if (type === "demonPrince") {
      return this._sheetToggleEntries(["isRogueTrader", "isPsyker", "craftAvailable"]);
    }
    if (type === "minion") {
      return [
        this._accessSubmenu(["isPsyker", "possessed", "isTechpriest"]),
        horde, this._bodyTypeSubmenu(),
        ...this._sheetToggleEntries(["craftAvailable"])
      ].filter(Boolean);
    }
    return [];
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
    this._applyChaosPatronTheme();

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
    activateSocialListeners(html, this.actor, {
      editable: this.isEditable,
      resolveOtherTargetActor: () => this._resolveOtherTargetActor()
    });

    activatePsychicListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts),
      resolveSoulBurn: _resolveSoulBurn
    });

    activateTechListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts)
    });

    // ── Ритуалы (стр. 393-425): добавление предмета + «Провести ритуал» ────
    activateRitualListeners(html, this.actor);

    activateGearListeners(root, this.actor);

    // ── Вкладка БОЙ ───────────────────────────────────────────────────────
    activateCombatListeners(root, this.actor);

    // ── Блок «ВЕРХОМ» там же (стр. 477-478) ───────────────────────────────
    activateMountPanelListeners(root, this.actor, { editable: this.isEditable });

    // ── Блок «ПАТРОН» / «ПРОТЕЖЕ» на СОЦИУМ (wdbc-yo6r) ────────────────────
    activatePatronPanelListeners(root, this.actor, { editable: this.isEditable });

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

  /**
   * Галочки модификаторов Навыка от НАДЕТОЙ брони (Heavy/Stealthed и подобные
   * свойства из закрытого реестра ARMOR_PROPERTIES, wdbc-vzyi) — вычисляются
   * на лету из system.properties[] каждого предмета, авторства на предмете не
   * требуют: одна правка реестра (constants/items.mjs) действует сразу на всю
   * текущую и будущую броню с этим свойством. Отдельно от _itemRollModsHtml
   * (та читает ЯВНО записанный flags.rollMods, этот источник — вычисляемый).
   */
  _armorSkillModsHtml(context) {
    if (context.kind !== "skill" || !context.skill) return { html: "", mods: [] };
    const groups = [];
    for (const it of this.actor.items) {
      if (it.type !== "armor" || !it.system.equipped) continue;
      const value = aggregateArmorSkillMods(resolveArmorProps(it))[context.skill];
      if (value) groups.push({ item: it, value });
    }
    if (!groups.length) return { html: "", mods: [] };
    const mods = groups.map(g => ({ value: g.value, label: g.item.name }));
    const rows = groups.map((g, i) => {
      const sign = g.value > 0 ? `+${g.value}` : `${g.value}`;
      return `<label class="attack-mod-check armor-roll-mod">
        <input type="checkbox" class="armor-mod" data-idx="${i}" data-value="${g.value}"/>
        <span>${esc(g.item.name)} <b>(${sign})</b></span></label>`;
    }).join("");
    return {
      mods,
      html: `<div class="atk-dlg-modifiers armor-mods">
        <div class="atk-mods-title">Броня</div>
        <div class="atk-mods-list">${rows}</div></div>`
    };
  }

  /**
   * Aspect (wdbc-8b5/wdbc-28ld, стр. 228): «−20 на ВСЕ тесты, пока носишь
   * броню без соответствующего Пути». Тот же общий диалог (_showSkillRollDialog
   * обслуживает и Навыки, и Характеристики — единственная точка входа
   * «любой тест», см. _rollCharacteristic ниже), поэтому не гейтится по
   * context.kind, в отличие от _armorSkillModsHtml (та — только Навыки).
   * R3-модификация брони снимает штраф не-Асуриан/Иннари — та же оговорка,
   * что у оружейного Aspect (attack-dialog.mjs): галочка, снимается вручную.
   */
  _armorAspectModHtml() {
    const groups = [];
    for (const it of this.actor.items) {
      if (it.type !== "armor" || !it.system.equipped) continue;
      if (!(it.system.properties || []).includes("aspect")) continue;
      const ratingText = it.system.propRatings?.aspect;
      if (!ratingText) continue;
      if (actorHasAspectPath(this.actor.system, ratingText)) continue;
      groups.push({ item: it, ratingText });
    }
    if (!groups.length) return { html: "", mods: [] };
    const mods = groups.map(g => ({ value: -20, label: g.item.name }));
    const rows = groups.map((g, i) => `<label class="attack-mod-check armor-roll-mod">
        <input type="checkbox" class="armor-aspect-mod" data-idx="${i}" data-value="-20"/>
        <span>${esc(g.item.name)}: нет Пути «${esc(g.ratingText)}» <b>(-20)</b></span></label>`).join("");
    return {
      mods,
      html: `<div class="atk-dlg-modifiers armor-mods">
        <div class="atk-mods-title">Броня (Aspect)</div>
        <div class="atk-mods-list">${rows}</div></div>`
    };
  }

  _showSkillRollDialog(label, baseTotal, defaultChar, hideCharSelect = false, rollContext = null, defaultKind = "base", { effectTargetActor = null, opposedRequest = null } = {}) {
    // targetActor (wdbc-1rno): раньше был только у атак (attack-dialog.mjs) —
    // обычный тест Навыка/Характеристики цель не нёс вовсе, и правила вида
    // «противник ПРОТИВ персонажа получает штраф» (targetHasTrait,
    // rules/predicates.mjs — уже существовал, но был мёртв за пределами
    // атак) не могли сработать. Тот же приём: первый выбранный таргет сцены.
    const targetActor = [...(game.user?.targets ?? [])][0]?.actor ?? null;

    // Делегированный тест (wdbc-uez7): effectTargetActor задан и отличается
    // от бросающего — this.actor тут ИСПОЛНИТЕЛЬ (его лист/модификаторы уже
    // во всём остальном диалоге), а effectTargetActor — тот, за кого просили
    // (его Таланты/Черты с областью ":recipient" поднимают/снижают Порог,
    // тот же механизм, что healing.mjs::patientHealingMod). Не делегированный
    // вызов effectTargetActor не передаёт вовсе — считаем, что тест «для себя».
    const delegating = !!effectTargetActor && effectTargetActor.id !== this.actor.id;
    const recipientMods = delegating
      ? resolveTest({ actor: effectTargetActor, kind: "skill", skill: rollContext?.skill, char: defaultChar, asRecipient: true }).mods
      : [];
    const recipientTotal = recipientMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
    const recipientNote = recipientMods.length
      ? `<div class="roll-dlg-note">${recipientMods.map(m => `${esc(m.label)} (${esc(effectTargetActor.name)}): ${m.value >= 0 ? "+" : ""}${m.value}`).join("<br/>")}</div>`
      : "";
    baseTotal += recipientTotal;
    const rollCtx = { kind: "skill", char: defaultChar, targetActor, ...(rollContext || {}) };
    // Встречные Запугивание/Пытки — тесты Морали по книге (wdbc-zepq).
    if (isMoraleOpposedSkill(rollCtx.skill)) rollCtx.morale = true;
    const hw = this._homeworldModsHtml(rollCtx);
    const im = this._itemRollModsHtml(rollCtx);
    const rl = this._ruleRollModsHtml(rollCtx);
    const am = this._armorSkillModsHtml(rollCtx);
    const aa = this._armorAspectModHtml();
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

    // Второй тест Комбинированного — тот же список характеристик с итогами,
    // что и у основного выбора: у Навыка/Характеристики он всегда есть,
    // остальные диалоги обходятся текстовым полем по умолчанию (см.
    // rules/test-kind-widget.mjs::testKindHtml).
    const combinedSecondHtml = `
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Второй тест:</label>
        <select id="combined-char-select">${charOptions}</select>
      </div>`;

    // Сумма модификатора: галочки Происхождения/предмета/правила + «ополовинить
    // штраф» + ассистенты. Отдельной функцией, а не только в callback кнопки —
    // её же использует живое предупреждение Автоуспеха/Автопровала ниже, и
    // расходиться этим двум местам нельзя.
    const modifierSumOf = formEl => {
      let modifier = parseInt(formEl.querySelector("#skill-modifier")?.value) || 0;
      let halve = false;
      for (const sel of [".hw-mod:checked", ".item-mod:checked", ".rule-mod:checked", ".armor-mod:checked", ".armor-aspect-mod:checked"]) {
        for (const cb of formEl.querySelectorAll(sel)) {
          modifier += parseInt(cb.dataset.value) || 0;
          if (cb.dataset.halve === "1") halve = true;
        }
      }
      if (halve && modifier < 0) modifier = -Math.floor(Math.abs(modifier) / 2);
      modifier += assistThresholdBonus(assistants.length);
      return modifier;
    };

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Проверка: ${label}` },
      classes: ["wh-roll-dialog-window"],
      position: { width: 340 },
      content: `
          <div class="wh-skill-roll-form">
            <div class="roll-dlg-header"><span>${label}</span></div>
            ${delegating ? `<div class="roll-dlg-note">📨 За <b>${esc(effectTargetActor.name)}</b> — бросаете листом <b>${esc(this.actor.name)}</b>.</div>` : ""}
            ${recipientNote}
            ${testKindHtml({ defaultKind, label, combinedSecondHtml, defaultCombinedTarget: defaultCharTotal })}
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
            ${am.html}
            ${aa.html}
            ${rr.html}
            ${diceModeHtml()}
            <div id="auto-outcome-note" class="roll-dlg-note"></div>
          </div>`,
      buttons: [
        {
          action: "roll", icon: "fas fa-dice-d10", label: "Бросок", default: true,
          callback: (event, button) => {
            const form = button.form;
            const val  = sel => form.querySelector(sel)?.value ?? null;
            const modifier = modifierSumOf(form);

            // Именной переброс (выдан правилом) важнее общего выбора Кубика —
            // если он есть, он и расходуется; иначе действует Преимущество/Помеха.
            const rerollEl = form.querySelector(".rule-reroll-opt:checked");
            const rerollIdx = parseInt(rerollEl?.dataset.idx ?? "-1");
            const namedReroll = rerollIdx >= 0
              ? { mode: rerollEl.dataset.mode, rolls: parseInt(rerollEl.dataset.rolls) || 2,
                  label: rerollEl.parentElement?.textContent?.trim() || "Переброс" }
              : null;
            const reroll = mergeReroll(namedReroll, readDiceChoice(val));
            const { kind, difficulty, combined, extended, opposed } = readTestKind(val, { label });

            // Авто-встречный (wdbc-j814): галочка читается напрямую, тем же
            // приёмом, что и чекбоксы модификаторов в modifierSumOf — val()
            // рассчитан на текстовые поля/select, не на checked.
            const opposedAutoChecked = !!form.querySelector("#opposed-auto")?.checked;
            const opposedAuto = (opposedAutoChecked && (kind === "opposed" || kind === "opposedSafe") && targetActor)
              ? { targetActorUuid: targetActor.uuid } : null;

            return {
              charKey:  form.querySelector("#skill-char-select")?.value,
              target:   parseInt(form.querySelector("#skill-target").value) || 0,
              modifier, difficulty, kind, combined, extended, opposed, opposedAuto,
              assistCount: assistants.length,
              reroll
            };
          }
        },
        // Делегирование (wdbc-uez7) — альтернатива «Бросок», не второй шаг
        // после него: запрос уходит СРАЗУ из этого колбэка, сам диалог просто
        // закрывается (false), ничего не бросая на этом клиенте. Не показан,
        // если этот диалог УЖЕ открыт делегированием (delegating), и не показан
        // ответчику встречного теста (opposedRequest, wdbc-j814) — цепочку
        // «делегировать делегированное/встречный ответ дальше» не поддерживаем.
        ...(delegating || opposedRequest ? [] : [{
          action: "delegate", icon: "fas fa-paper-plane", label: "📨 Делегировать",
          callback: async () => {
            await showDelegateTestPicker(this.actor, {
              title: `Делегировать: ${label}`, kind: "genericTest", label,
              buttonLabel: "Открыть тест",
              extra: {
                testKind: rollContext?.skill ? "skill" : "characteristic",
                skillKey: rollContext?.skill ?? null, charKey: defaultChar,
                label, hideCharSelect
              }
            });
            return false;
          }
        }]),
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
        const charSelectEl = root.querySelector("#skill-char-select");

        // ── Автоуспех/Автопровал по итоговому Порогу — сам порог у этого
        // диалога свой (Цель/Модификатор/Сложность/усталость/шлем/броня),
        // остальное (показ подблоков Вида, прогресс банка Расширенного) —
        // общее для любого диалога броска, см. rules/test-kind-widget.mjs.
        const currentCharKey = () => hideCharSelect ? defaultChar : (charSelectEl?.value || defaultChar);
        const { updateAutoOutcomeNote } = wireTestKindLive(root, {
          actor: this.actor, label,
          getBaseEff: () => {
            const target     = parseInt(root.querySelector("#skill-target")?.value) || 0;
            const modifier    = modifierSumOf(root);
            const difficulty = parseInt(root.querySelector("#test-difficulty")?.value) || 0;
            const charKey = currentCharKey();
            return target + modifier + difficulty
              + this._getFatiguePenalty(charKey)
              + this._getMarchPenalty(charKey)
              + this._getHelmetlessBonus(charKey)
              + disabledArmourPenalty(this.actor, { charKey, skillKey: rollContext?.skill })
              + inventoryOverloadPenalty(this.actor, { charKey, skillKey: rollContext?.skill });
          }
        });

        charSelectEl?.addEventListener("change", ev => {
          root.querySelector("#skill-target").value =
            (this.actor.system.characteristics[ev.currentTarget.value]?.total ?? 0) + rankBonus;
          updateAutoOutcomeNote();
        });

        // Авто-встречный тест (wdbc-j814): галочка видна, только когда есть
        // таргет сцены — таргет не меняется, пока диалог открыт, поэтому
        // подпись достаточно выставить один раз при рендере, без слушателя.
        if (targetActor) {
          const autoRow = root.querySelector("#opposed-auto-row");
          const autoLabel = root.querySelector("#opposed-auto-label");
          if (autoRow && autoLabel) {
            const owner = activeOwnerOf(targetActor);
            autoLabel.textContent = owner
              ? `📨 Запросить бросок у «${owner.name}» (${targetActor.name})`
              : `🎲 Бросить за «${targetActor.name}» автоматически`;
            autoRow.hidden = false;
          }
        }
        root.querySelector("#skill-target")?.addEventListener("input", updateAutoOutcomeNote);
        root.querySelector("#skill-modifier")?.addEventListener("input", updateAutoOutcomeNote);
        root.querySelectorAll(".hw-mod, .item-mod, .rule-mod, .armor-mod, .armor-aspect-mod").forEach(cb =>
          cb.addEventListener("change", updateAutoOutcomeNote));

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
          updateAutoOutcomeNote();
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

  /**
   * Встречный тест — соперник (wdbc-j814). Соперник — NPC без активного
   * игрока: бросаем за него тут же и отдаём готовый {threshold, roll}, дальше
   * всё как при ручном вводе. Соперник с активным владельцем: opposed
   * оставляем пустым (сравнение придёт отдельным сообщением позже) и отдаём
   * opponentActor — вызывающий метод после отправки СВОЕГО сообщения попросит
   * его сделать встречный бросок (_sendOpposedRequest).
   */
  async _resolveOpposedAuto(opposedAuto, { skillKey = null, charKey } = {}) {
    if (!opposedAuto?.targetActorUuid) return { opposed: null, opponentActor: null };
    const opponentActor = await fromUuid(opposedAuto.targetActorUuid).catch(() => null);
    if (!opponentActor) {
      ui.notifications?.warn("Цель встречного теста не найдена (удалена/сцена сменилась) — впишите Порог/Бросок соперника вручную.");
      return { opposed: null, opponentActor: null };
    }
    if (activeOwnerOf(opponentActor)) return { opposed: null, opponentActor };
    const threshold = skillKey ? skillTotal(opponentActor, skillKey) : (opponentActor.system.characteristics?.[charKey]?.total ?? 0);
    const roll = await new Roll("1d100").evaluate();
    return { opposed: { threshold, roll: roll.total }, opponentActor: null };
  }

  /** Запрос встречного броска сопернику-игроку — payload несёт УЖЕ готовую
   *  сторону инициатора, опенер "opposedResponse" (hooks.mjs) считает
   *  сравнение сам, сразу после своего броска, без обратной связи. */
  async _sendOpposedRequest(opponentActor, { label, kind, testKind, skillKey, charKey, hideCharSelect, baseEff, rv, outcome }) {
    await requestDelegatedTest({
      requesterActor: this.actor, executorActor: opponentActor, effectTargetActor: opponentActor,
      kind: "opposedResponse", label, buttonLabel: "Бросить встречный",
      extra: {
        testKind, skillKey, charKey, hideCharSelect: !!hideCharSelect,
        initiatorName: this.actor.name, initiatorLabel: label,
        initiatorSide: { threshold: baseEff, roll: rv, success: outcome.success, deg: outcome.deg },
        safe: kind === "opposedSafe"
      }
    });
  }

  /** Ответ соперника (opposedRequest пришёл через опенер "opposedResponse") —
   *  публикует готовую карточку сравнения, видимую обеим сторонам. */
  async _maybePostOpposedComparison(opposedRequest, { label, baseEff, rv, outcome }) {
    if (!opposedRequest) return;
    const theirs = { deg: outcome.deg, success: outcome.success, threshold: baseEff };
    const result = resolveOpposed(opposedRequest.initiatorSide, theirs, { safe: opposedRequest.safe });
    const content = opposedComparisonHtml({
      label, mineName: opposedRequest.initiatorName, mine: opposedRequest.initiatorSide,
      theirsName: this.actor.name, theirs: { threshold: baseEff, roll: rv }, result
    });
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: this.actor }), sound: CONFIG.sounds.dice });
  }

  // ── Бросок навыка ─────────────────────────────────────────────────────────

  async _rollSkill(label, baseTotal, defaultChar, rollContext = null, { effectTargetActor = null, opposedRequest = null } = {}) {
    const result = await this._showSkillRollDialog(label, baseTotal, defaultChar, false, rollContext, "base", { effectTargetActor, opposedRequest });
    if (!result) return;
    const { charKey, target, modifier, difficulty = 0, kind = "base", combined, extended, opposed, opposedAuto,
             assistCount = 0, reroll = null } = result;
    // Делегированный тест (wdbc-uez7): эффект/последствия — на effectTargetActor
    // (тот, за кого просили), сам бросок и его штрафы за состояние тела/снаряжения
    // (Усталость/Марш/Броня/Перевес) — на this.actor (кто физически бросает).
    const effectActor = effectTargetActor ?? this.actor;

    const fatiguePenalty = this._getFatiguePenalty(defaultChar);
    const marchPen = this._getMarchPenalty(defaultChar);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);
    // Выключенная силовая броня: −10 физическому действию, −40 Уклонению/
    // Парированию (стр. 233) — skill берётся из rollContext, если он у этого
    // навыка есть (Dodge/Parry передают его отдельным ключом, не через charKey).
    const armourPenalty = disabledArmourPenalty(this.actor, { charKey, skillKey: rollContext?.skill });
    // Перевес общего инвентаря (стр. 27, wdbc-2l3x) — независимый от брони источник.
    const overloadPenalty = inventoryOverloadPenalty(this.actor, { charKey, skillKey: rollContext?.skill });

    // Мод препаратов уже входит в target (через char.total → итог навыка)
    const baseEff  = target + modifier + difficulty + fatiguePenalty + marchPen + helmetBonus + armourPenalty + overloadPenalty;
    // Переброс: бросаем сколько сказано и оставляем один. Какой именно —
    // решает rules/reroll-pick.mjs: на d100 «лучший» это МЕНЬШИЙ, и это знание
    // держится в одном месте, а не переписывается на каждом месте броска.
    const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);
    const charAbbr = CHARACTERISTICS[charKey]?.abbr ?? charKey;
    const rollMode = game.settings.get("core", "rollMode");

    // Авто-встречный тест (wdbc-j814): ручные поля (opposed) в приоритете —
    // галочка их не перезаписывает, если что-то уже вписано вручную.
    let finalOpposed = opposed;
    let opposedOpponent = null;
    if (!finalOpposed && opposedAuto) {
      const auto = await this._resolveOpposedAuto(opposedAuto, { skillKey: rollContext?.skill, charKey });
      finalOpposed = auto.opposed;
      opposedOpponent = auto.opponentActor;
    }
    const pendingOpponentNote = opposedOpponent
      ? `<div class="roll-dlg-note">⏳ Ждём встречный бросок игрока «${esc(opposedOpponent.name)}»…</div>` : "";

    const outcome = await resolveKindOutcome(effectActor, {
      kind, baseEff, rv, combined, extended, opposed: finalOpposed,
      ctx: { actor: effectActor, kind: "skill", char: charKey, skill: rollContext?.skill,
             morale: isMoraleOpposedSkill(rollContext?.skill),
             targetActor: [...(game.user?.targets ?? [])][0]?.actor ?? null }
    });
    if (isMoraleOpposedSkill(rollContext?.skill)) {
      await applyLordOfExoditesFailPenalty(this.actor, {
        dof: outcome.success ? 0 : outcome.deg, usedReroll: !!reroll
      });
    }
    // Ассистенты добавляют степень только к успеху — см. rules/assists.mjs.
    const deg      = assistDegrees(outcome.deg, assistCount, outcome.success);
    const outcomeHtml = outcome.success
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label}${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""}${effectTargetActor ? ` — за ${esc(effectTargetActor.name)}` : ""}</div>
          <div class="roll-threshold">
            ${charAbbr}: <b>${target}</b>${modStr}
            ${difficulty !== 0 ? ` ${difficulty >= 0 ? "+" : ""}${difficulty} (📊 Сложность)` : ""}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${marchPen !== 0 ? ` ${marchPen} (🏃 Марш)` : ""}
            ${armourPenalty !== 0 ? ` ${armourPenalty} (🔌 Броня выключена)` : ""}
            ${overloadPenalty !== 0 ? ` ${overloadPenalty} (◈ Перевес инвентаря)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${baseEff}</b>
          </div>
          ${outcome.combinedLine}
          ${assistCount ? `<div class="roll-threshold">🤝 Ассистенты: <b>${assistCount}</b> (+${assistThresholdBonus(assistCount)} к порогу${outcome.success ? `, +${assistCount} к степени` : ""})</div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          ${rerollNote}
          ${outcome.critLine}
          <div class="roll-outcome">${outcomeHtml}</div>
          ${outcome.extendedLine}
          ${outcome.opposedLine}
          ${pendingOpponentNote}
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);

    if (opposedOpponent) {
      await this._sendOpposedRequest(opposedOpponent, {
        label, kind, testKind: rollContext?.skill ? "skill" : "characteristic",
        skillKey: rollContext?.skill ?? null, charKey, hideCharSelect: false,
        baseEff, rv, outcome
      });
    }
    await this._maybePostOpposedComparison(opposedRequest, { label, baseEff, rv, outcome });
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

  async _rollCharacteristic(label, abbr, threshold, charKey, hideCharSelect = false, { effectTargetActor = null, opposedRequest = null } = {}) {
    const result = await this._showSkillRollDialog(label, threshold, charKey, hideCharSelect, null, "base", { effectTargetActor, opposedRequest });
    if (!result) return;
    const { target, modifier, difficulty = 0, kind = "base", combined, extended, opposed, opposedAuto,
             assistCount = 0, reroll = null } = result;
    const effectActor = effectTargetActor ?? this.actor;

    const fatiguePenalty = this._getFatiguePenalty(charKey);
    const marchPen = this._getMarchPenalty(charKey);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);
    // Выключенная силовая броня: −10 физической характеристике (стр. 233).
    const armourPenalty = disabledArmourPenalty(this.actor, { charKey });
    // Перевес общего инвентаря (стр. 27, wdbc-2l3x) — независимый от брони источник.
    const overloadPenalty = inventoryOverloadPenalty(this.actor, { charKey });

    // Мод препаратов уже входит в target (через char.total)
    const baseEff  = target + modifier + difficulty + fatiguePenalty + marchPen + helmetBonus + armourPenalty + overloadPenalty;
    // Переброс/Преимущество/Помеха — тот же путь, что у теста Навыка
    // (rules/reroll-pick.mjs::pickReroll); раньше здесь бросался только один
    // d100 и выбор диалога тихо игнорировался (см. ревизию главы «Тесты»).
    const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);
    const rollMode = game.settings.get("core", "rollMode");

    // Авто-встречный тест (wdbc-j814) — см. _rollSkill, тот же приём.
    let finalOpposed = opposed;
    let opposedOpponent = null;
    if (!finalOpposed && opposedAuto) {
      const auto = await this._resolveOpposedAuto(opposedAuto, { charKey });
      finalOpposed = auto.opposed;
      opposedOpponent = auto.opponentActor;
    }
    const pendingOpponentNote = opposedOpponent
      ? `<div class="roll-dlg-note">⏳ Ждём встречный бросок игрока «${esc(opposedOpponent.name)}»…</div>` : "";

    const outcome = await resolveKindOutcome(effectActor, {
      kind, baseEff, rv, combined, extended, opposed: finalOpposed,
      ctx: { actor: effectActor, kind: "skill", char: charKey }
    });
    // Ассистенты добавляют степень только к успеху — см. rules/assists.mjs.
    const deg      = assistDegrees(outcome.deg, assistCount, outcome.success);
    const outcomeHtml = outcome.success
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${abbr} — ${label}${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""}${effectTargetActor ? ` — за ${esc(effectTargetActor.name)}` : ""}</div>
          <div class="roll-threshold">
            Цель: <b>${target}</b>${modStr}
            ${difficulty !== 0 ? ` ${difficulty >= 0 ? "+" : ""}${difficulty} (📊 Сложность)` : ""}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${marchPen !== 0 ? ` ${marchPen} (🏃 Марш)` : ""}
            ${armourPenalty !== 0 ? ` ${armourPenalty} (🔌 Броня выключена)` : ""}
            ${overloadPenalty !== 0 ? ` ${overloadPenalty} (◈ Перевес инвентаря)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${baseEff}</b>
          </div>
          ${outcome.combinedLine}
          ${assistCount ? `<div class="roll-threshold">🤝 Ассистенты: <b>${assistCount}</b> (+${assistThresholdBonus(assistCount)} к порогу${outcome.success ? `, +${assistCount} к степени` : ""})</div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          ${rerollNote}
          ${outcome.critLine}
          <div class="roll-outcome">${outcomeHtml}</div>
          ${outcome.extendedLine}
          ${outcome.opposedLine}
          ${pendingOpponentNote}
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);

    if (opposedOpponent) {
      await this._sendOpposedRequest(opposedOpponent, {
        label, kind, testKind: "characteristic", skillKey: null, charKey, hideCharSelect,
        baseEff, rv, outcome
      });
    }
    await this._maybePostOpposedComparison(opposedRequest, { label, baseEff, rv, outcome });
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

