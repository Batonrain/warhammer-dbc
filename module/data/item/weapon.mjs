// module/data/item/weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОРУЖИЕ — самый широкий тип: профиль, свойства, боепитание, а сверх того три
//  надстройки, каждая со своим набором полей:
//   - демоническое оружие (связанный демон и профиль до связывания);
//   - установка на технику (станция, сектор обстрела, боекомплект);
//   - ручной щит — рукопашное оружие, дающее AP на прикрываемые зоны.
//
//  Второй профиль (offProfile) и полосы дальности хранятся свободными: их
//  ключи задаёт сам предмет, схемой их не перечислить. Двупрофильные поля
//  разбираются отдельно (wdbc-ff4.8).
// ════════════════════════════════════════════════════════════════════════════

export class WeaponData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
    const list = label => new ArrayField(new ObjectField(), { label });
    return {
      description:  new StringField({ initial: "", label: "Описание" }),
      notes:        new StringField({ initial: "", label: "Заметки" }),
      rangeBands:   list("Полосы дальности"),
      // Второй профиль: ключи те же, что у основного, но набор задаёт предмет.
      offProfile:   new ObjectField({ label: "Второй профиль" }),
      gripProps2h:  list("Свойства в двух руках"),
      corEffects:   list("Эффекты порчи"),
      weaponClass:  new StringField({ initial: "melee", label: "Класс" }),
      weaponType:   new StringField({ initial: "laser", label: "Тип" }),
      range:        num(0, "Дальность"),
      balance:      num(0, "Баланс"),
      grips:        new StringField({ initial: "", label: "Хват" }),
      profileLabel: new StringField({ initial: "", label: "Название профиля" }),
      profiles:     list("Профили"),
      // Перезарядка — строка: в книге это и «1», и «полн.», и «2 полн.».
      reload:       new StringField({ initial: "1", label: "Перезарядка" }),
      magazineCur:  num(0, "В магазине"),
      magazineMax:  num(0, "Ёмкость магазина"),
      rof_single:   num(0, "Скорострельность: одиночный"),
      rof_semi:     num(0, "Скорострельность: короткая"),
      rof_full:     num(0, "Скорострельность: полная"),
      damage:       new StringField({ initial: "", label: "Урон" }),
      damageType:   new StringField({ initial: "impact", label: "Тип урона" }),
      penetration:  num(0, "Пробитие"),
      quality:      new StringField({ initial: "common", label: "Качество" }),
      availability: num(0, "Доступность"),
      weight:       num(0, "Вес"),
      attackBonus:  num(0, "Бонус к попаданию"),
      special:      new StringField({ initial: "", label: "Особенности" }),
      equipped:     new BooleanField({ initial: false, label: "Снаряжено" }),
      loadedAmmoId: new StringField({ initial: "", label: "Заряженный боеприпас" }),
      weaponProps:  list("Свойства"),
      needsRecharge: new BooleanField({ initial: false, label: "Требует перезарядки" }),
      legacyWeapon: new BooleanField({ initial: false, label: "Реликвия" }),
      sacred:       new BooleanField({ initial: false, label: "Освящённое" }),
      // Оружие Наследия (стр. 426-428). Признак «реликвия» выше существовал и
      // раньше — он остаётся отметкой на листе, а здесь лежит сама механика:
      // История (одна, при Возвышении), Характер (выбирается при первой
      // Мутации и больше не меняется) и сами Мутации по порогам Порчи.
      //
      // preProps/preDamage/prePen — снимок профиля ДО Возвышения, как у
      // демонического оружия рядом: связь может порваться Ревностью, и
      // возвращать оружию обычный вид надо по снимку, а не вычитанием.
      legacy: new SchemaField({
        active:      new BooleanField({ initial: false, label: "Оружие Наследия" }),
        legendary:   new BooleanField({ initial: false, label: "Легендарное" }),
        historyKey:  num(0, "История (бросок)"),
        historyName: new StringField({ initial: "", label: "Название Истории" }),
        historyText: new StringField({ initial: "", label: "Правило Истории" }),
        character:   new StringField({ initial: "", label: "Характер" }),
        mutations:   list("Мутации"),
        bonus:       num(0, "Бонус Наследия к Dmg/Pen"),
        preProps:    list("Свойства до Возвышения"),
        preDamage:   new StringField({ initial: "", label: "Урон до Возвышения" }),
        prePen:      num(0, "Пробитие до Возвышения"),
        preQuality:  new StringField({ initial: "", label: "Качество до Возвышения" })
      }, { label: "Наследие" }),
      daemonWeapon: new SchemaField({
        bound:      new BooleanField({ initial: false, label: "Демон связан" }),
        god:        new StringField({ initial: "", label: "Бог" }),
        demonName:  new StringField({ initial: "", label: "Имя демона" }),
        binding:    num(0, "Связывание"),
        demonWb:    num(0, "Бонус Силы Воли демона" ),
        demonInf:   num(0, "Влияние демона"),
        subdued:    new BooleanField({ initial: false, label: "Усмирён" }),
        runic:      new BooleanField({ initial: false, label: "Рунное" }),
        properties: list("Свойства связанного"),
        preProps:   list("Свойства до связывания"),
        preDamage:  new StringField({ initial: "", label: "Урон до связывания" }),
        prePen:     num(0, "Пробитие до связывания")
      }, { label: "Демоническое оружие" }),
      vehicleMount: new SchemaField({
        isMounted: new BooleanField({ initial: false, label: "Установлено на технику" }),
        operator:  new StringField({ initial: "gunner", label: "Кто стреляет" }),
        stationId: new StringField({ initial: "", label: "Станция" }),
        mount:     new StringField({ initial: "turret", label: "Установка" }),
        hArc:      new StringField({ initial: "360°", label: "Сектор по горизонтали" }),
        vArc:      new StringField({ initial: "", label: "Сектор по вертикали" }),
        standard:  new BooleanField({ initial: false, label: "Штатное" }),
        reloads:   num(10, "Боекомплект")
      }, { label: "Установка на технику" }),
      drukhari:     new BooleanField({ initial: false, label: "Друкхари" }),
      // Ручной щит (корбук стр. 215). В template.json объявлены не были.
      // Умолчание shieldAP — именно null: «щитовость» определяется наличием
      // поля (isHandShield в combat/hand-shield.mjs, isShield в
      // sheets/sheet-helpers.mjs), и 0 сделал бы щитом всё оружие подряд.
      shieldAP:     new NumberField({ initial: null, nullable: true, label: "AP щита" }),
      shieldZones:  new StringField({ initial: "", label: "Прикрываемые зоны" }),
      shieldForm:   new StringField({ initial: "", label: "Форма щита" })
    };
  }
}
