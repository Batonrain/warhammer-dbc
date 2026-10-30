// module/rules/turn-flags.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ФЛАГИ, ЖИВУЩИЕ «ДО НАЧАЛА СЛЕДУЮЩЕГО СВОЕГО ХОДА» (wdbc-5uae.1).
//
//  Их около десятка, и до этого каждый был вписан отдельной строкой прямо в
//  combat/action-economy.mjs::resetActionEconomy:
//
//      if (actor.getFlag(NS, "running")) upd["flags.warhammer-dbc.-=running"] = null;
//
//  Само по себе это работало. Плохо было другое: срок жизни метки — её
//  СВОЙСТВО, а хранился он не при метке, а в чужом файле, списком по имени.
//  Заводя новую метку такого срока, автор обязан вспомнить, что её надо
//  дописать ещё и туда, — и однажды не вспомнит. Найдётся это не сразу: метка
//  просто не снимется, и штраф или бонус останется висеть на следующий Ход.
//
//  Теперь срок описан данными: строка в реестре ниже — и всё. Сброс перебирает
//  реестр одним циклом и ничего не знает про имена.
//
//  ── Чего этот шаг НЕ делает ──────────────────────────────────────────────
//  Хранение остаётся прежним: метка по-прежнему лежит своим флагом там, где
//  лежала, а не переезжает в system.conditions. Родительский тикет предлагал
//  переезд, и он честно оценён в ~120 мест чтения плюс миграцию живых данных
//  (см. шапку rules/condition-mirrors.mjs). Здесь взято ровно то, ради чего
//  тикет и писался: перечисление по имени в общем сбросе исчезло.
//
//  Не всякая временная метка сюда попадает. «Марш» (marchKind) и «Выход из
//  Боя» (disengageActive) держатся дольше одного Хода и снимаются своим
//  кодом — им здесь не место, и это не упущение. Метки того же срока, что
//  бывают у акторов БЕЗ экономики действий (засечение Незримого
//  unseenDetectedUntilNextTurn, Грозный Вопль, Слепая Зона и т.п.), тоже
//  снимаются отдельными вызовами в hooks.mjs (начало Хода): реестр
//  перебирается внутри resetActionEconomy, а тот выходит сразу для типов вне
//  ACTION_ECONOMY_ACTOR_TYPES — перенос сюда перестал бы их снимать (wdbc-bjy1.9).
//
//  Чистый модуль: ни одного обращения к Foundry, только чтение переданного
//  актора и сборка патча для actor.update.
// ════════════════════════════════════════════════════════════════════════════

const FLAG_SCOPE = "warhammer-dbc";

/**
 * Флаг → зачем он и почему живёт ровно до начала следующего своего Хода.
 * Подпись не для интерфейса: она объясняет СЛЕДУЮЩЕМУ автору, что здесь
 * лежит и по какому признаку сюда попадают.
 */
export const TURN_SCOPED_FLAGS = {
  exposedAggressive: "Открытая стойка: Агрессивной Стойке нечем было платить Реакцией в конце Хода (стр. 15)",
  running:           "Бег: рывок этого Хода, штрафы и бонусы от него действуют до следующего",
  fullAttackLock:    "Полная Атака (core, «Полная Атака»): до начала своего следующего Хода нельзя совершать Физические Избегания; смягчают В Ногу с Моментом и Реприз (rules/full-attack-lock.mjs)",
  fastMoveThisTurn:  "Трудная Цель (стр. 62, wdbc-1rno.30): Бег/Натиск/Верховая Атака этого Хода — −10 стрельбе по носителю Таланта до следующего его Хода",
  justTheLightActive:"Лишь Свет: щит держится до начала следующего Хода (combat/just-the-light.mjs)",
  inevitabilityPenalty: "Локус Неизбежности: штраф −10 до начала своего следующего Хода",
  movedThisTurn:     "Импульсное: «не двигался с прошлого раунда» начинается заново каждым Ходом",
  recoilPool:        "Отскок: суммарная дистанция за Раунд (combat/recoil-pool.mjs)",
  moveDegreeThisTurn:"Выстрел Навскидку: категория перемещения этого Хода",
  ranMetersThisTurn: "Скоростная Внимательность (wdbc-l2urs): сколько метров токен реально пробежал за Бег этого Хода — штраф −5 за каждые P.b м читает combat/defense.mjs; нужна до начала следующего Хода, ядро Foundry стирает историю пути раньше (combat/path-limit.mjs::onMoveToken)",
  moveAllowanceThisTurn: "Лимит пути (wdbc-l2urs): сумма дистанций Действий Движения, объявленных в этом Ходу — сколько метров токен может пройти (combat/movement-actions.mjs::grantMoveAllowance, rules/movement-path.mjs)",
  physicalApSpentThisTurn:   "Калечащее: счётчик физических ОД этого Хода",
  cripplingTriggeredThisTurn:"Калечащее: защёлка «уже сработало в этом Ходу»",
  reactedAttackIds:  "Одна Реакция на одно Действие (стр. 12, wdbc-x1nz.2.28): attackId атак, на которые уже отвечали Реакцией",
  attackActionsThisTurn: "Лимит Атак за Ход (стр. 12, wdbc-x1nz.2.30): сколько Атак уже совершено в этом Ходу",
  concentrationActionsThisTurn: "Лимит Концентрации за Ход (стр. 12, wdbc-x1nz.2.33): сколько Концентраций уже совершено в этом Ходу",
  fullMoveDisadvantage: "Полное Движение (стр. 28, wdbc-x1nz.2.34): следующий тест Карабканья/Прыжка/Плавания в этом Ходу — с Помехой",
  duckAndCoverActive: "Перебежка (стр. 30, wdbc-x1nz.2.38): переброс Избегания/Подавления «до конца Раунда» (приближение — до начала своего следующего Хода)",
  delayNoAttack: "Задержка (стр. 12, wdbc-x1nz.2.42): банкованное ОД нельзя тратить на Атаку — уже атаковал в тот Ход, когда объявил Задержку",
  legacyGuardianMark: "Защитник, Оружие Наследия (wdbc-1rno.35, vigilant 8-8, стр. 428): цель, по которой стреляли, получает −30 на атаки по стрелку до начала СВОЕГО следующего Хода",
  legacyPendulumBonus: "Маятник, Оружие Наследия (wdbc-1rno.35, vigilant 7-7, стр. 427): бонус к следующему тесту Избегания = модификатор последней атаки этим оружием — тратится за один тест или гаснет к началу следующего своего Хода, смотря что раньше",
  legacySoulboundBonus: "Душесвязанное, Оружие Наследия (wdbc-1rno.35, skilled 7-7, стр. 427): заряженный бонус урона следующему попаданию этим оружием — тратится на первом попадании или гаснет к началу следующего своего Хода, смотря что раньше",
  sabreSecondAttackPending: "Сабля, Верховая Атака (core.json, wdbc-f6j9y): взведённая вторая атака — снимается концом Хода (hooks.mjs), здесь страховка на случай пропущенного конца Хода",
  devourerOfTimeApDebt: "Пожиратель Времени (wdbc-xzfp): долг ОД жертвы — вычитается из ОД этого Хода (resetActionEconomy читает до сброса) и гаснет",
  countenanceOfGods: "Лик <Бога> (Дары Богов, wdbc-1rno; снятие — wdbc-4umq): рейтинг Страха 3 «до начала своего следующего Хода» (rules/countenance-of-gods.mjs::COUNTENANCE_FLAG)",
  firedBracedHeavy: "Безоружный Бой (core.json, wdbc-x1nz.2.71): стрелял из Закреплённого тяжёлого — им «безоружен до начала своего следующего Хода» (combat/weapon-profiles.mjs::braceBlocksMelee)",
  shockHalfAction: "Шок, строка 1–20 (стр. 53): «только одно Полудействие в свой следующий Ход» — resetActionEconomy читает до сброса (1 ОД) и гаснет",
  flourishDance: "Размашистый Танец (Талант Избегания): штраф −5 за Успех на атаки выбранной цели по танцору — до начала его следующего Хода (combat/flourish-dance.mjs)",
  cautionThisTurn: "Осторожность (Талант Избегания): +1 Реакция за ментальное полудействие — раз в Ход (combat/caution.mjs)",
  quickDrawPinThisTurn: "Быстрое Выхватывание (Талант Скорости): чеку гранаты свободным действием можно выдернуть только раз в Ход (combat/draw-action.mjs)",
  sprintFatigueDue: "Спринт (Талант Скорости): второй Ход подряд дальнего Бега — +1 Усталости в конце Хода (combat/movement-actions.mjs::applySprintTurnEnd); здесь страховка на случай пропущенного конца Хода",
  hunkerDown: "Залегание (Талант Стойкости): AP укрытия ×2, выглядывающим частям — обычное AP, до начала следующего Хода (combat/hunker-down.mjs)",
  legacyHatredShield: "Щит Ненависти, Оружие Наследия (wdbc-1rno.35, vigilant 9-9, стр. 427): временный AP-щит руки(рук) и торса — держится до начала следующего своего Хода, не тратится отдельным попаданием",
  coveringFireOffer: "Прикрывающий Огонь (Талант Стрелка, 3-5fbf): враги из контакта на момент Выхода из Боя — кому можно дать очередь (combat/covering-fire.mjs)",
  coveringFireMarks: "Прикрывающий Огонь (Талант Стрелка, 3-5fbf): метки Подавления +10/+0 для Натиска бывших противников — враги ходят до следующего Хода стрелка (combat/covering-fire.mjs)",
  hipShootingPending: "Стрельба от Бедра (Талант Стрелка, 3-5fbf): Полное Движение объявлено, одиночный выстрел в этом Ходу ещё не сделан (combat/movement-actions.mjs::declareFullMove, rules/gunner-talents.mjs::HIP_SHOOTING_FLAG)",
  runAndGunPending: "Стрельба на Бегу (Талант Стрелка, 3-5fbf): Натиск объявлен, свободный выстрел ещё не сделан (combat/movement-actions.mjs::declareCharge, rules/run-and-gun.mjs)",
  chargeChecked: "Натиск (Прикрывающий Огонь и Стрельба на Бегу, Sahara covering-fire-hip-shooting): «<id боя>:<раунд>» — проверка Натиска в этом Раунде уже сделана, второй путь (HUD-кнопка или окно атаки) её не повторяет (combat/free-shot.mjs::chargeAttackGate, rules/run-and-gun.mjs)",
  runningThrowUsed: "Бросок на Бегу (Талант Метания, 3-8318): тест Acrobatics−10 в этом Ходу уже проходили — «раз в Ход» (combat/running-throw.mjs)",
  runningThrowPending: "Бросок на Бегу (Талант Метания, 3-8318): тест удался, свободный бросок метательным ещё не сделан (combat/running-throw.mjs, combat/free-shot.mjs)",
  runAndGunFired:"Стрельба на Бегу (Талант Стрелка, 3-5fbf): id оружия, из которого стреляли на Натиске и не сложили — им нельзя стрелять в рукопашной до конца Хода (снимается Сложить, combat/free-shot.mjs)",
  bayonetChargePending: "Штыковая Атака (Талант Рукопашных, 3-8dc5): попала Приёмом, свободный выстрел в упор ещё не сделан (rules/run-and-gun.mjs)",
  tankHunterThisTurn: "Охотник на Танки (Талант Стрелка, 3-5fbf): опознавать модель техники можно раз в Ход (combat/tank-hunter.mjs)",
  chamberInThisTurn: "Досылание (Талант Стрелка, 3-5fbf): патрон досылали в этом Ходу — «раз в Ход» (combat/reload.mjs::chamberInRound)",
  eyeOfVengeanceWeapon: "Око Мщения (Талант Стрелка, 3-5fbf): id стрелкового оружия, усиленного +Inf.b к Dmg и Pen — «до конца Хода» (rules/gunner-talents.mjs::EYE_OF_VENGEANCE_FLAG); приближение — до начала своего следующего Хода",
  killingStrikeThisTurn: "Смертельный Удар (Талант Берсерка, 3-861e): «только один раз в Ход» — Очко Бесчестия уже потрачено на автопровал Избеганий (combat/attack.mjs, rules/berserker-talents.mjs::KILLING_STRIKE_FLAG)",
  overclockThisTurn: "Разгон (Талант Техномистика, Sahara 3-2501): «раз в Ход» — метка гаснет с началом следующего Хода (sheets/tabs/tech.mjs::overclock, rules/technomystic-talents.mjs::OVERCLOCK_FLAG)",
  cloudCognitionThisTurn: "Облачная Когниция (Талант Техномистика, пачка J): «раз в Ход» — попытка передачи ⚙ уже была (sheets/tabs/tech.mjs::cloudCognition, rules/technomystic-resources.mjs)",
  motiveEucharistThisTurn: "Мотивное Причастие (Талант Техномистика, пачка J): «раз в Ход» — ⚡ уже передавали (sheets/tabs/tech.mjs::motiveEucharist, rules/technomystic-resources.mjs)",
  cloudCognitionReceived: "Облачная Когниция, ЦЕЛЬ (пачка J): сколько ⚙ она получила Талантом в этом Раунде — «от начала своего Хода до начала следующего», гаснет с началом её Хода (combat/gm-relay.mjs, rules/technomystic-resources.mjs)",
  processCostPaidThisTurn: "Начало Хода техномистика (Цифровое Откровение, Ноосферная Набожность, Sahara 3-2501): «↻» уже восстановил Когницию и списал цену Процессов, если они есть — второе нажатие в этом же Ходу ни восстанавливает, ни берёт плату (sheets/tabs/tech.mjs::cognitionRest, rules/technomystic-talents.mjs::PROCESS_PAID_FLAG)",
  psychicResurgenceActive: "Психическое Возрождение (Талант Псайканы, Sahara 3-28): поддержание психосил не снижает тPR — «до начала своего следующего Хода» (rules/psyker-talents.mjs::RESURGENCE_FLAG, sheets/tabs/psychic.mjs)",
  fastWeavingAp: "Быстрое Плетение (Талант Псайканы, Sahara 3-28, пачка I1): пул 2 ОД, выданный в начале боя после инициативы, только на манифестацию силы без типа «Атака» — с началом СВОЕГО Хода сбрасывается (rules/psyker-talents.mjs::FAST_WEAVING_FLAG, combat/psyker-pools.mjs)",
  warpLockActive: "Варп-Замок (Талант Псайканы, Sahara 3-28, пачка I2): «до начала своего следующего Хода теряет Трейт Psyker и не может манифестировать психосилы» — метка гаснет с началом СВОЕГО Хода (rules/warp-lock.mjs::WARP_LOCK_FLAG, combat/warp-lock.mjs, sheets/tabs/psychic.mjs)",
  fluidWeaveThisTurn: "Текучее Плетение (Талант Псайканы, Sahara 3-28, пачка I1): «раз в Ход» — переплетение уже было в этом Ходу (rules/psyker-talents.mjs::FLUID_WEAVE_TURN_FLAG, combat/psyker-pools.mjs)",
  bladeBindingOwner: "Сцепление Клинков (Талант Рукопашных, 3-8dc5): сцепление держится до начала следующего Хода цепляющего (rules/blade-binding.mjs, combat/blade-binding.mjs)",
  meleeDamageDealtThisTurn: "Упорство (Талант Рукопашных, 3-8dc5): рукопашная атака этого персонажа нанесла непоглощённый урон — повтор Упорства после этого недоступен (rules/melee-talents.mjs::MELEE_DAMAGE_DEALT_FLAG, combat/tenacity.mjs)",
  meleeDamageAppliedMsg: "Упорство (Талант Рукопашных, 3-8dc5): id карточки, по которой урон уже применён к цели (любой исход) — повтор Упорства не переспрашивает «урон ещё не применён» (rules/melee-talents.mjs::MELEE_DAMAGE_APPLIED_FLAG, combat/tenacity.mjs)",
  reaperInitialTarget: "Жнец (Талант Рукопашных, 3-8dc5): uuid токена начальной цели цепочки Натиска — от него меряется Полудвижение следующих целей (rules/melee-talents.mjs::REAPER_CHAIN_FLAG, combat/reaper-chain.mjs)",
  rageExitTried: "Ярость (Frenzy, Sahara focused-wrath-20-bs п.2): «не более одной попытки выйти из Ярости в Ход» — метка попытки гаснет с началом СВОЕГО Хода; вне боя «Ход» — 6 с игрового времени (rules/rage-behavior.mjs::rageExitAttemptAllowed, combat/rage-behavior.mjs::attemptRageExit)",
  haymakerHandForfeit: "Тяжёлый Хук (Талант Пугилиста, стр. 62, 3-eddb): «отказаться от атаки еще одной рукой в этот Ход» — «Обе руки» окна атаки закрыты до начала следующего Хода (rules/pugilist-talents.mjs::HAYMAKER_FORFEIT_FLAG)",
  legAttacksThisTurn: "Удар с Колена (Талант Пугилиста, стр. 62, 3-eddb): сколько ударов ногой уже было в этом Ходу — «ногой, которой он еще не атаковал» (rules/pugilist-talents.mjs::LEG_ATTACKS_FLAG, combat/attack.mjs)",
  pinDownHold: "Прижать (Талант Пугилиста, стр. 62, 3-eddb): штраф цели на физические действия и отмена +20 за Борьбу по прижимающему — до начала СЛЕДУЮЩЕГО Хода прижимающего; заодно метка «раз в Ход» (combat/grapple-talents.mjs, rules/situational.mjs)"
};

/** Ключи реестра — для сторожей и тестов. */
export const TURN_SCOPED_FLAG_KEYS = Object.keys(TURN_SCOPED_FLAGS);

/** Стоит ли флаг на акторе сейчас (и у документа Foundry, и у сырых данных). */
function flagValue(actor, key) {
  return actor?.getFlag?.(FLAG_SCOPE, key) ?? actor?.flags?.[FLAG_SCOPE]?.[key];
}

/**
 * Патч для actor.update, гасящий все истёкшие флаги этого такта.
 *
 * Возвращает именно патч, а не делает update сам: сброс экономики действий
 * собирает ОДИН update на всё (ОД, Реакции и эти флаги разом) — каждая
 * отдельная запись это раунд-трип в базу и полный re-render листов и токенов
 * у всех клиентов.
 *
 * Гасим штатным `-=`: записать false значило бы оставить в данных мусор,
 * который потом пришлось бы отличать от «никогда не ставили».
 *
 * @returns {object} пустой объект, если гасить нечего
 */
export function turnStartFlagClears(actor) {
  const upd = {};
  // != null, а не truthy: 0/false — тоже поставленная метка (Прижать со штрафом 0 — «уже прижимал в этом Ходу»).
  for (const key of TURN_SCOPED_FLAG_KEYS) {
    if (flagValue(actor, key) != null) upd[`flags.${FLAG_SCOPE}.-=${key}`] = null;
  }
  return upd;
}

// ════════════════════════════════════════════════════════════════════════════
//  МЕТКА, КОТОРУЮ НЕ ГАСЯТ, А ПЕРЕКЛАДЫВАЮТ (wdbc-pb60, Мэн-Гош)
//
//  Талант «Мэн-Гош» спрашивает не «бил ли ножом В ЭТОМ Ходу», а «бил ли им в
//  ПРЕДЫДУЩИЙ». Значит одного флага со сроком «до начала своего Хода» мало:
//  значение нужно на Ход дольше, чем живёт сама метка.
//
//  Отсюда пара: `attackedThisTurn` копится по ходу боя (attack.mjs дописывает
//  туда id оружия каждой атакой), а на старте своего Хода переезжает в
//  `attackedPrevTurn` и обнуляется. В общий реестр выше `attackedThisTurn` не
//  входит намеренно: там гасят, а здесь переносят, и слепое гашение стёрло бы
//  ответ на вопрос Таланта до того, как его успели задать.
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
//  СЖАТЬ В БОРЬБЕ (стр. 12, wdbc-x1nz.2.76) — тоже перекладывается, не гасится
//
//  «В свой Ход цель получит штраф –10 на любые Физические действия, за каждое
//  полудействие, потраченное на Сжатие, если она все еще в Захвате». Сжатия
//  копятся во время Хода Атакующего (grappleSqueezePending на Цели); в начале
//  Хода Цели они становятся действующим штрафом (grappleSqueezeActive) — если
//  она всё ещё в Захвате — и держатся весь её Ход. Следующее начало её Хода
//  без новых Сжатий штраф снимает. Читает rules/situational.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Патч для actor.update: Сжатия Атакующего → штраф на этот Ход Цели. */
export function turnStartSqueezeCarryOver(actor) {
  const pending = Number(flagValue(actor, "grappleSqueezePending")) || 0;
  const active  = Number(flagValue(actor, "grappleSqueezeActive")) || 0;
  const grappled = !!actor?.system?.conditions?.grappling;
  const upd = {};
  if (pending && grappled) upd[`flags.${FLAG_SCOPE}.grappleSqueezeActive`] = pending;
  else if (active) upd[`flags.${FLAG_SCOPE}.-=grappleSqueezeActive`] = null;
  if (pending) upd[`flags.${FLAG_SCOPE}.-=grappleSqueezePending`] = null;
  return upd;
}

/** Оружие, которым актор атаковал в свой ПРЕДЫДУЩИЙ Ход. */
export function attackedPrevTurn(actor) {
  const v = flagValue(actor, "attackedPrevTurn");
  return Array.isArray(v) ? v.map(String) : [];
}

/** Оружие, которым актор уже атаковал в ЭТОМ Ходу. */
export function attackedThisTurn(actor) {
  const v = flagValue(actor, "attackedThisTurn");
  return Array.isArray(v) ? v.map(String) : [];
}

/**
 * Патч для actor.update: перенести список этого Хода в «прошлый Ход».
 * Вливается в тот же один update, что и гашение флагов выше.
 */
export function turnStartAttackCarryOver(actor) {
  const now = attackedThisTurn(actor);
  const prev = attackedPrevTurn(actor);
  const upd = {};
  // Ничего не менялось — не пишем: лишний update это раунд-трип в базу и
  // перерисовка листов у всех клиентов.
  if (now.length) upd[`flags.${FLAG_SCOPE}.attackedPrevTurn`] = now;
  else if (prev.length) upd[`flags.${FLAG_SCOPE}.-=attackedPrevTurn`] = null;
  if (now.length) upd[`flags.${FLAG_SCOPE}.-=attackedThisTurn`] = null;
  return upd;
}
