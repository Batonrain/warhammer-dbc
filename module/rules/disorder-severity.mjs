// module/rules/disorder-severity.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тяжесть Ментального Расстройства (корбук, «Ментальные расстройства»):
//
//    «При получении ментальное расстройство имеет тяжесть 0 … Если персонаж
//     проходит этот тест, тяжесть его расстройства уменьшается на 1, а если
//     проваливает — увеличивается на 1. Тяжесть не может подниматься выше 5,
//     а если она опускается до −5, персонаж преодолевает расстройство и
//     излечивается от него, также перманентно получая +1d5 W».
//    «Все тесты, связанные с ментальным расстройством, кроме тестов на
//     повышение и понижение тяжести, получают модификатор −5×<тяжесть>».
//
//  Неизлечимые расстройства со своим нижним пределом — Беглый Псайкер («его
//  тяжесть не может опуститься ниже −2»), Мейстер/Ревенант/Когитор (Пакты) —
//  несут его в system.severityMin и флажок system.incurable.
//
//  Хранится system.severity как есть; читается ВСЕГДА через effectiveSeverity
//  — так предел действует, даже если число поправили руками мимо кнопок.
//  Чистые функции, test/rules/disorder-severity.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const SEVERITY_MIN = -5;
export const SEVERITY_MAX = 5;

const num = v => (v === null || v === undefined || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

/** Нижний предел Тяжести: свой (severityMin) или книжный −5. */
export function severityFloor(system) {
  const m = num(system?.severityMin);
  return m === null ? SEVERITY_MIN : Math.min(SEVERITY_MAX, Math.max(SEVERITY_MIN, m));
}

/** Действующая Тяжесть — хранимая, зажатая в пределы. */
export function effectiveSeverity(system) {
  const s = num(system?.severity) ?? 0;
  return Math.max(severityFloor(system), Math.min(SEVERITY_MAX, Math.round(s)));
}

/** Шаг Тяжести (тест ГМа: успех −1, провал +1) — с учётом пределов. */
export function stepSeverity(system, delta) {
  return effectiveSeverity({ ...system, severity: effectiveSeverity(system) + (Number(delta) || 0) });
}

/** Модификатор тестов, связанных с расстройством: −5×Тяжесть. */
export function severityTestMod(system) {
  const v = -5 * effectiveSeverity(system);
  return v === 0 ? 0 : v;   // без «−0» в подписях
}

const signed = v => (v > 0 ? `+${v}` : (v < 0 ? `−${Math.abs(v)}` : "0"));

/** Подпись для листа: «Тяжесть +1 · неизлечимо, не ниже −2». */
export function severityNote(system) {
  const sev = effectiveSeverity(system);
  const parts = [`Тяжесть ${signed(sev)}`];
  const floor = severityFloor(system);
  if (system?.incurable) parts.push(`неизлечимо${floor > SEVERITY_MIN ? `, не ниже ${signed(floor)}` : ""}`);
  else if (floor > SEVERITY_MIN) parts.push(`не ниже ${signed(floor)}`);
  else if (sev <= SEVERITY_MIN) parts.push("на −5 расстройство преодолено: излечивается, +1d5 W");
  return parts.join(" · ");
}
