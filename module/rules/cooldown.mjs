// module/rules/cooldown.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Обобщённый троттлинг «раз в X», где X — измеримая единица с ЖИВЫМ текущим
//  значением, сравниваемым с сохранённой меткой последнего использования
//  (wdbc-f4jt: до этого модуля «раз-в-Раунд» умел только apps/game-session.mjs,
//  а «раз в сутки»/«раз в T.b часов» дублировали одну и ту же формулу
//  remaining вручную в apps/sus-an-heal.mjs и combat/armor-mods.mjs).
//
//  ТРИ СЕМЬИ троттлинга — общая плоскость метки, разный способ узнать,
//  что пора сбрасывать:
//
//  1. round / battle — сохранённая метка сравнивается с ЖИВЫМ значением из
//     активного Combat (номер раунда / id самого боя). Сброс происходит
//     САМ, когда живое значение меняется, — отдельного действия ГМа не
//     нужно. Нет активного Combat — отследить нечем, возможность считается
//     доступной (не отнимаем её отсутствием боевого трекера). «battle»
//     сравнивается по game.combat.id: тот же приём, что уже использует
//     combat/evasion-pool.mjs (currentTurnTag) для «этого хода этого боя» —
//     и то же ограничение, что и там: пересоздание Encounter посреди одной
//     стычки даст новый id (открытый вопрос тикета, не решён здесь, т.к. в
//     проекте пока нет отдельного понятия «эта же стычка»).
//
//  2. scene / session — сохранённая метка это булев used, а не живое
//     значение для сравнения: у сцены/сессии нет своего счётчика. Сброс —
//     ЯВНОЕ действие ГМа (кнопки 🎬 Новая сцена / ⏻ Конец сессии в
//     apps/game-session.mjs::resetUsageLimit, массовый скан всех
//     актёров/предметов). Здесь — только чтение/запись ОДНОЙ метки;
//     массовый сброс по кнопке — Foundry-тяжёлая оркестрация, ей место
//     осталась в apps/game-session.mjs, не тут.
//
//  3. worldTime — сохранённая метка это МОМЕНТ (game.time.worldTime), а не
//     текущее состояние: доступность считается по истечении интервала
//     («раз в сутки», «раз в T.b часов»), не по смене живого значения и не
//     по внешнему сбросу.
//
//  Общая плоскость метки для (1) и (2): flags.warhammer-dbc.usageLimits.<key>
//  (точка в имени возможности меняется на дефис — точка в ключе флага
//  Foundry означала бы вложенный путь). resetUsageLimit() в game-session.mjs
//  фильтрует по полю scope, поэтому записи round/battle (scope:
//  "round"/"battle") не попадают под сброс кнопками Сцены/Сессии — так и
//  задумано, у них сброс автоматический, а не по кнопке.
// ═══════════════════════════════════════════════════════════════════════════

const usageKey = flag => String(flag ?? "").replace(/\./g, "-");

/** Текущее живое значение единицы, или undefined — если отследить нечем. */
function liveValue(unit) {
  if (!game.combat) return undefined;
  if (unit === "round")  return game.combat.round;
  if (unit === "battle") return game.combat.id;
  return undefined;
}

/** Доступна ли Раз-в-<unit> возможность актора ("round" | "battle" |
 *  "nextRound" — заблокирована и в раунд использования, И в следующий:
 *  Медленная Перезарядка узла корабля, wdbc-qhwb; отметка при этом пишется
 *  обычным markCapabilityUsed(…, "round")). */
export function isCapabilityAvailable(actor, flag, unit = "round") {
  if (unit === "nextRound") {
    const cur = liveValue("round");
    if (cur === undefined) return true;
    const stored = actor?.getFlag?.("warhammer-dbc", `usageLimits.${usageKey(flag)}`)?.round;
    return stored === undefined || cur > stored + 1 || cur < stored;
  }
  const current = liveValue(unit);
  if (current === undefined) return true;
  const stored = actor?.getFlag?.("warhammer-dbc", `usageLimits.${usageKey(flag)}`)?.[unit];
  return stored !== current;
}

/** Отметить Раз-в-<unit> возможность актора потраченной в текущем <unit>. */
export async function markCapabilityUsed(actor, flag, unit = "round") {
  if (!actor) return;
  const current = liveValue(unit);
  if (current === undefined) return;
  await actor.setFlag("warhammer-dbc", `usageLimits.${usageKey(flag)}`, { scope: unit, used: true, [unit]: current });
}

/**
 * Израсходована ли возможность актора в текущем scope (сцена/сессия — нет
 * живого значения для сравнения, сброс делает явное действие ГМа, см. п.2
 * в заголовке файла).
 */
export function isRuleUsageUsed(actor, flag) {
  return actor?.getFlag?.("warhammer-dbc", `usageLimits.${usageKey(flag)}`)?.used === true;
}

/** Отметить такую возможность израсходованной до явного сброса ГМа (scope по умолчанию "scene"). */
export async function markRuleUsageUsed(actor, flag, scope = "scene") {
  if (!actor) return;
  await actor.setFlag("warhammer-dbc", `usageLimits.${usageKey(flag)}`, { scope, used: true });
}

/**
 * Секунд до следующей доступности worldTime-троттлинга (0 — доступно прямо
 * сейчас). Чистая функция — usedAt/worldTime/intervalSeconds приходят
 * снаружи, ничего не читает сама (тем же приёмом, что и раньше
 * susAnHealCooldownRemaining/disabledArmourPeriodicTestRemaining по
 * отдельности). intervalSeconds ≤ 0 — вырожденный случай (нет длительности
 * интервала), кнопка доступна всегда, а не виснет заблокированной навечно.
 */
export function worldTimeRemaining(usedAt, worldTime, intervalSeconds) {
  const interval = Number(intervalSeconds) || 0;
  if (interval <= 0 || usedAt == null) return 0;
  const remaining = Number(usedAt) + interval - Number(worldTime);
  return remaining > 0 ? remaining : 0;
}

/** Готов ли worldTime-троттлинг документа (актор/предмет) прямо сейчас. */
export function isWorldTimeCooldownReady(doc, flag, intervalSeconds) {
  const usedAt = doc?.getFlag?.("warhammer-dbc", flag);
  return worldTimeRemaining(usedAt, game.time.worldTime, intervalSeconds) <= 0;
}

/** Завести worldTime-троттлинг документа (актор/предмет) на текущий момент. */
export async function markWorldTimeCooldownUsed(doc, flag) {
  if (!doc) return;
  await doc.setFlag("warhammer-dbc", flag, game.time.worldTime);
}
