// module/sheets/attack/mods.mjs
// ══════════════════════════════════════════════════════════════════════════
//  СИТУАТИВНЫЕ МОДИФИКАТОРЫ окна атаки (wdbc-uh56).
//
//  Список галочек «Общие» и «Рукопашные/Стрелковые» — тот, что живёт в
//  свёрнутом блоке диалога. Ничего не рисует: отдаёт данные, вёрстку из них
//  собирает markup.mjs.
//
//  Шов узкий по замеру (tools/_uh56-seam.mjs): 12 значений внутрь, 4 наружу
//  на 117 строк. Поперёк функции такого места больше нет — в середине через
//  границу идёт 90–106 значений.
// ══════════════════════════════════════════════════════════════════════════

import { ruleFlagLabels }         from "../../rules/flags.mjs";
import { meleeContactCount, hasHighGround } from "../../combat/tactical-map.mjs";
import { rangeBandKey }           from "../../rules/tactical-map.mjs";
import { getTerrainInfoForToken } from "../../regions/difficult-terrain.mjs";
import { actorHasAspectPath }     from "../../constants/aeldari-paths.mjs";
/**
 * @param {object} v состояние броска: оружие, токены, замеренная дистанция
 * @returns {{commonMods: object[], specificMods: object[], charSwapWhy: string[], bandKey: string|null}}
 */
export function situationalMods(v) {
  const {
    actor,
    attackCtx,
    attackerToken,
    gripRange,
    hasFatigue,
    hasLostEyes,
    isBlinded,
    isMelee,
    measured,
    targetHelpless,
    targetToken,
    wProps,
    wp,
  } = v;

  const commonMods = [
    { label: "Усталость",     value: -10, autoCheck: hasFatigue },
    { label: "Слабый свет",   value: -10 },
    { label: "Дым / туман",   value: isMelee ? -10 : -20 },
    { label: "Тьма",          value: isMelee ? -20 : -30 },
    { label: "Ослеплён",      value: isMelee ? -30 : -99, autofail: !isMelee, autoCheck: isBlinded },
    // Потеря глаз (частичная): −10 на BS и «тесты определения расстояний»
    // (последнее не автоматизировано — нет отдельного типа теста «на глаз»)
    // — только стрелковая, книга не даёт штрафа рукопашной от неё отдельно.
    ...(isMelee ? [] : [{ label: "Потеря глаз", value: -10, autoCheck: hasLostEyes }]),
    { label: "Цель лежит",    value: isMelee ?  20 : -20 },
    { label: "Цель бежит",    value: isMelee ?  20 : -20 },
    { label: "Цель Оглушена", value: 20 },
    { label: "Цель Врасплох", value: 30, immuneFlag: "attack.surpriseImmune" },
    { label: "Скрытая атака", value: 30, note: "цель не знает" }
  ];
  // Возможности ЦЕЛИ, гасящие модификатор атакующего (Мир смерти, «Паранойя
  // Выжившего»: по нему не работает бонус за Неожиданность). Цель — тот же
  // attackCtx.targetActor, что и у правил; нет цели — нечего гасить.
  for (const m of commonMods) {
    if (!m.immuneFlag || !attackCtx.targetActor) continue;
    // Контекст не передаём: он описывает бросок АТАКУЮЩЕГО, а спрашиваем мы
    // возможность цели — правило цели про чужое оружие ничего не знает.
    const why = ruleFlagLabels(attackCtx.targetActor, m.immuneFlag);
    if (!why.length) continue;
    m.value  = 0;
    m.immune = true;
    m.note   = `${attackCtx.targetActor.name}: ${why[0]}`;
  }
  // Aspect (wdbc-8b5/wdbc-28ld, стр. 168): без соответствующего Пути — −30 на
  // тесты использования. wProps хранит текст рейтинга (не число, см. aspect
  // в constants/weapon-properties.mjs — rating:true, ratingText:true).
  // Галочка, не auto: R3-модификация оружия снимает штраф для не-Асуриан/
  // Иннари, а отдельного реестра «установленных модификаций» под этот
  // конкретный случай в системе нет (weaponMod — свободные предметы ГМа) —
  // проще снять галочку руками, чем заводить новый распознаваемый эффект.
  const aspectText = wProps.find(p => p.key === "aspect")?.rating;
  if (aspectText) {
    const hasPath = actorHasAspectPath(actor.system, aspectText);
    commonMods.push({
      label: `Аспект: нет Пути «${aspectText}»`, value: -30,
      autoCheck: !hasPath,
      note: hasPath ? "Путь есть — снимите галочку" : "снимите галочку, если на оружии стоит модификация R3"
    });
  }
  // Зенитное (wdbc-z56a, стр. 166): «игнорирует все штрафы на попадание за
  // скорость цели, вроде –20 за Бег» — гасит именно эту строку, не отдельный
  // штраф (в диалоге атаки его отдельно и не было, штрафа скорости цели вне
  // «Цель бежит» книга не даёт числом).
  if (!isMelee && wp.antiAir) {
    const runMod = commonMods.find(m => m.label === "Цель бежит");
    if (runMod && !runMod.immune) {
      runMod.value = 0;
      runMod.immune = true;
      runMod.note = "Зенитное: игнорирует штраф скорости цели";
    }
  }
  const charSwapWhy  = ruleFlagLabels(actor, "charSwap.wp.forWsS", attackCtx);
  const twoWeaponWhy = ruleFlagLabels(actor, "penalty.twoWeapon.off", attackCtx);
  const twoWeaponOff  = twoWeaponWhy.length > 0;
  // Дуэлянтское (стр. 73 Книги Аэльдари): бой 1-на-1, когда никто не мешает,
  // — +5 на все тесты с оружием. Считаем реальные контакты на карте
  // (meleeContactCount), а не спрашиваем игрока на глаз — галочка лишь
  // подтверждает то, что уже видно на сцене, и её можно снять руками.
  const duelContacts = (wp.duelingParry && attackerToken) ? meleeContactCount(attackerToken) : null;
  // Числовой перевес (2к1/3к1): та же meleeContactCount, но ОБРАТНЫЙ обход —
  // считаем не врагов у атакующего, а «врагов цели» (т.е. атакующего и его
  // союзников) в контакте с целью (wdbc-5il7, п.5).
  const outnumberCount = (isMelee && targetToken) ? meleeContactCount(targetToken) : null;
  // Тактическая карта: полоса дальности из уже измеренной дистанции и Rng
  // оружия (стр. 40: в упор 0,5–3 м / короткая до Rng/2 / боевая до Rng /
  // дальняя до Rng×2 / экстремальная до Rng×3, дальше выстрел невозможен).
  // Автоотметка ровно одной галочки — все они по-прежнему снимаются руками,
  // ГМ-клапан сохраняется. За 3×Rng — видимый warning у измеренной дистанции.
  const bandKey  = (!isMelee && measured) ? rangeBandKey(measured.edgeM, gripRange) : null;
  const bandNote = k => (bandKey === k ? `по измеренной дистанции ${measured.edgeM} м` : undefined);
  // «Положение выше» (+10): сравнение elevation токенов атакующего и цели.
  const highGround = (isMelee && measured) ? hasHighGround(attackerToken, targetToken) : null;
  // «Трудный ландшафт» в рукопашной: зона Трудного Ландшафта под атакующим.
  // Зона «очень трудный» не различает — автоотмечаем обычный (−10), сильнее руками.
  const meleeTerrain = (isMelee && attackerToken)
    ? getTerrainInfoForToken(attackerToken.document ?? attackerToken) : null;
  const specificMods = isMelee ? [
    { label: "Трудный ландшафт",       value: -10, autoCheck: !!meleeTerrain?.inTerrain,
      note: meleeTerrain?.inTerrain ? "зона Трудного Ландшафта под атакующим" : undefined },
    { label: "Очень трудный ландшафт", value: -20 },
    { label: "Числ. перевес 2к1",      value:  10, autoCheck: outnumberCount === 2,
      note: outnumberCount == null ? undefined : `в контакте с целью: ${outnumberCount}` },
    { label: "Числ. перевес 3к1",      value:  20, autoCheck: outnumberCount != null && outnumberCount >= 3,
      note: outnumberCount == null ? undefined : `в контакте с целью: ${outnumberCount}` },
    { label: "Положение выше",         value:  10, autoCheck: highGround === true,
      note: highGround === true ? "elevation токена выше цели" : undefined },
    { label: "Более длинное оружие",   value:   5 },
    ...(wp.duelingParry ? [{
      label: "Дуэлянтское: бой 1-на-1 (никто не мешает)", value: 5,
      autoCheck: duelContacts === 1,
      note: duelContacts === null ? "нет токена атакующего — отметьте вручную"
          : `врагов в контакте: ${duelContacts}; Финт/Давление в такой дуэли — с Преимуществом (отметьте на кубике)`
    }] : []),
    // Локус Быстроты (стр. 29) снимает этот штраф. Строку не прячем, а обнуляем
    // с подписью: игрок должен видеть, ЧТО его сняло, иначе исчезнувшая галочка
    // выглядит как баг диалога.
    twoWeaponOff
      ? { label: "Бой несколькими руками", value: 0,
          note: `штраф снят: ${twoWeaponWhy.join(", ")}` }
      : { label: "Бой несколькими руками", value: -20, note: "осн./неосн. рука" }
  ] : [
    // Стр. 33: Подавленный персонаж в укрытии получает −20 ко всем тестам BS.
    // «В укрытии относительно источника» не проверяем (ситуативно) — авто-
    // отмечаем по самому факту Подавления, галочку можно снять руками.
    { label: "Подавлен огнём", value: -20, autoCheck: !!actor.system.conditions?.pinned },
    // id нужен readAttackForm — Карабин (wdbc-z56a) читает именно этот флаг,
    // чтобы решить, дать ли цели в рукопашной +30 или +10 на Уклонение.
    { id: "atk-melee-shot", label: "Стрельба в рукопашную",   value: -20 },
    { label: "Дистанция в упор",        value:  30, autoCheck: bandKey === "pointBlank", note: bandNote("pointBlank") },
    { label: "Короткая дистанция",      value:  10, autoCheck: bandKey === "short",      note: bandNote("short") },
    { label: "Боевая дистанция",        value:   0, autoCheck: bandKey === "combat",     note: bandNote("combat") },
    { label: "Дальняя дистанция",       value: -10, autoCheck: bandKey === "long",       note: bandNote("long") },
    { label: "Экстремальная дистанция", value: -30, autoCheck: bandKey === "extreme",    note: bandNote("extreme") },
    // Беспомощная цель, выстрел в упор/в рукопашной: как рукопашная — авто-
    // успех и удвоенный урон, а не просто +30 (см. targetHelpless выше). Это
    // ситуативный факт про конкретный выстрел (дистанция), а не хранимое
    // состояние — поэтому галочка, а не автоматика, ровно как «Дистанция в упор».
    ...(targetHelpless ? [{
      id: "atk-helpless-close", label: "Беспомощная цель: в упор / в рукопашной",
      value: 0, autosuccess: true,
      note: "заменяет +30 на авто-успех и ×2 урона"
    }] : []),
    // ── Ситуативные штрафы боя (wdbc-z56a, стр. 32/166): теснота/высота-
    // скорость цели/нестабильная платформа — раньше в диалоге не существовали
    // вовсе, поэтому Anti-Air/Gyro-Stabilized нечего было гасить. ──────────
    // Высота цели (стр. 32): Низкая –10 к попаданию, Высокая — попасть в
    // принципе нельзя без Зенитного (не просто штраф, отсюда autofail, как у
    // «Ослеплён» выше), Зенитное снимает оба штрафа целиком.
    { label: "Низкая высота цели",  value: wp.antiAir ? 0 : -10, immune: wp.antiAir,
      note: wp.antiAir ? "снято: Зенитное" : "цель на Низкой высоте (полёт)" },
    { label: "Высокая высота цели", value: 0, autofail: !wp.antiAir, immune: wp.antiAir,
      note: wp.antiAir ? "снято: Зенитное" : "без Зенитного попасть в принципе нельзя" },
    // Тяжёлое оружие (стр. 40): –30 без Закрепления, ещё –10 если стрелок
    // Двигался в этот Ход — Гиро-Стабилизированное снижает первое до –10 и
    // полностью снимает второе (стр. 168).
    { label: "Тяжёлое оружие: без Закрепления", value: wp.gyroStabilized ? -10 : -30,
      note: wp.gyroStabilized ? "Гиро-стаб.: –30 снижено до –10" : undefined },
    { label: "Тяжёлое оружие: стрельба на ходу", value: wp.gyroStabilized ? 0 : -10, immune: wp.gyroStabilized,
      note: wp.gyroStabilized ? "снято: Гиро-стаб." : undefined }
  ];

  return { bandKey, charSwapWhy, commonMods, specificMods };
}
