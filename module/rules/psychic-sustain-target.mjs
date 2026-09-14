// module/rules/psychic-sustain-target.mjs
//
// Психосилы, дающие способность НЕ владельцу, а цели, пока сила
// поддерживается (wdbc-lmd2, найдено внутри wdbc-q0q8): Dragon Scales/Чешуя
// Дракона, Wings of the Phoenix/Крылья Феникса — «Цели психосилы получают
// иммунитет к...», не «получает сам псайкер». Обычная запись Конструктора
// kind:"capability" выдаёt Возможность ВЛАДЕЛЬЦУ предмета (module/rules/
// item-rules.mjs — источник "items" в sources.mjs читает только собственные
// предметы актора), а не цели активного каста — для цели нужен отдельный,
// cross-actor источник, тот же приём, что у Adjutant/Dreadnought
// (module/rules/adjutant.mjs, dreadnought.mjs): спрашивать не самого актора,
// а мир.
//
// Соглашение: capabilityKey записи с префиксом "target:" (напр.
// "target:damageImmunity.subtype.flame") означает «выдать эту Возможность не
// владельцу психосилы, а её текущей цели» — предмет остаётся самой обычной
// записью Конструктора «Возможность», без нового вида записи и без правки
// apps/mechanics.mjs. Цель фиксируется на самом предмете психосилы
// (system.sustainedTargetUuid) в момент включения тумблера «Поддерживать»
// (module/sheets/tabs/psychic.mjs) — по game.user.targets. Источник читает
// состояние живьём при каждой сборке правил: снятие поддержания (isSustained
// → false) само убирает правило на следующий же вопрос, ничего не хранится
// на акторе-цели и не нуждается в откате по концу боя/удалению предмета.
//
// Мрачная Форма (третья находка wdbc-lmd2) сюда не относится — она бьёт
// только «Сам» (self-only): обычной записи kind:"capability" на самом
// предмете достаточно, apps/effects.mjs::isItemActive уже гасит психосилу по
// isSustained, а источник "items" уже читает собственные предметы владельца.

const TARGET_PREFIX = "target:";

/** Все kind:"capability" записи предмета с префиксом "target:" — рекурсивно по подгруппам. */
function targetCapabilityEntries(item) {
  const groups = item?.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) return [];
  const out = [];
  const walk = entries => {
    for (const e of entries || []) {
      if (e?.kind === "group" && e.group) { walk(e.group.entries); continue; }
      if (e?.kind === "capability" && typeof e.capabilityKey === "string" && e.capabilityKey.startsWith(TARGET_PREFIX)) {
        out.push(e);
      }
    }
  };
  for (const g of groups) walk(g?.entries);
  return out;
}

/**
 * Правила «я — текущая цель чьей-то поддерживаемой психосилы с записью
 * target:<флаг>» — источник для module/rules/sources.mjs::registerRuleSource.
 * Вне игры (тесты ядра, нет game.actors) молчит, как и dreadnought/adjutant.
 */
export function psychicSustainTargetRules(actor) {
  if (typeof game === "undefined" || !actor?.uuid) return [];
  const rules = [];
  for (const caster of game.actors ?? []) {
    for (const item of caster?.items ?? []) {
      if (item.type !== "psychicPower" || !item.system?.isSustained) continue;
      if (item.system?.sustainedTargetUuid !== actor.uuid) continue;
      for (const entry of targetCapabilityEntries(item)) {
        const flag = entry.capabilityKey.slice(TARGET_PREFIX.length);
        rules.push({
          id: `psychicSustainTarget.${item.uuid ?? item.id ?? entry.id}.${entry.id}`,
          label: item.name || "Психосила", when: {},
          effects: [{ kind: "grantFlag", target: flag }]
        });
      }
    }
  }
  return rules;
}
