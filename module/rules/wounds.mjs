// module/rules/wounds.mjs
//
// Единая арифметика понижения Ран, откуда бы урон ни пришёл (боевой урон,
// Токсичное, Выжигание Души, резонанс саркофага Дредноута на пилота, что
// угодно ещё). Раньше каждое место писало в system.wounds.value/critical
// по-своему (см. wdbc-aleb) — где-то верно уходило в Критические при
// нехватке Ран, где-то просто клампило в 0 (Токсичное — расхождение с
// книгой, Критические никогда не наступали). Теперь arithmetic и
// actor.update() — здесь одним местом; вызывающий код собирает только свой
// текст в чат и специфичные для источника эффекты (крит-таблица боя,
// «душа разорвана» и т.п.).

/**
 * Раны/Критические ПОСЛЕ потери amount Ран — чистый расчёт без записи в
 * документ. amount <= 0 не меняет ничего.
 *
 * @param {number} currentWounds
 * @param {number} currentCritical
 * @param {number} amount
 * @returns {{value:number, critical:number, overflow:boolean}}
 */
export function woundLossAfter(currentWounds, currentCritical, amount) {
  const current  = Number(currentWounds)  || 0;
  const critical = Number(currentCritical) || 0;
  const dmg      = Math.max(0, Number(amount) || 0);

  if (dmg === 0) return { value: current, critical, overflow: false };
  if (current >= dmg) return { value: current - dmg, critical, overflow: false };
  return { value: 0, critical: critical + (dmg - current), overflow: true };
}

/**
 * То же понижение Ран, но в виде updates-объекта — для мест, которые собирают
 * ОДИН общий actor.update() из нескольких кусков (эффекты препарата,
 * Поглощение Болью, цена психосилы в Ранах, откат Электростимуляторов).
 * При фактическом уроне сбрасывает firstAidUsed: новый урон → снова можно
 * оказать Первую Помощь (гейт в tabs/healing.mjs).
 *
 * @param {object} system  actor.system
 * @param {number} amount  сколько Ран потеряно
 * @returns {Record<string, number|boolean>} кусок для actor.update()
 */
export function woundLossUpdates(system, amount) {
  const { value, critical } = woundLossAfter(
    system?.wounds?.value, system?.wounds?.critical, amount);
  const updates = {
    "system.wounds.value":    value,
    "system.wounds.critical": critical
  };
  if ((Number(amount) || 0) > 0) updates["system.wounds.firstAidUsed"] = false;
  return updates;
}

/**
 * Применяет потерю Ран к актору: считает woundLossAfter() и сам пишет
 * actor.update(), если что-то реально меняется. amount <= 0 — update не
 * шлётся вовсе (нет смысла дёргать документ впустую).
 *
 * @param {Actor} actor
 * @param {number} amount  сколько Ран потеряно (уже посчитанный, непоглощённый урон)
 * @returns {Promise<{applied:boolean, currentWounds:number, currentCritical:number,
 *   newWounds:number, newCritical:number, maxWounds:number, overflow:boolean, gotCritical:boolean}>}
 */
export async function applyWoundLoss(actor, amount) {
  const currentWounds   = Number(actor.system?.wounds?.value)    || 0;
  const currentCritical = Number(actor.system?.wounds?.critical) || 0;
  const maxWounds        = Number(actor.system?.wounds?.max)      || 0;

  const { value: newWounds, critical: newCritical, overflow } =
    woundLossAfter(currentWounds, currentCritical, amount);

  const applied = newWounds !== currentWounds || newCritical !== currentCritical;
  if (applied) {
    await actor.update({
      "system.wounds.value":    newWounds,
      "system.wounds.critical": newCritical,
      // Новый урон → снова можно оказать Первую Помощь (гейт в
      // tabs/healing.mjs). applied ⇔ amount > 0: при нулевом уроне
      // woundLossAfter ничего не меняет и сюда не попадаем.
      "system.wounds.firstAidUsed": false
    });
  }

  return {
    applied, currentWounds, currentCritical, newWounds, newCritical, maxWounds,
    overflow, gotCritical: overflow
  };
}

/** Порог гибели по отрицательным (Критическим) Ранам — Макс Ран + 7. */
export function woundDeathThreshold(maxWounds) {
  return (Number(maxWounds) || 0) + 7;
}
