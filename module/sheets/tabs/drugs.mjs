// module/sheets/tabs/drugs.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Препараты: тест зависимости. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { _degWord, resolveCharFormula, esc } from "../../helpers/utils.mjs";
import { fatiguePenalty, conditionAdjustFields, conditionApplyFields, conditionRemoveFields } from "./conditions.mjs";
import { computeWoundHealing } from "./wounds.mjs";
import { woundLossUpdates } from "../../rules/wounds.mjs";
import { conditionLevelField } from "../../constants/conditions.mjs";
import { maybeGrantEnjoymentPain } from "../../combat/enjoyment.mjs";

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
export async function applyEffectExtras(target, fx) {
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
      Object.assign(updates, computeWoundHealing(target.system, r.total));
      lines.push(`${rollIcon("heart","#ff8a8a")}Лечение: <b>${fx.healFormula}</b> = <b>${r.total}</b>`);
    } catch(e) {
      console.error("healFormula:", e);
    }
  }

  if (fx.grantsFatigue > 0) {
    const fatVal = target.system.fatigue?.value ?? 0;
    updates["system.fatigue.value"] = fatVal + fx.grantsFatigue;
    lines.push(`${rollIcon("warn","#ffb84d")}Усталость +<b>${fx.grantsFatigue}</b>`);
  }

  if (fx.woundDamage) {
    try {
      const r = await new Roll(resolveCharFormula(fx.woundDamage, chars)).evaluate();
      rolls.push(r);
      Object.assign(updates, woundLossUpdates(target.system, r.total));
      lines.push(`${rollIcon("burst","#ff6b6b")}Непоглощаемый урон в Раны: <b>${fx.woundDamage}</b> = <b style="color:#8b0000;">${r.total}</b>`);
    } catch(e) {
      console.error("woundDamage:", e);
    }
  }

  return { updates, lines, rolls };
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

  let resolvedRounds = 0;
  let durationRollStr = "";
  let durationRoll = null;

  if (sys.duration) {
    const chars = actor.system.characteristics;
    const resolvedFormula = resolveCharFormula(sys.duration, chars, actor.system.corruptionBonus ?? 0);

    try {
      durationRoll = await new Roll(resolvedFormula).evaluate();
      resolvedRounds = durationRoll.total;
      durationRollStr = rollTermsText(durationRoll, resolvedRounds);
    } catch(e) {
      console.warn(`Не удалось бросить формулу длительности: ${sys.duration}`, e);
      durationRollStr = sys.duration;
    }
  }

  const itemUpdates = {
    "system.quantity": qty,
    "system.activeEffect.isActive": true,
    "system.activeEffect.isAfterEffect": false,
    "system.activeEffect.appliedAt": game.time.worldTime,
    "system.activeEffect.roundsRemaining": resolvedRounds,
    "system.activeEffect.charDamageStat": "",
    "system.activeEffect.charDamageAmount": 0
  };

  const actorUpdates = {};
  const fx = sys.specialEffects || {};

  if (fx.removesBleedingLevels > 0) {
    Object.assign(actorUpdates, conditionAdjustFields(actor, "bleeding", -fx.removesBleedingLevels));
  }

  if (fx.removesFatigueLevels > 0) {
    // «Усталость» — зеркало system.fatigue.value (rules/character.mjs), тег
    // сам пересчитается из него; conditionAdjustFields на "fatigued" — no-op.
    const fatVal = actor.system.fatigue?.value || 0;
    actorUpdates["system.fatigue.value"] = Math.max(0, fatVal - fx.removesFatigueLevels);
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
      const fatVal = actor.system.fatigue?.value || 0;
      actorUpdates["system.fatigue.value"] = lvlToRemove > 0 ? Math.max(0, fatVal - lvlToRemove) : 0;
    }
  }

  if (fx.removesRadiation) {
    Object.assign(actorUpdates, conditionRemoveFields("radiation"));
  }

  if (fx.grantsCondition) {
    const lvlToGrant  = fx.grantsConditionLevel ?? 1;
    const levelField  = conditionLevelField(fx.grantsCondition);
    const curLvl      = levelField ? (actor.system.conditions?.[levelField] || 0) : 0;
    Object.assign(actorUpdates, conditionApplyFields(fx.grantsCondition, levelField ? curLvl + lvlToGrant : null));
    if (fx.grantsCondition === "fatigued") {
      const fatVal = actor.system.fatigue?.value || 0;
      actorUpdates["system.fatigue.value"] = fatVal + lvlToGrant;
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

  const extras = await applyEffectExtras(actor, fx);
  Object.assign(actorUpdates, extras.updates);

  if (Object.keys(actorUpdates).length > 0) await actor.update(actorUpdates);

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
        expiresAt: null,
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

  if (sys.hasAfterEffect) {
    chatContent += `<div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}Пост-эффект: ${sys.afterEffect || "—"}`;
    if (sys.afterEffectDice) chatContent += ` [${sys.afterEffectDice}]`;
    chatContent += "</span></div>";
  }

  chatContent += `<div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">
    Осталось: ${qty}
  </div></div>`;

  const rollMode = game.settings.get("core", "rollMode");
  const allRolls = [...(durationRoll ? [durationRoll] : []), ...extras.rolls];
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: chatContent,
    ...(allRolls.length ? { rolls: allRolls } : {}),
    sound: CONFIG.sounds.dice
  }, rollMode));
}

export async function triggerAfterEffect(actor, item) {
  const sys = item.system;
  if (!sys.hasAfterEffect) return;

  const fx = sys.afterEffectSpecial || {};
  const actorUpdates = {};

  if (fx.removesBleedingLevels > 0) {
    Object.assign(actorUpdates, conditionAdjustFields(actor, "bleeding", -fx.removesBleedingLevels));
  }

  if (fx.removesFatigueLevels > 0) {
    const fatVal = actor.system.fatigue?.value || 0;
    actorUpdates["system.fatigue.value"] = Math.max(0, fatVal - fx.removesFatigueLevels);
  }

  if (fx.removesWounds > 0) {
    Object.assign(actorUpdates, computeWoundHealing(actor.system, fx.removesWounds));
  }

  if (fx.grantsCondition) {
    const lvlToGrant = fx.grantsConditionLevel ?? 1;
    const levelField = conditionLevelField(fx.grantsCondition);
    const curLvl     = levelField ? (actor.system.conditions?.[levelField] || 0) : 0;
    Object.assign(actorUpdates, conditionApplyFields(fx.grantsCondition, levelField ? curLvl + lvlToGrant : null));
    if (fx.grantsCondition === "fatigued") {
      const fatVal = actor.system.fatigue?.value || 0;
      actorUpdates["system.fatigue.value"] = fatVal + lvlToGrant;
    }
  }

  const extras = await applyEffectExtras(actor, fx);
  Object.assign(actorUpdates, extras.updates);

  if (Object.keys(actorUpdates).length > 0) await actor.update(actorUpdates);

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
      const roll = await new Roll(resolvedFormula).evaluate();
      const diceStr = rollTermsExpression(roll, resolvedFormula);

      chatContent += `<div class="roll-threshold">
        ${rollIcon("dice","#6fe6ff")}Формула: <b>${sys.afterEffectDice}</b> → ${diceStr} =
        <b style="color:#8b0000;">${roll.total}</b>
      </div>`;

      if (fx.removesBleedingLevels > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("blood","#ff6b6b")}Снято ур. Кровотечения: <b>${fx.removesBleedingLevels}</b></div>`;
      if (fx.removesFatigueLevels > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("warn","#ffb84d")}Снято ур. Усталости: <b>${fx.removesFatigueLevels}</b></div>`;
      if (fx.removesWounds > 0)
        chatContent += `<div class="roll-threshold">${rollIcon("heart","#ff8a8a")}Снято Ран: <b>${fx.removesWounds}</b></div>`;
      if (fx.grantsCondition) {
        const lvl = fx.grantsConditionLevel ?? 1;
        chatContent += `<div class="roll-threshold">${rollIcon("warn","#ff6b6b")}Наложено${lvl > 1 ? ` ${lvl} ур.` : ""}: <b>${fx.grantsCondition}</b></div>`;
      }
      if (fx.customEffect)
        chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;

      chatContent += "</div>";

      const rollMode = game.settings.get("core", "rollMode");
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatContent,
        rolls: [roll, ...(charDamageRoll ? [charDamageRoll] : []), ...extras.rolls],
        sound: CONFIG.sounds.dice
      }, rollMode));
    } catch(e) {
      chatContent += "</div>";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatContent
      });
      ui.notifications.warn(`Не удалось бросить формулу пост-эффекта: ${sys.afterEffectDice}`);
      console.error(e);
    }
  } else {
    if (fx.customEffect)
      chatContent += `<div class="roll-threshold">${rollIcon("target","#8fd0ff")}${fx.customEffect}</div>`;
    chatContent += "</div>";
    const rollMode = game.settings.get("core", "rollMode");
    const postRolls = [...(charDamageRoll ? [charDamageRoll] : []), ...extras.rolls];
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatContent,
      ...(postRolls.length ? { rolls: postRolls, sound: CONFIG.sounds.dice } : {})
    }, rollMode));
  }

  ui.notifications.info(`${item.name}: пост-эффект активирован.`);
}

export async function deactivateDrugEffect(item) {
  if (!item) return;
  await item.update({
    "system.activeEffect.isActive": false,
    "system.activeEffect.isAfterEffect": false,
    "system.activeEffect.roundsRemaining": 0,
    "system.activeEffect.charDamageStat": "",
    "system.activeEffect.charDamageAmount": 0
  });
  ui.notifications.info(`Эффект «${item.name}» завершён.`);
}

export async function removeDrugAddiction(actor, item) {
  if (item) await item.update({ "system.addiction.isAddicted": false });
  const stillAddicted = actor.items.some(i =>
    i.type === "drug" && i.system.addiction?.hasAddiction && i.system.addiction?.isAddicted
  );
  if (!stillAddicted) await actor.update(conditionRemoveFields("addicted"));
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
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    const charKey = ev.currentTarget.dataset.char || "t";
    const mod = parseInt(ev.currentTarget.dataset.mod) || 0;
    await rollAddictionTest(actor, item, charKey, mod);
  });

  html.find(".addiction-remove-btn").click(async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    await removeDrugAddiction(actor, item);
  });
}

export async function rollAddictionTest(actor, item, charKey = "t", testMod = 0) {
  const charTotal = actor.system.characteristics[charKey]?.total ?? 0;
  const fatigue = fatiguePenalty(actor, charKey);
  const eff = charTotal + testMod + fatigue;
  const wasAddicted = item?.system?.addiction?.isAddicted || false;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= eff;
  const deg = Math.floor(Math.abs(rv - eff) / 10) + 1;
  const abbr = CHARACTERISTICS[charKey]?.abbr ?? charKey.toUpperCase();
  const name = item?.name ?? "Наркотик";

  let outcome;
  if (success) {
    if (wasAddicted && item) {
      // Срыв зависимости — избавление.
      await item.update({ "system.addiction.isAddicted": false });
      const still = actor.items.some(i =>
        i.type === "drug" && i.id !== item.id &&
        i.system.addiction?.hasAddiction && i.system.addiction?.isAddicted
      );
      if (!still) await actor.update(conditionRemoveFields("addicted"));
      outcome = `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Зависимость преодолена!</span>`;
    } else {
      outcome = `<span class="roll-success">Сопротивление успешно — ${deg} ${_degWord(deg)}</span>`;
    }
  } else {
    // Провал → персонаж зависим от ЭТОГО препарата.
    if (item) await item.update({ "system.addiction.isAddicted": true });
    await actor.update(conditionApplyFields("addicted"));
    outcome = wasAddicted
      ? `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Зависимость сохраняется.</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж стал зависим!</span>`;
  }

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn","#ffb84d")}Тест Зависимости — ${name}</div>
        <div class="roll-threshold">
          ${abbr}: <b>${charTotal}</b>${testMod !== 0 ? ` ${testMod >= 0 ? "+" : ""}${testMod}` : ""}${fatigue !== 0 ? ` 😓 ${fatigue}` : ""}
          → Порог: <b>${eff}</b>
        </div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcome}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}
