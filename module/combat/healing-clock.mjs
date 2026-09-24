// module/combat/healing-clock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Естественное лечение по Календарю (wdbc-x1nz.2.104; решение владельца
//  24.09.2026): раненый лечится сам раз в сутки — или раз в 8 часов под
//  успешным медицинским уходом — по режиму на листе (system.healing.regimen).
//  Обработчик часов Состояний (combat/condition-clock.mjs), та же точка
//  входа — хук updateWorldTime.
//
//  Период: начинается, когда часы впервые видят раненого (или ручная кнопка
//  диалога его перезапускает); в начале периода медик на уходе
//  (system.healing.caregiver) сам бросает Medicae (+0, критическому −10) —
//  успех сокращает период до 8 ч или лечит критического как тяжёлого. В
//  конце периода — лечение по таблице rules/healing-clock.mjs, при
//  необходимости тест T+0. Прыжок Календаря на неделю — все периоды
//  подряд, одной карточкой.
//
//  Бой: «во время отдыха персонаж не должен … участвовать в боях» — в
//  начатом бою Отдых и Постельный режим засчитываются как Пассивное.
//  Карточка — владельцам-игрокам в общий чат, статистам — только ГМу.
// ════════════════════════════════════════════════════════════════════════════

import { woundLevel } from "../rules/wound-tier.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { medicaeEff } from "../sheets/tabs/healing.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import {
  REGIMEN_HEAL_LABELS, astartesRegimen, regimenHeal, careTestMod,
  healPeriodSeconds, effectiveHealKey, isWounded
} from "../rules/healing-clock.mjs";

/** Страховка от бесконечного цикла: 8-часовых периодов в прыжке на полгода. */
const MAX_PERIODS = 600;

const LEVEL_LABELS = { light: "Лёгкое", heavy: "Тяжёлое", critical: "Критическое" };

/** Медик на уходе — живой актор по UUID, иначе null. */
function caregiverOf(actor) {
  const uuid = actor.system?.healing?.caregiver;
  if (!uuid) return null;
  const doc = globalThis.fromUuidSync?.(uuid);
  return doc?.documentName === "Actor" && !doc.getFlag?.("warhammer-dbc", "deceased") ? doc : null;
}

/** В начатом бою ли актор — тогда он не отдыхает. */
function inCombat(actor) {
  const combat = game.combat;
  return !!combat?.started && !!combat.combatants?.some?.(c => c.actor === actor || c.actor?.id === actor.id);
}

/**
 * Тест ухода на новый период. Нет медика — уход не идёт (false, без броска).
 * @returns {Promise<{ok: boolean, line?: string, roll?: Roll}>}
 */
async function rollCare(actor, key) {
  const medic = caregiverOf(actor);
  if (!medic) return { ok: false };
  const mod = careTestMod(key);
  const eff = medicaeEff(medic, actor, mod);
  const roll = await new Roll("1d100").evaluate();
  const ok = roll.total <= eff;
  const gain = key === "critical" ? "лечится как тяжёлый" : "следующее лечение через 8 ч";
  const line = `Мед. уход (${esc(medic.name)}): Медика${mod ? mod : "+0"} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok
    ? `<span class="roll-success">Успех, ${gain}</span>` : `<span class="roll-failure">Провал</span>`}`;
  return { ok, line, roll };
}

/** Тест T+0 пациента (Итог + Черты/Конструктор). */
async function rollToughness(actor) {
  const base = Number(actor.system.characteristics?.t?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "t" });
  const threshold = base + mods.total;
  const roll = await new Roll("1d100").evaluate();
  return { ok: roll.total <= threshold, threshold, roll };
}

/**
 * Часы естественного лечения одного актора за отрезок (from, to].
 * Экспорт — для CONDITION_CLOCK_HANDLERS и тестов.
 */
export async function healingClock(actor, { from, to }) {
  const sys = actor?.system;
  if (!sys?.wounds || !sys.healing) return;
  let nextAt = Number(sys.healing.nextAt) || 0;
  if (!isWounded(sys.wounds)) {
    if (nextAt) await actor.update({ "system.healing.nextAt": 0, "system.healing.careOk": false });
    return;
  }

  // Ход лечения ведётся на копии Ран: несколько периодов — одна запись.
  const wounds = { ...sys.wounds };
  const view = () => ({ ...sys, wounds });
  const lines = [];
  const rolls = [];
  let careOk = !!sys.healing.careOk;

  if (!nextAt) {
    const care = await rollCare(actor, woundLevel(view()).key);
    if (care.roll) { rolls.push(care.roll); lines.push(care.line); }
    careOk = care.ok;
    nextAt = Number(from) + healPeriodSeconds(woundLevel(view()).key, careOk);
  }

  const astartes = hasRuleFlag(actor, "healing.astartes");
  let healed = 0;
  let periods = 0;
  while (nextAt <= to && periods++ < MAX_PERIODS) {
    const lvl = woundLevel(view());
    if (!isWounded(wounds)) { nextAt = 0; careOk = false; break; }
    const chosen = inCombat(actor) ? "active" : (sys.healing.regimen || "active");
    const regimen = astartesRegimen(chosen, astartes);
    const key = effectiveHealKey(lvl.key, careOk);
    const { amount, needT } = regimenHeal(regimen, key, lvl.tb);
    let gain = amount;
    let detail = `${amount} Ран`;
    if (needT) {
      const t = await rollToughness(actor);
      rolls.push(t.roll);
      gain = t.ok ? 1 : 0;
      detail = `тест T+0 → порог <b>${t.threshold}</b>, бросок <b>${t.roll.total}</b> — ${t.ok
        ? '<span class="roll-success">Успех, 1 Рана</span>' : '<span class="roll-failure">Провал</span>'}`;
    }
    const woundMax = Number(wounds.effectiveMax ?? wounds.max) || 0;
    const missing = Math.max(0, woundMax - (Number(wounds.value) || 0)) + (Number(wounds.critical) || 0);
    const applied = Math.min(gain, missing);
    if (applied > 0) {
      const upd = computeWoundHealing({ wounds }, applied);
      wounds.value = upd["system.wounds.value"];
      wounds.critical = upd["system.wounds.critical"];
      healed += applied;
    }
    const regimenNote = regimen !== chosen ? ` (Астартес: как «${REGIMEN_HEAL_LABELS[regimen]}»)` : "";
    const careNote = key !== lvl.key ? ", уход — как тяжёлое" : "";
    lines.push(`<b>${REGIMEN_HEAL_LABELS[chosen]}</b>${regimenNote}, ${LEVEL_LABELS[lvl.key]}${careNote}: ${gain === 0 && !needT ? "нет лечения" : detail}${applied < gain ? ` (восстановлено ${applied})` : ""}.`);

    if (!isWounded(wounds)) { nextAt = 0; careOk = false; break; }
    const care = await rollCare(actor, woundLevel(view()).key);
    if (care.roll) { rolls.push(care.roll); lines.push(care.line); }
    careOk = care.ok;
    nextAt += healPeriodSeconds(woundLevel(view()).key, careOk);
  }

  await actor.update({
    "system.wounds.value": wounds.value,
    "system.wounds.critical": wounds.critical,
    "system.healing.nextAt": nextAt,
    "system.healing.careOk": careOk
  });
  if (!periods && !rolls.length) return;

  const total = healed ? `<br/>Итого восстановлено Ран: <b>${healed}</b>.` : "";
  const rollMode = actor.hasPlayerOwner ? game.settings.get("core", "rollMode") : "gmroll";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart", "#ff8a8a")}${esc(actor.name)} — Лечение</div>
      <div class="roll-threshold">${lines.join("<br/>")}${total}</div>
    </div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : null
  }, rollMode));
}
