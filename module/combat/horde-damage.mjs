// module/combat/horde-damage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПРИМЕНЕНИЕ УРОНА ПО ОРДЕ
//
//  Обычный конвейер урона (combat/damage.mjs) Орде не годится: у неё нет Ран,
//  Поглощение лежит одним числом, а место попадания всегда торс. Здесь считается
//  ровно то, что нужно толпе — сколько попаданий прошло и сколько Магнитуды они
//  сняли. Счётная часть без Foundry — rules/horde-damage.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hordeExtraHits, hordeMagnitudeLoss, needsMassDamageTest, massDamageThreshold }
  from "../rules/horde-damage.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { lockPsychHealing } from "./horde-psych.mjs";
import { esc } from "../helpers/utils.mjs";
import { testCardHtml, postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { DAMAGE_TYPES } from "../constants/items.mjs";

/** Флаг накопленного за Раунд урона в Магнитуду — для теста W+Магнитуда. */
export const ROUND_DAMAGE_FLAG = "hordeRoundDamage";

/** Итоговый Размер актора: своя база плюс вклад Черт. */
function sizeOf(actor) {
  const sys = actor?.system ?? {};
  if (sys.sizeTotal != null) return Number(sys.sizeTotal) || 0;
  return (Number(sys.size) || 0) + (Number(sys.sizeMod) || 0) + (Number(sys.sizeModNoSpd) || 0);
}

/** Есть ли у актора Талант или Черта с таким именем (имена двуязычные). */
function hasNamed(actor, name) {
  return [...(actor?.items ?? [])].some(
    i => (i?.type === "talent" || i?.type === "trait") && itemHasName(i, name));
}

/**
 * Надбавка урона в Магнитуду от Талантов атакующего.
 *
 * «Ураган Смерти» — рукопашные атаки, ½WS.b (окр.▲).
 * «Свинцовый Дождь» — стрельба очередями либо оружием со свойством Blast или
 * Spray, ½BS.b (окр.▲).
 */
export function talentMagBonus(attacker, { melee = false, burst = false, blast = 0, spray = false } = {}) {
  if (!attacker) return { bonus: 0, note: "" };
  const chars = attacker.system?.characteristics ?? {};

  if (melee && hasNamed(attacker, "Whirlwind of Death")) {
    const bonus = Math.ceil((Number(chars.ws?.bonus) || 0) / 2);
    if (bonus > 0) return { bonus, note: `Ураган Смерти: +${bonus}` };
  }
  if (!melee && (burst || blast > 0 || spray) && hasNamed(attacker, "Storm of Lead")) {
    const bonus = Math.ceil((Number(chars.bs?.bonus) || 0) / 2);
    if (bonus > 0) return { bonus, note: `Свинцовый Дождь: +${bonus}` };
  }
  return { bonus: 0, note: "" };
}

/** Актор-атакующий по uuid из кнопки карточки. Не нашёлся — считаем без него. */
function resolveAttacker(uuid) {
  if (!uuid) return null;
  try {
    const doc = fromUuidSync(uuid);
    return doc?.actor ?? doc ?? null;
  } catch (e) { return null; }
}

/**
 * Применяет одно попадание по Орде.
 *
 * @param {Actor}  horde
 * @param {object} damageData — то же, что у applyDamageToActor, плюс свойства
 *        оружия, которые дают Орде дополнительные попадания.
 * @returns {Promise<{magLoss:number, hits:number}>}
 */
export async function applyDamageToHorde(horde, damageData = {}) {
  const {
    rawDamage = 0, damageType = "impact", attackerName = "", weaponName = "",
    blast = 0, flame = false, powerField = false, spray = false, weaponRange = 0,
    devastating = 0, melee = false, burst = false, attackerUuid = "",
    psychological = false
  } = damageData;

  const sys = horde.system ?? {};
  const derived = sys.derived ?? {};
  // Поглощение Орды: ручное поле (броня без предмета + бонус Стойкости) плюс AP
  // тела надетой брони. Пробитие в счёт не идёт — у толпы нет зон брони, и
  // правило требует всего лишь «пробить Поглощение».
  const absorption = Number(derived.absorptionTotal ?? sys.absorption) || 0;

  const attacker = resolveAttacker(attackerUuid);
  const { hits, notes } = hordeExtraHits({
    blast, flame, powerField, spray, range: weaponRange, melee,
    attackerSize: sizeOf(attacker), creatureSize: Number(sys.sizeMod) || 0
  });

  const talent = talentMagBonus(attacker, { melee, burst, blast, spray });
  const { pierced, magLoss } = hordeMagnitudeLoss({
    rawDamage, absorption, hits,
    devastating, talentBonus: talent.bonus
  });

  const before = Math.max(0, Number(sys.magnitude?.value) || 0);
  const after  = Math.max(0, before - magLoss);

  if (magLoss > 0) {
    const update = { "system.magnitude.value": after };
    // Психологический урон уменьшает Магнитуду так же, как обычный, но
    // отслеживается отдельно: только он лечится Командованием и социалкой.
    if (psychological) update["system.psychDamage"] = (Number(sys.psychDamage) || 0) + magLoss;
    await horde.update(update);
    await addRoundDamage(horde, magLoss);

    // Просели за половину — психологический урон не восстанавливается 10−W.b
    // часов. Ставим запрет один раз, на самом переходе.
    const start = Number(sys.magnitude?.start) || 0;
    if (start > 0 && before > start / 2 && after <= start / 2) await lockPsychHealing(horde);
  }

  await postHordeDamageCard(horde, {
    rawDamage, absorption, damageType, attackerName, weaponName,
    hits, notes, talent, devastating, pierced, magLoss, before, after, psychological
  });

  return { magLoss, hits };
}

/**
 * Копит урон в Магнитуду за текущий боевой Раунд: набежало 25% стартовой —
 * Орда обязана пройти тест W+Магнитуда, иначе потеряет ещё Провалы×3.
 * Счётчик обнуляется хуком на смену Раунда (hooks.mjs).
 */
export async function addRoundDamage(horde, amount) {
  const prev = Number(horde.getFlag("warhammer-dbc", ROUND_DAMAGE_FLAG)) || 0;
  const next = prev + (Number(amount) || 0);
  await horde.setFlag("warhammer-dbc", ROUND_DAMAGE_FLAG, next);

  const start = Number(horde.system?.magnitude?.start) || 0;
  // Предупреждаем ровно один раз — на переходе через порог, а не каждый удар.
  if (!needsMassDamageTest({ roundDamage: prev, startMagnitude: start }) &&
       needsMassDamageTest({ roundDamage: next, startMagnitude: start })) {
    await postMassDamageWarning(horde, next, massDamageThreshold(start));
  }
  return next;
}

/** Карточка: потери Орды за Раунд перешли порог — нужен тест W+Магнитуда.
 *
 *  НЕ карточка теста (wdbc-kuun): броска и Порога здесь нет, это ЗАПРОС теста
 *  с кнопкой. Разметка общая (testCardHtml; корневой класс `horde-mass-dmg` —
 *  по нему styles/sheets/horde-sheet.css рисует кнопку), а публикация осталась
 *  своей и это не недоделка: postTestCard прогоняет данные через
 *  ChatMessage.applyRollMode, и в приватном режиме броска требование «пройди
 *  тест» пропало бы у стола, хотя нажимать кнопку нужно игроку.
 */
async function postMassDamageWarning(horde, roundDamage, threshold) {
  const wp  = Number(horde.system?.characteristics?.wp?.total) || 0;
  const mag = Number(horde.system?.magnitude?.value) || 0;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: horde }),
    content: testCardHtml({
      classes: "horde-mass-dmg",
      title: `${esc(horde.name)} — массивные потери`,
      threshold: `<div class="roll-threshold">За Раунд потеряно <b>${roundDamage}</b> Магнитуды при пороге <b>${threshold}</b> (25% стартовой)</div>`,
      outcome: outcomeHtml(false, "Требуется тест W+Магнитуда — провал стоит Провалы×3 Магнитуды"),
      sections: [`<div class="roll-apply-dmg-section">
        <button class="wh-horde-psych-btn" type="button"
          data-horde-id="${horde.id}" data-kind="massDamage">
          Тест W+Магнитуда: <b>${wp} + ${mag}</b>
        </button>
      </div>`]
    })
  });
}

/** Карточка применённого урона по Орде.
 *
 *  Это карточка УРОНА, а не теста (ни броска, ни Порога) — от общего сборщика
 *  (wdbc-kuun) берутся разметка и публикация. Корневой класс `horde-dmg`
 *  оставлен: по нему styles/sheets/horde-sheet.css рисует чип «Орда».
 *  Говорит от лица «Системы», а не от Орды, поэтому speaker задан явно.
 */
async function postHordeDamageCard(horde, d) {
  const dtLabel = DAMAGE_TYPES[d.damageType] || d.damageType || "";
  const extraNotes = [...d.notes];
  if (d.devastating > 0) extraNotes.push(`Опустошительное (${d.devastating}): +${d.devastating}`);
  if (d.talent.note) extraNotes.push(d.talent.note);

  const outcome = d.pierced
    ? outcomeHtml(false, `Пробито: −<b>${d.magLoss}</b> Магнитуды${d.psychological ? " (психологический урон)" : ""}`)
    : outcomeHtml(true, `Поглощено (${d.rawDamage} ≤ ${d.absorption}) — толпа не заметила`);

  await postTestCard(null, {
    classes: "horde-dmg",
    title: `Урон → ${esc(horde.name)} <span class="horde-chip">Орда</span>`,
    lines: [
      `<div class="roll-damage-meta">
        Источник: <b>${esc(d.attackerName || "?")}</b>${d.weaponName ? ` (${esc(d.weaponName)})` : ""}
        · Место: <b>Торс</b> · Тип: <b>${dtLabel}</b> · Урон: <b>${d.rawDamage}</b>
      </div>`,
      `<div class="dmg-absorption-detail">
        Поглощение Орды: <b>${d.absorption}</b>
        <div class="dmg-tb-note">Пробившее попадание стоит 1 Магнитуды — величина урона роли не играет.</div>
      </div>`
    ],
    sections: [
      `<div class="roll-damage-section">
        <div class="roll-section-head">Попаданий по Орде: <b>${d.hits}</b></div>
        ${extraNotes.length ? `<div class="roll-damage-meta">${extraNotes.map(esc).join(" · ")}</div>` : ""}
        <div class="roll-outcome">${outcome}</div>
        <div class="roll-damage-meta">Магнитуда: <b>${d.before}</b> → <b>${d.after}</b></div>
      </div>`
    ]
  }, { speaker: { alias: "Система" }, sound: false });
}
