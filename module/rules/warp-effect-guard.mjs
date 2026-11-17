// module/rules/warp-effect-guard.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Точка перехвата «эффект Варпа» для Талантов Пси-Стойкости (wdbc-nzzgn).
//
//  Что здесь, а что в данных:
//   • Божественная Защита — «раз в Раунд, получая эффект психосилы… бросить
//     1d10, на 10 игнорировать эффект». Возможность выдаёт Талант (запись
//     Конструктора «Возможность» psyResist.core.divineProtection), здесь —
//     чистая часть: доступна ли попытка в этом Раунде и исход d10. Сама точка
//     перехвата — гейт кнопки «Тест Сопротивления» психосилы (hooks.mjs, рядом с
//     Пустотой Парии и Фатализмом) и Выжигание Души (hooks.mjs::_executeSoulBurn).
//   • Эфирный Кокон — «+2 на встречные тесты W против психосил за каждую
//     действующую на него психосилу»: правило library/core.mjs, число считает
//     valueFrom.selfPsychicPowersActing (rules/resolve-test.mjs) через
//     psychicPowersActingOn отсюда.
//   • Отверженный — правила library/core.mjs (предикаты targetIsDaemon,
//     targetHasTalent).
//
//  Чистый модуль без Foundry; читает game.actors только для чужих сил.
// ════════════════════════════════════════════════════════════════════════════

export const DIVINE_PROTECTION_CAP = "psyResist.core.divineProtection";

/** Флаг актора: «combatId:round», в котором Защита уже пробовалась. */
export const DIVINE_PROTECTION_ROUND_FLAG = "warpGuardRound";

/** Типы сил, считающиеся «действующими на персонажа» для Эфирного Кокона. */
export const COCOON_POWER_TYPES = ["infusion", "change", "aura", "summon"];

/** Ключ Раунда боя; вне боя — пустая строка (Раундов нет, ограничения нет). */
export function divineProtectionKey(combat) {
  if (!combat?.id) return "";
  return `${combat.id}:${Number(combat.round) || 0}`;
}

/** Можно ли в этом Раунде ещё пробовать Защиту. Вне боя — всегда можно. */
export function divineProtectionAvailable(actor, combat) {
  const key = divineProtectionKey(combat);
  if (!key) return true;
  return actor?.getFlag?.("warhammer-dbc", DIVINE_PROTECTION_ROUND_FLAG) !== key;
}

/** Исход d10: игнорирует эффект только 10. */
export function attemptDivineProtection(d10) {
  const roll = Number(d10) || 0;
  return { roll, ignored: roll === 10 };
}

const powerIsOfTypes = (item, types) =>
  [item?.system?.powerType, ...(item?.system?.extraTypes ?? []).map(e => e?.type)]
    .some(t => types.includes(t));

/**
 * Сколько психосил (Вливание, Изменение, Аура, Призыв) сейчас действуют на
 * актора: поддерживаемые силы, нацеленные на него (sustainedTargetUuid — у
 * любого актора мира), и его собственные поддерживаемые силы без заданной цели
 * («на себе»).
 */
export function psychicPowersActingOn(actor, types = COCOON_POWER_TYPES) {
  if (!actor || typeof game === "undefined") return 0;
  let n = 0;
  for (const caster of game.actors ?? []) {
    const own = !!actor.uuid && caster === actor;
    for (const item of caster?.items ?? []) {
      if (item?.type !== "psychicPower" || !item.system?.isSustained) continue;
      if (!powerIsOfTypes(item, types)) continue;
      const target = item.system?.sustainedTargetUuid ?? "";
      if (target ? target === actor.uuid : own) n++;
    }
  }
  return n;
}

// ── Остальные Таланты Пси-Стойкости (ответы владельца) ──────────────────────
export const NEURAL_TRIGGERS_CAP = "psyResist.core.neuralTriggers";
export const DONT_TRUST_CAP = "psyResist.core.donTTrustYourEyes";
export const PSYCHIC_COLLAPSE_CAP = "psyResist.core.psychicCollapse";
export const SHIELD_CAP = "psyResist.core.shieldOfContempt";

/** Кнопки карточки сопротивления: Талант → действие, которое жмёт игрок/ГМ. */
export const WARP_OFFERS = [
  { cap: NEURAL_TRIGGERS_CAP, action: "neural", label: "Нейральные Триггеры: стать Беспомощным на 1 Раунд" },
  { cap: DONT_TRUST_CAP, action: "perception", label: "Не Верь Глазам Своим: тайный бросок ГМ (Awareness−10)" },
  { cap: PSYCHIC_COLLAPSE_CAP, action: "collapse", label: "Психический Обвал: развеять свою поддерживаемую силу (Феномен)" }
];

/** Порог тайного броска «Не Верь Глазам Своим»: Awareness−10. */
export function perceptionThreshold(awarenessTotal) {
  return (Number(awarenessTotal) || 0) - 10;
}

/** Щит Презрения: тест W+0 — успех при броске не выше Воли. */
export function shieldOfContemptPasses(wpTotal, roll) {
  return (Number(roll) || 101) <= (Number(wpTotal) || 0);
}
