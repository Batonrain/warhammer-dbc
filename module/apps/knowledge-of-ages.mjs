// module/apps/knowledge-of-ages.mjs
// ════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Знаний Веков (wdbc-1rno.23; логика и книжный текст —
//  rules/knowledge-of-ages.mjs). Две вещи:
//    • кнопка «бросить 1d10» в карточке траты Очка Бесчестия на «Усиление»/
//      «Успех»/«Переброс». Книга говорит «может бросить» — бросок не
//      навязывается: 1 на нём даёт Ступор, игрок решает сам, нажимать ли.
//      Рисуют её три места: меню Очков на карточке теста (hooks.mjs,
//      переброс и +10 — тест известен по флагу skillTest, кнопка только на
//      добытый Навык) и полоса Бесчестия на листе (apps/infamy-points.mjs::
//      spendInfamy — трата там до/вне броска, тест неизвестен: кнопка
//      называет Навык, решает игрок, как у напоминания Змеиного Языка);
//    • обработчик (hooks.mjs, renderChatMessageHTML): 1d10, 9-10 — Очко
//      возвращается туда, откуда списано (временный запас или пул), 1 —
//      Ступор на 1 Раунд единой точкой applyConditionWithDuration (иммунитет
//      к Ступору его гасит). Раз на карточку (combat/card-once.mjs).
//  [книга] «способности Бесчестия» — только Очки Бесчестия (Хаосит, Демон-
//  Принц): трата Очка Судьбы/Боли той же кнопкой меню кнопку не даёт.
//  [допущение] Очко Чемпиона, потраченное за персонажа (Вдохновляющее
//  Присутствие), — не «его» Очко: кнопку для такой траты не рисуем.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import {
  KNOWLEDGE_OF_AGES_CAPABILITY, KNOWLEDGE_OF_AGES_ABILITIES,
  knowledgeOfAgesOutcome, knowledgeOfAgesSkillKeys, knowledgeOfAgesCoversTest, spendsInfamyPoints
} from "../rules/knowledge-of-ages.mjs";
import { masteryLabel } from "../rules/mastery-targets.mjs";
import { changeActorInfamy } from "./infamy-points.mjs";
import { grantTempInfamy, tempInfamyInfo } from "../rules/temp-infamy.mjs";
import { applyConditionWithDuration } from "../combat/condition-effects.mjs";
import { runCardOnce } from "../combat/card-once.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";

const LABEL = "Знания Веков";

/**
 * Кнопка для карточки траты Очка. Пустая строка — кнопки нет.
 * @param {Actor} actor тот, чьё Очко потрачено
 * @param {object} opts
 * @param {string} opts.ability ключ способности ("boost" | "reroll" | "success" …)
 * @param {object} [opts.spend] итог apps/infamy-points.mjs::spendFromInfamyPool —
 *   откуда списано Очко (временный запас и его источник)
 * @param {object|null} [opts.skillTest] флаг skillTest карточки теста; не
 *   передан (undefined) — тест неизвестен (полоса Бесчестия), null — карточка
 *   не теста Навыка
 */
export function knowledgeOfAgesButtonHtml(actor, { ability, spend = null, skillTest } = {}) {
  if (!actor || !KNOWLEDGE_OF_AGES_ABILITIES.has(ability)) return "";
  if (!spendsInfamyPoints(actor)) return "";
  if (!hasRuleFlag(actor, KNOWLEDGE_OF_AGES_CAPABILITY)) return "";
  const keys = knowledgeOfAgesSkillKeys(actor.items);
  if (skillTest !== undefined) {
    if (!skillTest || !(skillTest.skill || skillTest.group)) return "";
    // Привязку не восстановить (Mastery на этот Навык уже был до мутации —
    // второй не создаётся): тест любого Навыка, решает игрок.
    if (keys.length && !knowledgeOfAgesCoversTest(keys, skillTest)) return "";
  }
  const names = keys.map(k => masteryLabel(k) || k).join(", ");
  const which = names ? `Навык «${names}»` : "Навык, добытый Знаниями Веков";
  const hint = skillTest === undefined
    ? `Только если Очко потрачено на ${which}. `
    : "";
  const temp = Number(spend?.tempSpent) > 0;
  const tempData = temp
    ? ` data-temp-source="${esc(spend.tempSource ?? "")}" data-temp-restriction="${esc(spend.tempRestriction ?? "")}"`
    : "";
  return `<div class="roll-threshold"><button type="button" class="wh-knowledge-of-ages-btn"
      data-actor-uuid="${esc(actor.uuid)}" data-temp="${temp ? 1 : 0}"${tempData}
      title="${esc(`${hint}9-10 — Очко Бесчестия не тратится (вернётся), 1 — Ступор на 1 Раунд. Бросать не обязательно.`)}"
      >📜 ${LABEL}: бросить 1d10${names && skillTest === undefined ? ` (${esc(names)})` : ""}</button></div>`;
}

/**
 * Обработчик кнопки. true — бросок состоялся.
 * @param {Actor} actor
 * @param {{message:ChatMessage, temp?:boolean, tempSource?:string, tempRestriction?:string}} opts
 *   temp — Очко списано из временного запаса, вернуть туда же с прежним
 *   источником/ограничением (по источнику запас сгорает — Глас Божий,
 *   Стервятник, Око Зависти); снятые до траты, они лежат в кнопке.
 */
export async function rollKnowledgeOfAges(actor, { message, temp = false, tempSource = "", tempRestriction = "" } = {}) {
  if (!actor || !hasRuleFlag(actor, KNOWLEDGE_OF_AGES_CAPABILITY)) {
    ui.notifications?.warn(`${actor?.name ?? "Персонаж"}: нет мутации «${LABEL}».`);
    return false;
  }
  // Ключ отметки — литералом: сторож test/combat/card-once.test.mjs сверяет
  // такие литералы с белым списком сокета (CARD_ONCE_FLAGS).
  return runCardOnce(message, "knowledgeOfAgesRolled", async () => {
    const roll = await new Roll("1d10").evaluate();
    const d10 = roll.total;
    const { refund, stupor } = knowledgeOfAgesOutcome(d10);
    const lines = [rollStatLine({ rv: d10 })];
    let outcome = `<span class="roll-success">Очко потрачено, без последствий</span>`;
    if (refund) {
      if (temp) {
        // Источник — из кнопки (снят ДО траты). Запас ещё не пуст — у него
        // свой, текущий; пустых обоих не бывает, но подпись не должна пропасть.
        const info = tempInfamyInfo(actor);
        await grantTempInfamy(actor, 1, {
          source: tempSource || info?.source || LABEL,
          restriction: tempRestriction || info?.restriction || ""
        });
      } else {
        await changeActorInfamy(actor, 1);
      }
      outcome = `<span class="roll-success">Очко Бесчестия не потрачено — вернулось${temp ? " во временный запас" : ""}</span>`;
    } else if (stupor) {
      const ok = await applyConditionWithDuration(actor, "dazed", { value: 1, unit: "rounds" });
      outcome = ok
        ? `<span class="roll-failure">Ступор на 1 Раунд — поглощён видениями из жизни других чемпионов</span>`
        : `<span class="roll-failure">Выпала 1 — Ступор не наложен (иммунитет)</span>`;
    }
    await postTestCard(actor, {
      icon: "📜 ", title: `${LABEL} — ${esc(actor.name)}`,
      lines, outcome
    }, { rolls: [roll] });
    return true;
  }, "Этот бросок Знаний Веков уже сделан.");
}
