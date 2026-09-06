import { disabledActorTypes, featureForActorType, isFeatureEnabled,
         featureForRace, isRaceDisabled } from "../constants/features.mjs";
import { prepareShipDerived } from "../rules/ship.mjs";
import { prepareVehicleDerived } from "../rules/vehicle.mjs";
import { prepareHordeDerived } from "../rules/horde.mjs";
import { prepareFormationDerived } from "../rules/formation.mjs";
import { prepareSquadDerived } from "../rules/squad.mjs";
import { prepareCharacterDerived } from "../rules/character.mjs";
import { withRulesCache } from "../rules/collect.mjs";

export class WarhammerActor extends Actor {
  prepareData() { super.prepareData(); }

  /**
   * Круглый токен из портрета. Foundry рисует токен кольцом: картинка
   * обрезается по кругу и вписывается в клетку, а не ложится на сцену
   * портретом во весь рост — именно это и видно, когда актора выставляют
   * на сцену, ведь картинка токена у нас равна портрету.
   *
   * Включается ПОДГОТОВКОЙ, а не при создании: так кольцо получают и уже
   * созданные персонажи, и все существа бестиария — без миграции и без правки
   * паков. Тот же приём в pf2e.
   *
   * Своей текстуры кольцу не задаём: без неё Foundry берёт картинку самого
   * токена, и выбор ГМа в «Прототипе токена» продолжает работать.
   */
  prepareBaseData() {
    super.prepareBaseData();
    if (this.prototypeToken?.ring) this.prototypeToken.ring.enabled = true;
  }

  /**
   * Окно создания актора: типы выключенных подсистем в списке не показываем.
   * Настройка читается на лету, поэтому перезагрузка мира не нужна.
   */
  static async createDialog(data = {}, createOptions = {}, options = {}) {
    if (!options.types) {
      const off = disabledActorTypes();
      if (off.length) {
        const types = this.TYPES.filter(t => t !== "base" && !off.includes(t));
        if (types.length) options = { ...options, types };
      }
    }
    return super.createDialog(data, createOptions, options);
  }

  /** Создать актора выключенной подсистемы нельзя — с указанием, что включить. */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const feature = featureForActorType(this.type);
    if (feature && !isFeatureEnabled(feature.key)) {
      ui.notifications?.warn(
        `Подсистема «${feature.name}» выключена. Включите её в Настройках Игры → Warhammer DBC, ` +
        `чтобы создавать акторов типа «${this.type}».`);
      return false;
    }
  }

  /**
   * Симметрично _preCreate, но для расы (не отдельный тип актора, а
   * значение system.race) — жёсткий бэкстоп поверх фильтра дропдауна в
   * шапке/Мастере: даже если запрос дошёл в обход UI (макрос, чужой
   * инструмент), выключенную расу выставить нельзя. Уже стоящую расу не
   * трогаем (не ломаем существующих персонажей) — блокируем только СМЕНУ на
   * выключенную.
   */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    if (allowed === false) return false;

    const newRace = data.system?.race;
    if (newRace && newRace !== this.system.race && isRaceDisabled(newRace)) {
      const feature = featureForRace(newRace);
      ui.notifications?.warn(
        `Подсистема «${feature.name}» выключена. Включите её в Настройках Игры → Warhammer DBC, ` +
        `чтобы выбрать эту расу.`);
      return false;
    }
  }

  /**
   * Производные данные корабля: бюджеты Энергии/Пространства/Очков и эфф.
   * характеристики. Узлы — это вложенные Предметы типа "component"; Корпус —
   * отдельный тип "shipHull" (задаёт SPC/P.Gen/HI/характеристики/поворот/WC),
   * выбирается пикером в шапке листа (sheets/hull-picker.mjs), а не узлом
   * среди прочих — на корабле он всегда один (apps/ship-hull.mjs).
   * Чистая агрегация — rules/ship.mjs.
   */
  _prepareShipData(system) {
    prepareShipDerived(this.items, system);
  }

  /** Сводка звёздной системы: подсчёт тел по типам и ресурсам. */
  _prepareStarSystemData(system) {
    const bodies = this.items.filter(i => i.type === "celestialBody");
    const counts = {};
    const RES_KEYS = ["ore", "promethium", "adamantium", "phlogiston", "organics",
      "plasteel", "weapons", "tech", "provisions", "manpower", "archeotech", "xenotech", "heretek"];
    const res = {}; for (const k of RES_KEYS) res[k] = 0;
    let habitable = 0, stars = 0;
    for (const b of bodies) {
      const t = b.system.bodyType || "other";
      counts[t] = (counts[t] || 0) + 1;
      if (t === "star") stars++;
      const r = b.system.resources || {};
      // Учитываем бонусы от улучшений колонии.
      const bonus = {};
      for (const imp of (b.system.improvements || [])) for (const k in (imp.res || {})) bonus[k] = (bonus[k] || 0) + Number(imp.res[k] || 0);
      for (const k of RES_KEYS) res[k] += (Number(r[k]) || 0) + (Number(bonus[k]) || 0);
      const h = b.system.habitability;
      if (h && h !== "inhospitable") habitable++;
    }
    system.derived = { total: bodies.length, counts, stars, habitable, resources: res };
  }

  /**
   * Производные данные Отряда: Слаженность (зажатая в ±40) и её толкование,
   * потолок Успехов по уровню Риска, признак Сломленного Отряда.
   *
   * Здесь — только чистая арифметика по собственным данным отряда. Всё, что
   * требует чтения связанных акторов (Командир, участники), считается в листе:
   * прочитать чужой документ в prepareDerivedData на этапе загрузки мира нельзя.
   */
  _prepareSquadData(system) {
    prepareSquadDerived(system);
  }

  /**
   * Производные данные Формирования («Книга Битв»): итоговая Сила, Оборона,
   * кости урона, скорость по ландшафту, укрытие, истощение и пороги боевого духа.
   *
   * Инициатива формирования — 1к10 + бонус характеристики войск (Выучка/10),
   * поэтому пишем её в system.initiative: боевой трекер системы считает
   * «1d10 + @initiative + @initiativeMod» и работает без отдельной логики.
   * Чистая агрегация — rules/formation.mjs.
   */
  _prepareFormationData(system) {
    prepareFormationDerived(system);
  }

  /**
   * Производные данные Орды: Характеристики (total/bonus), Размер и боевые
   * показатели по текущей Магнитуде, движение, состояние (Ослаблена/Сломлена).
   * Чистая агрегация — rules/horde.mjs.
   */
  _prepareHordeData(system) {
    prepareHordeDerived(this, system);
  }

  /**
   * Производные данные Техники: эффективная SPD (с учётом повреждений Ходовой),
   * дистанции хода, суммарный модификатор Маневрирования (Ходовая + повреждения),
   * состояние (полуразрушена при Структуре ≤ 0). Чистая агрегация — rules/vehicle.mjs.
   */
  _prepareVehicleData(system) {
    prepareVehicleDerived(this.items, system);
  }

  prepareDerivedData() {
    const system = this.system;

    // ── Корабль: отдельная модель данных ─────────────────────────────────────
    if (this.type === "ship") { this._prepareShipData(system); return; }

    // ── Техника: Структура вместо Ран, броня по сторонам ─────────────────────
    if (this.type === "vehicle") { this._prepareVehicleData(system); return; }

    // ── Звёздная система: сводка по небесным телам ───────────────────────────
    if (this.type === "starSystem") { this._prepareStarSystemData(system); return; }

    // ── Орда: Магнитуда вместо Ран, Размер по Магнитуде ──────────────────────
    if (this.type === "horde") { this._prepareHordeData(system); return; }

    // ── Отряд: Слаженность, Риск, командная вертикаль ────────────────────────
    if (this.type === "squad") { this._prepareSquadData(system); return; }

    // ── Формирование: Сила/Оборона, численность, боевой дух («Книга Битв») ───
    if (this.type === "formation") { this._prepareFormationData(system); return; }

    // Персонаж/Демон/Принц Демона/Миньон — вызывается напрямую (не через
    // this._prepareXData, как остальные пять веток выше): часть тестов
    // (test/documents/*, test/rules/*) вызывает prepareDerivedData через
    // WarhammerActor.prototype.prepareDerivedData.call({ type, system, items, … })
    // на голом объекте без цепочки прототипов — this.someMethod() там упал бы.
    //
    // withRulesCache: пересчёт задаёт правилам один и тот же вопрос несколько
    // раз («он пилот Дредноута?» — четырежды), а каждый ответ обходил заново
    // все предметы и все записи их Конструктора. Обёртка держит сборку одну на
    // весь пересчёт и снимает её на выходе — см. rules/collect.mjs (wdbc-uvap).
    withRulesCache(() => prepareCharacterDerived(this, system));
  }
}