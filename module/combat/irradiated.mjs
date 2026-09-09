// module/combat/irradiated.mjs
// ════════════════════════════════════════════════════════════════════════
//  Облучённый / Irradiated (Дар Нургла, d100 59..62, wdbc-1rno):
//  «Все существа в радиусе 3 м от него в начале своего Хода получают
//  попадание со свойством Rad (1d10), считающееся наносящим Cor.b Dmg в
//  расчёте пробития брони. Он сам становится неуязвимым к радиации.»
//
//  Почему НЕ Region. Первая мысль — «аура, значит regions/»: движок регионов
//  умеет и триггер TOKEN_TURN_START, и урон (regions/linger-zone.mjs). Но
//  зона там СТОИТ НА МЕСТЕ, а эта аура ездит с носителем, и держать регион
//  синхронно с токеном пришлось бы отдельным механизмом. Радиус же нужен
//  ровно в один момент — начало Хода жертвы, — и в этот момент геометрию
//  можно просто посчитать (tokensWithinRadius), как это уже делает
//  combat/vulture.mjs тем же тактом. Регион здесь был бы дороже и хрупче.
//
//  Арифметика «пробития». Книга не говорит, что попадание наносит Раны —
//  Cor.b нужен только чтобы понять, пролезло ли облучение сквозь броню:
//  свойство Rad(X) срабатывает от НЕПОГЛОЩЁННОГО урона ≥ X. Поэтому здесь
//  нет вызова applyDamageToActor: считается непоглощённый остаток
//  (Cor.b − поглощение торса) и сравнивается с X. system.absorption.body
//  уже включает и AP брони, и T.b (documents/actor.mjs) — тот же источник,
//  которым пользуется сам конвейер урона.
//
//  Cor.b берётся у НОСИТЕЛЯ Дара: это его радиация, а не свойство жертвы.
//  Несколько носителей рядом дают несколько попаданий — книга их не
//  складывает и не схлопывает, у каждого чемпиона своя аура.
//
//  Иммунитет самого носителя оформлен НЕ здесь, а данными: записью
//  kind:"condition" condMode:"immunity" condKey:"radiation" на самом Даре —
//  её уважает любой путь наложения Состояния (rules/condition-guards.mjs).
//  Здесь носитель пропускается ещё и до броска, чтобы не сыпать в чат
//  карточками, исход которых заведомо пуст.
//
//  НЕ смоделировано: «вкусивший плоти или крови чемпиона получает
//  неуязвимость к радиации на 7 дней (тест Т+0 или 1d5 Порчи без
//  покровительства Нургла)» — поедание чужой плоти событием движка не
//  является, отдельной кнопки под это не заводим.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { isImmuneToCondition } from "../rules/condition-guards.mjs";
// combat/ → sheets/tabs/conditions.mjs: тот же (единственный) мостик, которым
// уже пользуется combat/crit-effect-parser.mjs — патч наложения Состояния
// живёт там, дублировать его здесь было бы хуже, чем импорт через слой.
import { conditionAdjustFields } from "../sheets/tabs/conditions.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export const IRRADIATED = "gift.nurgle.irradiated";
const RADIUS_M = 3;

/** Может ли актор вообще получить Состояние Радиации (у техники/Орды нет conditions). */
export function canTakeRadiation(actor) {
  return !!actor?.system?.conditions;
}

/**
 * Пробилось ли облучение: непоглощённый остаток Cor.b носителя против
 * поглощения торса жертвы, сравнённый с рейтингом Rad(X). Чистая функция.
 *
 * @param {number} corB        Cor.b НОСИТЕЛЯ Дара
 * @param {number} absorption  system.absorption.body жертвы (AP + T.b)
 * @param {number} radX        выпавший рейтинг Rad (1d10)
 */
export function radAuraOutcome(corB, absorption, radX) {
  const unsoaked = Math.max(0, (Number(corB) || 0) - (Number(absorption) || 0));
  const x = Number(radX) || 0;
  return { unsoaked, triggersTest: x > 0 && unsoaked >= x };
}

/** Носители Дара в радиусе 3 м от токена (сам токен в выборку не попадает). */
export function irradiatedSourcesNear(tokenDoc) {
  return tokensWithinRadius(tokenDoc, RADIUS_M).filter(t => hasRuleFlag(t.actor, IRRADIATED));
}

/**
 * Начало своего Хода жертвы: по одному попаданию Rad(1d10) от каждого
 * носителя Дара в радиусе. Провал теста T+0 — +1 уровень Радиации.
 */
export async function processIrradiatedTurnStart(actor, tokenDoc) {
  if (!actor || !tokenDoc || !canTakeRadiation(actor)) return;
  if (hasRuleFlag(actor, IRRADIATED)) return;
  if (isImmuneToCondition(actor, "radiation")) return;

  const sources = irradiatedSourcesNear(tokenDoc);
  if (!sources.length) return;

  const absorption = Number(actor.system?.absorption?.body) || 0;
  const tTotal = Number(actor.system?.characteristics?.t?.total) || 0;
  const lines = [];
  const rolls = [];
  let levels = 0;

  for (const sourceToken of sources) {
    const corB = Number(sourceToken.actor?.system?.corruptionBonus) || 0;
    const radRoll = await new Roll("1d10").evaluate();
    rolls.push(radRoll);
    const { unsoaked, triggersTest } = radAuraOutcome(corB, absorption, radRoll.total);
    if (!triggersTest) {
      lines.push(`<div class="roll-threshold">${esc(sourceToken.actor.name)}: Рад(<b>${radRoll.total}</b>) — непоглощённых <b>${unsoaked}</b> (Cor.b ${corB} − поглощение ${absorption}), броня выдержала</div>`);
      continue;
    }
    const test = await new Roll("1d100").evaluate();
    rolls.push(test);
    const failed = test.total > tTotal;
    if (failed) levels += 1;
    lines.push(`<div class="roll-threshold">${esc(sourceToken.actor.name)}: Рад(<b>${radRoll.total}</b>) прошёл (непоглощённых <b>${unsoaked}</b>) — тест T+0 (<b>${tTotal}</b>): <b>${test.total}</b> ${failed
      ? `<span class="roll-failure">провал → +1 Радиации</span>`
      : `<span class="roll-success">успех</span>`}</div>`);
  }

  if (levels > 0) await actor.update(conditionAdjustFields(actor, "radiation", levels));

  await postTestCard(actor, {
    icon: rollIcon("warp", "#ffe14d"),
    title: `Облучение — ${esc(actor.name)}`,
    lines
  }, { rolls, sound: false });
}
