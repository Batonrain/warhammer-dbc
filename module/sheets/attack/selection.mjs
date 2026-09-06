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
         RANGED_GRIPS, rangedGripEffects } from "../../constants/combat.mjs";
import { CAPABILITIES }            from "../../constants/capabilities.mjs";
import { esc }                     from "../../helpers/utils.mjs";
import { hasRuleFlag }             from "../../rules/flags.mjs";
import { hasRecoilSuppressor }     from "../../combat/armor-mods.mjs";
import { isFusedByHandOfDeath }    from "../../rules/hand-of-death.mjs";
import { attackIsMelee }           from "../../combat/weapon-profiles.mjs";
import { tentacleBonusSuppressed } from "../../rules/tentacle-hand-form.mjs";

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
    return Object.entries(MELEE_STANCES).map(([key, def]) => {
      const trainingOk = trained || key === "standard";
      const groundedOk = key === "standard" || !isMounted;
      const fitOk = def.categories
        ? (def.strictCategory ? (!!category && def.categories.includes(category))
                               : (!category || def.categories.includes(category)))
        : def.minBalance != null ? ((sys.balance ?? 0) >= def.minBalance)
        : true;
      const reason = !trainingOk
        ? `Нужна Рукопашная Тренировка (${category})`
        : (!groundedOk ? "Стойки — только в пешем бою (сейчас верхом)"
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
      const reason = !trainingOk
        ? `Нужна Рукопашная Тренировка (${category})`
        : (!categoryOk ? `Не подходит категории «${category}»`
          : (!baseOk ? `Только с Базой: ${def.bases.map(b => MELEE_BASES[b]?.label ?? b).join(", ")}`
            : (!balanceOk ? `Нужен Баланс не ниже ${def.minBalance}`
              : (!capOk ? `Нужно: ${CAPABILITIES[def.requiresCapability]?.source || def.requiresCapability}` : ""))));
      return { key, label: def.label, allowed: trainingOk && categoryOk && baseOk && balanceOk && capOk, reason };
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
      if (allowed && noCharge && key === "charge") { allowed = false; reason = "Недоступно в Стойке «Частокол»"; }
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
  // «Удар в упор»: окно считало порог по BS, а бросок ту же атаку — рукопашной
  // (прибавлял S.b, не тратил патрон, не проверял заклинивание). Ровно то
  // расхождение окна и броска, ради устранения которого заведена attackIsMelee.
  // Рукопашный профиль у стрелкового выбирается ДО открытия окна — кнопкой «в
  // упор» в HUD, и тогда окно открывается уже рукопашным, а в списке остаётся
  // он один.
  const sameKind = profile => attackIsMelee(sys, { profile }) === isMelee;
  const profileOptions = atkProfiles.length ? [
    ...(sameKind(null)
      ? [{ idx: -1, label: sys.profileLabel || "Основной", dmg: sys.damage || "", allowed: true }]
      : []),
    ...atkProfiles.map((p, i) => {
      const allowed = !p.requiresCapability || hasRuleFlag(actor, p.requiresCapability);
      const reason  = allowed ? "" : `Нужно: ${CAPABILITIES[p.requiresCapability]?.source || p.requiresCapability}`;
      return { idx: i, label: p.label || `Проф. ${i + 1}`, dmg: p.damage || "", allowed, reason,
               kind: attackIsMelee(sys, { profile: p }) };
    }).filter(o => o.kind === isMelee)
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
    const gDef = isMelee
      ? (GRIPS[gKey] ? gripEffects(gKey, gKey !== primGrip) : null)
      : (RANGED_GRIPS[gKey] ? rangedGripEffects(gKey) : null);
    const gWs  = gDef ? gDef.ws : 0;

    // Запрещённый Приём (Cheap Shot, стр. 166): тратит Реакцию вместо
    // действия, но «считается Стандартной Атакой» — База принудительно
    // становится standard, как fullAttackForced принудительно ставит fullatk.
    const cheapShotActive = isMelee && !!(wp.cheapShot || gDef?.addProps?.includes("cheapShot"));

    const baseKey = fullAttackForced ? "fullatk" : (cheapShotActive ? "standard" : (sel.baseKey ?? meleeBaseKey));
    const bDef    = MELEE_BASES[baseKey] || MELEE_BASES.standard;
    const baseBon = isMelee ? (bDef.wsBonus ?? 0) : 0;

    const maneuverKey = isMelee ? (sel.maneuverKey ?? maneuverKeyDefault) : "standard";
    const mDef        = MELEE_MANEUVERS[maneuverKey] || MELEE_MANEUVERS.standard;
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
    const maneuverBon = isMelee ? (mDef.wsBonus ?? 0) + maneuverCapBonus : 0;

    const pIdx = sel.profIdx ?? profIdx;
    const prof = (pIdx >= 0) ? (atkProfiles[pIdx] || null) : null;

    // Избегания ЦЕЛИ против ЭТОЙ атаки — Приём и Стойка складываются (стр.
    // 14-15): например Взмах (−10 Уклонение) + Агрессивная (−10 Уклонение).
    // Поклон Публике (wdbc-1rno): «равный штраф на их физические Избегания» —
    // тот же bowMarkedMod, что уже прибавлен атакующему в wpAttackMod выше
    // (замыкание, bowMark читается один раз на актора-атакующего).
    const targetDodgeMod = (mDef.targetDodgeMod ?? 0) + (stDef.targetDodgeMod ?? 0) - bowMarkedMod;
    const targetParryMod = (mDef.targetParryMod ?? 0) + (stDef.targetParryMod ?? 0) - bowMarkedMod;

    // Защитная Стойка без щита (стр. 15) — персонаж не может атаковать вовсе.
    const blocked = isMelee && stanceKey === "defensive" && stDef.noAttackWithoutShield && !hasShieldEquipped;

    const note = [
      prof ? `Профиль: ${prof.label || "доп."}${prof.damage ? ` (${prof.damage})` : ""}` : "",
      gDef ? `Хват: ${gDef.label}${gDef.ws ? ` · WS ${gDef.ws >= 0 ? "+" : ""}${gDef.ws}` : ""}${gDef.dmgFlat ? ` · урон ${gDef.dmgFlat >= 0 ? "+" : ""}${gDef.dmgFlat}` : ""}${gDef.sbHalf ? " · ½S.b" : ""} — ${gDef.note}` : "",
      maneuverCapBonus ? `Щупальце: +${maneuverCapBonus} на приём Захват` : ""
    ].filter(Boolean).join("<br>");

    return {
      stanceKey, stDef, stanceBon, baseKey, bDef, baseBon,
      maneuverKey, mDef, maneuverBon, gKey, gDef, gWs, pIdx, prof,
      cheapShotActive,
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
    computeManeuverOptions, computeLockNoteHtml,
    resolveSelectionSafe, dyn0
  };
}
