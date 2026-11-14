// module/combat/final-execution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОКОНЧАТЕЛЬНАЯ КАЗНЬ / Final Execution (Мастер Казней, Талант; Sahara task-bbe1, решение владельца 27.10.2026).
//
//  Текст: «Совершая атаку Казнью, может потратить Очко Трофеев, чтобы первая атака получила свойства
//  Extreme(9) и Proven(5), а каждая следующая атака Казни — накапливающиеся −1 к рейтингу Extreme и +1 к
//  Proven. Если такая атака убивает добычу, получает Трейт Fear(2) (сверхъестественный) на 1 Раунд.»
//
//  Как устроено (по образцу Смертельного Танца, combat/death-dance.mjs): кнопка в окне рукопашной атаки
//  (sheets/attack/markup.mjs + dialog.mjs) ВООРУЖАЕТ намерение, а Очко Трофеев списывается только при
//  подтверждении атаки — закрытый диалог ничего не сжигает. Свойства Extreme/Proven едут в атаку записями
//  `ruleProps` (attack.mjs доливает их в свойства оружия). Серия — Раунд боя (Казнь раз в Раунд, трейт
//  Execution): первая атака серии платит Очко, следующие атаки того же Раунда продолжают её бесплатно, со
//  свойствами сильнее (Extreme на 1 ниже — легче, Proven на 1 выше). Вне боя серий нет.
//  Черта «Казнь» (доп. атаки при не-убийстве) — combat/execution.mjs (Sahara fear-2, 30.10.2026).
//
//  Fear(2) за убийство (Sahara fear-2, решение владельца 30.10.2026 — автоматизировать). «Убивает» = смерть
//  цели констатирована (sheets/tabs/body.mjs::setDeceased — то же решение, что у Жнеца и Трофея). Поток:
//  кнопка окна атаки вооружает намерение → бросок несёт opts.finalExecution → карточка атаки метит кнопки урона
//  (data-final-execution) → конвейер урона (damage.mjs) метит жертву «последний удар — Окончательная Казнь»
//  (markLastFinalExecutionHit; любой другой удар метку стирает: «последний» и есть тот, от которого умерли) →
//  констатация смерти в том же Раунде выдаёт убийце Трейт «Страх (2)» из пака на «1 Раунд»
//  (offerFinalExecutionFearAfterKill). Срок — rules/temp-grant.mjs (expiresAtRound = Раунд + 1, как у прочих
//  «N Раундов» системы); снимается сам на смене Раунда (hooks.mjs, updateCombat). Выдавать убийце может ГМ
//  или его владелец; иначе в чат уходит карточка с кнопкой «Принять Страх (2)» (hooks.mjs, .wh-fe-fear-btn).
//  «Сверхъестественный» — пометка в названии и в карточке: за столом это значит, что «Земной ужас»
//  (Пресыщенный, disorders.mjs) на этот Страх не действует.
// ════════════════════════════════════════════════════════════════════════════

import { trophyUpdate, trophyValue } from "../rules/trophy-points.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const NS = "warhammer-dbc";

/** Метка на жертве: последний удар по ней нанесён Окончательной Казнью — { attackerUuid, combatId, round }. */
export const FINAL_EXECUTION_HIT_FLAG = "lastDamageFinalExecution";
/** Метка на выданном Трейте «Страх (2)»: его выдала Окончательная Казнь (повторная выдача заменяет, а не складывает). */
export const FINAL_EXECUTION_FEAR_FLAG = "finalExecutionFear";
/** Трейт «Fear / Страх (X)» в пак-предметах (packs-src/traits): рейтинг 2 по умолчанию, эффект system.fearRating = 2. */
export const FEAR_TRAIT_PACK_ID = "ntYh2fH5Tv8GH4qA";
/** Ключ отметки на карточке-запросе (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const FINAL_EXECUTION_FEAR_CARD_FLAG = "finalExecutionFearGranted";

/** Флаг серии: { combatId, round, n } — сколько атак серии этого Раунда уже сделано. */
export const FINAL_EXECUTION_FLAG = "finalExecution";

/** Текст-напоминание для окна атаки. */
export const FINAL_EXECUTION_TEXT = "Extreme(9) и Proven(5) первой атаке серии; каждая следующая атака Казни: Extreme на 1 ниже, Proven на 1 выше.";

/** Талант опознаётся по имени предмета (по нему же находит носителя tools/capability-reachability.mjs). */
const FINAL_EXECUTION_MATCH = /Final Execution|Окончательная Казнь/i;

/** Владеет ли актор Талантом (Талант, не Черта-тёзка). */
export function hasFinalExecution(actor) {
  return (actor?.items ?? []).some(i => i?.type === "talent" && FINAL_EXECUTION_MATCH.test(i.name));
}

/** Свойства оружия для атаки номер `n` серии (0 — первая): Extreme(9−n), Proven(5+n). Extreme не ниже 2. */
export function finalExecutionProps(n = 0) {
  const k = Math.max(0, Number(n) || 0);
  return [
    { key: "extreme", rating: Math.max(2, 9 - k) },
    { key: "proven", rating: 5 + k }
  ];
}

/** Номер следующей атаки серии и цена: новая серия — 0 и 1 Очко Трофеев, продолжение — n и бесплатно. */
export function finalExecutionStep(actor) {
  const combat = globalThis.game?.combat;
  const rec = actor?.getFlag?.(NS, FINAL_EXECUTION_FLAG);
  const live = !!combat?.id && rec?.combatId === combat.id && Number(rec.round) === (Number(combat.round) || 0);
  return live ? { n: Number(rec.n) || 0, cost: 0 } : { n: 0, cost: 1 };
}

/** Можно ли сейчас применить Окончательную Казнь: Талант и (на новой серии) Очко Трофеев. */
export function finalExecutionGate(actor) {
  if (!hasFinalExecution(actor)) return { ok: false, reason: "Нет Таланта «Окончательная Казнь».", cost: 0, n: 0 };
  const { n, cost } = finalExecutionStep(actor);
  if (cost > 0 && trophyValue(actor) < cost) return { ok: false, reason: "Нет Очка Трофеев.", cost, n };
  return { ok: true, cost, n };
}

/**
 * Подтверждённая атака: списать Очко (новая серия) и записать шаг серии. false — Очка нет, ничего не записано.
 * Звать ПОСЛЕ подтверждения атаки (кнопка «Бросок!»), не по клику вооружения.
 */
export async function commitFinalExecution(actor) {
  const gate = finalExecutionGate(actor);
  if (!gate.ok) return false;
  if (gate.cost > 0) {
    const patch = trophyUpdate(actor, -gate.cost);
    if (!patch) return false;
    await actor.update(patch);
  }
  const combat = globalThis.game?.combat;
  if (combat?.id) {
    await actor.setFlag(NS, FINAL_EXECUTION_FLAG, { combatId: combat.id, round: Number(combat.round) || 0, n: gate.n + 1 });
  }
  return true;
}

/** Строка окна атаки: кнопка-«вооружение» и статус (наполняет dialog.mjs). Пусто — не носителю / не в ближнем бою. */
export function finalExecutionRowHtml(actor, { isMelee = false } = {}) {
  if (!isMelee || !hasFinalExecution(actor)) return "";
  return `<div class="av-row" id="atk-final-execution-row">
      <label>Окончательная Казнь</label>
      <button type="button" id="atk-final-execution-btn" class="av-pill av-pill-disabled" disabled
        title="${FINAL_EXECUTION_TEXT} Очко Трофеев списывается при подтверждении атаки, один раз на серию (Раунд)."><span>Extreme + Proven</span></button>
      <span class="av-opt-note" id="atk-final-execution-status"></span>
    </div>`;
}

// ── Fear(2) за убийство ──────────────────────────────────────────────────────

/**
 * Записать (или снять) метку «последний удар — Окончательная Казнь». Зовёт конвейер урона при непоглощённом
 * уроне (damage.mjs, рядом с markLastChargeHit): любой другой удар прежнюю метку стирает.
 */
export async function markLastFinalExecutionHit(victim, { melee, finalExecution, attackerUuid } = {}) {
  if (!victim?.setFlag) return;
  if (melee && finalExecution && attackerUuid) {
    const combat = globalThis.game?.combat;
    await victim.setFlag(NS, FINAL_EXECUTION_HIT_FLAG, { attackerUuid, combatId: combat?.id ?? "", round: Number(combat?.round) || 0 });
  } else if (victim.getFlag?.(NS, FINAL_EXECUTION_HIT_FLAG)) {
    await victim.unsetFlag?.(NS, FINAL_EXECUTION_HIT_FLAG);
  }
}

/**
 * Данные Трейта «Страх (2)» на 1 Раунд — копия настоящего Трейта Fear из пака (рейтинг 2 и эффект
 * system.fearRating = 2 в нём уже есть) с меткой срока для rules/temp-grant.mjs: expiresAtRound = Раунд + 1.
 * @param {object} source  Трейт Fear (toObject / JSON пака)
 * @param {?{id:string, round:number}} combat
 */
export function finalExecutionFearItemData(source, combat) {
  const data = structuredClone(source);
  delete data._id; delete data._key;
  for (const e of data.effects ?? []) { delete e._id; delete e._key; }
  data.name = "Fear / Страх (2) — Окончательная Казнь";
  data.system = { ...data.system, rating: 2 };
  const label = "Страх (2), сверхъестественный — Окончательная Казнь";
  data.flags = {
    ...data.flags,
    [NS]: {
      ...data.flags?.[NS],
      [FINAL_EXECUTION_FEAR_FLAG]: true,
      tempGrant: { unit: "round", combatId: combat?.id ?? "", expiresAtRound: (Number(combat?.round) || 0) + 1, label }
    }
  };
  return data;
}

const loadFearTrait = async () =>
  (await globalThis.fromUuid?.(`Compendium.warhammer-dbc.traits.Item.${FEAR_TRAIT_PACK_ID}`).catch(() => null))?.toObject?.() ?? null;

/** Выдать убийце Трейт «Страх (2)» на 1 Раунд (повторная выдача заменяет прежний) и сказать об этом в чат. */
export async function grantFinalExecutionFear(killer, { loadTrait = loadFearTrait } = {}) {
  const source = await loadTrait();
  if (!source) { globalThis.ui?.notifications?.warn("⚠️ Окончательная Казнь: Трейт «Страх» не найден в компендиуме."); return false; }
  const old = [...(killer.items ?? [])]
    .filter(i => i.flags?.[NS]?.[FINAL_EXECUTION_FEAR_FLAG] ?? i.getFlag?.(NS, FINAL_EXECUTION_FEAR_FLAG))
    .map(i => i.id);
  if (old.length) await killer.deleteEmbeddedDocuments("Item", old);
  await killer.createEmbeddedDocuments("Item", [finalExecutionFearItemData(source, globalThis.game?.combat)]);
  await postTestCard(killer, {
    icon: rollIcon("skull", "#c9a24a"),
    title: `Окончательная Казнь — Страх (2) — ${esc(killer.name)}`,
    lines: [`<div class="roll-threshold">Добыча убита: ${esc(killer.name)} получает Трейт Страх (2) (сверхъестественный) на 1 Раунд.</div>`]
  }, { sound: false });
  return true;
}

/** Карточка-запрос, когда выдать Трейт некому на месте: кнопку жмёт ГМ или владелец убийцы (hooks.mjs, .wh-fe-fear-btn). */
export function finalExecutionFearButtonHtml({ killerUuid }) {
  return `<div class="roll-defense-section">
    <button class="wh-fe-fear-btn" type="button" data-killer-uuid="${esc(killerUuid)}"
      title="Окончательная Казнь убила добычу: убийца получает Трейт Страх (2) (сверхъестественный) на 1 Раунд.">
      ${rollIcon("skull")}Принять Страх (2) на 1 Раунд
    </button>
  </div>`;
}

/**
 * Смерть цели констатирована (sheets/tabs/body.mjs::setDeceased, «жив → мёртв»): если последний удар был
 * Окончательной Казнью в ЭТОМ же Раунде и бою, убийце — Страх (2) на 1 Раунд. Выдать может ГМ или владелец
 * убийцы; иначе в чат уходит карточка с кнопкой.
 * @param {Actor} victim
 * @returns {Promise<boolean>} Страх выдан или предложен
 */
export async function offerFinalExecutionFearAfterKill(victim, { loadTrait } = {}) {
  const rec = victim?.getFlag?.(NS, FINAL_EXECUTION_HIT_FLAG);
  if (!rec?.attackerUuid) return false;
  const combat = globalThis.game?.combat;
  if (rec.combatId !== (combat?.id ?? "") || rec.round !== (Number(combat?.round) || 0)) return false;   // умер позже, не от этого удара
  const killer = await globalThis.fromUuid?.(rec.attackerUuid).catch(() => null);
  if (!killer || killer === victim || !hasFinalExecution(killer)) return false;
  await victim.unsetFlag?.(NS, FINAL_EXECUTION_HIT_FLAG);
  if (globalThis.game?.user?.isGM || killer.isOwner !== false) return grantFinalExecutionFear(killer, loadTrait ? { loadTrait } : {});
  await postTestCard(killer, {
    icon: rollIcon("skull", "#c9a24a"),
    title: `Окончательная Казнь — ${esc(victim.name ?? "добыча")} убит(а)`,
    lines: [
      `<div class="roll-threshold">${esc(killer.name)}: Страх (2) на 1 Раунд — кнопку жмёт ГМ или владелец.</div>`,
      finalExecutionFearButtonHtml({ killerUuid: killer.uuid })
    ]
  }, { sound: false });
  return true;
}
