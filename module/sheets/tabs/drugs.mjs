// module/sheets/tabs/drugs.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Препараты: тест зависимости. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { _degWord, resolveCharFormula, esc } from "../../helpers/utils.mjs";
import { conditionAdjustFields, conditionApplyFields, conditionRemoveFields,
         fatigueChangeFields, announceFatigueChange } from "./conditions.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { expiryAtFor } from "../../rules/drug-expiry.mjs";
import { computeWoundHealing } from "./wounds.mjs";
import { woundLossUpdates } from "../../rules/wounds.mjs";
import { conditionLevelField, CONDITIONS } from "../../constants/conditions.mjs";
import { maybeGrantEnjoymentPain } from "../../combat/enjoyment.mjs";
import { isAlcoholItem, applyAlcoholDrink } from "../../combat/alcohol.mjs";
import { noteWoundsRestored, woundsRestored } from "../../combat/heal-target.mjs";
import { postTestCard, rollStatLine } from "../../helpers/test-card.mjs";
import { hasRuleFlag, ruleFlagLabels } from "../../rules/flags.mjs";
import { DRUG_AFTERMATH_IMMUNE_CAPABILITY, POISON_IMMUNE_CAPABILITY } from "../../rules/naga-traits.mjs";
import { ALCHEM_MONSTER, alchemDurationFactor, mustRerollSuccess } from "../../rules/replicant.mjs";
import { isReplicantSerum, takeSerum } from "../../combat/replicant.mjs";
// Snake Eater / Пожиратель Змей (Талант Стойкости, глава 3): урон ядов и
// длительность ядов/пост-эффектов вдвое меньше (окр.▲).
import { snakeEaterHalve, hasResilienceTalent } from "../../rules/resilience-talents.mjs";
import { DRUG_DOSES_FLAG, doseKey, logDose, dosesThisWeek, weeklyDoseLimit, addictionCheckFor, isHookedUp, hookUpMinDose } from "../../rules/drug-doses.mjs";
// Зависимость: комбинированный тест, частота приёма, штраф без дозы, срыв (wdbc-gyqf2).
import { addictionTestParts, lowestPart, parseFrequency, readWithdrawalEntries, drugKey, breakTestState, breakTestMod, addictionRecords,
         isAddictedTo, withdrawalStatusLabel } from "../../rules/drug-withdrawal.mjs";
import { startWithdrawal, endWithdrawal, markBreakTested } from "../../combat/drug-withdrawal.mjs";
// New Men / Новые Люди (Йигори): срок вдвое, без пост-эффекта, разовый эффект
// медикамента вдвое (module/rules/new-men.mjs).
import { newMenDrugDuration, newMenInstantMedicine, halvesInstantMedicine,
         ignoresDrugSideEffects, halveDown } from "../../rules/new-men.mjs";

// wdbc-1rno (кластер Дары Богов — Слаанеш): «Владыка Праздности» — «Персонаж
// приобретает иммунитет к любым пост-эффектам и зависимостям от употребления
// наркотиков». Тест Зависимости (rollAddictionTest ниже) — единственное место
// движка, где вообще возникает зависимость (запись флага актора
// drugWithdrawal, раньше — system.addiction.isAddicted)/состояние
// "addicted" — им и гасим: обладатель Дара никогда не проваливает и никогда
// не остаётся зависимым, каким бы ни был бросок. «Никаких негативных
// эффектов от еды (включая яды в пище)» и «не набирает вес от обжорства» —
// не смоделированы: в системе нет ни механики яда именно ЧЕРЕЗ еду (Toxic —
// общее свойство оружия/укуса, не пищи), ни трекера веса тела персонажа
// (rig.mjs весит только снаряжение) — читать/гасить нечего, честно остаётся
// текстом Дара (capabilities.mjs).
export const LORD_OF_SLOTH_CAPABILITY = "gift.slaanesh.lordOfSloth";

/**
 * Откуда у актора иммунитет к пост-эффектам и зависимости от наркотиков —
 * подпись для карточки, или "" (иммунитета нет). Два источника с одним и тем
 * же книжным текстом: Дар Слаанеш «Владыка Праздности» и Изуверская
 * Физиология Наги (rules/naga-traits.mjs, та же фраза у Сслита).
 */
export function drugAftermathImmunity(actor) {
  if (hasRuleFlag(actor, LORD_OF_SLOTH_CAPABILITY)) return "Дар Слаанеш «Владыка Праздности»";
  if (hasRuleFlag(actor, DRUG_AFTERMATH_IMMUNE_CAPABILITY)) {
    return ruleFlagLabels(actor, DRUG_AFTERMATH_IMMUNE_CAPABILITY)[0] || "Иммунитет к пост-эффектам";
  }
  return "";
}

const DELIVERY_RU = {
  injection: "Инъекция",
  gas: "Газ/Аэрозоль",
  liquid: "Жидкость",
  smoke: "Курение",
  patch: "Припарка",
  pill: "Таблетка",
  food: "Еда",
  wound: "Рана",
  contact: "Контакт",
  gas_contact: "Газ-Контакт",
  gas_eye: "Газ-Глаза"
};

const DRUG_CATEGORY_ICON = {
  medicine: "💊",
  narcotic: "💉",
  poison: "☠️",
  elixir: "⚗️"
};

function rollTermsExpression(roll, fallback = "") {
  if (!roll.terms) return fallback;
  const parts = [];
  for (const term of roll.terms) {
    if (term.results) {
      const sum = term.results
        .filter(r => r.active)
        .reduce((acc, r) => acc + r.result, 0);
      parts.push(`[${sum}]`);
    } else if (term.operator !== undefined) {
      parts.push(term.operator);
    } else if (term.number !== undefined) {
      parts.push(String(term.number));
    }
  }
  return parts.join("");
}

function rollTermsText(roll, total) {
  const expression = rollTermsExpression(roll);
  return expression ? `${expression} = ${total}` : String(total);
}

/**
 * Применяет «доп.» (мульти-) эффекты блока к цели: снятие Обескровливания,
 * лечение по формуле, доп. Усталость, непоглощаемый урон в Раны.
 */
export async function applyEffectExtras(target, fx, { halveHeal = false, poisonSource = false } = {}) {
  const updates = {};
  const lines = [];
  const rolls = [];
  if (!fx) return { updates, lines, rolls };
  const chars = target.system.characteristics;

  if (fx.removesHaemorrhagingLevels > 0) {
    Object.assign(updates, conditionAdjustFields(target, "haemorrhaging", -fx.removesHaemorrhagingLevels));
    lines.push(`${rollIcon("blood","#ff6b6b")}Снято ур. Обескровливания: <b>${fx.removesHaemorrhagingLevels}</b>`);
  }

  if (fx.healFormula) {
    try {
      const r = await new Roll(resolveCharFormula(fx.healFormula, chars)).evaluate();
      rolls.push(r);
      // Разовый эффект медикамента у Нового Человека — вдвое (окр.▼).
      const healed = halveHeal ? halveDown(r.total) : r.total;
      Object.assign(updates, computeWoundHealing(target.system, healed));
      lines.push(`${rollIcon("heart","#ff8a8a")}Лечение: <b>${fx.healFormula}</b> = <b>${r.total}</b>${halveHeal ? ` → Новые Люди: вдвое = <b>${healed}</b>` : ""}`);
    } catch(e) {
      console.error("healFormula:", e);
    }
  }

  // Доп. Усталость НЕ пишется в updates, а отдаётся дельтой (wdbc-x1nz.2.95):
  // applyDrug/triggerAfterEffect складывают её со своими изменениями
  // Усталости и пишут ОДИН патч через fatigueChangeFields (порог обморока,
  // Саркофаг). Раньше каждая ветка писала fatigue.value поверх соседней.
  let fatigueDelta = 0;
  if (fx.grantsFatigue > 0) {
    fatigueDelta = Number(fx.grantsFatigue) || 0;
    lines.push(`${rollIcon("warn","#ffb84d")}Усталость +<b>${fx.grantsFatigue}</b>`);
  }

  if (fx.woundDamage) {
    try {
      const r = await new Roll(resolveCharFormula(fx.woundDamage, chars)).evaluate();
      rolls.push(r);
      // Пожиратель Змей: «получаемый урон от ядов вдвое меньше (окр.▲)» — урон яда (категория poison).
      const dealt = poisonSource ? snakeEaterHalve(target, r.total) : r.total;
      Object.assign(updates, woundLossUpdates(target.system, dealt));
      lines.push(`${rollIcon("burst","#ff6b6b")}Непоглощаемый урон в Раны: <b>${fx.woundDamage}</b> = <b style="color:#8b0000;">${r.total}</b>${dealt !== r.total ? ` → Пожиратель Змей: <b style="color:#8b0000;">${dealt}</b>` : ""}`);
    } catch(e) {
      console.error("woundDamage:", e);
    }
  }

  return { updates, lines, rolls, fatigueDelta };
}

/**
 * Все изменения Усталости одного препарата — одним патчем через
 * fatigueChangeFields (wdbc-x1nz.2.95): снятие уровней, «снять Усталость
 * целиком», наложение и доп. Усталость из applyEffectExtras. Раньше каждая
 * ветка читала старое значение и писала своё поверх соседней, и ни одна не
 * проверяла порог обморока.
 * @returns {object|null} итог fatigueChangeFields (для announceFatigueChange) или null — Усталость не трогается
 */
function drugFatigueChange(actor, { delta = 0, zero = false, touched = false } = {}) {
  if (!touched) return null;
  const base = zero ? 0 : (Number(actor.system.fatigue?.value) || 0);
  return fatigueChangeFields(actor, base + delta);
}

export async function applyDrug(owner, item, recipient = null) {
  const sys = item.system;
  const actor = recipient || owner;
  const applyToOther = actor !== owner;
  const qty = (sys.quantity || 0) - 1;

  if (qty < 0) {
    ui.notifications.warn(`Препарат «${item.name}» закончился!`);
    return;
  }

  // Иммунитет к ядам (Изуверская Физиология Наги и т.п., rules/naga-traits.mjs):
  // доза яда потрачена, но на этого получателя не действует вовсе.
  if (sys.drugCategory === "poison" && hasRuleFlag(actor, POISON_IMMUNE_CAPABILITY)) {
    await item.update({ "system.quantity": qty });
    const src = ruleFlagLabels(actor, POISON_IMMUNE_CAPABILITY)[0] || "Иммунитет к ядам";
    await postTestCard(owner, {
      icon: rollIcon("shield", "#4dffa6"), title: `${esc(item.name)} → ${esc(actor.name)}`,
      threshold: `<div class="roll-threshold">${esc(src)} — иммунитет к ядам.</div>`,
      rv: "—", outcome: `<span class="roll-success">Яд не действует (доза потрачена, осталось: ${qty}).</span>`
    }, { sound: false });
    return;
  }

  let resolvedRounds = 0;
  let rolledRounds = 0;   // срок до поправок получателя — по нему масштабируется срок по часам
  let durationRollStr = "";
  let durationRoll = null;

  if (sys.duration) {
    const chars = actor.system.characteristics;
    const resolvedFormula = resolveCharFormula(sys.duration, chars, actor.system.corruptionBonus ?? 0);

    try {
      durationRoll = await new Roll(resolvedFormula).evaluate();
      resolvedRounds = durationRoll.total;
      rolledRounds = resolvedRounds;
      durationRollStr = rollTermsText(durationRoll, resolvedRounds);
      // Новые Люди: «время действия любого яда, наркотика или медикамента
      // вдвое (окр.▼)» — срок режется у ПОЛУЧАТЕЛЯ, а не у применившего.
      const halved = newMenDrugDuration(actor, resolvedRounds);
      if (halved !== resolvedRounds) {
        durationRollStr += ` → Новые Люди: вдвое = ${halved}`;
        resolvedRounds = halved;
      }
    } catch(e) {
      console.warn(`Не удалось бросить формулу длительности: ${sys.duration}`, e);
      durationRollStr = sys.duration;
    }
  }

  // Пожиратель Змей: «длительность Отравления, эффектов ядов … вдвое меньше
  // (окр.▲)» — срок яда режется у ПОЛУЧАТЕЛЯ.
  if (sys.drugCategory === "poison" && resolvedRounds && hasResilienceTalent(actor, "snakeEater")) {
    const halvedSnake = snakeEaterHalve(actor, resolvedRounds);
    if (halvedSnake !== resolvedRounds) {
      durationRollStr += ` → Пожиратель Змей: вдвое (окр.▲) = ${halvedSnake}`;
      resolvedRounds = halvedSnake;
    }
  }

  // Alchem Monster / Алхимическое Чудовище (Репликант): «удваивает
  // длительность всех наркотиков и ядов на себя» — на ПОЛУЧАТЕЛЕ, не на том,
  // кто вколол (rules/replicant.mjs).
  const durationFactor = alchemDurationFactor(sys.drugCategory, hasRuleFlag(actor, ALCHEM_MONSTER));
  if (durationFactor !== 1 && resolvedRounds) {
    resolvedRounds *= durationFactor;
    durationRollStr = `${durationRollStr} ×${durationFactor} (Алхимическое Чудовище) = ${resolvedRounds}`;
  }

  // Срок по игровому времени (поле gameMinutes, rules/drug-expiry.mjs): те же
  // поправки получателя, что у срока выше (Новые Люди вдвое, Пожиратель Змей,
  // Алхимическое Чудовище), — пропорционально ему. null — вручную.
  const gameMinutes = (Number(sys.gameMinutes) || 0) * (rolledRounds > 0 ? resolvedRounds / rolledRounds : 1);
  const expiresAt = expiryAtFor({ gameMinutes }, game.time.worldTime);

  const itemUpdates = {
    "system.quantity": qty,
    "system.activeEffect.isActive": true,
    "system.activeEffect.isAfterEffect": false,
    "system.activeEffect.appliedAt": game.time.worldTime,
    "system.activeEffect.expiresAt": expiresAt,
    "system.activeEffect.roundsRemaining": resolvedRounds,
    "system.activeEffect.charDamageStat": "",
    "system.activeEffect.charDamageAmount": 0
  };

  const actorUpdates = {};
  // Новые Люди: мгновенный/разовый эффект МЕДИКАМЕНТА вдвое (окр.▼) — числа
  // в карточке ниже берутся уже из урезанного набора.
  const fx = newMenInstantMedicine(actor, sys.drugCategory, sys.specialEffects || {});
  const halveHeal = halvesInstantMedicine(actor, sys.drugCategory);

  if (fx.removesBleedingLevels > 0) {
    Object.assign(actorUpdates, conditionAdjustFields(actor, "bleeding", -fx.removesBleedingLevels));
  }

  // Усталость копится здесь и пишется одним патчем ниже (drugFatigueChange).
  const fat = { delta: 0, zero: false, touched: false };
  if (fx.removesFatigueLevels > 0) {
    // «Усталость» — зеркало system.fatigue.value (rules/character.mjs), тег
    // сам пересчитается из него; conditionAdjustFields на "fatigued" — no-op.
    fat.delta -= fx.removesFatigueLevels;
    fat.touched = true;
  }

  if (fx.removesWounds > 0) {
    Object.assign(actorUpdates, computeWoundHealing(actor.system, fx.removesWounds));
  }

  if (fx.removesCondition) {
    const lvlToRemove = fx.removesConditionLevel || 0;
    Object.assign(actorUpdates, lvlToRemove > 0
      ? conditionAdjustFields(actor, fx.removesCondition, -lvlToRemove)
      : conditionRemoveFields(fx.removesCondition));
    if (fx.removesCondition === "fatigued") {
      if (lvlToRemove > 0) fat.delta -= lvlToRemove; else fat.zero = true;
      fat.touched = true;
    }
  }

  if (fx.removesRadiation) {
    Object.assign(actorUpdates, conditionRemoveFields("radiation"));
  }

  if (fx.grantsCondition) {
    const lvlToGrant  = fx.grantsConditionLevel ?? 1;
    const levelField  = conditionLevelField(fx.grantsCondition);
    const curLvl      = levelField ? (actor.system.conditions?.[levelField] || 0) : 0;
    Object.assign(actorUpdates, conditionApplyFields(fx.grantsCondition, levelField ? curLvl + lvlToGrant : null, actor));
    if (fx.grantsCondition === "fatigued") {
      fat.delta += lvlToGrant;
      fat.touched = true;
    }
  }

  if (fx.counteractsDrugs) {
    for (const drugItem of actor.items.filter(
      i => i.type === "drug" && i.id !== item.id && i.system.activeEffect?.isActive
    )) {
      await drugItem.update({
        "system.activeEffect.isActive": false,
        "system.activeEffect.isAfterEffect": false,
        "system.activeEffect.roundsRemaining": 0,
        "system.activeEffect.charDamageStat": "",
        "system.activeEffect.charDamageAmount": 0
      });
    }
  }

  const extras = await applyEffectExtras(actor, fx, { halveHeal, poisonSource: sys.drugCategory === "poison" });
  Object.assign(actorUpdates, extras.updates);
  if (extras.fatigueDelta) { fat.delta += extras.fatigueDelta; fat.touched = true; }
  const fatRes = drugFatigueChange(actor, fat);
  if (fatRes) Object.assign(actorUpdates, fatRes.fields);

  // Раны до/после (Критические — Раны в минусе): вылечил ли препарат.
  const woundsBefore = { value: actor.system.wounds?.value, critical: actor.system.wounds?.critical };
  if (Object.keys(actorUpdates).length > 0) await actor.update(actorUpdates);
  if (fatRes) await announceFatigueChange(actor, fatRes);

  // Затронутый Варпом, «Недоверие к Лечению» (wdbc-1rno.26): Раны вылечил
  // препарат, вколотый ДРУГИМ, — штраф на час. Общая точка лечения Ран
  // (combat/heal-target.mjs) сама сверяет «не себе» и восстановление Ран.
  const mistrustNote = await noteWoundsRestored(actor, owner, woundsRestored(woundsBefore, actor.system.wounds));

  // Сыворотка Репликанта — отметка приёма у Крючка Сывороток получателя.
  if (isReplicantSerum(item)) await takeSerum(actor);

  // Enjoyment/Наслаждение (wdbc-sk8s): Наркотик триггерит, ТОЛЬКО когда его
  // применил кто-то другой (applyToOther) — не сам персонаж себе.
  if (applyToOther) await maybeGrantEnjoymentPain(actor);

  if (applyToOther) {
    await item.update({ "system.quantity": qty });

    const hasOngoing =
      sys.hasAfterEffect ||
      Object.values(sys.statMods || {}).some(v => typeof v === "number" && v !== 0);

    if (hasOngoing) {
      const drugData = item.toObject();
      delete drugData._id;
      drugData.system.quantity = 0;
      drugData.system.activeEffect = {
        isActive: true,
        isAfterEffect: false,
        appliedAt: game.time.worldTime,
        expiresAt,
        roundsRemaining: resolvedRounds,
        charDamageStat: "",
        charDamageAmount: 0
      };
      try {
        await Item.create(drugData, { parent: actor });
      } catch(e) {
        ui.notifications.error(`Не удалось применить «${item.name}» на ${actor.name} (нет прав на изменение цели?).`);
        console.error(e);
      }
    }
  } else {
    await item.update(itemUpdates);
  }

  const categoryIcon = DRUG_CATEGORY_ICON[sys.drugCategory] || "💊";
  const statModParts = [];
  for (const [key, value] of Object.entries(sys.statMods || {})) {
    if (value && value !== 0) statModParts.push(`${key.toUpperCase()} ${value > 0 ? "+" : ""}${value}`);
  }

  let chatContent = `<div class="wh-roll-result">
    <div class="roll-header">${categoryIcon} ${esc(item.name)}</div>`;

  if (applyToOther) {
    chatContent += `<div class="roll-threshold">${rollIcon("target","#4dffa6")}Применил: <b>${esc(owner.name)}</b> → <b>${esc(actor.name)}</b></div>`;
  }
  if (sys.deliveryMethod) {
    chatContent += `<div class="roll-threshold">Приём: <b>${DELIVERY_RU[sys.deliveryMethod] ?? sys.deliveryMethod}</b></div>`;
  }
  if (sys.duration) {
    chatContent += durationRollStr
      ? `<div class="roll-threshold">⏱ Длительность: <b>${sys.duration}</b> → <b>${durationRollStr}</b> раундов/минут</div>`
      : `<div class="roll-threshold">⏱ Длительность: <b>${sys.duration}</b></div>`;
  }
  if (sys.effect) {
    chatContent += `<div class="roll-outcome"><span class="roll-success">${rollIcon("bolt","#ffb84d")}Эффект: ${sys.effect}</span></div>`;
  }
  if (statModParts.length > 0) {
    chatContent += `<div class="roll-threshold">${rollIcon("chart","#8fd0ff")}Модификаторы: <b>${statModParts.join(", ")}</b></div>`;
  }

  if (fx.removesBleedingLevels > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("blood","#ff6b6b")}Снято ур. Кровотечения: <b>${fx.removesBleedingLevels}</b></div>`;
  if (fx.removesFatigueLevels > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Снято ур. Усталости: <b>${fx.removesFatigueLevels}</b></div>`;
  if (fx.removesWounds > 0)
    chatContent += `<div class="roll-threshold">${rollIcon("heart","#ff8a8a")}Восстановлено Ран: <b>${fx.removesWounds}</b></div>`;
  for (const line of extras.lines)
    chatContent += `<div class="roll-threshold">${line}</div>`;
  if (fx.removesCondition) {
    const lvl = fx.removesConditionLevel || 0;
    chatContent += `<div class="roll-threshold">Снято${lvl > 0 ? ` ${lvl} ур.` : ""}: <b>${fx.removesCondition}</b></div>`;
  }
  if (fx.removesRadiation)
    chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Радиация снята</div>`;
  if (fx.grantsCondition) {
    const lvl = fx.grantsConditionLevel ?? 1;
    chatContent += `<div class="roll-threshold">${rollIcon("warn","#ff6b6b")}Наложено${lvl > 1 ? ` ${lvl} ур.` : ""}: <b>${fx.grantsCondition}</b></div>`;
  }
  if (fx.counteractsDrugs)
    chatContent += `<div class="roll-threshold">${rollIcon("spark","#6fe6ff")}Нейтрализует все активные препараты</div>`;
  if (fx.immuneToPoisons)
    chatContent += `<div class="roll-threshold">${rollIcon("shield","#4dffa6")}Иммунитет к ядам активен</div>`;
  if (fx.bonusVsPoisons && fx.bonusVsPoisons !== 0)
    chatContent += `<div class="roll-threshold">${rollIcon("shield","#4dffa6")}Бонус против ядов: <b>+${fx.bonusVsPoisons}</b></div>`;
  if (fx.customEffect)
    chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;
  if (mistrustNote)
    chatContent += `<div class="roll-threshold">${esc(mistrustNote)}</div>`;

  if (sys.hasAfterEffect && ignoresDrugSideEffects(actor)) {
    chatContent += `<div class="roll-threshold">${rollIcon("shield","#4dffa6")}Новые Люди: пост-эффект «${sys.afterEffect || "—"}» не наступит</div>`;
  } else if (sys.hasAfterEffect) {
    chatContent += `<div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}Пост-эффект: ${sys.afterEffect || "—"}`;
    if (sys.afterEffectDice) chatContent += ` [${sys.afterEffectDice}]`;
    chatContent += "</span></div>";
  }

  chatContent += `<div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">
    Осталось: ${qty}
  </div></div>`;

  // Карточка собрана выше построчно (набор строк зависит от того, что именно
  // препарат делает) — общий helpers/test-card.mjs берёт на себя публикацию:
  // говорящего, режим броска и звук (wdbc-kuun).
  const allRolls = [...(durationRoll ? [durationRoll] : []), ...extras.rolls];
  await postTestCard(owner, chatContent, { rolls: allRolls });
  // Алкоголь: счётчик Провалов опьянения (3-edc4 п.8, Декаданс удваивает пороги).
  if (isAlcoholItem(item)) await applyAlcoholDrink(actor, item);
  await weeklyDoseCheck(actor, item);
}

/**
 * Недельный счётчик доз (wdbc-gyqf2, rules/drug-doses.mjs): доза записывается в
 * журнал получателя, и если за скользящую неделю набрано минимальное опасное
 * число применений этого наркотика — тест Зависимости со штрафом −10 за каждое
 * применение сверх числа. Уже зависимого тест не нужен: он решает, сорвётся ли
 * (кнопка в панели Зависимостей). Лимит: Репликант ×2, Толерантность +1.
 */
export async function weeklyDoseCheck(actor, item) {
  const add = item?.system?.addiction;
  if (!actor || !add?.hasAddiction) return;
  const now = game.time?.worldTime ?? 0;
  // Доза — это и есть «удовлетворить зависимость» (книга, поле 3): штраф без
  // дозы снят, отсчёт частоты приёма идёт заново (rules/drug-withdrawal.mjs).
  // Зависим ли ПОЛУЧАТЕЛЬ от этого наркотика — по флагу самого получателя
  // (ключ — название препарата, task-9717), а не по предмету `item`: колет,
  // возможно, другой персонаж, или доза взята из второй стопки того же препарата.
  const recipientAddicted = isAddictedTo(readWithdrawalEntries(actor), item);
  if (recipientAddicted) await startWithdrawal(actor, item, now);
  if (!(Number(add.minDose) > 0)) return;
  const key = doseKey(item);
  const log = logDose(actor.getFlag?.("warhammer-dbc", DRUG_DOSES_FLAG), key, now);
  try { await actor.setFlag("warhammer-dbc", DRUG_DOSES_FLAG, log); } catch { /* нет прав на лист получателя */ }
  if (recipientAddicted) return;
  // «Крючок»: приготовленный с ним препарат — лимит вдвое ниже (окр.▼).
  const limit = weeklyDoseLimit(actor, isHookedUp(item) ? hookUpMinDose(add.minDose) : add.minDose);
  const check = addictionCheckFor(dosesThisWeek(log, key, now), limit);
  if (!check) return;
  // Комбинированный тест (Рекаф «Т+40/W+50»): штраф за сверхлимит ложится на оба Предела.
  const [a, b] = addictionTestParts(add);
  await rollAddictionTest(actor, item, a.charKey, a.mod + check.penalty,
    b ? { second: { charKey: b.charKey, testMod: b.mod + check.penalty } } : {});
}

export async function triggerAfterEffect(actor, item) {
  const sys = item.system;
  if (!sys.hasAfterEffect) return;

  // Иммунитет к пост-эффектам (Владыка Праздности, Изуверская Физиология):
  // действие препарата просто кончается, пост-эффект не наступает — раньше
  // Дар гасил только тест Зависимости, а пост-эффект приходил как обычно.
  // Новые Люди (Йигори): «игнорирует побочные эффекты» — тот же исход.
  const aftermathImmune = drugAftermathImmunity(actor) || (ignoresDrugSideEffects(actor) ? "Новые Люди" : "");
  if (aftermathImmune) {
    await deactivateDrugEffect(item);
    await postTestCard(actor, {
      icon: rollIcon("shield", "#9d7cd8"), title: `Пост-эффект — ${esc(item.name)}`,
      threshold: `<div class="roll-threshold">${esc(aftermathImmune)} — иммунитет к пост-эффектам наркотиков.</div>`,
      rv: "—", outcome: `<span class="roll-success">Пост-эффект не наступает.</span>`
    }, { sound: false });
    return;
  }

  const fx = sys.afterEffectSpecial || {};
  const actorUpdates = {};

  // Кубы пост-эффекта у препарата, накладывающего Состояние со счётчиком
  // «Раунды» (Оглушение Струпа: «Оглушая персонажа на 1d10 Раундов», стр. 284),
  // и есть срок этого Состояния — бросок делается ДО наложения и потом
  // показывается в карточке тем же результатом (не второй бросок). Для
  // Состояний с уровнем и препаратов без кубов остаётся grantsConditionLevel.
  let afterRoll = null, afterRollTotal = 0;
  if (sys.afterEffectDice && fx.grantsCondition && CONDITIONS[fx.grantsCondition]?.counter === "rounds") {
    try {
      const resolved = resolveCharFormula(sys.afterEffectDice, actor.system.characteristics, actor.system.corruptionBonus ?? 0);
      afterRoll = await new Roll(resolved).evaluate();
      afterRollTotal = snakeEaterHalve(actor, afterRoll.total);
    } catch (e) {
      ui.notifications.warn(`Не удалось бросить формулу пост-эффекта: ${sys.afterEffectDice}`);
      console.error(e);
    }
  }

  if (fx.removesBleedingLevels > 0) {
    Object.assign(actorUpdates, conditionAdjustFields(actor, "bleeding", -fx.removesBleedingLevels));
  }

  const fat = { delta: 0, zero: false, touched: false };
  if (fx.removesFatigueLevels > 0) {
    fat.delta -= fx.removesFatigueLevels;
    fat.touched = true;
  }

  if (fx.removesWounds > 0) {
    Object.assign(actorUpdates, computeWoundHealing(actor.system, fx.removesWounds));
  }

  if (fx.grantsCondition) {
    const lvlToGrant = afterRoll ? Math.max(0, afterRollTotal) : (fx.grantsConditionLevel ?? 1);
    const levelField = conditionLevelField(fx.grantsCondition);
    const curLvl     = levelField ? (actor.system.conditions?.[levelField] || 0) : 0;
    Object.assign(actorUpdates, conditionApplyFields(fx.grantsCondition, levelField ? curLvl + lvlToGrant : null, actor));
    if (fx.grantsCondition === "fatigued") {
      fat.delta += lvlToGrant;
      fat.touched = true;
    }
  }

  const extras = await applyEffectExtras(actor, fx, { poisonSource: sys.drugCategory === "poison" });
  Object.assign(actorUpdates, extras.updates);
  if (extras.fatigueDelta) { fat.delta += extras.fatigueDelta; fat.touched = true; }
  const fatRes = drugFatigueChange(actor, fat);
  if (fatRes) Object.assign(actorUpdates, fatRes.fields);

  if (Object.keys(actorUpdates).length > 0) await actor.update(actorUpdates);
  if (fatRes) await announceFatigueChange(actor, fatRes);

  const cd = sys.afterEffectCharDamage || {};
  let charDamageStat = "";
  let charDamageAmount = 0;
  let charDamageRoll = null;
  let charDamageDiceStr = "";

  if (cd.stat && cd.formula) {
    const chars = actor.system.characteristics;
    const resolved = resolveCharFormula(cd.formula, chars, actor.system.corruptionBonus ?? 0);
    try {
      charDamageRoll = await new Roll(resolved).evaluate();
      charDamageAmount = Math.max(0, charDamageRoll.total);
      charDamageStat = cd.stat;
      charDamageDiceStr = rollTermsExpression(charDamageRoll);
    } catch(e) {
      ui.notifications.warn(`Не удалось бросить формулу урона в характеристику: ${cd.formula}`);
      console.error(e);
    }
  }

  await item.update({
    "system.activeEffect.isActive": true,
    "system.activeEffect.isAfterEffect": true,
    "system.activeEffect.roundsRemaining": 0,
    "system.activeEffect.charDamageStat": charDamageStat,
    "system.activeEffect.charDamageAmount": charDamageAmount
  });

  const categoryIcon = DRUG_CATEGORY_ICON[sys.drugCategory] || "💊";
  let chatContent = `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("warn","#ffb84d")}Пост-эффект: ${categoryIcon} ${esc(item.name)}</div>`;

  const afterStatMods = sys.afterEffectStatMods || {};
  const afterModParts = [];
  for (const [key, value] of Object.entries(afterStatMods)) {
    if (value && value !== 0) afterModParts.push(`${key.toUpperCase()} ${value > 0 ? "+" : ""}${value}`);
  }
  if (afterModParts.length > 0) {
    chatContent += `<div class="roll-threshold">${rollIcon("chart","#8fd0ff")}Модификаторы: <b>${afterModParts.join(", ")}</b></div>`;
  }

  if (charDamageStat && charDamageAmount > 0) {
    const label = CHARACTERISTICS[charDamageStat]?.abbr ?? charDamageStat.toUpperCase();
    chatContent += `<div class="roll-threshold">${rollIcon("burst","#ffb84d")}Урон в характеристику <b>${label}</b>: ${charDamageDiceStr ? `${charDamageDiceStr} = ` : ""}<b style="color:#8b0000;">−${charDamageAmount}</b> <span style="font-size:0.85em;color:#5a4a30;">(действует, пока активен пост-эффект)</span></div>`;
  }

  for (const line of extras.lines)
    chatContent += `<div class="roll-threshold">${line}</div>`;

  if (sys.afterEffect) {
    chatContent += `<div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}${sys.afterEffect}</span></div>`;
  }

  if (sys.afterEffectDice) {
    try {
      const chars = actor.system.characteristics;
      const resolvedFormula = resolveCharFormula(sys.afterEffectDice, chars, actor.system.corruptionBonus ?? 0);
      // Бросок уже сделан выше, если он задаёт срок Состояния (Оглушение Струпа).
      const roll = afterRoll ?? await new Roll(resolvedFormula).evaluate();
      const diceStr = rollTermsExpression(roll, resolvedFormula);
      // Пожиратель Змей: «пост-эффектов стимуляторов … вдвое меньше (окр.▲)» —
      // длительность пост-эффекта (бросок «Кубы пост-эффекта») режется вдвое.
      const afterTotal = snakeEaterHalve(actor, roll.total);

      chatContent += `<div class="roll-threshold">
        ${rollIcon("dice","#6fe6ff")}Формула: <b>${sys.afterEffectDice}</b> → ${diceStr} =
        <b style="color:#8b0000;">${roll.total}</b>${afterTotal !== roll.total ? ` → Пожиратель Змей: вдвое (окр.▲) = <b style="color:#8b0000;">${afterTotal}</b>` : ""}
      </div>`;

      if (fx.removesBleedingLevels > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("blood","#ff6b6b")}Снято ур. Кровотечения: <b>${fx.removesBleedingLevels}</b></div>`;
      if (fx.removesFatigueLevels > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Снято ур. Усталости: <b>${fx.removesFatigueLevels}</b></div>`;
      if (fx.removesWounds > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("heart","#ff8a8a")}Снято Ран: <b>${fx.removesWounds}</b></div>`;
      if (fx.grantsCondition) {
        const lvl = fx.grantsConditionLevel ?? 1;
        chatContent += afterRoll
          ? `<div class="roll-threshold">${rollIcon("warn","#ff6b6b")}Наложено на <b>${afterTotal}</b> Раунд.: <b>${fx.grantsCondition}</b></div>`
          : `<div class="roll-threshold">${rollIcon("warn","#ff6b6b")}Наложено${lvl > 1 ? ` ${lvl} ур.` : ""}: <b>${fx.grantsCondition}</b></div>`;
      }
      if (fx.customEffect)
        chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;

      chatContent += "</div>";

      await postTestCard(actor, chatContent,
        { rolls: [roll, ...(charDamageRoll ? [charDamageRoll] : []), ...extras.rolls] });
    } catch(e) {
      chatContent += "</div>";
      // Формула не сработала — кубика нет, поэтому без звука.
      await postTestCard(actor, chatContent, { sound: false });
      ui.notifications.warn(`Не удалось бросить формулу пост-эффекта: ${sys.afterEffectDice}`);
      console.error(e);
    }
  } else {
    if (fx.customEffect)
      chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;
    chatContent += "</div>";
    const postRolls = [...(charDamageRoll ? [charDamageRoll] : []), ...extras.rolls];
    await postTestCard(actor, chatContent, { rolls: postRolls, sound: postRolls.length > 0 });
  }

  ui.notifications.info(`${item.name}: пост-эффект активирован.`);
}

export async function deactivateDrugEffect(item) {
  if (!item) return;
  await item.update({
    "system.activeEffect.isActive": false,
    "system.activeEffect.isAfterEffect": false,
    "system.activeEffect.expiresAt": null,
    "system.activeEffect.roundsRemaining": 0,
    "system.activeEffect.charDamageStat": "",
    "system.activeEffect.charDamageAmount": 0
  });
  ui.notifications.info(`Эффект «${item.name}» завершён.`);
}

/** Осталась ли у актора хоть одна зависимость от препарата (флаг актора, task-9717). */
const stillAddicted = actor => addictionRecords(actor.items, readWithdrawalEntries(actor)).length > 0;

/**
 * Предмет-препарат для зависимости по ключу: живой предмет листа, а если препарат
 * кончился и предмет удалён — «призрак» из записи актора с теми же настройками.
 * Нужен кнопкам панели ЗАВИСИМОСТИ: зависимость от удалённого препарата остаётся.
 */
export function resolveDrug(actor, key) {
  const live = actor.items.find(i => i.type === "drug" && drugKey(i) === key && i.system?.addiction?.hasAddiction)
    ?? actor.items.find(i => i.type === "drug" && drugKey(i) === key);
  if (live) return live;
  const rec = addictionRecords(actor.items, readWithdrawalEntries(actor)).find(r => r.key === key);
  return rec ? { id: null, name: rec.name, type: "drug", system: { addiction: rec.add }, flags: {} } : null;
}

export async function removeDrugAddiction(actor, drug) {
  if (drug) await endWithdrawal(actor, drug);
  if (!stillAddicted(actor)) await actor.update(conditionRemoveFields("addicted"));
}

export function activateDrugListeners(html, actor, { resolveOtherTargetActor } = {}) {
  html.find(".drug-apply-btn").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await applyDrug(actor, item);
  });

  html.find(".drug-apply-other-btn").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    const target = resolveOtherTargetActor?.();
    if (!target) return;
    await applyDrug(actor, item, target);
  });

  html.find(".drug-name-link").click(ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) item.sheet.render(true);
  });

  html.find(".effect-deactivate-btn").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    await deactivateDrugEffect(item);
  });

  html.find(".effect-trigger-after-btn").click(async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    await triggerAfterEffect(actor, item);
  });

  html.find(".addiction-test-btn").click(async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    // Кнопка панели ЗАВИСИМОСТИ несёт ключ препарата (предмета может уже не быть),
    // кнопка «Зав.» в списке препаратов — id предмета.
    const drugKeyAttr = ev.currentTarget.dataset.drugKey;
    const item = drugKeyAttr ? resolveDrug(actor, drugKeyAttr) : actor.items.get(ev.currentTarget.dataset.itemId);
    // Уже зависим — это тест на срыв (книга: –50, +10 за каждый предыдущий период
    // под штрафом, один раз за период): модификатор считает rollBreakTest, а не кнопка.
    if (item && isAddictedTo(readWithdrawalEntries(actor), item)) { await rollBreakTest(actor, item); return; }
    const charKey = ev.currentTarget.dataset.char || "t";
    const mod = parseInt(ev.currentTarget.dataset.mod) || 0;
    // Комбинированный тест (Рекаф): вторая Характеристика берётся с самого препарата.
    const b = item ? addictionTestParts(item.system.addiction)[1] : null;
    await rollAddictionTest(actor, item, charKey, mod, b ? { second: { charKey: b.charKey, testMod: b.mod } } : {});
  });

  html.find(".addiction-remove-btn").click(async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const key = ev.currentTarget.dataset.drugKey;
    await removeDrugAddiction(actor, key ? resolveDrug(actor, key) ?? key : actor.items.get(ev.currentTarget.dataset.itemId));
  });
}

/**
 * Тест Зависимости. Обычно один Предел; комбинированный (Рекаф «Комб.Т+40/W+50»,
 * стр. 25) — ОДИН бросок против наименьшего из двух Пределов, второе слагаемое
 * приходит в `second` ({charKey, testMod} — модификатор уже со штрафами).
 * @returns {Promise<?{success:boolean, cured:boolean}>} null — иммунитет, теста не было
 */
export async function rollAddictionTest(actor, item, charKey = "t", testMod = 0, { second = null } = {}) {
  const aftermathImmune = drugAftermathImmunity(actor);
  if (aftermathImmune) {
    await postTestCard(actor, {
      icon: rollIcon("shield", "#9d7cd8"), title: `Тест Зависимости — ${item?.name ?? "Наркотик"}`,
      threshold: `<div class="roll-threshold">${esc(aftermathImmune)} — иммунитет к пост-эффектам и зависимости от наркотиков.</div>`,
      rv: "—", outcome: `<span class="roll-success">Зависимость невозможна — тест не требуется.</span>`
    }, { sound: false });
    return null;
  }
  // Слагаемые теста: у каждого свой Предел (Характеристика + модификатор препарата
  // + модификаторы правил именно по этой Характеристике). Общий сбор модификаторов
  // (wdbc-ct65.2) — см. tabs/tech.mjs, тот же перевод. addictionTest — тег теста
  // Зависимости: на него даёт +10 Декаданс (Талант Стойкости).
  const partOf = (key, mod) => {
    const total = actor.system.characteristics[key]?.total ?? 0;
    const mods = collectTestMods(actor, { kind: "skill", char: key, addictionTest: true });
    return { charKey: key, mod, total, ruleMods: mods, eff: total + mod + mods.total,
             abbr: CHARACTERISTICS[key]?.abbr ?? key.toUpperCase() };
  };
  const candidates = [partOf(charKey, testMod), ...(second ? [partOf(second.charKey, second.testMod)] : [])];
  const used = candidates[lowestPart(candidates)];
  const { total: charTotal, ruleMods, eff, abbr } = used;
  testMod = used.mod;
  const combinedNote = second
    ? `<div class="roll-threshold">🔗 Комбинированный тест: ${candidates.map(c => `${c.abbr} <b>${c.eff}</b>`).join(" · ")} → Порог <b>${eff}</b> (наименьший)</div>`
    : "";
  // Зависимость — запись на ПОЛУЧАТЕЛЕ (флаг актора), а не поле предмета: колет,
  // возможно, другой персонаж, и предмет мог быть удалён (task-9717).
  const wasAddicted = !!item && isAddictedTo(readWithdrawalEntries(actor), item);

  let roll = await new Roll("1d100").evaluate();
  const rolls = [roll];
  // Alchem Monster / Алхимическое Чудовище (Репликант): «должен перебрасывать
  // успешные тесты Зависимости» — один раз, второй бросок окончателен.
  let rerollNote = "";
  // «Крючок» (Талант Медика): принимающие препарат, приготовленный с ним,
  // перебрасывают тест Зависимости — прочтено как «успех перебрасывается»,
  // по образцу Алхимического Чудовища и Отравителя (книга уточнения не даёт).
  const hooked = isHookedUp(item);
  if (mustRerollSuccess(roll.total <= eff, hasRuleFlag(actor, ALCHEM_MONSTER) || hooked)) {
    const first = roll.total;
    roll = await new Roll("1d100").evaluate();
    rolls.push(roll);
    const who = hasRuleFlag(actor, ALCHEM_MONSTER) ? "Алхимическое Чудовище" : "Крючок";
    rerollNote = `<div class="roll-threshold">⚗️ ${who}: успех (${first}) обязательно перебрасывается → <b>${roll.total}</b></div>`;
  }
  const rv = roll.total;
  const success = rv <= eff;
  const deg = Math.floor(Math.abs(rv - eff) / 10) + 1;
  const name = item?.name ?? "Наркотик";

  let outcome;
  let cured = false;
  if (success) {
    if (wasAddicted) {
      // Срыв зависимости — избавление.
      cured = true;
      await endWithdrawal(actor, item);
      if (!stillAddicted(actor)) await actor.update(conditionRemoveFields("addicted"));
      outcome = `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Зависимость преодолена!</span>`;
    } else {
      outcome = `<span class="roll-success">Сопротивление успешно — ${deg} ${_degWord(deg)}</span>`;
    }
  } else {
    // Провал → получатель зависим от ЭТОГО препарата. Запись — на нём самом
    // (флаг актора), а не в предмете: доза могла прийти от другого персонажа.
    await actor.update(conditionApplyFields("addicted", null, actor));
    // Только что стал зависим — отсчёт частоты приёма с этого момента (запись,
    // оставшаяся от прошлой зависимости, дала бы мгновенный штраф).
    if (item && !wasAddicted) await startWithdrawal(actor, item);
    outcome = wasAddicted
      ? `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Зависимость сохраняется.</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж стал зависим!</span>`;
  }

  await postTestCard(actor, {
    icon: rollIcon("warn", "#ffb84d"), title: `Тест Зависимости — ${name}`,
    threshold: rollStatLine({
      label: abbr, base: charTotal,
      parts: [...(testMod !== 0 ? [`${testMod >= 0 ? "+" : ""}${testMod}`] : []), ...ruleMods.parts],
      threshold: eff, rv
    }) + combinedNote + rerollNote,
    outcome
  }, { rolls });
  return { success, cured };
}

/**
 * Тест на срыв зависимости (книга, «Эффект зависимости»): за каждый период
 * частоты приёма, проведённый под штрафом, — один тест Зависимости со штрафом
 * –50 и бонусом +10 за каждый предыдущий последовательный период; успех снимает
 * зависимость. Открывается, когда период закончился (rules/drug-withdrawal.mjs),
 * и один раз на период. Доп. модификатор препарата (Смах: –20) — breakMod.
 */
export async function rollBreakTest(actor, item) {
  const add = item?.system?.addiction;
  if (!actor || !add) return null;
  const now = game.time?.worldTime ?? 0;
  const period = parseFrequency(add.frequency);
  const entry = readWithdrawalEntries(actor)[drugKey(item)];
  const state = breakTestState(entry, period, now);
  if (!state.available) {
    const why = !period ? "у препарата не задана частота приёма"
      : (withdrawalStatusLabel(entry, period, now, add.breakMod) || "отсчёт частоты приёма ещё не начат — сдвиньте Календарь");
    ui.notifications.warn(`«${item.name}»: тест на срыв сейчас недоступен — ${why}.`);
    return null;
  }
  const mod = breakTestMod(state.completed, add.breakMod);
  const [a, b] = addictionTestParts(add);
  const res = await rollAddictionTest(actor, item, a.charKey, a.mod + mod,
    b ? { second: { charKey: b.charKey, testMod: b.mod + mod } } : {});
  if (res && !res.cured) await markBreakTested(actor, item, state.completed);
  return res;
}
