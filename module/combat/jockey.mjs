// module/combat/jockey.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЖОКЕЙ / Jockey (Талант Пугилиста, стр. 62; задача Sahara 3-eddb, решение
//  владельца 24.10.2026) — только ВХОД.
//
//  «Он может совершать Захват против целей Размером выше себя, используя
//  Acrobatics(A) вместо Athletics(S), игнорируя штрафы за разницу в Размерах, и
//  может проводить его против целей до на 2 Размера больше себя, вместо до на 1
//  Размер как обычно. При победе он вместо обычного Захвата взбирается на цель.
//  Цель не может атаковать персонажа как при обычном Захвате, но атаки по ней
//  получают только половинный бонус от Борьбы (обычно +10), но в остальном
//  может свободно действовать. Раз в Раунд, когда цель совершает любое
//  физическое действие, персонаж может пройти против нее тест Acrobatics(A)+30
//  vs Athletics(S)+0 (игнорируя Unnatural S цели) и заставить её совершить
//  управляемое им Полудвижение.»
//
//  ЧТО АВТОМАТИЗИРОВАНО
//  • Вход (combat/grapple.mjs::applyGrappleOnHit): диалог Захвата идёт через
//    Acrobatics(A) без штрафа Размера, потолок цели — на 2 Размера крупнее
//    (без Таланта — на 1). При победе — resolveJockeySuccess ниже. Против цели
//    на 1 Размер крупнее сперва выбор «Захват / взобраться» (chooseJockeyMode):
//    обычный Захват там ещё разрешён и Талант его не отнимает.
//  • Состояние «взобрался» — НЕ Борьба: состояние grappling не ставится, так
//    что +20 «по сцепившимся» по Жокею не действует (sheets/attack/mods.mjs
//    читает именно его) и оковы Борьбы на цель не ложатся. Метка — пара флагов:
//    на Жокее jockeyRiding (uuid цели), на цели jockeyMountedBy (uuid Жокея).
//  • Окно атаки: по оседланной цели — строка +10 (половина бонуса Борьбы +20)
//    для всех, кроме самого Жокея (jockeyMountedBonus).
//  • Карточка победы напоминает остальное: цель не может атаковать Жокея.
//  • Метка снимается кнопкой «Спешиться» на карточке и по концу боя.
//
//  НЕ автоматизировано: запрет цели атаковать Жокея (стол помнит; нет гейта на
//  выбор цели), управление Полудвижением цели (Acrobatics(A)+30 vs Athletics(S)+0
//  раз в Раунд — тестом вручную), перенос токена Жокея вместе с целью.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const NS = "warhammer-dbc";

/** На Жокее: uuid оседланной цели. */
export const JOCKEY_RIDING_FLAG = "jockeyRiding";
/** На цели: uuid Жокея, сидящего на ней. */
export const JOCKEY_MOUNTED_FLAG = "jockeyMountedBy";
/** Половина обычного +20 по сцепившимся (sheets/attack/mods.mjs). */
export const JOCKEY_ATTACK_BONUS = 10;

/**
 * Цель слишком крупна для Захвата: без Таланта — на 2+ Размера, у Жокея — на 3+.
 * @param {number} sizeDiff Размер цели минус Размер атакующего
 */
export function jockeySizeBlocked(sizeDiff, hasJockey) {
  return sizeDiff >= (hasJockey ? 3 : 2);
}

/**
 * Против цели РОВНО на 1 Размер крупнее обычный Захват ещё разрешён (стр. 12),
 * и Жокей вправе выбрать его вместо «взобраться» («при победе он ВМЕСТО обычного
 * Захвата взбирается на цель» — выбор за игроком). На 2 Размера крупнее обычный
 * Захват запрещён — остаётся только взобраться, выбора нет.
 */
export function jockeyChoiceOffered(sizeDiff) {
  return sizeDiff === 1;
}

/**
 * Диалог «Захват / взобраться» для Жокея против цели на 1 Размер крупнее.
 * @returns {Promise<"grapple"|"climb"|null>} null — окно закрыто, Приём не проводится
 */
export async function chooseJockeyMode(actor, target) {
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Жокей — ${actor.name} → ${target.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="padding:4px 6px;">${esc(target.name)} крупнее на 1 Размер. Провести обычный Захват (Athletics(S), `
      + `штраф за разницу в Размере) или взобраться на цель (Acrobatics(A), без штрафа)?</p>`,
    rejectClose: false,
    buttons: [
      { action: "grapple", label: "Обычный Захват", default: true, callback: () => "grapple" },
      { action: "climb", label: "Взобраться (Жокей)", callback: () => "climb" }
    ]
  });
  return choice === "grapple" || choice === "climb" ? choice : null;
}

/** +10 на атаки по оседланной цели; Жокей сам по ней не получает бонуса. */
export function jockeyMountedBonus(targetActor, attackerActor) {
  const jockeyUuid = targetActor?.getFlag?.(NS, JOCKEY_MOUNTED_FLAG);
  if (!jockeyUuid) return 0;
  return attackerActor?.uuid === jockeyUuid ? 0 : JOCKEY_ATTACK_BONUS;
}

/** Победа Жокея во встречном тесте: взобраться на цель. */
export async function resolveJockeySuccess(actor, { target } = {}) {
  if (!actor || !target) return;
  // Уже сидел на другой цели — прежняя метка снимается.
  if (actor.getFlag?.(NS, JOCKEY_RIDING_FLAG)) await endJockey(actor);
  await actor.setFlag(NS, JOCKEY_RIDING_FLAG, target.uuid);
  await target.setFlag(NS, JOCKEY_MOUNTED_FLAG, actor.uuid);
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Жокей — ${esc(actor.name)} взобрался на ${esc(target.name)}`,
    sections: [
      `<div class="roll-threshold">${esc(target.name)} не может атаковать ${esc(actor.name)} как при обычном Захвате, `
      + `но в остальном действует свободно.</div>`,
      `<div class="roll-threshold">Атаки по ${esc(target.name)} получают половину бонуса Борьбы (+${JOCKEY_ATTACK_BONUS}) — `
      + `строка уже стоит в окне атаки; по ${esc(actor.name)} бонус Борьбы не действует.</div>`,
      `<div class="roll-threshold">Раз в Раунд, когда ${esc(target.name)} совершает физическое действие, `
      + `${esc(actor.name)} может пройти Acrobatics(A)+30 vs Athletics(S)+0 цели (Unnatural S цели игнорируется) и `
      + `заставить её совершить управляемое им Полудвижение — тест и движение ведёт стол.</div>`,
      `<button class="wh-jockey-dismount-btn" type="button" data-jockey-uuid="${esc(actor.uuid)}">`
      + `${rollIcon("sword")}Спешиться</button>`
    ]
  }, { sound: false });
}

/** Снять метку «взобрался» с Жокея и с его цели (любой из двух актёров). */
export async function endJockey(actor) {
  if (!actor) return;
  const targetUuid = actor.getFlag?.(NS, JOCKEY_RIDING_FLAG);
  const jockeyUuid = actor.getFlag?.(NS, JOCKEY_MOUNTED_FLAG);
  const otherUuid = targetUuid || jockeyUuid;
  const other = otherUuid ? await fromUuid(otherUuid).catch(() => null) : null;
  if (targetUuid) await actor.unsetFlag?.(NS, JOCKEY_RIDING_FLAG);
  if (jockeyUuid) await actor.unsetFlag?.(NS, JOCKEY_MOUNTED_FLAG);
  if (other) {
    if (other.getFlag?.(NS, JOCKEY_MOUNTED_FLAG)) await other.unsetFlag?.(NS, JOCKEY_MOUNTED_FLAG);
    if (other.getFlag?.(NS, JOCKEY_RIDING_FLAG)) await other.unsetFlag?.(NS, JOCKEY_RIDING_FLAG);
  }
}

/** Конец боя: метки «взобрался» снимаются у бойцов и токенов сцены. */
export async function clearJockeyOnCombatEnd(combat) {
  const actors = new Set();
  for (const c of combat?.combatants ?? []) if (c?.actor) actors.add(c.actor);
  for (const t of globalThis.canvas?.scene?.tokens ?? []) if (t?.actor) actors.add(t.actor);
  for (const a of actors) {
    for (const key of [JOCKEY_RIDING_FLAG, JOCKEY_MOUNTED_FLAG]) {
      if (a?.getFlag?.(NS, key)) await a.unsetFlag?.(NS, key);
    }
  }
}
