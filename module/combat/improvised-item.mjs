// module/combat/improvised-item.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Импровизированное Оружие / Метание (стр. 27-28) — ОБЫЧНЫЙ ПРЕДМЕТ из
//  инвентаря как рукопашная Дубина или метательный снаряд. Персонажей как
//  Дубину/снаряд считает module/combat/grapple.mjs (партнёр по Захвату,
//  Захват там обязателен книгой: «Чтобы размахивать/метнуть ПЕРСОНАЖЕМ, его
//  нужно сначала взять в Захват» — на обычный предмет это требование НЕ
//  распространяется, книга говорит только о персонажах). Общие тиры/пороги —
//  rules/improvised-weapon.mjs (throwTier/footingRequirement — уже были
//  универсальны, canWieldItemAsCudgel/itemWeightOf добавлены рядом).
//
//  В отличие от партнёра-Дубины/снаряда, у обычного предмета своих Ран нет —
//  здесь нет «собственного» урона предмету, только урон ЦЕЛИ при попадании.
// ════════════════════════════════════════════════════════════════════════════

import { canWieldItemAsCudgel, itemWeightOf, throwTier, footingRequirement, bodyWeightOf }
  from "../rules/improvised-weapon.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { MELEE_STANCES, MELEE_BASES } from "../constants/combat.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { _targetDamageSection } from "./grapple.mjs";

const TIER_LABEL = { light: "лёгкий", medium: "средний", heavy: "тяжёлый" };

/** Замахнуться — удар обычным предметом как Дубиной по цели под прицелом. */
export async function useSwingItem(actor, item) {
  if (!actor || !item) return;
  if (!canWieldItemAsCudgel(actor, item)) {
    return ui.notifications.warn(`${actor.name}: ${esc(item.name)} слишком тяжёл(а) для Дубины — нужно ≤¼ Веса Ношения (стр. 27).`);
  }
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) return ui.notifications.warn(`${actor.name}: наведите прицел на цель, по которой замахнётесь ${esc(item.name)}.`);

  const stance  = actor.system.meleeStance || "standard";
  const stBon   = MELEE_STANCES[stance]?.wsBonus ?? 0;
  const baseKey = actor.system.meleeBase || "standard";
  const baseBon = MELEE_BASES[baseKey]?.wsBonus ?? 0;
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "ws" });
  const ws    = actor.system.characteristics.ws?.total ?? 0;
  const final = ws - 20 + baseBon + stBon + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const { success: hit, deg } = testOutcome(roll.total, final);
  const dmgRoll = await new Roll("1d10").evaluate();
  const dmgTotal = dmgRoll.total;

  await postTestCard(actor, {
    prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Замахнуться (${esc(item.name)})</b>
        <div class="roll-technique-note">${esc(item.name)} используется как импровизированная Дубина против ${esc(target.name)} (стр. 27).</div>
      </div>`,
    icon: rollIcon("sword"),
    title: `Замахнуться — удар ${esc(item.name)} (1d10 I(Cr))`,
    threshold: rollStatLine({
      label: "WS", base: ws,
      parts: [`база ${baseBon >= 0 ? "+" : ""}${baseBon}`,
        ...(stBon !== 0 ? [`стойка ${stBon >= 0 ? "+" : ""}${stBon}`] : []),
        "Дубина −20", ...ruleMods.parts],
      threshold: final, rv: roll.total
    }),
    outcome: outcomeHtml(hit, hit
      ? `Попадание по ${esc(target.name)} — ${deg} степеней`
      : `Промах мимо ${esc(target.name)} — ${deg} степеней`),
    sections: [hit ? _targetDamageSection(dmgTotal, `Замахнуться (${item.name})`, actor) : ""]
  }, { rolls: [roll, dmgRoll] });
}

/** Метнуть — бросок обычного предмета в цель под прицелом, тир по весу предмета. */
export async function useThrowItem(actor, item) {
  if (!actor || !item) return;
  const carry = Number(actor.system?.encumbrance?.carry) || 0;
  const tier = throwTier(carry, itemWeightOf(item));
  if (!tier) {
    return ui.notifications.warn(`${actor.name}: ${esc(item.name)} тяжелее полного Веса Ношения (${carry} кг) — метнуть нельзя вовсе (стр. 28).`);
  }
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) return ui.notifications.warn(`${actor.name}: наведите прицел на цель, по которой метнёте ${esc(item.name)}.`);

  const footing = footingRequirement(bodyWeightOf(actor), itemWeightOf(item));
  if (footing === "impossible") {
    return ui.notifications.warn(`${actor.name}: ${esc(item.name)} весит втрое больше вашего собственного тела (без снаряжения) или больше — метнуть невозможно без магии (стр. 28).`);
  }
  let combinedTestRequired = false;
  if (footing === "harsh") {
    const hasFooting = await Dialog.confirm({
      title: "Опора при Метании",
      content: `<p>${esc(item.name)} весит от 1.5 до 3 раз больше вашего собственного тела. Без надёжной опоры (стена, борт машины и т.п. позади, в стороне, противоположной броску) метнуть нельзя вовсе.</p><p>Опора есть?</p>`
    });
    if (!hasFooting) {
      return ui.notifications.warn(`${actor.name}: без надёжной опоры метнуть настолько тяжёлый (относительно вас самих) предмет нельзя (стр. 28).`);
    }
    combinedTestRequired = true; // «даже с опорой тест — как будто её нет»
  } else if (footing === "check") {
    const hasFooting = await Dialog.confirm({
      title: "Опора при Метании",
      content: `<p>${esc(item.name)} весит сравнимо с вашим собственным телом (0.5-1.5×). Без надёжной опоры — риск сбития с ног.</p><p>Опора есть?</p>`
    });
    combinedTestRequired = !hasFooting;
  }

  let knockedDown = false, halved = false;
  if (combinedTestRequired) {
    const sTotal = actor.system.characteristics.s?.total ?? 0;
    const aTotal = actor.system.characteristics.ag?.total ?? 0;
    const sRoll = await new Roll("1d100").evaluate();
    const aRoll = await new Roll("1d100").evaluate();
    if (!(sRoll.total <= sTotal - 30 && aRoll.total <= aTotal - 30)) {
      knockedDown = true;
      halved = true;
      await actor.update(conditionApplyFields("prone", null, actor));
    }
  }

  const testChar = tier === "light" ? "bs" : "s";
  const testLabel = tier === "light" ? "BS" : "Athletics(S)";
  const athleticsPenalty = tier === "heavy" ? -30 : 0;
  const charVal = actor.system.characteristics[testChar]?.total ?? 0;
  const throwMods = collectTestMods(actor, { kind: "skill", char: testChar });
  const final = charVal + athleticsPenalty + throwMods.total;

  const roll = await new Roll("1d100").evaluate();
  const { success: hit, deg } = testOutcome(roll.total, final);
  const knockNote = knockedDown
    ? `<div class="roll-threshold" style="font-size:0.85em;">Без надёжной опоры: ${esc(actor.name)} сбит(а) с ног (Повален), дальность и урон уменьшены вдвое.</div>` : "";
  const rangeM = tier === "light" ? (Number(actor.system?.characteristics?.s?.bonus) || 0) * 3 : null;

  if (!hit) {
    await postTestCard(actor, {
      prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Метнуть</b>
          <div class="roll-technique-note">${esc(item.name)} метается в ${esc(target.name)} (стр. 28, тир «${TIER_LABEL[tier]}»).</div>
        </div>`,
      icon: rollIcon("sword"),
      title: `Метнуть — ${testLabel}${rangeM ? `, дальность до ${rangeM} м` : ""}`,
      threshold: rollStatLine({
        label: testLabel, base: charVal,
        parts: [...(athleticsPenalty ? [`тир ${athleticsPenalty}`] : []), ...throwMods.parts],
        threshold: final, rv: roll.total
      }),
      outcome: outcomeHtml(false, `Промах — ${esc(item.name)} летит мимо ${esc(target.name)}, ${deg} степеней`),
      sections: [knockNote]
    }, { rolls: [roll] });
    return;
  }

  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const dmgRoll = tier === "light"
    ? await new Roll(`1d5+${sb}`).evaluate()
    : await new Roll(`1d10+${sb}+${deg}`).evaluate();
  const dmgTotal = halved ? Math.ceil(dmgRoll.total / 2) : dmgRoll.total;

  await postTestCard(actor, {
    prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Метнуть</b>
        <div class="roll-technique-note">${esc(item.name)} метается в ${esc(target.name)} (стр. 28, тир «${TIER_LABEL[tier]}»).</div>
      </div>`,
    icon: rollIcon("sword"),
    title: `Метнуть — ${testLabel}${rangeM ? `, дальность до ${rangeM} м` : ""}`,
    threshold: rollStatLine({
      label: testLabel, base: charVal,
      parts: [...(athleticsPenalty ? [`тир ${athleticsPenalty}`] : []), ...throwMods.parts],
      threshold: final, rv: roll.total
    }),
    outcome: outcomeHtml(true, `Попадание — ${deg} степеней`),
    sections: [
      knockNote,
      _targetDamageSection(dmgTotal, `Метнуть (${item.name})`, actor)
    ]
  }, { rolls: [roll, dmgRoll] });
}
