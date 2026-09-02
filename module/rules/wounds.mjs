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
 * Аблативные Раны (wdbc-smy7, напр. Дар Нургла «Абсурдно Толстый»: «+10
 * аблативных Ран») — отдельный пул, поглощающий урон ДО обычных Ран, как
 * временный «щит из жира». Чистый расчёт: сколько урона поглотил аблативный
 * пул и сколько осталось для обычных Ран.
 *
 * @param {number} currentAblative
 * @param {number} amount
 * @returns {{ablative:number, absorbed:number, remaining:number}}
 */
export function ablativeAbsorb(currentAblative, amount) {
  const pool = Math.max(0, Number(currentAblative) || 0);
  const dmg  = Math.max(0, Number(amount) || 0);
  const absorbed = Math.min(pool, dmg);
  return { ablative: pool - absorbed, absorbed, remaining: dmg - absorbed };
}

/**
 * То же понижение Ран, но в виде updates-объекта — для мест, которые собирают
 * ОДИН общий actor.update() из нескольких кусков (эффекты препарата,
 * Поглощение Болью, цена психосилы в Ранах, откат Электростимуляторов).
 * При фактическом уроне сбрасывает firstAidUsed: новый урон → снова можно
 * оказать Первую Помощь (гейт в tabs/healing.mjs). Аблативный пул (wdbc-smy7),
 * если он есть, поглощает урон ПЕРВЫМ — обычные Раны получают только остаток.
 *
 * @param {object} system  actor.system
 * @param {number} amount  сколько Ран потеряно
 * @returns {Record<string, number|boolean>} кусок для actor.update()
 */
export function woundLossUpdates(system, amount) {
  const { ablative, remaining } = ablativeAbsorb(system?.wounds?.ablative, amount);
  const { value, critical } = woundLossAfter(
    system?.wounds?.value, system?.wounds?.critical, remaining);
  const updates = {
    "system.wounds.value":    value,
    "system.wounds.critical": critical
  };
  // Пул мог появиться и без poolMax-максимума (wdbc-w8ws, динамические
  // источники вроде Ракового Исцеления пишут system.wounds.ablative напрямую,
  // не через Конструктор) — писать пул, если он либо ограничен максимумом,
  // либо просто сейчас не пуст, иначе поглощение посчиталось бы, но тут же
  // потерялось бы (ablativeMax===0 не значит «пула нет», раз есть текущее значение).
  if ((system?.wounds?.ablativeMax || 0) > 0 || (Number(system?.wounds?.ablative) || 0) > 0)
    updates["system.wounds.ablative"] = ablative;
  if ((Number(amount) || 0) > 0) updates["system.wounds.firstAidUsed"] = false;
  return updates;
}

/**
 * Применяет потерю Ран к актору: считает woundLossAfter() и сам пишет
 * actor.update(), если что-то реально меняется. amount <= 0 — update не
 * шлётся вовсе (нет смысла дёргать документ впустую). Аблативный пул
 * (wdbc-smy7), если он есть, поглощает урон ПЕРВЫМ, ДО обычных Ран.
 *
 * @param {Actor} actor
 * @param {number} amount  сколько Ран потеряно (уже посчитанный, непоглощённый урон)
 * @returns {Promise<{applied:boolean, currentWounds:number, currentCritical:number,
 *   newWounds:number, newCritical:number, maxWounds:number, overflow:boolean, gotCritical:boolean,
 *   ablativeAbsorbed:number}>}
 */
export async function applyWoundLoss(actor, amount) {
  const currentWounds   = Number(actor.system?.wounds?.value)    || 0;
  const currentCritical = Number(actor.system?.wounds?.critical) || 0;
  const maxWounds        = Number(actor.system?.wounds?.max)      || 0;
  const ablativeMax      = Number(actor.system?.wounds?.ablativeMax) || 0;

  const { ablative: newAblative, absorbed: ablativeAbsorbed, remaining } =
    ablativeAbsorb(actor.system?.wounds?.ablative, amount);
  const { value: newWounds, critical: newCritical, overflow } =
    woundLossAfter(currentWounds, currentCritical, remaining);

  // Пул без poolMax-максимума — не значит «пула нет» (wdbc-w8ws, см.
  // woundLossUpdates выше): динамические источники пишут .ablative напрямую.
  const hasAblativePool = ablativeMax > 0 || (Number(actor.system?.wounds?.ablative) || 0) > 0;
  const ablativeChanged = hasAblativePool && newAblative !== (Number(actor.system?.wounds?.ablative) || 0);
  const applied = newWounds !== currentWounds || newCritical !== currentCritical || ablativeChanged;
  if (applied) {
    const upd = {
      "system.wounds.value":    newWounds,
      "system.wounds.critical": newCritical,
      // Новый урон → снова можно оказать Первую Помощь (гейт в
      // tabs/healing.mjs). applied ⇔ amount > 0: при нулевом уроне
      // woundLossAfter ничего не меняет и сюда не попадаем.
      "system.wounds.firstAidUsed": false
    };
    if (hasAblativePool) upd["system.wounds.ablative"] = newAblative;
    await actor.update(upd);
  }

  return {
    applied, currentWounds, currentCritical, newWounds, newCritical, maxWounds,
    overflow, gotCritical: overflow, ablativeAbsorbed
  };
}

/** Порог гибели по отрицательным (Критическим) Ранам — Макс Ран + 7. */
export function woundDeathThreshold(maxWounds) {
  return (Number(maxWounds) || 0) + 7;
}

/**
 * Заменяет вклад ОДНОГО динамического источника (wdbc-w8ws: Раковое
 * Исцеление/Освежёванный/Чумной Пастырь — грант переменной величины ДРУГОМУ
 * актору, не через Конструктор) в общий аблативный пул новым значением, не
 * трогая вклад остальных источников на том же акторе (напр. Absurdly Fat,
 * см. [[doombc-supply-timer-poolmax-target]]).
 *
 * Двигает СРАЗУ и ablative (текущее), и ablativeMax — обязательно с #291
 * (rules/character.mjs::prepareCharacterDerived клэмпит ablative до
 * ablativeMax на КАЖДЫЙ цикл расчёта, «осиротевший пул без источника должен
 * затухать»): динамический источник без своего ablativeMax исчез бы на
 * первом же рендере/такте боя. poolMax-источники Конструктора получают свой
 * ablativeMax от ActiveEffect и сюда не заходят вовсе.
 *
 * @param {object} system            actor.system получателя
 * @param {number} prevContribution  сколько ЭТОТ источник дал в прошлый раз
 * @param {number} newContribution   сколько он должен давать теперь
 * @returns {{ablative:number, ablativeMax:number, contribution:number}}
 */
export function replaceAblativeContribution(system, prevContribution, newContribution) {
  const prev = Math.max(0, Number(prevContribution) || 0);
  const next = Math.max(0, Number(newContribution) || 0);
  const currentAblative = Number(system?.wounds?.ablative)    || 0;
  const currentMax      = Number(system?.wounds?.ablativeMax) || 0;
  const baselineAblative = Math.max(0, currentAblative - prev);
  const baselineMax      = Math.max(0, currentMax - prev);
  return { ablative: baselineAblative + next, ablativeMax: baselineMax + next, contribution: next };
}

/**
 * Держит одну метку-вклад динамического источника в допустимых границах
 * ПОСЛЕ того, как общий ablative пул актора уменьшился по любой причине
 * (поглощение урона — ablativeAbsorb выше). Без этого ablativeMax источника
 * оставался бы задранным на исторический пик, открывая дыру для лишнего
 * пассивного регена (module/combat/ablative-wounds.mjs, +1 Ход, «пока
 * cur < max») — доля не может быть больше, чем сейчас реально осталось в
 * общем пуле. НЕ вызывать источнику самому за себя — сверяет и двигает
 * ablativeMax тоже, actor.update() снаружи, не здесь (чистый расчёт).
 *
 * @param {object} system            actor.system (уже ПОСЛЕ уменьшения ablative)
 * @param {number} prevContribution  доля этого источника до уменьшения
 * @returns {{ablativeMax:number, contribution:number}|null} null — сжимать нечего
 */
export function shrinkAblativeContributionToFit(system, prevContribution) {
  const prev = Math.max(0, Number(prevContribution) || 0);
  if (prev <= 0) return null;
  const currentAblative = Number(system?.wounds?.ablative) || 0;
  const next = Math.min(prev, currentAblative);
  if (next === prev) return null;
  const currentMax = Number(system?.wounds?.ablativeMax) || 0;
  return { ablativeMax: Math.max(0, currentMax - (prev - next)), contribution: next };
}
