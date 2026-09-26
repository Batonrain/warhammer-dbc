// module/combat/horde-psych.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПСИХОЛОГИЧЕСКИЙ УРОН ОРДЫ
//
//  Толпу ломает не только оружие. Массивные потери за Раунд, Страх и Запугивание
//  бьют по воле к бою, и эти провалы снимают Магнитуду так же, как обычный урон —
//  разница в том, что психологический урон лечится Командованием и социалкой.
//
//  Орды, автоматически проходящие тесты на Страх и Запугивание, психологического
//  урона не получают вовсе и Сломлены быть не могут.
// ════════════════════════════════════════════════════════════════════════════

import { psychDamageFor, PSYCH_MULTIPLIERS, WEAKENED_WP_PENALTY, noRecoveryHours }
  from "../rules/horde-damage.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
// Взаимный импорт с horde-damage.mjs (тот берёт отсюда lockIfCrossedHalf):
// обе стороны зовут функции только во время выполнения, не при загрузке.
import { addRoundDamage } from "./horde-damage.mjs";

/** Флаг: до какого worldTime Ослабленная Орда не лечит психологический урон. */
export const PSYCH_LOCK_FLAG = "hordePsychLockUntil";

/**
 * Флаг: сколько Магнитуды сняла последняя карточка атаки ({messageId, magLoss})
 * — пишет combat/horde-damage.mjs, читает Огонь (rollHordeFlameTest).
 */
export const LAST_HIT_FLAG = "hordeLastHit";

export const PSYCH_TESTS = {
  massDamage: { label: "Массивные потери", sub: "тест W+Магнитуда после потери 25%+ за Раунд" },
  fear:       { label: "Страх",            sub: "провал стоит Провалы×2 Магнитуды" },
  intimidate: { label: "Запугивание",      sub: "провал стоит Провалы×1 Магнитуды" }
};

/**
 * Порог психологического теста Орды.
 *
 * Во всех трёх случаях это Воля плюс Магнитуда: толпа держится числом. У
 * Ослабленной Орды (потеряно больше половины) тесты Воли идут с −10.
 */
export function psychThreshold(horde, mod = 0) {
  const wp  = Number(horde.system?.characteristics?.wp?.total) || 0;
  const mag = Number(horde.system?.magnitude?.value) || 0;
  const weakened = horde.system?.derived?.state === "weakened" ? WEAKENED_WP_PENALTY : 0;
  return wp + mag + weakened + (Number(mod) || 0);
}

/**
 * Психологический тест Орды с применением урона.
 *
 * @param {Actor}  horde
 * @param {string} kind  massDamage | fear | intimidate
 * @param {object} [opts]
 * @param {number} [opts.mod] модификатор теста (рейтинг Страха, степень Запугивания)
 */
export async function rollHordePsychTest(horde, kind, { mod = 0 } = {}) {
  const meta = PSYCH_TESTS[kind];
  if (!meta || !PSYCH_MULTIPLIERS[kind]) return null;

  // Несломляемая Орда проходит такие тесты автоматически — и потому неуязвима
  // для психологического урона.
  if (horde.system?.immuneFear) {
    // НЕ карточка теста (wdbc-kuun): Несломляемая Орда ничего не
    // бросает и не имеет Порога — это уведомление «тест пройден автоматом».
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: horde }),
      content: `<div class="wh-roll-result horde-psych">
        <div class="roll-header">${esc(horde.name)} — ${esc(meta.label)}</div>
        <div class="roll-outcome"><span class="roll-success">Тест пройден автоматически — психологического урона нет</span></div>
      </div>`
    });
    return { immune: true, psychDamage: 0 };
  }

  // Общий сбор модификаторов (wdbc-kok3). Бросает сама Орда, поэтому и
  // правила берутся её: Черты Орды, её предметы, её Состояния. Психология
  // Орды — Страх, Паника и Подавление — по книге тесты Морали, отсюда
  // morale:true.
  //
  // Штрафы состояния тела на Орде безвредны по построению: у неё нет ни
  // Усталости, ни шлема, ни инвентаря, и каждый из них честно возвращает 0,
  // а не подставляет чужое число.
  const ruleMods = collectTestMods(horde, { kind: "skill", char: "wp", morale: true });
  const threshold = psychThreshold(horde, mod) + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const passed = rv <= threshold;
  const deg = Math.floor(Math.abs(rv - threshold) / 10) + 1;
  const damage = passed ? 0 : psychDamageFor(kind, deg);

  if (damage > 0) await applyPsychDamage(horde, damage);

  const weakenedNote = horde.system?.derived?.state === "weakened"
    ? ` · Ослаблена: ${WEAKENED_WP_PENALTY}` : "";

  // wdbc-fyvv: Порог Орды складывается из ДВУХ значений (W + Магнитуда), а не
  // одного — Магнитуда идёт в parts как ещё одно слагаемое, наравне с
  // остальными модификаторами. Класс horde-psych на корне сохранён: за него
  // цепляется вёрстка (styles/sheets/horde-sheet.css).
  await postTestCard(horde, {
    classes: "horde-psych",
    title: `${esc(horde.name)} — ${esc(meta.label)}`,
    threshold: rollStatLine({
      label: "W", base: horde.system?.characteristics?.wp?.total ?? 0,
      parts: [
        `Магнитуда ${horde.system?.magnitude?.value ?? 0}`,
        mod ? `мод. ${mod >= 0 ? "+" : ""}${mod}` : "",
        ...ruleMods.parts,
        weakenedNote ? weakenedNote.replace(/^ · /, "") : ""
      ],
      threshold, rv
    }),
    outcome: outcomeHtml(passed, passed
      ? `Успех (${deg} ${_degWord(deg)}) — строй держится`
      : `Провал (${deg} ${_degWord(deg)}) — психологический урон ×${PSYCH_MULTIPLIERS[kind]} = <b>${damage}</b> Магнитуды`),
    sections: [`<div class="roll-damage-meta">${esc(meta.sub)}</div>`]
  }, { rolls: [roll], sound: false });

  return { passed, degrees: deg, psychDamage: damage };
}

/**
 * Сколько психологического урона стоит Орде проваленный тест против Огня:
 * «вместо эффекта Горения получает дополнительный Психологический урон,
 * равный обычному урону в Магнитуду от этого попадания». Несломляемая Орда
 * психологического урона не получает вовсе.
 */
export function hordeFlameFailDamage({ resisted = false, magLoss = 0, immune = false } = {}) {
  if (resisted || immune) return 0;
  return Math.max(0, Number(magLoss) || 0);
}

/**
 * Огонь по Орде («Орды», Психологический урон): тест A+мод, чтобы не
 * загореться. Горения у Орды нет — провал вместо него снимает ещё столько
 * Магнитуды психологическим уроном, сколько сняло само попадание этой
 * карточки атаки (флаг LAST_HIT_FLAG). Урон карточки не применён к этой Орде —
 * отказ с подсказкой; Shift (force) — ГМ вводит число сам.
 *
 * @returns {Promise<?{resisted:boolean, psychDamage:number}>}
 */
export async function rollHordeFlameTest(horde, { testChar = "ag", testMod = 0, messageId = "", force = false, label = "Огонь" } = {}) {
  const rec = horde.getFlag?.("warhammer-dbc", LAST_HIT_FLAG);
  let magLoss = rec?.messageId && rec.messageId === messageId ? Number(rec.magLoss) || 0 : null;
  if (magLoss === null) {
    if (!force) {
      ui.notifications.warn(`⚠️ ${label}: сначала примените урон этой атаки к Орде «${horde.name}» — психологический урон равен снятой им Магнитуде (Shift — ввести вручную).`);
      return null;
    }
    magLoss = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${label} → ${horde.name}` },
      classes: ["warhammer-dbc", "wh-holo"],
      content: `<div class="wh-attack-form"><div class="atk-dlg-row"><label>Урон в Магнитуду от попадания:</label>
        <input id="h-flame-mag" type="number" min="0" value="1"/></div></div>`,
      ok: { label: "Бросок!", callback: (event, button) => parseInt(button.form.querySelector("#h-flame-mag")?.value) || 0 }
    }).catch(() => null);
    if (magLoss === null || magLoss === undefined) return null;
  }

  const base = Number(horde.system?.characteristics?.[testChar]?.total) || 0;
  const ruleMods = collectTestMods(horde, { kind: "skill", char: testChar });
  const threshold = base + (Number(testMod) || 0) + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const resisted = rv <= threshold;
  const deg = Math.floor(Math.abs(rv - threshold) / 10) + 1;
  const immune = !!horde.system?.immuneFear;
  const damage = hordeFlameFailDamage({ resisted, magLoss, immune });
  if (damage > 0) await applyPsychDamage(horde, damage);

  const outcome = resisted
    ? `Успех (${deg} ${_degWord(deg)}) — пламя не сломило строй`
    : immune
      ? `Провал — но эта Орда психологического урона не получает`
      : `Провал (${deg} ${_degWord(deg)}) — вместо Горения психологический урон <b>${damage}</b> Магнитуды`;
  await postTestCard(horde, {
    classes: "horde-psych",
    title: `${esc(horde.name)} — ${esc(label)}`,
    threshold: rollStatLine({
      label: testChar.toUpperCase(), base,
      parts: [testMod ? `мод. ${testMod >= 0 ? "+" : ""}${testMod}` : "", ...ruleMods.parts],
      threshold, rv
    }),
    outcome: outcomeHtml(resisted, outcome),
    sections: [`<div class="roll-damage-meta">Попадание сняло ${magLoss} Магнитуды — провал стоит столько же психологическим уроном</div>`]
  }, { rolls: [roll], sound: false });
  return { resisted, psychDamage: damage };
}

/**
 * Наносит психологический урон: он уменьшает Магнитуду так же, как обычный,
 * но копится отдельно — только его можно «вылечить» речью и угрозами.
 */
export async function applyPsychDamage(horde, amount) {
  const sys = horde.system ?? {};
  if (sys.immuneFear) return 0;
  const damage = Math.max(0, Number(amount) || 0);
  if (!damage) return 0;

  const value = Math.max(0, Number(sys.magnitude?.value) || 0);
  const after = Math.max(0, value - damage);
  await horde.update({
    "system.magnitude.value": after,
    "system.psychDamage": (Number(sys.psychDamage) || 0) + damage
  });
  // Психологический урон «уменьшает Магнитуду так же, как обычный» — он
  // идёт и в счёт массивных потерь за Раунд (25% стартовой → тест
  // W+Магнитуда), и может уронить Орду за половину (запрет лечения).
  await addRoundDamage(horde, value - after);
  await lockIfCrossedHalf(horde, value, after);
  return damage;
}

/**
 * Просела за половину стартовой Магнитуды именно этим уроном — психологический
 * урон не восстанавливается 10−W.b часов. Ставится один раз, на переходе.
 */
export async function lockIfCrossedHalf(horde, before, after) {
  const start = Number(horde.system?.magnitude?.start) || 0;
  if (start > 0 && before > start / 2 && after <= start / 2) return lockPsychHealing(horde);
  return 0;
}

/**
 * Лечение психологического урона (Командование, социальные взаимодействия).
 * Возвращает, сколько удалось вернуть: обычные потери так не восполняются, и
 * Ослабленная Орда не лечится 10−W.b часов после того, как просела за половину.
 */
export async function healPsychDamage(horde, amount) {
  const sys = horde.system ?? {};
  const psych = Math.max(0, Number(sys.psychDamage) || 0);
  const healed = Math.min(Math.max(0, Number(amount) || 0), psych);
  if (!healed) return 0;

  const value = Math.max(0, Number(sys.magnitude?.value) || 0);
  const start = Math.max(0, Number(sys.magnitude?.start) || 0);
  await horde.update({
    "system.magnitude.value": start > 0 ? Math.min(start, value + healed) : value + healed,
    "system.psychDamage": psych - healed
  });
  return healed;
}

/** Заперто ли лечение психологического урона прямо сейчас. */
export function psychHealLocked(horde) {
  const until = Number(horde?.getFlag?.("warhammer-dbc", PSYCH_LOCK_FLAG)) || 0;
  if (!until) return null;
  const now = Number(game?.time?.worldTime) || 0;
  if (now >= until) return null;
  return { until, hoursLeft: Math.ceil((until - now) / 3600) };
}

/**
 * Ставит запрет на лечение психологического урона: Орда, потерявшая больше
 * половины, не восстанавливает его 10−W.b часов.
 */
export async function lockPsychHealing(horde) {
  const wpBonus = Number(horde.system?.characteristics?.wp?.bonus) || 0;
  const hours = noRecoveryHours(wpBonus);
  if (hours <= 0) return 0;
  const now = Number(game?.time?.worldTime) || 0;
  await horde.setFlag("warhammer-dbc", PSYCH_LOCK_FLAG, now + hours * 3600);
  return hours;
}
