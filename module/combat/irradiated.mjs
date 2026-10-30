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
//  Арифметика «пробития». Cor.b носителя — не урон в Раны, а число для
//  проверки брони: «считающееся наносящим Cor.b Dmg в расчёте пробития
//  брони». «Расчёт пробития» в книге (core.json, «Раны и Урон», Пробитие
//  Брони) — свой: «AP удваивается (или утраивается против I(Cr) Dmg), но T.b
//  игнорируется. Если в таком расчёте попадание нанесло бы непоглощённый
//  урон, это считается как пробитие брони». Это тот же расчёт, которым
//  damage.mjs решает, пробито ли оружием Rad (armorBreachOutcome), поэтому
//  здесь он и зовётся: Cor.b против AP торса жертвы ×2, без T.b. Текст задачи
//  «rad» предлагал сравнивать Cor.b с полным поглощением торса (AP + T.b) —
//  это расходится с книгой (голого культиста с T.b 3 аура бы щадила при
//  Cor.b 3, а закованного в карапас била бы там, где книга пробития не даёт),
//  поэтому сделано по книге. AP торса = absorption.body − toughnessBonus
//  (documents/actor.mjs кладёт в body сумму AP и T.b — так же его разбирает
//  damage.mjs). Урон в Раны эта аура не наносит: applyDamageToActor не зовётся.
//
//  Что делает пробитое попадание — решает Rad (X) по книге (core.json,
//  Особые Свойства Оружия): X урона в T без теста, счёт «10+ за бой» и тест
//  T+0 после боя. Это то же самое, что у радиевого оружия, поэтому здесь
//  зовётся ровно та же функция — combat/radiation.mjs::applyRadHit (иммунитет,
//  Чёрная Мантия, счётчик «за бой» внутри). Теста при попадании и Состояния
//  «Радиация» у ауры больше нет (прежнее прочтение «порог ≥ X, тест T+0, +1
//  уровень» книге не соответствует, rad / wdbc-x1nz-10-rad-x).
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
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { isItemActive } from "../apps/effects.mjs";
import { applyRadHit } from "./radiation.mjs";
import { armorBreachOutcome } from "./armor-properties.mjs";

export const IRRADIATED = "gift.nurgle.irradiated";
const RADIUS_M = 3;

/**
 * Может ли существо получить Rad: урон в T хранится только у существ
 * (system.charLoss). У техники и Орды его нет — аура их не трогает.
 */
export function canTakeRadiation(actor) {
  return !!actor?.system?.charLoss;
}

/**
 * Пробилось ли облучение: расчёт пробития книги (armorBreachOutcome) —
 * Cor.b НОСИТЕЛЯ как урон против AP торса жертвы ×2, T.b игнорируется.
 * Чистая функция.
 *
 * @param {number} corB   Cor.b НОСИТЕЛЯ Дара
 * @param {object} soak   system.absorption жертвы: body (AP + T.b) и toughnessBonus
 */
export function radAuraBreach(corB, soak) {
  const armorAP = Math.max(0, (Number(soak?.body) || 0) - (Number(soak?.toughnessBonus) || 0));
  const { breached, breachAbsorption } = armorBreachOutcome({ rawDamage: Number(corB) || 0, effArmorAP: armorAP });
  return { armorAP, breachAbsorption, breached };
}

/** Носители Дара в радиусе 3 м от токена (сам токен в выборку не попадает). */
export function irradiatedSourcesNear(tokenDoc) {
  return tokensWithinRadius(tokenDoc, RADIUS_M).filter(t => hasRuleFlag(t.actor, IRRADIATED));
}

/**
 * Начало своего Хода жертвы: по одному попаданию Rad (1d10) от каждого
 * носителя Дара в радиусе. Броня пробита (расчёт пробития книги: Cor.b против AP торса ×2, без T.b) —
 * 1d10 урона в T через applyRadHit; не пробита — только строка в чат.
 */
export async function processIrradiatedTurnStart(actor, tokenDoc) {
  if (!actor || !tokenDoc || !canTakeRadiation(actor)) return;
  if (hasRuleFlag(actor, IRRADIATED)) return;
  if (isImmuneToCondition(actor, "radiation", isItemActive)) return;

  const sources = irradiatedSourcesNear(tokenDoc);
  if (!sources.length) return;

  const soak = actor.system?.absorption;
  const held = [];

  for (const sourceToken of sources) {
    const corB = Number(sourceToken.actor?.system?.corruptionBonus) || 0;
    const { armorAP, breachAbsorption, breached } = radAuraBreach(corB, soak);
    if (!breached) {
      held.push(`<div class="roll-threshold">${esc(sourceToken.actor.name)}: Cor.b <b>${corB}</b> против AP ${armorAP}×2 = <b>${breachAbsorption}</b> — броня не пробита</div>`);
      continue;
    }
    await applyRadHit(actor, { formula: "1d10", label: `Облучение (${sourceToken.actor.name})` });
  }

  if (held.length) {
    await postTestCard(actor, {
      icon: rollIcon("warp", "#ffe14d"),
      title: `Облучение — ${esc(actor.name)}`,
      lines: held
    }, { sound: false });
  }
}
