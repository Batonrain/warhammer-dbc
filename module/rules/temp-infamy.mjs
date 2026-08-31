// module/rules/temp-infamy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Временное Очко Бесчестия — ограниченная валюта ОТДЕЛЬНО от обычного
//  пула system.fate: не восстанавливается конце сессии/сцены, тратится
//  только на заявленное ограничение, и пропадает по внешнему триггеру
//  (не по своему таймеру) — истечение действия Команды, конец Хода и т.п.
//  вызывающий код решает сам, когда звать clearTempInfamy().
//
//  Первый потребитель — Voice of God/Глас Божий (wdbc-sk8s): «получатель
//  Личной Команды получает Очко Бесчестия, которое можно потратить только
//  на Переброс/Усиление/Успех для выполнения этой Команды (теряется в
//  конце действия Команды)». Задокументирован как переиспользуемый —
//  тот же паттерн нужен «Пламени Душ» (constants/mutations.mjs — «получает
//  Очко Бесчестия, которое пропадёт в конце его следующего Хода») и,
//  видимо, особенности архетипа Чемпион — не реализовано здесь, только
//  сам примитив, чтобы не плодить копии.
//
//  Ограничение (restriction) НЕ проверяется кодом при трате — это текстовая
//  метка для игрока/ГМа (кнопка траты не знает, на что реально ушли очки),
//  тем же уровнем автоматизации, что и обычная трата Боли/Бесчестия
//  (module/sheets/tabs/pain.mjs::painChange) — система считает числа,
//  соответствие правилу использования решает стол.
// ════════════════════════════════════════════════════════════════════════

const FLAG = "tempInfamy";

/** Текущий временный запас (0, если нет вовсе). */
export function tempInfamyAmount(actor) {
  return Number(actor?.getFlag?.("warhammer-dbc", FLAG)?.amount) || 0;
}

/** Метка ограничения/источника — для отображения игроку, не для проверки. */
export function tempInfamyInfo(actor) {
  const data = actor?.getFlag?.("warhammer-dbc", FLAG);
  return data ? { amount: Number(data.amount) || 0, source: data.source || "", restriction: data.restriction || "" } : null;
}

/** Начисляет (складывая с уже имеющимся) временное Очко/Очки Бесчестия. */
export async function grantTempInfamy(actor, amount, { source = "", restriction = "" } = {}) {
  if (!actor || !(amount > 0)) return;
  const cur = tempInfamyAmount(actor);
  await actor.setFlag("warhammer-dbc", FLAG, { amount: cur + amount, source, restriction });
}

/** Тратит N (умолчание 1) — false, если не хватило. */
export async function spendTempInfamy(actor, amount = 1) {
  const data = actor?.getFlag?.("warhammer-dbc", FLAG);
  const cur = Number(data?.amount) || 0;
  if (cur < amount) return false;
  const next = cur - amount;
  if (next <= 0) await actor.unsetFlag("warhammer-dbc", FLAG);
  else await actor.setFlag("warhammer-dbc", FLAG, { ...data, amount: next });
  return true;
}

/** Обнуляет запас целиком — звать по внешнему триггеру истечения (конец Команды/Хода и т.п.). */
export async function clearTempInfamy(actor) {
  if (!actor) return;
  await actor.unsetFlag("warhammer-dbc", FLAG);
}
