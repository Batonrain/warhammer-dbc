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
import { hasBlackEyesDarknessImmunity } from "../../rules/black-eyes.mjs";
import { isBraced } from "../../combat/brace-weapon.mjs";
import { lockingContactTokenDocs } from "../../combat/free-attack.mjs";
import { hasQuietElimination, isQuietEliminationWeapon } from "../../rules/quiet-elimination.mjs";
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
    weapon = null,
    wProps,
    wp,
    // Штраф за огринское оружие в чужих руках (rules/ogryn-fit.mjs) — число
    // со знаком минус или 0. Нужен, чтобы предложить его снять Закреплением.
    ogrynBracePenalty = 0,
  } = v;

  const commonMods = [
    { label: "Усталость",     value: -10, autoCheck: hasFatigue },
    // visionPenalty (wdbc-1rno.1, Чёрные Глаза/Black Eyes, Cor 60+) — три
    // галочки ниже гасятся у АТАКУЮЩЕГО (не у цели, поэтому не immuneFlag —
    // тот гасит только возможности ЦЕЛИ, см. цикл ниже).
    // Слабый свет (стр. 34, wdbc-x1nz.2.46): штраф только стрелковой — у
    // рукопашной книжная таблица «Стандартные Модификаторы Атаки» даёт
    // пустую ячейку (0), в отличие от Дыма/Тьмы ниже, где штраф есть у обеих.
    { label: "Слабый свет",   value: isMelee ? 0 : -10, visionPenalty: true },
    { label: "Дым / туман",   value: isMelee ? -10 : -20, visionPenalty: true },
    { label: "Тьма",          value: isMelee ? -20 : -30, visionPenalty: true },
    { label: "Ослеплён",      value: isMelee ? -30 : -99, autofail: !isMelee, autoCheck: isBlinded },
    // Потеря глаз (частичная): −10 на BS и «тесты определения расстояний»
    // (последнее не автоматизировано — нет отдельного типа теста «на глаз»)
    // — только стрелковая, книга не даёт штрафа рукопашной от неё отдельно.
    ...(isMelee ? [] : [{ label: "Потеря глаз", value: -10, autoCheck: hasLostEyes }]),
    { label: "Цель лежит",    value: isMelee ?  20 : -20 },
    { label: "Цель бежит",    value: isMelee ?  20 : -20 },
    { label: "Цель Оглушена", value: 20 },
    // id нужен readAttackForm (wdbc-1rno.3, стр. 32 «Скрытная Атака»):
    // «Взятие Врасплох» читается как именованный флаг attack.mjs::
    // targetSurprised (Quiet Elimination: +1 куб урона/тихая смерть ПО
    // ЛЮБОЙ атаке, отмеченной Врасплох, не только ножом/пистолетом — см.
    // rules/quiet-elimination.mjs), а не только суммируется в общий Порог.
    { id: "atk-mod-surprised", label: "Цель Врасплох", value: 30, immuneFlag: "attack.surpriseImmune" },
    // id нужен readAttackForm (стр. 12, wdbc-x1nz.2.29): «Избегание невозможно
    // от атаки, о которой цель не знает» — атакующий сам объявляет это
    // галочкой (со спины/из засады/невидимый-неслышный снаряд книга не даёт
    // теста на автоопределение), а не только получает +30 к попаданию.
    { id: "atk-mod-hidden", label: "Скрытая атака", value: 30, note: "цель не знает — Избегание невозможно" },
    // Тихое Устранение / Quiet Elimination (стр. …, wdbc-1rno.3): «нож или
    // игольчатый/осколочный пистолет — +10 к тестам атаки», независимо от
    // Врасплох — авто-галочка, вычисляется прямо здесь (actor/weapon уже в
    // области видимости, тот же приём, что у hasBlackEyesDarknessImmunity
    // ниже).
    ...(hasQuietElimination(actor) && weapon && isQuietEliminationWeapon(weapon) ? [{
      label: "Тихое Устранение (нож/игольчатый/осколочный пистолет)", value: 10, autoCheck: true
    }] : []),
    // Закрепление (Полудействие, Физическое: оружие ставится на укрытие,
    // лафет, бипод или трипод). Книга свойства Ogrynized: «Закрепление оружия
    // убирает все эти штрафы». Отдельного состояния «закреплено» в системе
    // нет — Закрепление и для тяжёлого оружия живёт галочкой этого списка, —
    // поэтому здесь оно тоже галочка, и она РОВНО компенсирует уже посчитанный
    // штраф, каким бы он ни сложился (−10, −20 или −30).
    ...(ogrynBracePenalty ? [{
      label: "Огринское оружие Закреплено",
      value: -ogrynBracePenalty,
      note: "полудействие: на укрытие/лафет/бипод — снимает штрафы за Размер, Силу и форму рук"
    }] : [])
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
  // Чёрные Глаза / Black Eyes (wdbc-1rno.1, rules/black-eyes.mjs): Cor 60+ —
  // АТАКУЮЩИЙ видит сквозь дым/тьму/слабый свет, штрафы гасятся у него
  // самого (в отличие от immuneFlag выше, который гасит возможности ЦЕЛИ).
  if (hasBlackEyesDarknessImmunity(actor)) {
    for (const m of commonMods) {
      if (!m.visionPenalty) continue;
      m.value  = 0;
      m.immune = true;
      m.note   = "Чёрные Глаза: видит сквозь тьму/дым/слабый свет (Cor 60+)";
    }
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
  // Полёт (стр. 30, wdbc-x1nz.2): высота ЦЕЛИ решает разрешён ли контакт —
  // Низкая недосягаема рукопашной (но не стрелковым, там штраф −10 вместо
  // блока), Высокая недосягаема стрелковым вовсе без Зенитного, рукопашной —
  // всегда. Атакующий на ТОЙ ЖЕ высоте снимает оба правила целиком (бой
  // на равной высоте — книга не даёт для него ни штрафа, ни блока).
  const targetAltitude   = attackCtx.targetActor?.system?.movement?.altitude;
  const attackerAltitude = actor?.system?.movement?.altitude;
  const sameAltitude = attackerAltitude != null && attackerAltitude === targetAltitude;
  const targetAtLow  = targetAltitude === "low"  && !sameAltitude;
  const targetAtHigh = targetAltitude === "high" && !sameAltitude;
  // «Трудный ландшафт» в рукопашной: зона Трудного Ландшафта под атакующим.
  // Зона «очень трудный» не различает — автоотмечаем обычный (−10), сильнее руками.
  const meleeTerrain = (isMelee && attackerToken)
    ? getTerrainInfoForToken(attackerToken.document ?? attackerToken) : null;
  // Связан в Рукопашной (стр. 30, wdbc-x1nz.2.64): стрелок сам заперт врагом
  // с рукопашным оружием/Пистолетом в Базовом/Глубоком контакте — «не может
  // стрелять в цели ВНЕ рукопашной». Геометрия та же, что у Свободной Атаки.
  const lockedByEnemies = (!isMelee && attackerToken)
    ? lockingContactTokenDocs(attackerToken.document ?? attackerToken) : [];
  const inContactWithTarget = !!measured?.contact && measured.contact !== "none";
  // Стрельба ПО цели, которая сама Связана в Рукопашной с кем-то ТРЕТЬИМ (не
  // самим стрелком — тот случай уже покрыт «Стрельба в рукопашную» ниже, со
  // своим исключением для Пистолета) — отдельный штраф −20 без исключений.
  const targetLocked = (!isMelee && targetToken && !inContactWithTarget)
    ? lockingContactTokenDocs(targetToken.document ?? targetToken).length > 0 : false;
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
    // Полёт (стр. 30, wdbc-x1nz.2): Низкая/Высокая — «вне досягаемости
    // рукопашных атак наземных персонажей» — не штраф, а полный блок.
    // Приземная сюда не попадает (targetAtLow/targetAtHigh уже false) —
    // книга прямо говорит «без всяких ограничений».
    { label: "Цель в полёте (Низкая/Высокая) — рукопашная недосягаема",
      value: 0, autofail: true, autoCheck: targetAtLow || targetAtHigh,
      note: (targetAtLow || targetAtHigh) ? `цель на высоте «${targetAltitude}» (стр. 30)` : undefined },
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
    // Пистолет (стр. 40, wdbc-x1nz.2.57): «может использоваться для стрельбы
    // в ближнем бою без каких-либо штрафов» — ни этого штрафа, ни бонуса
    // Уклонения цели (тот гасится отдельно, attack.mjs::meleeShotDodgeBonus).
    { id: "atk-melee-shot", label: "Стрельба в рукопашную",
      value: weapon?.system?.weaponClass === "pistol" ? 0 : -20,
      note: weapon?.system?.weaponClass === "pistol" ? "Пистолет: без штрафов в рукопашную" : undefined },
    // Связан в Рукопашной (стр. 30, wdbc-x1nz.2.64): полный запрет стрелять в
    // цели ВНЕ рукопашной, если стрелок сам заперт врагом с рукопашным
    // оружием/Пистолетом в контакте. Тот же autofail-приём, что у «Тяжёлое/
    // Длинная Винтовка» ниже — галочка есть всегда, бьёт (autoCheck) только
    // когда стрелок реально заперт и целится МИМО своей рукопашной.
    { label: "Связан в Рукопашной: нельзя стрелять вне рукопашной",
      value: 0,
      autofail: lockedByEnemies.length > 0,
      immune: lockedByEnemies.length === 0,
      autoCheck: lockedByEnemies.length > 0 && !inContactWithTarget,
      note: lockedByEnemies.length > 0
        ? `в контакте с врагом (рукопашное/Пистолет): ${lockedByEnemies.map(d => d.name).join(", ")} (стр. 30)`
        : undefined },
    // Стрельба ПО цели в рукопашной с ТРЕТЬИМ лицом (стр. 30) — отдельно от
    // «Стрельба в рукопашную» выше (та про самого стрелка, с исключением для
    // Пистолета): здесь исключения нет, стрелок сам не в этой рукопашной.
    { label: "Цель связана в рукопашной (с другим персонажем)", value: -20,
      autoCheck: targetLocked,
      note: targetLocked ? "стр. 30 — штраф без исключений, даже Пистолету" : undefined },
    // Тяжёлое оружие и Длинная Винтовка (стр. 40, wdbc-x1nz.2.57): «не может
    // использоваться для стрельбы в ближнем бою» вовсе — в отличие от
    // Пистолета/Винтовки выше, это не штраф, а полный запрет самого выстрела
    // по цели, с которой стрелок в контакте Баз. Тот же приём autofail, что
    // у «Высокая высота цели» ниже: галочка есть всегда, но реально бьёт
    // (autoCheck) только когда выстрел ДЕЙСТВИТЕЛЬНО идёт в рукопашную —
    // wp.noMeleeFire — Длинная Винтовка (constants/weapon-properties.mjs),
    // weaponClass "heavy" гейтится напрямую, без отдельного флага в паке.
    { label: "Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную",
      value: 0,
      autofail: weapon?.system?.weaponClass === "heavy" || !!wp.noMeleeFire,
      immune: !(weapon?.system?.weaponClass === "heavy" || !!wp.noMeleeFire),
      autoCheck: !!measured?.contact && measured.contact !== "none",
      note: (weapon?.system?.weaponClass === "heavy" || !!wp.noMeleeFire)
        ? "класс оружия не допускает стрельбу в ближнем бою (стр. 40)" : undefined },
    // Стр. 40: «Стрельба в ближнем бою считается дистанцией в упор, но имеет
    // модификатор на попадание +0, как будто это боевая дистанция» — контакт
    // Баз (measured.contact, tactical-map.mjs::measureTokens) уже даёт
    // расстояние в диапазоне «в упор» (0–3м), поэтому геометрия сама
    // отличает «просто стреляю с 1м, никого не трогая» (честные +30) от
    // «стреляю в того, с кем сцепился врукопашную» (книжные +0).
    { label: "Дистанция в упор",
      value: (!!measured?.contact && measured.contact !== "none") ? 0 : 30,
      autoCheck: bandKey === "pointBlank",
      note: (!!measured?.contact && measured.contact !== "none")
        ? "стрельба в ближнем бою — как боевая дистанция (стр. 40)"
        : bandNote("pointBlank") },
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
      autoCheck: targetAtLow,
      note: wp.antiAir ? "снято: Зенитное" : (targetAtLow ? "цель на Низкой высоте (полёт)" : undefined) },
    { label: "Высокая высота цели", value: 0, autofail: !wp.antiAir, immune: wp.antiAir,
      autoCheck: targetAtHigh,
      note: wp.antiAir ? "снято: Зенитное" : (targetAtHigh ? "без Зенитного попасть в принципе нельзя" : undefined) },
    // Тяжёлое оружие (стр. 40): –30 без Закрепления, ещё –10 если стрелок
    // Двигался в этот Ход — Гиро-Стабилизированное снижает первое до –10 и
    // полностью снимает второе (стр. 168). Закрепление (стр. 35, wdbc-x1nz.2.56)
    // теперь настоящее Действие с состоянием (combat/brace-weapon.mjs) —
    // галочка сама снимается, пока оружие реально Закреплено этим же токеном.
    { label: "Тяжёлое оружие: без Закрепления", value: wp.gyroStabilized ? -10 : -30,
      autoCheck: weapon?.system?.weaponClass === "heavy" && !isBraced(actor, weapon),
      note: wp.gyroStabilized ? "Гиро-стаб.: –30 снижено до –10"
          : (weapon?.system?.weaponClass === "heavy" && isBraced(actor, weapon) ? "Закреплено" : undefined) },
    { label: "Тяжёлое оружие: стрельба на ходу", value: wp.gyroStabilized ? 0 : -10, immune: wp.gyroStabilized,
      note: wp.gyroStabilized ? "снято: Гиро-стаб." : undefined }
  ];

  return { bandKey, charSwapWhy, commonMods, specificMods };
}
