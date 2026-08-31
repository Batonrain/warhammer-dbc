// module/combat/dread-wail.mjs
// ════════════════════════════════════════════════════════════════════════
//  Dread Wail/Грозный Вопль (Черта, Шумовой Десантник, wdbc-sk8s): «Раз за
//  бой может потратить Очко Бесчестия, чтобы перегрузить динамики и
//  звуковые усилители брони: до начала следующего Хода усилить Dmg и Pen
//  звукового оружия на Per.b [«R.b» книги — решение пользователя], ЛИБО
//  испустить звуковую волну по всем в радиусе ½ Cor.b м, кто не посвящён
//  Слаанеш (тест W−20 или один из эффектов на выбор до активации: рейтинг
//  Страха 2 до конца боя; 1d5 Усталости; Оглушение на 2 Раунда).»
//
//  Sweet Cacophony/Сладкая Какофония (wdbc-sk8s) расширяет лимит с 1 до
//  Cor.b раз за бой — счётчик throttleCount(actor, FLAG, "battle") с
//  переменным max, тот же приём, что и везде в этой сессии.
//
//  «Звуковое оружие» — не формальный класс в системе (нет структурного
//  свойства), только имена конкретных предметов («Sonic Blaster» и т.п.,
//  constants/elite-archetypes.mjs) — определяется по regex на имя, тем же
//  приёмом, что constants/body-map.mjs::/sonic shrieker|звуков.../i.
//
//  «Рейтинг Страха 2 до конца боя» — НЕ интегрирован в производный расчёт
//  system.fearRating (character.mjs, сумма от Трейтов) — это временный
//  триггер, а не хранимая Черта; отмечено информационным флагом для стола,
//  тем же уровнем автоматизации, что и Voice of God/temp-infamy.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "dreadWail";
const WEAPON_BUFF_FLAG = "dreadWailWeaponBuff";
const SONIC_RE = /sonic|звуков/i;

export const WAVE_EFFECTS = [
  { key: "fear",     label: "Рейтинг Страха 2 до конца боя" },
  { key: "fatigue",  label: "1d5 Усталости" },
  { key: "stunned",  label: "Оглушение на 2 Раунда" }
];

/** Владеет ли актор Чертой Dread Wail / Грозный Вопль. */
export function hasDreadWail(actor) {
  return !!actor?.items?.some(i => i.type === "trait" && itemHasName(i, "Dread Wail"));
}

function hasSweetCacophony(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Sweet Cacophony"));
}

/** Лимит использований за бой — 1, либо Cor.b с Sweet Cacophony (мин. 1). */
export function dreadWailMax(actor) {
  if (!hasSweetCacophony(actor)) return 1;
  return Math.max(1, Number(actor?.system?.corruptionBonus) || 0);
}

/** Доступна ли способность (любая из веток) прямо сейчас. */
export function dreadWailAvailable(actor) {
  return hasDreadWail(actor) && isThrottleCountAvailable(actor, FLAG, "battle", dreadWailMax(actor));
}

/** Похоже ли оружие на «звуковое» — по имени, формального класса в системе нет. */
export function isSonicWeapon(item) {
  return SONIC_RE.test(item?.name || "");
}

/** Бонус к Dmg/Pen звукового оружия от активного усилителя — {dmg:0,pen:0}, если не активен/не звуковое. */
export function dreadWailWeaponBonus(actor, item) {
  const buff = actor?.getFlag?.("warhammer-dbc", WEAPON_BUFF_FLAG);
  if (!buff?.active || !isSonicWeapon(item)) return { dmg: 0, pen: 0 };
  return { dmg: Number(buff.bonus) || 0, pen: Number(buff.bonus) || 0 };
}

async function spendAndCount(actor) {
  // Очко Бесчестия — условие активации, а не побочный эффект: без него
  // способность не срабатывает и счётчик за бой не растёт.
  const fate = actor.system.fate?.value ?? 0;
  if (fate <= 0) { ui.notifications?.warn("Нет Очка Бесчестия — Грозный Вопль не активирован."); return false; }
  await actor.update({ "system.fate.value": fate - 1 });
  await incrementThrottleCount(actor, FLAG, "battle", dreadWailMax(actor));
  return true;
}

/** Ветка «усиление оружия»: +Per.b Dmg/Pen звуковому оружию до начала следующего Хода. */
export async function applyDreadWailWeaponBuff(actor) {
  await spendAndCount(actor);
  const perBonus = Number(actor.system?.characteristics?.per?.bonus) || 0;
  await actor.setFlag("warhammer-dbc", WEAPON_BUFF_FLAG, { active: true, bonus: perBonus });
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", "#c98bff")}Грозный Вопль — ${esc(actor.name)}</div>
      <div class="roll-threshold">Звуковое оружие получает <b>+${perBonus}</b> Dmg/Pen до начала следующего Хода.</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Снимает усилитель оружия — звать в начале Хода актора (hooks.mjs::updateCombat). */
export async function clearDreadWailWeaponBuff(actor) {
  if (actor?.getFlag?.("warhammer-dbc", WEAPON_BUFF_FLAG)?.active) {
    await actor.unsetFlag("warhammer-dbc", WEAPON_BUFF_FLAG);
  }
}

async function applyWaveEffect(targetActor, effectKey) {
  if (effectKey === "fatigue") {
    const roll = await new Roll("1d5").evaluate();
    const cur = Number(targetActor.system.fatigue?.value) || 0;
    await targetActor.update({ "system.fatigue.value": cur + roll.total });
    return `+${roll.total} Усталости`;
  }
  if (effectKey === "stunned") {
    const curRounds = Number(targetActor.system.conditions?.stunnedRounds) || 0;
    await targetActor.update({
      "system.conditions.stunned": true,
      "system.conditions.stunnedRounds": Math.max(curRounds, 2)
    });
    return "Оглушение на 2 Раунда";
  }
  // "fear" — информационная метка, см. заголовок файла (не интегрирована в
  // производный system.fearRating).
  await targetActor.setFlag("warhammer-dbc", "dreadWailFeared", true);
  return "Рейтинг Страха 2 до конца боя (отметьте вручную)";
}

/** Ветка «звуковая волна»: AoE в радиусе ½Cor.b м, тест W−20, провал → выбранный эффект (общий для всех провалившихся). */
export async function applyDreadWailWave(actor, casterToken, effectKey) {
  await spendAndCount(actor);
  const corBonus = Number(actor.system?.corruptionBonus) || 0;
  const radius = corBonus / 2;
  const inRange = tokensWithinRadius(casterToken, radius)
    .filter(t => t.actor && !hasRuleFlag(t.actor, "dreadWail.immune"));

  const lines = [];
  for (const tokenDoc of inRange) {
    const targetActor = tokenDoc.actor;
    const threshold = (Number(targetActor.system?.characteristics?.wp?.total) || 0) - 20;
    const roll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(roll.total, threshold);
    if (success) { lines.push(`${esc(targetActor.name)}: устоял(а) (${roll.total} vs ${threshold})`); continue; }
    const effectNote = await applyWaveEffect(targetActor, effectKey);
    lines.push(`${esc(targetActor.name)}: провал (${roll.total} vs ${threshold}) — ${effectNote}`);
  }

  const effectLabel = WAVE_EFFECTS.find(e => e.key === effectKey)?.label || effectKey;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", "#c98bff")}Грозный Вопль — звуковая волна (радиус ${radius} м)</div>
      <div class="roll-threshold">Тест W−20, при провале: <b>${esc(effectLabel)}</b></div>
      ${lines.length ? lines.map(l => `<div>${l}</div>`).join("") : "<div><i>Никого в радиусе (кроме посвящённых Слаанеш)</i></div>"}
    </div>`
  }, game.settings.get("core", "rollMode")));
}
