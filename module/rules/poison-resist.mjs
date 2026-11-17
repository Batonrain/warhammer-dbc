// module/rules/poison-resist.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Спасбросок ЦЕЛИ против яда-препарата (DrugData drugCategory:"poison",
//  Глава IV «Арсенал», раздел «Яды», wdbc-x1nz.4). Характеристика и базовый
//  модификатор теста лежат на самом предмете: poisonTestChar/poisonTestMod
//  были в схеме DrugData с самого начала (module/data/item/drug.mjs), но до
//  этой правки их не читал ни один кусок кода — препарат категории «яд»
//  применялся без единого спасброска цели.
//
//  Модификатор Качества — отдельная таблица, НЕ общая module/constants/
//  quality.mjs::qualityEffects (та модифицирует тест ВЛАДЕЛЬЦА «с этим
//  снаряжением» — для яда это неверное правило книги, см. отчёт wdbc-x1nz.4).
//  Книга «Яды»: «Качество яда модифицирует все тесты против него: Poor.Q:
//  +10, Good.Q: –10, Best.Q: –20» (если у конкретного яда не сказано иначе —
//  тогда это число уже лежит прямо в poisonTestMod).
//
//  Чистая арифметика, без Foundry; бросок и карточка — sheets/tabs/drugs.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { normQuality } from "../constants/quality.mjs";

/** Qty.Q → модификатор ТЕСТА ЦЕЛИ против яда (книга «Яды», своя таблица). */
const POISON_QUALITY_TEST_MOD = { poor: 10, common: 0, good: -10, best: -20 };

export function poisonQualityTestMod(quality) {
  return POISON_QUALITY_TEST_MOD[normQuality(quality)] ?? 0;
}

/**
 * Слагаемое спасброска цели против яда: характеристика предмета (по
 * умолчанию T — так же, как у общего Сопротивления ядам/болезням в системе)
 * + собственный модификатор яда + модификатор его Качества.
 * @param {object} sys system предмета-яда (DrugData)
 * @returns {{charKey:string, mod:number}}
 */
export function poisonResistPart(sys) {
  const charKey = String(sys?.poisonTestChar || "t").toLowerCase();
  const mod = (Number(sys?.poisonTestMod) || 0) + poisonQualityTestMod(sys?.quality);
  return { charKey, mod };
}
