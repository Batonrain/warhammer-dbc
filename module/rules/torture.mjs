// module/rules/torture.mjs
//
// Пытка — общий диалог для всех (apps/torture.mjs, 3-dc87) и Талант «Мучитель»
// (Медик, medic.core.torturer). Книга: «Проводя пытки или ассистируя в них,
// персонаж может пройти тест Medicae−10 и при Успехе дать жертве −3×Успехи на
// её встречные тесты; при неудачном тесте пыток он не наносит урон жертве и не
// делает её непригодной для дальнейших пыток.»
//
// Чистая арифметика без Foundry. Файл НЕ импортирует ничего.

/** Штраф жертве за каждый Успех теста Мучителя. */
export const TORTURER_PENALTY_PER_SUCCESS = -3;
/** Штраф теста Мучителя по книге. */
export const TORTURER_TEST_MOD = -10;

/** Успехи теста d100: 0 при провале, иначе целых десятков запаса + 1. */
export function testSuccesses(rv, threshold) {
  if (!(Number(rv) <= Number(threshold))) return 0;
  return Math.floor((Number(threshold) - Number(rv)) / 10) + 1;
}

/** Штраф встречному тесту жертвы: −3 за каждый Успех Мучителя. */
export function torturerVictimPenalty(successes) {
  const n = Math.max(0, Math.trunc(Number(successes) || 0));
  return n ? TORTURER_PENALTY_PER_SUCCESS * n : 0; // без -0
}

/** Предел теста Мучителя: Medicae−10 (нет Навыка — Int−20, как у нетренированного). */
export function torturerThreshold(holder, extra = 0) {
  const medicae = Number(holder?.system?.skills?.medicae?.total);
  const base = Number.isFinite(medicae)
    ? medicae
    : (Number(holder?.system?.characteristics?.int?.total) || 20) - 20;
  return base + TORTURER_TEST_MOD + (Number(extra) || 0);
}
