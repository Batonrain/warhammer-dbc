// module/sheets/attack/selection.mjs
// ══════════════════════════════════════════════════════════════════════════
//  ВЫБОР В ОКНЕ АТАКИ: Профиль, Стойка, Хват, База, Приём (wdbc-uh56).
//
//  Что предложить в каждом списке и что даёт выбранная связка. Ничего не
//  рисует и ничего не бросает: отдаёт наборы вариантов и функцию разбора
//  выбора, а окно и карточка строятся из них выше.
//
//  Шов замерен до выреза (tools/_uh56-seam.mjs): 21 значение внутрь,
//  9 наружу на 244 строки.
// ══════════════════════════════════════════════════════════════════════════

import { MELEE_STANCES, MELEE_BASES, MELEE_MANEUVERS, GRIPS, gripEffects,
         RANGED_GRIPS, rangedGripEffects, meleeEffectiveRange, gripManeuverBonus,
         LONG_ARMS_EXCLUDED_GRIPS } from "../../constants/combat.mjs";
import { actorMaxMeleeRange, chargeTargetDodgeBonus } from "../../rules/weapon-length.mjs";
import { CAPABILITIES }            from "../../constants/capabilities.mjs";
import { esc }                     from "../../helpers/utils.mjs";
import { hasRuleFlag }             from "../../rules/flags.mjs";
import { hasRecoilSuppressor }     from "../../combat/armor-mods.mjs";
import { isFusedByHandOfDeath }    from "../../rules/hand-of-death.mjs";
import { attackIsMelee }           from "../../combat/weapon-profiles.mjs";
import { tentacleBonusSuppressed } from "../../rules/tentacle-hand-form.mjs";
import { legacySlaughterThresholdDelta } from "../../rules/legacy-weapon.mjs";

/**
 * @param {object} v оружие, профиль, состояние актора и уже посчитанные бонусы
 * @returns {object} наборы вариантов для списков окна и разбор выбранной связки
 */
export function buildSelection(v) {
  const {
    actor,
    atkProfiles,
    bowMarkedMod,
    categoryFor,
    fullAttackForced,
    gripKey,
    gripList,
    hasShieldEquipped,
    isMelee,
    isMounted,
    item,
    maneuverKeyDefault,
    meleeBaseKey,
    primGrip,
    profIdx,
    sBonus,
    stance,
    sys,
    targetActor,
    trainingFor,
    wp,
  } = v;


  // ── Доступность Стойки/Хвата/Базы/Приёма (стр. 14-15, 62 Melee Training) ─
  // Без Рукопашной Тренировки на категорию оружия книга разрешает только
  // Обычную Атаку, Стандартную Стойку и Базовый (первый) Хват — База книгой
  // не ограничена, остаётся полностью на выбор. Приём дополнительно всегда
  // сверяется со списком совместимых категорий (MELEE_MANEUVERS[*].categories),
  // независимо от тренировки — но только если категория оружия известна:
  // много предметов пока без meleeCategory (пак не пересобран), и в этом
  // случае фильтр не применяется — лучше показать лишнее, чем незаслуженно
  // запереть Приёмы там, где данных попросту ещё нет.
  // Стойка дополнительно сверяется со своим categories/minBalance (Частокол:
  // Глефа/Копьё/Штык; Пружинящая: Баланс не ниже 0, стр. 15) — так же, как
  // Приём сверяется со своим categories ниже. Частокол — исключение из
  // «мягкого» пропуска при неизвестной категории (def.strictCategory,
  // MELEE_STANCES.rapidstrike): это требование к самой геометрии оружия
  // (длинное древковое), а не к Тренировке персонажа, поэтому неизвестная
  // категория не должна ошибочно предлагать Частокол любому оружию.
  //
  // Стойки книгой (стр. 15, «Композиция Рукопашной Атаки») применимы только
  // в пешем бою: верхом, за люком техники, в полёте и т.п. — только
  // Стандартная. Из перечисленных книгой состояний система живьём отслеживает
  // только «верхом» (actor.system.mount.uuid, тот же isMounted, что у Базы
  // «Верховая Атака» выше) — люк техники/полёт этот код не моделирует.
  // Стойка/Хват тоже зависят от выбранного Профиля (categoryFor/trainingFor
  // выше) — пересчитываются заново при его смене (см. updateTotal ниже), как
  // Приём — при смене Базы.
  function computeStanceOptions(pIdx) {
    const category = categoryFor(pIdx);
    const trained  = trainingFor(pIdx).trained;
    // «Только в пешем бою» (стр. 15): из книжного списка исключений (верхом,
    // за люком техники, в полёте) живьём отслеживаются верхом (isMounted) И
    // полёт (wdbc-x1nz.2.66.10, system.movement.altitude — low/high не
    // «приземный», module/data/actor/_creature.mjs). Бой из люка техники не
    // моделируется вовсе — для него в системе нет состояния, честно как есть.
    const altitude = actor.system?.movement?.altitude;
    const isFlying = altitude === "low" || altitude === "high";
    return Object.entries(MELEE_STANCES).map(([key, def]) => {
      const trainingOk = trained || key === "standard";
      const groundedOk = key === "standard" || (!isMounted && !isFlying);
      const fitOk = def.categories
        ? (def.strictCategory ? (!!category && def.categories.includes(category))
                               : (!category || def.categories.includes(category)))
        : def.minBalance != null ? ((sys.balance ?? 0) >= def.minBalance)
        : true;
      const reason = !trainingOk
        ? `Нужна Рукопашная Тренировка (${category})`
        : (!groundedOk ? `Стойки — только в пешем бою (сейчас ${isFlying ? "в полёте" : "верхом"})`
          : (!fitOk ? (def.categories
              ? (category ? `Не подходит категории «${category}»` : `Требуется профиль: ${def.categories.join("/")}`)
              : `Нужен Баланс не ниже ${def.minBalance}`) : ""));
      return { key, label: def.label, allowed: trainingOk && groundedOk && fitOk, reason };
    });
  }
  // Дальнобойный Хват (wdbc-3hxg) — не про Тренировку, а про Отдачу (стр. 166):
  // "1р" запрещён, если на оружии есть свойство Отдача(X) и S.b персонажа
  // меньше X — иначе персонаж обязан стрелять "2р". "2р" всегда доступен.
  // Подавители Отдачи (wdbc-cnju, armorMod на руках) снимают гейт Отдачи
  // целиком у винтовки/длинной винтовки (weaponClass "basic") — своей
  // категории у «длинной винтовки» в схеме нет, обе лежат в "basic".
  // Откатная Перчатка Good.Q/Best.Q «игнорирует свойство Recoil оружия» — гейт
  // снимается у ЛЮБОГО класса, не только у винтовки, в отличие от подавителей
  // (wdbc-f7iw). Возможность выдаётся Механикой самого предмета, а не именем.
  const recoilSuppressed = !isMelee
    && ((sys.weaponClass === "basic" && hasRecoilSuppressor(actor))
        || hasRuleFlag(actor, "weapon.ignoreRecoil"));
  // Рука Смерти форсирует "1р" безусловно (стр. 46) — Отдача её не блокирует,
  // тот же принцип, что и подавители Отдачи, гейт снят наравне с ними.
  const handOfDeathFused = isFusedByHandOfDeath(item);
  function computeRangedGripOptions() {
    return gripList.map(key => {
      const recoilBlocked = key === "1р" && !recoilSuppressed && !handOfDeathFused
        && wp.recoilRating > 0 && sBonus < wp.recoilRating;
      return {
        key, label: RANGED_GRIPS[key]?.label || key,
        allowed: !recoilBlocked,
        reason: recoilBlocked ? `Отдача: нужен S.b ≥ ${wp.recoilRating} для стрельбы одной рукой (сейчас ${sBonus})` : ""
      };
    });
  }
  function computeGripOptions(pIdx) {
    if (!isMelee) return computeRangedGripOptions();
    const trained = trainingFor(pIdx).trained;
    return gripList.map(key => ({
      key, label: GRIPS[key]?.label || key,
      allowed: trained || key === primGrip
    }));
  }

  // Длина Оружия, правило 5 (стр. 39, wdbc-x1nz.2.67.2): книга даёт Rng
  // диапазоном у части рукопашного оружия (Гладий 1-3, Меч 2-4 и т.п.) —
  // rangeMin > 0 и меньше range означает выбор доступен, иначе (0, обычный
  // случай — большинство оружия ещё не размечено content-проходом) пикер не
  // показывается вовсе, effRange считается по прежнему range без изменений.
  const hasVariableLength = isMelee && sys.rangeMin > 0 && sys.rangeMin < sys.range;
  /** Пилюли длины — по целому числу на каждое значение диапазона. */
  function computeLengthOptions() {
    const out = [];
    for (let n = sys.rangeMin; n <= sys.range; n++) out.push({ key: String(n), label: String(n), allowed: true });
    return out;
  }
  // "freeattack" (Свободная Атака, стр. 12) — Реакция доступная всем, как и
  // Обычная Атака: книга не требует Тренировки для неё отдельно.
  // Приём дополнительно завязан на текущую выбранную Базу (стр. 14: у каждого
  // Приёма своя «База» — MELEE_MANEUVERS[*].bases, отсутствие поля = «Любая»,
  // как у книжного «База: Любая»). Совпадать должны оба условия сразу —
  // категория оружия И База, поэтому пересчитывается заново при смене Базы
  // ИЛИ Профиля (см. updateTotal ниже), как Базы — при смене Стойки. Приёмы
  // из Талантов (Быстрая/Молниеносная Атака) добавляют requiresCapability и
  // minBalance — тот же приём, что у альт-профиля Профиля и у Пружинящей
  // Стойки соответственно.
  function computeManeuverOptions(baseKeyNow, pIdx) {
    const category = categoryFor(pIdx);
    const trained  = trainingFor(pIdx).trained;
    return Object.entries(MELEE_MANEUVERS).map(([key, def]) => {
      const categoryOk = key === "standard" || key === "freeattack" || !def.categories || !category || def.categories.includes(category);
      const baseOk     = !def.bases || def.bases.includes(baseKeyNow);
      const trainingOk = trained || key === "standard" || key === "freeattack";
      const balanceOk  = def.minBalance == null || ((sys.balance ?? 0) >= def.minBalance);
      const capOk      = !def.requiresCapability || hasRuleFlag(actor, def.requiresCapability);
      // Требование к свойству самого оружия (Пила: Tearing/Power Field, стр.
      // 14, wdbc-x1nz.2.66.2) — сверяется с уже посчитанным wp (aggregateAuto),
      // тем же приёмом, что categories/minBalance выше.
      const propsOk    = !def.requiresWeaponProps || def.requiresWeaponProps.some(k => wp[k]);
      const reason = !trainingOk
        ? `Нужна Рукопашная Тренировка (${category})`
        : (!categoryOk ? `Не подходит категории «${category}»`
          : (!baseOk ? `Только с Базой: ${def.bases.map(b => MELEE_BASES[b]?.label ?? b).join(", ")}`
            : (!balanceOk ? `Нужен Баланс не ниже ${def.minBalance}`
              : (!capOk ? `Нужно: ${CAPABILITIES[def.requiresCapability]?.source || def.requiresCapability}`
                : (!propsOk ? `Нужно свойство: ${def.requiresWeaponProps.join("/")}` : "")))));
      return { key, label: def.label, allowed: trainingOk && categoryOk && baseOk && balanceOk && capOk && propsOk, reason };
    });
  }
  /**
   * Пилюли Базы зависят от ТЕКУЩЕЙ Стойки (Частокол запрещает Натиск, стр. 15),
   * от Верховой Атаки (только верхом) и от Запрещённого Приёма (Cheap Shot,
   * стр. 166: «считается Стандартной Атакой» — свойство либо у самого оружия
   * (wp.cheapShot), либо временно даёт текущий Хват, см. GRIPS.Хв.addProp) —
   * пересчитываются заново на каждое изменение формы (см. #atk-base-pills в
   * updateTotal), а не один раз.
   */
  function computeBaseOptions(stanceKeyNow, gKeyNow) {
    const noCharge = MELEE_STANCES[stanceKeyNow]?.noCharge === true;
    const gDefNow = GRIPS[gKeyNow] ? gripEffects(gKeyNow, gKeyNow !== primGrip) : null;
    const cheapShotActive = !!(wp.cheapShot || gDefNow?.addProps?.includes("cheapShot"));
    return Object.entries(MELEE_BASES).map(([key, def]) => {
      let allowed = !fullAttackForced || key === "fullatk";
      let reason = "";
      if (allowed && cheapShotActive && key !== "standard") {
        allowed = false;
        reason = "Запрещённый Приём (Cheap Shot): только Стандартная Атака, тратит Реакцию";
      }
      if (allowed && def.requiresMount && !isMounted) { allowed = false; reason = "Только верхом на байке/скакуне"; }
      // noCharge теперь несут две Стойки (Частокол, стр. 15 — древковое
      // оружие мешает; Защитная, стр. 15, wdbc-x1nz.2.66.6 — «не даёт
      // совершать Натиск») — подпись причины берёт лейбл РЕАЛЬНОЙ текущей
      // Стойки, не захардкожена на одну из них.
      if (allowed && noCharge && key === "charge") {
        allowed = false;
        reason = `Недоступно в Стойке «${MELEE_STANCES[stanceKeyNow]?.label ?? stanceKeyNow}»`;
      }
      return { key, label: def.label, allowed, reason };
    });
  }
  // Профиль (стр. 207-221) не завязан на Тренировку — доступен всегда, кроме
  // альт-профилей с requiresCapability (напр. «Unarmed Warrior»/Безоружный
  // Воин, стр. 40, module/constants/capabilities.mjs: unarmed.warriorProfile) —
  // такой профиль лежит на том же предмете, но выбрать его можно только с
  // Талантом.
  //
  // КРОСС-ВИДОВЫЕ ПРОФИЛИ В СПИСОК НЕ ПОПАДАЮТ (wdbc-bs0q). Вид теста
  // фиксируется на входе в окно (attack-dialog.mjs: isMelee и charKey — const),
  // а бросок пересчитывает его заново по ВЫБРАННОМУ профилю
  // (combat/attack.mjs::_executeAttackRoll). Пока список предлагал профили
  // обоих видов, игрок мог открыть окно выстрела и переключиться в нём на
  // «Ударить оружием»: окно считало порог по BS, а бросок ту же атаку — рукопашной
  // (прибавлял S.b, не тратил патрон, не проверял заклинивание). Ровно то
  // расхождение окна и броска, ради устранения которого заведена attackIsMelee.
  // Рукопашный профиль у стрелкового выбирается ДО открытия окна — кнопкой «в
  // упор» в HUD, и тогда окно открывается уже рукопашным, а в списке остаётся
  // он один.
  //
  // ВЫБРАННЫЙ профиль остаётся в списке всегда, даже если он другого вида
  // (wdbc-4ltj). Вид окна считается по forceMelee И по профилю
  // (attack-dialog.mjs: attackIsMelee(sys, { forceMelee, profile })), поэтому
  // разойтись они могут ровно в одном случае — вызывающий передал
  // forceMelee:true вместе со СТРЕЛКОВЫМ profileIdx. Сегодня такого
  // вызывающего нет (кнопка «в упор» в HUD всегда шлёт индекс выводимого
  // рукопашного профиля), но появись он — фильтр по виду выкинул бы из списка
  // именно отмеченную пилюлю: игрок видел бы набор без выбранного, а profIdx
  // указывал бы на профиль вне списка. Считать вид вместе с forceMelee вместо
  // этого нельзя — тогда в окно «в упор» вернулись бы стрелковые профили, а
  // это и есть та дыра, которую закрывает wdbc-bs0q.
  const sameKind = profile => attackIsMelee(sys, { profile }) === isMelee;
  const profileOptions = atkProfiles.length ? [
    ...(sameKind(null) || profIdx < 0
      ? [{ idx: -1, label: sys.profileLabel || "Основной", dmg: sys.damage || "", allowed: true }]
      : []),
    ...atkProfiles.map((p, i) => {
      const allowed = !p.requiresCapability || hasRuleFlag(actor, p.requiresCapability);
      const reason  = allowed ? "" : `Нужно: ${CAPABILITIES[p.requiresCapability]?.source || p.requiresCapability}`;
      return { idx: i, label: p.label || `Проф. ${i + 1}`, dmg: p.damage || "", allowed, reason,
               kind: attackIsMelee(sys, { profile: p }) };
    }).filter(o => o.kind === isMelee || o.idx === profIdx)
  ] : [];
  function computeLockNoteHtml(pIdx) {
    const category = categoryFor(pIdx);
    const trained  = trainingFor(pIdx).trained;
    return (isMelee && category && !trained)
      ? `<span class="atk-training-warn" title="Без Рукопашной Тренировки (${esc(category)}) книга разрешает только Обычную Атаку, Стандартную Стойку и Базовый Хват">🔒 Без Тренировки (${esc(category)})</span>`
      : "";
  }

  /** Бонусы по текущему выбору (по умолчанию — стартовые значения диалога). */
  function resolveSelection(sel = {}) {
    const stanceKey = sel.stanceKey ?? stance;
    const stDef     = MELEE_STANCES[stanceKey] || MELEE_STANCES.standard;
    const stanceBon = isMelee ? (stDef.wsBonus ?? 0) : 0;

    const gKey = sel.gripKey ?? gripKey;
    const gDefRaw = isMelee
      ? (GRIPS[gKey] ? gripEffects(gKey, gKey !== primGrip) : null)
      : (RANGED_GRIPS[gKey] ? rangedGripEffects(gKey) : null);

    // Запрещённый Приём (Cheap Shot, стр. 166): тратит Реакцию вместо
    // действия, но «считается Стандартной Атакой» — База принудительно
    // становится standard, как fullAttackForced принудительно ставит fullatk.
    const cheapShotActive = isMelee && !!(wp.cheapShot || gDefRaw?.addProps?.includes("cheapShot"));

    const baseKey = fullAttackForced ? "fullatk" : (cheapShotActive ? "standard" : (sel.baseKey ?? meleeBaseKey));
    const bDef    = MELEE_BASES[baseKey] || MELEE_BASES.standard;
    const baseBon = isMelee ? (bDef.wsBonus ?? 0) : 0;

    const maneuverKey = isMelee ? (sel.maneuverKey ?? maneuverKeyDefault) : "standard";
    const mDef        = MELEE_MANEUVERS[maneuverKey] || MELEE_MANEUVERS.standard;

    // Длина Оружия (wdbc-x1nz.2.67, стр. 39): действующий Rng ЭТОЙ атаки —
    // длина + Хват + Приём (Выпад +1, Пила → 0). Читается диалогом
    // (Приём Выпад) и ниже, для бонуса Избегания цели при Натиске (правило 2).
    // Правило 5 (wdbc-x1nz.2.67.2): у оружия с диапазоном длины (rangeMin>0)
    // персонаж выбирает длину этой атаки пилюлями «Длина» в окне — sel.length
    // приходит строкой из формы, по умолчанию (пилюли не показаны либо ещё
    // не тронуты) — верхняя граница range, как и раньше.
    const length = hasVariableLength
      ? Math.min(sys.range, Math.max(sys.rangeMin, Number(sel.length ?? sys.range) || sys.range))
      : sys.range;
    // Длинные Руки (wdbc-x1nz.2.68, стр. 39): Размер 1+ атакующего.
    const sizeBonus = Math.max(0, Number(actor?.system?.size) || 0);
    const effRange = isMelee ? meleeEffectiveRange(length, gKey, maneuverKey, gKey !== primGrip, sizeBonus) : 0;

    // Обратный Хват (Об, стр. 39): приём Выпад «просто не получает штрафа»
    // WS от хвата — в любой Базе, не только на Полной Атаке. А на самой
    // Полной Атаке Выпадом хват вдобавок перестаёт резать S.b пополам и
    // сам наносит ещё +½S.b (окр.▲) урона СВЕРХ полного S.b, а не вместо
    // него — двойное исключение из общего −10 WS/½S.b хвата.
    // reverseThrustBonus не считается числом здесь: он зависит от S.b с
    // учётом Могучего/Сдержанного/Длани Кхорна, которые известны только в
    // attack.mjs (sbEff) — здесь только сигнальный флаг.
    const reverseGripThrust    = isMelee && gKey === "Об" && maneuverKey === "thrust";
    const reverseThrustFullAtk = reverseGripThrust && baseKey === "fullatk";
    const gDef = (reverseGripThrust && gDefRaw)
      ? { ...gDefRaw, ws: 0, sbHalf: reverseThrustFullAtk ? false : gDefRaw.sbHalf,
          reverseThrustBonus: reverseThrustFullAtk }
      : gDefRaw;
    const gWs = gDef ? gDef.ws : 0;
    // Щупальце (Мутация, wdbc-vkwe): «+20 на приём Захват» — модификатор
    // конкретного манёвра, не Стойки/Базы (те целятся во ВСЕ манёвры разом).
    // Нет общего вида записи «+N к манёвру X» в Конструкторе — решение по
    // тикету: точечный capability-флаг вместо новой инфраструктуры modScope,
    // тот же приём, что stanceWs/FULL_ATTACK_CAPABILITY выше в этом файле.
    // «...и все тесты в Борьбе» (module/combat/grapple.mjs, Сжать/Метнуть)
    // НЕ подключено — отдельная точка входа (_showContestDialog), не эта.
    // Субмутация 9 «Изменчивое» (wdbc-2ynk): пока щупальце временно в форме
    // руки — бонусу нечем помогать приёму Захват.
    const maneuverCapBonus = (isMelee && maneuverKey === "grapple"
      && hasRuleFlag(actor, "mutation.tentacle") && !tentacleBonusSuppressed(actor)) ? 20 : 0;
    // Наследие Бойни (H1, стр. 426): +20 к следующей атаке этим оружием после
    // убийства им, −30 вместо того же +20, если следующая атака — Оглушить
    // (нелетальный Приём). Чистое чтение — сам флаг гасится в attack.mjs
    // при фактическом броске, не здесь (эта функция зовётся многократно на
    // каждую перерисовку диалога, до самого броска).
    const slaughterBon = isMelee ? legacySlaughterThresholdDelta(actor, item, maneuverKey) : 0;
    // Хват, стр. 39 (wdbc-x1nz.2.68): «2р» как вторичный хват одноручного
    // даёт +10 к Приёму Оглушить (обычный WS-манёвр этого файла). Повалить —
    // отдельное Состязание (module/combat/knockdown.mjs), тот же бонус
    // подсказывается там же, где Финт для Обратного Хвата (sheets/tabs/combat.mjs).
    const gripManeuverBon = isMelee ? gripManeuverBonus(gKey, maneuverKey, gKey !== primGrip) : 0;
    // Рапира/Сабля (core.json, «Типы Рукопашного Оружия»): «Рапира
    // использует тип Меч, но получает +10 на прием Выпад, –10 на прием
    // Широкий Взмах» / «Сабля... +10 на прием Широкий Взмах, –10 на прием
    // Выпад» — тот же приём добавочного слагаемого maneuverBon, что
    // gripManeuverBon/slaughterBon выше, а не правка самой константы
    // MELEE_MANEUVERS (та общая для ВСЕХ Мечей, не только этого подтипа).
    const swordSubtypeBon = (isMelee && sys.meleeCategory === "Меч")
      ? (sys.meleeSubtype === "Рапира"
          ? (maneuverKey === "thrust" ? 10 : maneuverKey === "sweep" ? -10 : 0)
          : sys.meleeSubtype === "Сабля"
            ? (maneuverKey === "sweep" ? 10 : maneuverKey === "thrust" ? -10 : 0)
            : 0)
      : 0;
    const maneuverBon = isMelee ? (mDef.wsBonus ?? 0) + maneuverCapBonus + slaughterBon + gripManeuverBon + swordSubtypeBon : 0;

    const pIdx = sel.profIdx ?? profIdx;
    const prof = (pIdx >= 0) ? (atkProfiles[pIdx] || null) : null;

    // Избегания ЦЕЛИ против ЭТОЙ атаки — Приём и Стойка складываются (стр.
    // 14-15): например Взмах (−10 Уклонение) + Агрессивная (−10 Уклонение).
    // Поклон Публике (wdbc-1rno): «равный штраф на их физические Избегания» —
    // тот же bowMarkedMod, что уже прибавлен атакующему в wpAttackMod выше
    // (замыкание, bowMark читается один раз на актора-атакующего).
    // Длина Оружия, правило 2 (wdbc-x1nz.2.67, стр. 39): при Натиске на
    // противника, чьё оружие длиннее атакующего на 3 и более, у цели +5
    // к тестам Избегания от этой атаки.
    const chargeLengthBonus = (isMelee && baseKey === "charge" && targetActor
      && chargeTargetDodgeBonus(effRange, actorMaxMeleeRange(targetActor))) ? 5 : 0;
    const targetDodgeMod = (mDef.targetDodgeMod ?? 0) + (stDef.targetDodgeMod ?? 0) - bowMarkedMod + chargeLengthBonus;
    const targetParryMod = (mDef.targetParryMod ?? 0) + (stDef.targetParryMod ?? 0) - bowMarkedMod;

    // Защитная Стойка без щита (стр. 15) — персонаж не может атаковать вовсе.
    const blocked = isMelee && stanceKey === "defensive" && stDef.noAttackWithoutShield && !hasShieldEquipped;

    const note = [
      prof ? `Профиль: ${prof.label || "доп."}${prof.damage ? ` (${prof.damage})` : ""}` : "",
      gDef ? `Хват: ${gDef.label}${gDef.ws ? ` · WS ${gDef.ws >= 0 ? "+" : ""}${gDef.ws}` : ""}${gDef.dmgFlat ? ` · урон ${gDef.dmgFlat >= 0 ? "+" : ""}${gDef.dmgFlat}` : ""}${gDef.sbHalf ? " · ½S.b" : ""} — ${gDef.note}` : "",
      reverseGripThrust ? `Выпад в Обратном хвате: без штрафа WS${reverseThrustFullAtk ? ", Полная Атака — полный S.b + ещё ½S.b (окр.▲) урона сверху" : ""}` : "",
      maneuverCapBonus ? `Щупальце: +${maneuverCapBonus} на приём Захват` : "",
      gripManeuverBon ? `Хват: +${gripManeuverBon} на приём «${mDef.label}»` : "",
      slaughterBon ? `Наследие Бойни: ${slaughterBon > 0 ? "+" : ""}${slaughterBon} — заряжено убийством этим оружием` : "",
      chargeLengthBonus ? `Длина Оружия: цель длиннее на 3+ — Натиск даёт ей +5 Избегание` : "",
      (hasVariableLength && length !== sys.range) ? `Длина Оружия: выбрана ${length} вместо максимума ${sys.range} — влияет на правила 1/2/4 Длины Оружия (стр. 39)` : "",
      (sizeBonus > 0 && isMelee && !LONG_ARMS_EXCLUDED_GRIPS.has(gKey)) ? `Длинные Руки: Размер +${sizeBonus} к досягаемости (эфф. Rng ${effRange})` : ""
    ].filter(Boolean).join("<br>");

    return {
      stanceKey, stDef, stanceBon, baseKey, bDef, baseBon,
      maneuverKey, mDef, maneuverBon, gKey, gDef, gWs, pIdx, prof,
      cheapShotActive, effRange, length, hasVariableLength,
      techBon: baseBon + maneuverBon, targetDodgeMod, targetParryMod, blocked, note
    };
  }

  /**
   * То же, что resolveSelection, но недоступный, а всё ещё отмеченный вариант
   * (disabled+checked пилюля: readAttackForm читает :checked независимо от
   * disabled) сбрасывается на standard/базовый Хват. Одно место и для живого
   * пересчёта (updateTotal), и для самого броска — иначе смена Базы, делающая
   * выбранный Приём недоступным, всё равно уносила бы его в бросок.
   */
  function resolveSelectionSafe(f = {}) {
    const sel = resolveSelection(f);
    const ok = (opts, key, field = "key") =>
      opts.find(o => o[field] === key)?.allowed ?? true;
    if (!isMelee) {
      // Только Хват может стать недоступным у дальнобойного (Отдача) — тот же
      // приём сброса на безопасное значение, что у рукопашного ниже, просто
      // без Стойки/Базы/Приёма (у них тут нет пилюль вовсе).
      if (gripList.length && !ok(computeRangedGripOptions(), sel.gKey)) {
        const fallback = computeRangedGripOptions().find(o => o.allowed)?.key ?? "2р";
        return resolveSelection({ ...f, gripKey: fallback });
      }
      return sel;
    }
    const fix = {};
    if (!ok(computeStanceOptions(sel.pIdx), sel.stanceKey)) fix.stanceKey = "standard";
    const stanceKey = fix.stanceKey ?? sel.stanceKey;
    if (!ok(computeBaseOptions(stanceKey, sel.gKey), sel.baseKey)) fix.baseKey = "standard";
    const baseKey = fix.baseKey ?? sel.baseKey;
    if (!ok(computeManeuverOptions(baseKey, sel.pIdx), sel.maneuverKey)) fix.maneuverKey = "standard";
    if (gripList.length && !ok(computeGripOptions(sel.pIdx), sel.gKey)) fix.gripKey = primGrip;
    return Object.keys(fix).length ? resolveSelection({ ...f, ...fix }) : sel;
  }

  const dyn0 = resolveSelection();

  return {
    profileOptions, computeStanceOptions, computeGripOptions, computeBaseOptions,
    computeManeuverOptions, computeLockNoteHtml, computeLengthOptions, hasVariableLength,
    resolveSelectionSafe, dyn0
  };
}
