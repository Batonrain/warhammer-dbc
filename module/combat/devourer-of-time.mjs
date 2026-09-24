// module/combat/devourer-of-time.mjs
// ════════════════════════════════════════════════════════════════════════
//  Devourer of Time / Пожиратель Времени (Тзинч, wdbc-1rno, d100 6…8):
//  «Когда чемпион застаёт хотя бы одного другого персонажа Врасплох, он
//  совершает свой первый Ход в бою два раза за Раунд: один в свою
//  инициативу и второй в конце инициативы. Все захваченные им Врасплох
//  персонажи теряют одно полудействие в свой второй Ход.» — «свой» здесь
//  про ХОД ОБЛАДАТЕЛЯ ДАРА (его повторный Ход), не про Ход самой жертвы
//  (подтверждено пользователем 12.09.2026, поправка к первому черновику).
//
//  «Застал Врасплох» книга не даёт числа/теста для автоопределения — в
//  системе это и так ручная галочка «Цель Врасплох» в окне атаки
//  (sheets/attack/mods.mjs), решает игрок за столом. Здесь по тому же
//  принципу: кнопка на предмете (packs-src, kind:"script"), не автодетект —
//  отдельного состояния «Врасплох» на Combatant в системе нет и не может
//  быть выведено из имеющихся данных.
//
//  Доп. Ход — существующий примитив combat/extra-turn.mjs (ещё один
//  Combatant того же актора), тот же, что у Last Actor/Последнего Актёра.
//  Выдаётся РОВНО ОДИН раз на бой (повторные захваты Врасплох добавляют
//  жертв в список, не плодят второй доп. Ход) и снимается сменой Раунда
//  после того, как отыгран: книга даёт «первый Ход в бою два раза», не
//  каждый Раунд (wdbc-xzfp, processDevourerOfTimeRoundChange ниже). «В конец инициативы» — Foundry сортирует Ходы по
//  убыванию инициативы, «конец» = минимум минус единица (endOfOrderInitiative).
//
//  Полудействие — реальный ОД (1 ОД = полудействие, стр. 12), но ДОЛГОМ на
//  следующий Ход жертвы, а не списанием в момент доп. Хода чемпиона: к тому
//  моменту жертвы свой Ход уже отыграли (wdbc-xzfp, раздел внизу файла).
// ════════════════════════════════════════════════════════════════════════

export const DEVOURER_OF_TIME_CAPABILITY = "gift.tzeentch.devourerOfTime";
export const DEVOURER_OF_TIME_SOURCE = "devourerOfTime";
export const DEVOURER_OF_TIME_VICTIMS_FLAG = "devourerOfTimeVictims";

/**
 * Инициатива «в конец порядка» — Foundry сортирует Combatant по убыванию
 * инициативы (выше = раньше), значит «конец» — минимум текущих минус 1.
 * Нет ни одного числового значения (бой ещё не начал катать инициативу) —
 * 0 минус 1, чтобы доп. Ход всё равно оказался позже любого будущего 0.
 */
export function endOfOrderInitiative(combatants) {
  const list = Array.isArray(combatants) ? combatants : [...(combatants ?? [])];
  const values = list
    .map(c => c?.initiative)
    .filter(v => typeof v === "number" && Number.isFinite(v));
  return (values.length ? Math.min(...values) : 0) - 1;
}

/** Именно доп. Combatant этой находки (не обычный Ход того же актора). */
export function isDevourerOfTimeExtraTurn(combatant) {
  return combatant?.getFlag?.("warhammer-dbc", "extraTurnSource") === DEVOURER_OF_TIME_SOURCE;
}

/** Список Uuid жертв, накопленных на чемпионе за этот бой (без повторов). */
export function devourerOfTimeVictimUuids(actor) {
  const list = actor?.getFlag?.("warhammer-dbc", DEVOURER_OF_TIME_VICTIMS_FLAG);
  return Array.isArray(list) ? list : [];
}

/** Уникальное объединение уже записанных жертв с новыми Uuid — чистая функция для кнопки и теста. */
export function mergedVictimUuids(existing, added) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), ...(Array.isArray(added) ? added : [])])];
}

// ── wdbc-xzfp: долг ОД, один доп. Ход, уборка ───────────────────────────────
//
// Шапка выше описывает прежнее поведение; оно расходилось с книгой в трёх
// местах. (1) «Теряют полудействие» списывалось в момент доп. Хода
// чемпиона — жертвы к тому моменту свой Ход уже отыграли (а застигнутые
// Врасплох и вовсе пропускают первый Раунд, стр. 12), spendActionPoints
// возвращал false и ничего не писал. Теперь это ДОЛГ: жертва начинает свой
// следующий Ход на 1 ОД меньше (action-economy.mjs::resetActionEconomy).
// (2) Список жертв не снимался с концом боя. (3) Книга: «совершает свой
// ПЕРВЫЙ Ход в бою два раза за Раунд» — доп. Ход один, а не каждый Раунд:
// использованный снимается сменой Раунда.

/** Флаг на ЖЕРТВЕ — сколько ОД снять в начале её следующего Хода. */
export const DEVOURER_OF_TIME_AP_DEBT_FLAG = "devourerOfTimeApDebt";
/** Флаг на ЧЕМПИОНЕ — Раунд, в котором доп. Ход уже отыгран. */
export const DEVOURER_OF_TIME_USED_ROUND_FLAG = "devourerOfTimeUsedRound";

/** ОД Хода после долга — не ниже нуля. */
export function apAfterDevourerDebt(apMax, debt) {
  return Math.max(0, (Number(apMax) || 0) - (Number(debt) || 0));
}

/** Начало доп. Хода чемпиона (hooks.mjs::updateCombat): долг жертвам, отметка Раунда. */
export async function processDevourerOfTimeExtraTurn(combat, combatant) {
  const champion = combatant?.actor;
  if (!champion) return;
  for (const uuid of devourerOfTimeVictimUuids(champion)) {
    const victim = await fromUuid(uuid).catch(() => null);
    if (!victim) continue;
    const debt = Number(victim.getFlag?.("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG)) || 0;
    await victim.setFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG, debt + 1);
  }
  await champion.setFlag("warhammer-dbc", DEVOURER_OF_TIME_USED_ROUND_FLAG, Number(combat?.round) || 0);
}

/**
 * Смена Раунда: доп. Ход, уже отыгранный в прошлом Раунде, снимается — книга
 * даёт его только первому Ходу. Снимается именно на смене Раунда: доп. Ход
 * стоит в конце порядка, текущий Ход (первый в новом Раунде) не сдвигается.
 */
export async function processDevourerOfTimeRoundChange(combat) {
  const ids = [];
  for (const c of combat?.combatants ?? []) {
    if (!isDevourerOfTimeExtraTurn(c)) continue;
    const used = c.actor?.getFlag?.("warhammer-dbc", DEVOURER_OF_TIME_USED_ROUND_FLAG);
    if (used != null && Number(combat.round) > Number(used)) ids.push(c.id);
  }
  if (ids.length) await combat.deleteEmbeddedDocuments("Combatant", ids);
}

/** Конец боя: список жертв, отметка Раунда и неиспользованный долг не переживают бой. */
export async function clearDevourerOfTimeAtCombatEnd(combat) {
  for (const c of combat?.combatants ?? []) {
    const actor = c.actor;
    if (!actor?.getFlag) continue;
    for (const key of [DEVOURER_OF_TIME_VICTIMS_FLAG, DEVOURER_OF_TIME_USED_ROUND_FLAG, DEVOURER_OF_TIME_AP_DEBT_FLAG]) {
      if (actor.getFlag("warhammer-dbc", key) != null) await actor.unsetFlag("warhammer-dbc", key);
    }
  }
}
