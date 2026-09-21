// module/combat/unseen-attack.mjs
//
// Незримое (стр. 32, wdbc-1rno.2) — реактивный тест защищающегося на
// засечение Незримой атаки (Психонаука/Пси-чутьё или Техпользование/
// Ноосканирование), кнопка в той же карточке, что Уклонение/Парирование
// (module/combat/attack-card.mjs::defenseSection). Обобщение узкого
// module/combat/hidden-threat.mjs (wdbc-1rno.1: тот же тест, но с
// зашитым −50 и завязкой только на Дар «Сокрытая Угроза») — здесь штраф
// параметризован (0 по умолчанию, −50 передаёт вызывающая сторона, когда
// источник Незримости — именно Hidden Threat).
//
// Результат детекта разовый: снимает блокировку Уклонения/Парирования
// ТОЛЬКО в ЭТОЙ карточке (клиентский DOM-разблок, module/hooks.mjs) — не
// пишет ничего на актора. Персистентное засечение «до начала следующего
// Хода» — отдельный путь, module/rules/unseen-attack.mjs
// (markUnseenDetectedUntilNextTurn, зовётся Ноосферным Сканированием, не
// этим реактивным тестом).

import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { actorInfamyValue, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { markUnseenDetectedUntilNextTurn } from "../rules/unseen-attack.mjs";

const SKILLS = {
  psyniscience: { label: "Психонаука (Пси-чутьё)", char: "per" },
  techUse:      { label: "Техпользование (Ноосканирование)", char: "int" }
};

/**
 * @param {Actor} actor защищающийся
 * @param {string} skillKey "psyniscience" | "techUse"
 * @param {{penalty?: number}} opts штраф к Порогу (Сокрытая Угроза: −50, иначе 0)
 * @returns {Promise<{success: boolean}>}
 */
export async function _performUnseenDetect(actor, skillKey, { penalty = 0 } = {}) {
  const def = SKILLS[skillKey];
  if (!def) return { success: false };

  const skillTotal = Number(actor.system?.skills?.[skillKey]?.total) || -20;
  const threshold = skillTotal + penalty;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;

  await postTestCard(actor, {
    icon: rollIcon("target"), title: `Засечь Незримую атаку — ${esc(actor.name)}`,
    threshold: rollStatLine({
      label: def.label, base: skillTotal,
      parts: penalty ? [`Сокрытая Угроза ${penalty}`] : [], threshold, rv
    }),
    outcome: success
      ? `<span class="roll-success">Успех — атака засечена, Уклонение/Парирование от неё доступны.</span>`
      : `<span class="roll-failure">Провал — источник атаки остаётся скрыт.</span>`
  }, { rolls: [roll] });

  return { success };
}

/**
 * Sixth Sense / Шестое Чувство (персистентный обход) и Music of Battle /
 * Музыка Битвы (разовый обход) — module/rules/unseen-talents.mjs. Оба
 * тратят 1 Очко Бесчестия, чтобы Уклониться/Парировать вопреки блоку
 * Незримой атаки, без теста на засечение. `persistent` — только у Sixth
 * Sense (книжный текст явно обещает «до начала следующего Хода», у Music
 * of Battle — нет).
 *
 * Гейт «хватает ли Очков» — на рендере кнопки (attack-card.mjs, actor уже
 * известен при сборке карточки), здесь — не переспрашивается повторно:
 * тот же риск гонки, что уже принят у остальных spendFromInfamyPool-кнопок
 * этого проекта (переброс очком Судьбы, hooks.mjs — canSpend считается
 * один раз при открытии меню, не на каждый клик).
 *
 * @param {Actor} actor защищающийся
 * @param {{persistent?: boolean, label: string}} opts
 * @returns {Promise<{spent: boolean, poolValue?: number}>}
 */
export async function _performUnseenBypass(actor, { persistent = false, label = "" } = {}) {
  if (actorInfamyValue(actor) < 1) return { spent: false };
  // Где лежит пул — спрашиваем у actorInfamyPath, а не подставляем
  // system.fate.value: у Демон-Принца Очки Бесчестия живут в system.dp.ip,
  // и гейт выше читал именно их, а списание уходило в чужое поле — обход
  // Незримого получался бесплатным (приёмка стопки #482-#504).
  const poolPath = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, poolPath);
  await actor.update({ [poolPath]: spend.poolValue });
  if (persistent) await markUnseenDetectedUntilNextTurn(actor);

  await postTestCard(actor, {
    icon: rollIcon("target"), title: `${label} — ${esc(actor.name)}`,
    outcome: `<span class="roll-success">Потрачено 1 Очко Бесчестия — Уклонение/Парирование от этой атаки доступны`
      + `${persistent ? ", способность сохраняется до начала следующего Хода" : ""}.</span>`
  });

  return { spent: true, poolValue: spend.poolValue };
}
