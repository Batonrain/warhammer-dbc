# Расы и субрасы предметами — план реализации

> **Для исполнителей-агентов:** ОБЯЗАТЕЛЬНЫЙ ПОД-СКИЛЛ: `superpowers:subagent-driven-development`
> (рекомендуется) или `superpowers:executing-plans`. Шаги отмечаются чекбоксами `- [ ]`.

**Цель:** перенести 18 рас и 16 субрас из `module/constants/races.mjs` в компендиум-библиотеку
предметов, чтобы расу можно было перетащить на лист персонажа и получить готовую основу.

**Архитектура:** два типа предметов (`race`, `subrace`) в одном паке `races`. Черты выдаются
ссылками через Конструктор Механики, стартовые характеристики пишет код разово в пустые поля.
`system.race` / `system.subrace` остаются строкой-ключом: всё, что читает ключ (предикаты правил,
замки папок, CSS-темы, элитные архетипы, `reqRace`), продолжает работать без правок.

**Стек:** Foundry VTT v13, ApplicationV2, `foundry.abstract.TypeDataModel`, vitest 3.2.7, Node 20+.

**Спека:** [docs/superpowers/specs/2026-08-15-race-items-design.md](../specs/2026-08-15-race-items-design.md)

**Эпик:** `wdbc-n1k`

## Общие ограничения

- Комментарии и тексты интерфейса — по-русски, в тоне соседних файлов: зачем так сделано, а не что делает строка.
- Тесты — `npm test` (vitest). Линт — `npm run lint`, допускается 0 ошибок; предупреждения не наращивать.
- Правки в `packs-src/` требуют `npm run packs:build` перед коммитом. Каталог `packs/` в git не попадает.
- Коммит сразу в `main`, без веток и PR. Коммит после каждого зелёного цикла.
- Никакого дублирования чисел: предмет-раса **не несёт** записей `kind:"characteristic"`. Числа приходят только Чертами.
- `module/constants/races.mjs` не удаляется — остаётся резервом, как `constants/archetypes.mjs`.
- Машинные правила (`ASTARTES_RULES`) остаются кодом в `module/rules/library/`.
- В генераторах нельзя звать `foundry.utils.randomID()`: инструменты работают вне Foundry. Идентификаторы — детерминированные, из sha1 семени.

---

### Задача 1: Рейтинг параметрических Черт доходит до эффекта

Черта-шаблон «Unnatural Strength / Сверхъестественная Сила (X)» несёт ActiveEffect `+1` и поле
`rating: 1`. Конструктор при выдаче ставит новый рейтинг в текст, но эффект не трогает, и «Сила (4)»
даёт +1. Проверено на всех шести параметрических Чертах пака с эффектами: величина эффекта всегда
равна `rating`. Это живой баг и без рас, и без него ссылки на шаблоны бессмысленны.

**Файлы:**
- Изменить: `module/apps/mechanics.mjs:828-848` (ветка `entry.kind === "trait"`)
- Тест: `test/apps/mech-trait-rating.test.mjs` (создать)

**Интерфейсы:**
- Отдаёт: `rescaleTraitByRating(data, rating)` — экспорт из `module/apps/mechanics.mjs`. Правит копию документа Черты **на месте** и возвращает её. `data` — результат `src.toObject()`, `rating` — число или строка.

- [ ] **Шаг 1: Написать падающий тест**

```js
// test/apps/mech-trait-rating.test.mjs
//
// Черта-шаблон «(X)» несёт эффект, равный своему рейтингу: Демонический (1),
// Страх (2), Машина (3), Естественная Броня (2), Сверхъест. Сила (1),
// Сверхъест. Стойкость (1) — все шесть параметрических Черт пака с эффектами.
// Значит выдача с другим рейтингом обязана двигать и эффект, иначе рейтинг
// остаётся только в тексте, а «Сверхъест. Сила (4)» даёт +1.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { rescaleTraitByRating } from "../../module/apps/mechanics.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

/** Копия документа Черты в том виде, в каком её отдаёт src.toObject(). */
const traitDoc = (rating, changes, effects = {}) => ({
  name: "Проба (X)", type: "trait",
  system: {
    hasRating: true, rating,
    effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [],
               charValueBonuses: [], armourAll: 0, fearRating: 0, sizeMod: 0,
               initMod: 0, speedMod: 0, ...effects }
  },
  effects: [{ name: "Проба", system: { changes: changes.map(v => ({
    key: "system.characteristics.s.bonusFx", type: "add", value: v, phase: "initial", priority: 0
  })) } }]
});

const changeValues = d => d.effects.flatMap(e => e.system.changes.map(c => c.value));

describe("рейтинг Черты двигает её эффект", () => {

  it("эффект, равный рейтингу шаблона, становится новым рейтингом", () => {
    const doc = rescaleTraitByRating(traitDoc(1, [1]), 4);

    expect(changeValues(doc)).toEqual([4]);
  });

  it("старое поле system.effects пересчитывается вместе с ActiveEffect", () => {
    const doc = rescaleTraitByRating(
      traitDoc(2, [2], { charBonusStat: "t", charBonusValue: 2, armourAll: 2 }), 5);

    expect(doc.system.effects.charBonusValue).toBe(5);
    expect(doc.system.effects.armourAll).toBe(5);
  });

  // Не всякое число в Черте — рейтинг. Трогаем только совпавшие с ним.
  it("числа, не равные рейтингу шаблона, остаются как были", () => {
    const doc = rescaleTraitByRating(traitDoc(2, [2, 10]), 5);

    expect(changeValues(doc)).toEqual([5, 10]);
  });

  it("без рейтинга шаблона или при том же рейтинге ничего не меняется", () => {
    expect(changeValues(rescaleTraitByRating(traitDoc(0, [1]), 4))).toEqual([1]);
    expect(changeValues(rescaleTraitByRating(traitDoc(3, [3]), 3))).toEqual([3]);
    expect(changeValues(rescaleTraitByRating(traitDoc(3, [3]), 0))).toEqual([3]);
  });

  // Живые данные: то, ради чего всё затевалось.
  it("«Сверхъест. Сила (X)» из пака с рейтингом 4 даёт +4 к бонусу Силы", () => {
    const { doc } = packDocuments("traits", "trait")
      .find(d => /Unnatural Strength/.test(d.doc.name));
    const scaled = rescaleTraitByRating(structuredClone(doc), 4);
    const change = scaled.effects[0].system.changes
      .find(c => c.key === "system.characteristics.s.bonusFx");

    expect(change.value).toBe(4);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/apps/mech-trait-rating.test.mjs`
Ожидание: FAIL — `rescaleTraitByRating is not a function`.

- [ ] **Шаг 3: Написать пересчёт**

В `module/apps/mechanics.mjs`, рядом с `resolveMechSource` (около строки 578):

```js
/**
 * Черта-шаблон «(X)» несёт эффект, равный своему рейтингу — так заведён пак
 * (проверено на всех шести параметрических Чертах с эффектами). Выдача с другим
 * рейтингом обязана двигать и эффект: иначе рейтинг остаётся только в тексте, а
 * «Сверхъест. Сила (4)» даёт +1, как шаблонная единица.
 *
 * Меняются ТОЛЬКО числа, равные рейтингу шаблона. Всё прочее к рейтингу
 * отношения не имеет: у «Машины (3)» броня равна рейтингу, а порог теста — нет.
 *
 * @param {object} data   копия документа Черты (src.toObject()), правится на месте
 * @param {number|string} rating  рейтинг выдачи
 * @returns {object} тот же data — для сцепления с вызовом
 */
export function rescaleTraitByRating(data, rating) {
  const base = Number(data?.system?.rating) || 0;
  const next = Number(rating) || 0;
  if (!base || !next || base === next) return data;
  const swap = v => (Number(v) === base ? next : v);

  for (const eff of data.effects || [])
    for (const ch of (eff.system?.changes || eff.changes || [])) ch.value = swap(ch.value);

  const e = data.system.effects;
  if (e) {
    for (const k of ["charBonusValue", "armourAll", "fearRating", "sizeMod", "initMod", "speedMod"])
      if (Number(e[k])) e[k] = swap(e[k]);
    for (const cb of [...(e.charBonuses || []), ...(e.charValueBonuses || [])])
      if (cb) cb.value = swap(cb.value);
  }
  return data;
}
```

- [ ] **Шаг 4: Позвать пересчёт при выдаче**

В `module/apps/mechanics.mjs:835-839` — **до** записи нового рейтинга, иначе пересчёт прочитает уже
затёртое значение шаблона:

```js
    if (entry.kind === "trait") {
      if (entry.rating !== "" && entry.rating != null && data.system) {
        rescaleTraitByRating(data, entry.rating);   // пока system.rating — рейтинг шаблона
        data.system.hasRating = true;
        data.system.rating = Number(entry.rating) || 0;
      }
    } else {
```

- [ ] **Шаг 5: Прогнать тесты**

Запуск: `npx vitest run test/apps/mech-trait-rating.test.mjs` — ожидание PASS (5 тестов).
Затем `npm test` — ожидание: ни один существующий тест не покраснел.

- [ ] **Шаг 6: Линт и коммит**

```bash
npm run lint
git add module/apps/mechanics.mjs test/apps/mech-trait-rating.test.mjs
git commit -m "Конструктор: рейтинг Черты двигает её эффект (wdbc-n1k)"
```

---

### Задача 2: Типы предметов `race` и `subrace`

**Файлы:**
- Создать: `module/data/item/race.mjs`, `module/data/item/subrace.mjs`
- Создать: `templates/item/parts/race.hbs`, `templates/item/parts/subrace.hbs`
- Изменить: `module/data/index.mjs`, `template.json`, `module/constants/items.mjs`,
  `warhammer-dbc.mjs` (список предзагрузки), `templates/item/item-sheet.hbs`, `system.json` (пак)
- Тест: `test/data/item-schemas.test.mjs`

**Интерфейсы:**
- Отдаёт: классы `RaceData`, `SubraceData`; ключи `race` и `subrace` в `ITEM_DATA_MODELS` и в `template.json` → `Item.types`.
- Потребляет: результат задачи 1 не нужен — задачи независимы.

- [ ] **Шаг 1: Написать падающий тест**

В `test/data/item-schemas.test.mjs`, в объект `TYPES` (после записи `archetype`). Пак ещё не
существует — `pack: null` включает `it.skipIf` и оставляет проверку умолчаний:

```js
  race: {
    pack: null,
    defaults: {
      key: "", group: "", chars: {}, bonusRolls: 0, skills: "", gear: "", talents: "",
      description: "", notes: "", hasGeneSeed: false, pastRaces: [],
      size: 0, bonusPoints: 0, charShift: 0, fateRoll: "", skillsNote: "", adaptations: "",
      bookSource: ""
    }
  },
  subrace: {
    pack: null,
    defaults: {
      key: "", parent: "", cost: 0, effect: "", god: "", charMods: {}, talents: "",
      removesTraits: [], description: "", notes: "", bookSource: ""
    }
  },
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/data/item-schemas.test.mjs`
Ожидание: FAIL в тесте «у каждого типа из template.json есть схема, и каждая проверена» —
`Object.keys(TYPES)` содержит `race`/`subrace`, а `template.json` и `ITEM_DATA_MODELS` — нет.

- [ ] **Шаг 3: Написать схемы**

```js
// module/data/item/race.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РАСА — происхождение персонажа: стартовые характеристики, текстовые пакеты
//  навыков и снаряжения, справка из книги. Расовые Черты здесь НЕ живут: их
//  выдаёт Конструктор Механики ссылками на библиотеку Черт, и второе описание
//  того же в схеме разъехалось бы с первым.
//
//  `chars` — не бонусы, а стартовые ЗНАЧЕНИЯ (25/30): применение кладёт их в
//  пустые поля характеристик и не трогает заполненные.
// ════════════════════════════════════════════════════════════════════════════

export class RaceData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField, BooleanField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      key:         new StringField({ initial: "", label: "Ключ" }),
      // Группа задаёт и optgroup в списках, и признак аэльдари: набор рас
      // группы «Аэльдари» совпадает с прежней константой AELDARI_RACES.
      group:       new StringField({ initial: "", label: "Группа" }),
      chars:       new ObjectField({ label: "Стартовые характеристики" }),
      bonusRolls:  new NumberField({ initial: 0, integer: true, label: "Бонусные броски" }),
      skills:      new StringField({ initial: "", label: "Навыки" }),
      gear:        new StringField({ initial: "", label: "Снаряжение" }),
      talents:     new StringField({ initial: "", label: "Стартовые таланты" }),
      description: new StringField({ initial: "", label: "Описание" }),
      notes:       new StringField({ initial: "", label: "Заметки" }),
      hasGeneSeed: new BooleanField({ initial: false, label: "Геносемя" }),
      pastRaces:   new ArrayField(new StringField(), { label: "Возможное Прошлое" }),
      // Ниже — книжная справка: система по ней ничего не считает, но текст из
      // книги терять нельзя, поэтому он виден на листе расы.
      size:        new NumberField({ initial: 0, integer: true, label: "Размер" }),
      bonusPoints: new NumberField({ initial: 0, integer: true, label: "Очки распределения" }),
      charShift:   new NumberField({ initial: 0, integer: true, label: "Сдвиг характеристик" }),
      fateRoll:    new StringField({ initial: "", label: "Бросок Судьбы" }),
      skillsNote:  new StringField({ initial: "", label: "Примечание к навыкам" }),
      adaptations: new StringField({ initial: "", label: "Адаптации" }),
      bookSource:  new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
```

```js
// module/data/item/subrace.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СУБРАСА — ветвь расы: стоит опыта, меняет характеристики, добавляет свои
//  Черты и иногда ОТМЕНЯЕТ расовые (субрасы друкхари). Привязка к родителю —
//  поле `parent` с ключом расы: субрасу нельзя выдать чужой расе.
//
//  Черты, как и у расы, живут в Конструкторе Механики, а не в схеме.
// ════════════════════════════════════════════════════════════════════════════

export class SubraceData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, NumberField, ObjectField, ArrayField } = foundry.data.fields;
    return {
      key:           new StringField({ initial: "", label: "Ключ" }),
      parent:        new StringField({ initial: "", label: "Раса-родитель" }),
      cost:          new NumberField({ initial: 0, integer: true, label: "Стоимость в опыте" }),
      effect:        new StringField({ initial: "", label: "Действие" }),
      god:           new StringField({ initial: "", label: "Бог" }),
      charMods:      new ObjectField({ label: "Изменения характеристик" }),
      talents:       new StringField({ initial: "", label: "Стартовые таланты" }),
      // Имена расовых Черт, которые субраса снимает.
      removesTraits: new ArrayField(new StringField(), { label: "Снимает Черты" }),
      description:   new StringField({ initial: "", label: "Описание" }),
      notes:         new StringField({ initial: "", label: "Заметки" }),
      bookSource:    new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
```

- [ ] **Шаг 4: Зарегистрировать типы**

В `module/data/index.mjs` — импорт рядом с `ArchetypeData` и записи в `ITEM_DATA_MODELS` рядом с
`archetype`:

```js
import { RaceData }           from "./item/race.mjs";
import { SubraceData }        from "./item/subrace.mjs";
```
```js
  archetype:          ArchetypeData,
  race:               RaceData,
  subrace:            SubraceData,
```

В `template.json` → `Item.types` дописать `"race"`, `"subrace"` (записи типов остаются пустыми —
схема живёт только в `index.mjs`).

В `module/constants/items.mjs` → `ITEM_TYPES` дописать:

```js
  race:           "Раса",
  subrace:        "Субраса",
```

- [ ] **Шаг 5: Прогнать тест схем**

Запуск: `npx vitest run test/data/item-schemas.test.mjs`
Ожидание: PASS. Проверки «документы пака проходят через схему» для `race`/`subrace` пропускаются
(`pack: null`) — их включит задача 4.

- [ ] **Шаг 6: Листы предметов и объявление пака**

`templates/item/parts/race.hbs` — в стиле `templates/item/parts/archetype.hbs` (те же классы
`item-section` / `weapon-row` / `wr-label` / `wr-input-md`). Черты не показываются: они на вкладке
МЕХАНИКА, общей для всех предметов.

```hbs
{{!-- ══════════════════════════════════════════════════════════════════════ --}}
{{!--  РАСА (библиотека происхождений) --}}
{{!-- ══════════════════════════════════════════════════════════════════════ --}}
{{#if (eq item.type "race")}}

<div class="item-section">
  <div class="item-section-title">РАСА</div>
  <div class="trait-fx-hint">Запись библиотеки «Расы»: источник списков в шапке листа и в Мастере создания. Расовые Черты добавляются на вкладке МЕХАНИКА ссылками на библиотеку Черт — здесь их нет намеренно, чтобы одно и то же не описывалось дважды.</div>

  <div class="weapon-row">
    <label class="wr-label">Ключ</label>
    <input type="text" name="system.key" value="{{system.key}}" class="wr-input-md" placeholder="astartes"/>
    <label class="wr-label">Группа</label>
    <input type="text" name="system.group" value="{{system.group}}" class="wr-input-md" placeholder="Люди / Отродия / Аэльдари / Другие Ксеносы"/>
  </div>

  <div class="item-section-title">СТАРТОВЫЕ ХАРАКТЕРИСТИКИ</div>
  <div class="trait-fx-hint">Значения, а не прибавки: применение расы кладёт их в пустые поля и не трогает заполненные.</div>
  <div class="weapon-row">
    {{#each charKeys as |c|}}
      <label class="wr-label">{{c.label}}</label>
      <input type="number" name="system.chars.{{c.key}}" value="{{lookup @root.system.chars c.key}}" class="wr-input-sm"/>
    {{/each}}
  </div>

  <div class="weapon-row">
    <label class="wr-label">Бонусные броски</label>
    <input type="number" name="system.bonusRolls" value="{{system.bonusRolls}}" class="wr-input-sm"/>
    <label class="wr-label">Геносемя</label>
    <input type="checkbox" name="system.hasGeneSeed" {{#if system.hasGeneSeed}}checked{{/if}}/>
  </div>

  <div class="weapon-row"><label class="wr-label">Навыки</label>
    <textarea name="system.skills" rows="2" class="wr-input-lg">{{system.skills}}</textarea></div>
  <div class="weapon-row"><label class="wr-label">Снаряжение</label>
    <textarea name="system.gear" rows="2" class="wr-input-lg">{{system.gear}}</textarea></div>
  <div class="weapon-row"><label class="wr-label">Таланты</label>
    <textarea name="system.talents" rows="2" class="wr-input-lg">{{system.talents}}</textarea></div>

  <div class="item-section-title">ИЗ КНИГИ</div>
  <div class="trait-fx-hint">Справка для игрока: система по этим полям ничего не считает.</div>
  <div class="weapon-row">
    <label class="wr-label">Размер</label>
    <input type="number" name="system.size" value="{{system.size}}" class="wr-input-sm"/>
    <label class="wr-label">Очки распределения</label>
    <input type="number" name="system.bonusPoints" value="{{system.bonusPoints}}" class="wr-input-sm"/>
    <label class="wr-label">Сдвиг</label>
    <input type="number" name="system.charShift" value="{{system.charShift}}" class="wr-input-sm"/>
  </div>
  <div class="weapon-row">
    <label class="wr-label">Бросок Судьбы</label>
    <input type="text" name="system.fateRoll" value="{{system.fateRoll}}" class="wr-input-md"/>
    <label class="wr-label">Адаптации</label>
    <input type="text" name="system.adaptations" value="{{system.adaptations}}" class="wr-input-md"/>
  </div>
  <div class="weapon-row"><label class="wr-label">Примечание к навыкам</label>
    <textarea name="system.skillsNote" rows="2" class="wr-input-lg">{{system.skillsNote}}</textarea></div>
  <div class="weapon-row"><label class="wr-label">Описание</label>
    <textarea name="system.description" rows="3" class="wr-input-lg">{{system.description}}</textarea></div>
  <div class="weapon-row"><label class="wr-label">Книга</label>
    <input type="text" name="system.bookSource" value="{{system.bookSource}}" class="wr-input-lg"/></div>
</div>

{{/if}}
```

`charKeys` для цикла даёт лист предмета: в `_prepareContext` для типа `race` добавить
`context.charKeys = Object.entries(CHARACTERISTICS).map(([key, c]) => ({ key, label: c.short }))`
(константа уже импортирована в `module/sheets/item-sheet.mjs` — проверить имя поля метки и взять то,
что там есть).

`templates/item/parts/subrace.hbs` — тот же каркас, поля: `key`, `parent` (ключ расы-родителя),
`cost` (число, опыт), `god`, `effect` (textarea), `charMods` (те же десять числовых полей, что у
расы, но с префиксом `system.charMods.`), `talents`, `removesTraits` (textarea, имена через строку),
`description`, `bookSource`.

В `templates/item/item-sheet.hbs` рядом с блоком архетипа:

```hbs
{{#if (eq item.type "race")}}
{{> "systems/warhammer-dbc/templates/item/parts/race.hbs"}}
{{/if}}
{{#if (eq item.type "subrace")}}
{{> "systems/warhammer-dbc/templates/item/parts/subrace.hbs"}}
{{/if}}
```

В `warhammer-dbc.mjs`, в список предзагрузки рядом со строкой `archetype.hbs`:

```js
    "systems/warhammer-dbc/templates/item/parts/race.hbs",
    "systems/warhammer-dbc/templates/item/parts/subrace.hbs",
```

В `system.json`, в массив `packs` рядом с `archetypes`:

```json
    {
      "name": "races",
      "label": "Расы — Библиотека (DBC)",
      "path": "packs/races",
      "type": "Item",
      "system": "warhammer-dbc",
      "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER", "GAMEMASTER": "OWNER" }
    },
```

- [ ] **Шаг 7: Проверка и коммит**

```bash
npm test
npm run lint
git add module/data/item/race.mjs module/data/item/subrace.mjs module/data/index.mjs \
        template.json module/constants/items.mjs warhammer-dbc.mjs system.json \
        templates/item/item-sheet.hbs templates/item/parts/race.hbs \
        templates/item/parts/subrace.hbs test/data/item-schemas.test.mjs
git commit -m "Типы предметов «Раса» и «Субраса»: схемы, листы, пак (wdbc-n1k)"
```

---

### Задача 3: Недостающие расовые Черты в библиотеке

67 из 102 уникальных расовых Черт уже лежат в паке `traits`. Остальные 35 — в основном большие
повествовательные («Эльдарское Тело», «Тёмная Душа», «Через Боль») — надо завести, иначе ссылаться
будет не на что. Делается генератором, а не руками: константы уже содержат имя, текст, рейтинг и
числовые эффекты.

**Файлы:**
- Создать: `tools/race-traits.mjs`
- Создать: `test/tools/race-traits.test.mjs`
- Создать (генератором): `packs-src/traits/Трейты_рас/*.json`

**Интерфейсы:**
- Отдаёт: `normTraitName(name)` — нормализация имени для сверки (регистр, скобки, знаки); `missingRaceTraits()` — список Черт из констант, которых нет в паке; `run({ write })` — отчёт `{ existing, created, files }`.
- Потребляет: ничего. Идёт параллельно задаче 2.

- [ ] **Шаг 1: Написать падающий тест**

```js
// test/tools/race-traits.test.mjs
//
// Расовые Черты выдаются ССЫЛКОЙ на библиотеку: раса несёт запись Конструктора
// с именем Черты, а текст и эффекты живут в паке traits. Значит каждая Черта из
// констант обязана иметь пару в паке — иначе ссылка повиснет.
//
// Сверка по нормализованному имени: в паке шаблоны названы «(X)», а раса
// называет конкретный рейтинг — «Unnatural Strength (4)».

import { describe, it, expect } from "vitest";
import { normTraitName, missingRaceTraits } from "../../tools/race-traits.mjs";

describe("сверка расовых Черт с библиотекой", () => {

  it("рейтинг в скобках не мешает узнать Черту", () => {
    expect(normTraitName("Unnatural Strength (4) / Сверхъест. Сила (4)"))
      .toBe(normTraitName("Unnatural Strength / Сверхъестественная Сила (X)"));
  });

  it("после прогона генератора ни одна расовая Черта не осталась без пары", () => {
    expect(missingRaceTraits()).toEqual([]);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/tools/race-traits.test.mjs`
Ожидание: FAIL — модуль `tools/race-traits.mjs` не найден.

- [ ] **Шаг 3: Написать генератор**

```js
// tools/race-traits.mjs
// ════════════════════════════════════════════════════════════════════════
//  Недостающие расовые Черты в библиотеку packs-src/traits.
//
//  Расы выдают Черты ссылкой на библиотеку (Конструктор, kind:"trait"), а не
//  копией текста. 67 из 102 расовых Черт там уже есть; остальные заводятся
//  здесь — из тех же констант, откуда их раньше создавал лист персонажа.
//
//  Сверка по нормализованному имени: пак хранит шаблон «Сверхъест. Сила (X)»,
//  а раса называет «Сверхъест. Сила (4)». Скобки при сверке отбрасываются,
//  рейтинг едет отдельным полем.
//
//  Запуск:  node tools/race-traits.mjs [--write]
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RACES } from "../module/constants/races.mjs";

const DIR    = "packs-src/traits";
const FOLDER = "packs-src/traits/Трейты_рас";
const FOLDER_ID = "NQHsbl75bk7fCc77";          // _Folder.json папки «Трейты рас»

/** Имя без скобок, регистра и знаков — общий вид для шаблона и конкретного рейтинга. */
export function normTraitName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zа-яё]+/gi, " ")
    .trim();
}

/** Все документы Черт пака: [{ path, doc }]. */
function packTraits(dir = DIR) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...packTraits(path));
    else if (entry.endsWith(".json") && entry !== "_Folder.json")
      out.push({ path, doc: JSON.parse(readFileSync(path, "utf8")) });
  }
  return out;
}

/** Уникальные расовые Черты констант: имя → запись расы. */
export function raceTraits() {
  const out = new Map();
  for (const race of Object.values(RACES))
    for (const t of race.traits || []) if (t?.name && !out.has(t.name)) out.set(t.name, t);
  return out;
}

/** Расовые Черты, у которых нет пары в библиотеке. */
export function missingRaceTraits() {
  const have = new Set(packTraits().map(({ doc }) => normTraitName(doc.name)));
  return [...raceTraits().keys()].filter(n => !have.has(normTraitName(n)));
}

/** Устойчивый идентификатор: пересборка не должна менять _id. */
const stableId = seed => createHash("sha1").update(seed).digest("base64")
  .replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

/** Имя файла в стиле выгрузки: пробелы и знаки — подчёркиванием. */
const fileName = (name, id) =>
  `${name.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "_").slice(0, 40)}_${id}.json`;

export function run({ write = false } = {}) {
  const missing = missingRaceTraits();
  const traits  = raceTraits();
  const files   = [];

  for (const name of missing) {
    const t  = traits.get(name);
    const id = stableId(`race-trait:${name}`);
    const doc = {
      name, type: "trait", img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
      folder: FOLDER_ID,
      system: {
        description: "", notes: "", benefit: t.benefit || "", source: "раса",
        hasRating: !!t.hasRating, rating: t.rating || 0,
        hasRating2: false, rating2: 0,
        effects: {
          charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
          armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0,
          ...(t.effects || {})
        },
        bookSource: "DoomBC — Основная книга"
      },
      _id: id, effects: [], sort: 0, flags: {}, _key: `!items!${id}`
    };
    const path = join(FOLDER, fileName(name, id));
    if (write) writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    files.push(path);
  }

  return { existing: traits.size - missing.length, created: missing.length, files };
}

if (process.argv[1]?.endsWith("race-traits.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Расовых Черт в константах: ${res.existing + res.created}`);
  console.log(`Уже в библиотеке: ${res.existing}; заведено: ${res.created}`);
}
```

- [ ] **Шаг 4: Прогнать генератор и тест**

```bash
node tools/race-traits.mjs --write
npx vitest run test/tools/race-traits.test.mjs
```
Ожидание: генератор сообщает «заведено: 35», тест PASS — `missingRaceTraits()` пуст.

- [ ] **Шаг 5: Проверить, что новые Черты проходят схему**

Запуск: `npx vitest run test/data/item-schemas.test.mjs`
Ожидание: PASS. Тип `trait` проверяется на всём паке, включая 35 новых документов; поле, забытое в
генераторе, всплывёт здесь.

- [ ] **Шаг 6: Собрать паки и закоммитить**

```bash
npm run packs:build
npm test
npm run lint
git add tools/race-traits.mjs test/tools/race-traits.test.mjs packs-src/traits
git commit -m "Библиотека Черт: 35 недостающих расовых Черт (wdbc-n1k)"
```

---

### Задача 4: Генератор рас и субрас в пак

**Файлы:**
- Создать: `tools/races-to-pack.mjs`
- Создать: `test/tools/races-to-pack.test.mjs`
- Создать (генератором): `packs-src/races/**/*.json` — 34 документа и 5 папок
- Изменить: `test/data/item-schemas.test.mjs` (`pack: null` → `pack: "races"` у обоих типов)

**Интерфейсы:**
- Потребляет: `RaceData`/`SubraceData` (задача 2), `normTraitName` из `tools/race-traits.mjs` (задача 3), пересчёт рейтинга (задача 1) — им пользуется система при выдаче, генератор лишь кладёт рейтинг в запись.
- Отдаёт: `raceDocs()` — массив `{ path, doc }` для рас и субрас; `traitEntries(race)` — записи Конструктора для Черт расы; `run({ write })`.

- [ ] **Шаг 1: Написать падающий тест**

```js
// test/tools/races-to-pack.test.mjs
//
// Перенос рас из констант в пак. Проверяется не «файлы записались», а то, что
// содержимое доехало без потерь: состав Черт, рейтинги, группы, стартовые
// характеристики. Расхождение здесь означает, что персонаж после переезда
// получит не ту расу, что раньше.

import { describe, it, expect } from "vitest";
import { RACES, SUBRACES, SUBRACE_DATA, RACE_GROUPS } from "../../module/constants/races.mjs";
import { raceDocs, traitEntries } from "../../tools/races-to-pack.mjs";
import { normTraitName, missingRaceTraits } from "../../tools/race-traits.mjs";

const docs = () => raceDocs().map(d => d.doc);
const byKey = type => new Map(docs().filter(d => d.type === type).map(d => [d.system.key, d]));

describe("расы в пак", () => {

  it("каждая раса и каждая субраса получили документ", () => {
    expect(byKey("race").size).toBe(Object.keys(RACES).length);
    expect(byKey("subrace").size).toBe(Object.keys(SUBRACES).length);
  });

  // eldanar и grayman есть только меткой, без данных: пустая запись честнее
  // пропажи — субрасу видно в списке и в неё можно дописать книгу.
  it("субрасы без данных тоже заведены, с родителем и без механики", () => {
    const eldanar = byKey("subrace").get("eldanar");

    expect(eldanar.name).toBe("Эльданар");
    expect(eldanar.system.parent).toBe("azuriane");
    expect(eldanar.flags["warhammer-dbc"].mechanics).toEqual([]);
  });

  it("стартовые характеристики и группа перенесены как есть", () => {
    const astartes = byKey("race").get("astartes");

    expect(astartes.system.chars).toEqual(RACES.astartes.chars);
    expect(astartes.system.group).toBe("Люди");
    expect(astartes.system.hasGeneSeed).toBe(true);
    expect(astartes.system.bonusRolls).toBe(RACES.astartes.bonusRolls);
  });

  it("группа «Аэльдари» повторяет прежний список аэльдарийских рас", () => {
    const fromDocs = docs().filter(d => d.type === "race" && d.system.group === "Аэльдари")
      .map(d => d.system.key).sort();
    const fromConst = RACE_GROUPS.find(g => g.label === "Аэльдари").races.slice().sort();

    expect(fromDocs).toEqual(fromConst);
  });

  it("Черты стали записями Конструктора: имя, рейтинг, вид", () => {
    const entries = traitEntries(RACES.astartes);
    const strength = entries.find(e => /Unnatural Strength/.test(e.sourceName));

    expect(entries).toHaveLength(RACES.astartes.traits.length);
    expect(entries.every(e => e.kind === "trait")).toBe(true);
    expect(strength.rating).toBe(4);
    expect(strength.sourceHasRating).toBe(true);
  });

  it("ни одна запись не ссылается на Черту, которой нет в библиотеке", () => {
    expect(missingRaceTraits()).toEqual([]);
    for (const doc of docs()) {
      for (const g of doc.flags["warhammer-dbc"].mechanics)
        for (const e of g.entries) expect(normTraitName(e.sourceName)).not.toBe("");
    }
  });

  it("идентификаторы устойчивы: два прогона дают те же _id", () => {
    const first  = raceDocs().map(d => d.doc._id);
    const second = raceDocs().map(d => d.doc._id);

    expect(second).toEqual(first);
  });

  it("субрасы друкхари сохранили снимаемые Черты", () => {
    const wrack = byKey("subrace").get("wrack");

    expect(wrack.system.removesTraits).toEqual(SUBRACE_DATA.wrack.removesTraits ?? []);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/tools/races-to-pack.test.mjs`
Ожидание: FAIL — модуль `tools/races-to-pack.mjs` не найден.

- [ ] **Шаг 3: Написать генератор**

```js
// tools/races-to-pack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Расы и субрасы из констант в компендиум packs-src/races.
//
//  Черты В ДОКУМЕНТ НЕ КОПИРУЮТСЯ: раса несёт записи Конструктора
//  (kind:"trait") со ссылкой на библиотеку Черт по имени и рейтингу. Так
//  «Проворный» правится один раз для четырёх рас, а рейтинг доезжает до
//  эффекта пересчётом при выдаче (см. rescaleTraitByRating в mechanics.mjs).
//
//  Числа характеристик в записи Конструктора НЕ кладутся: их несут сами Черты.
//  Одна и та же прибавка, записанная в двух местах, сложилась бы дважды.
//
//  Запуск:  node tools/races-to-pack.mjs [--write]
// ════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RACES, SUBRACES, SUBRACE_DATA, RACE_GROUPS } from "../module/constants/races.mjs";

const ROOT = "packs-src/races";
const NS   = "warhammer-dbc";

const stableId = seed => createHash("sha1").update(seed).digest("base64")
  .replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

const fileName = (name, id) =>
  `${name.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "_").slice(0, 40)}_${id}.json`;

/** Группа расы по RACE_GROUPS; она же отвечает на вопрос «аэльдари ли это». */
const groupOf = key => RACE_GROUPS.find(g => g.races.includes(key))?.label || "";

/**
 * Пустая запись Конструктора. Повторяет blankMechEntry из apps/mechanics.mjs —
 * позвать его нельзя: там foundry.utils.randomID, а инструменты работают вне
 * Foundry. Поля, которых нет, ломают вкладку МЕХАНИКА при открытии.
 */
const blankEntry = id => ({
  id, kind: "trait", group: null,
  corruptionValue: "1", woundsValue: "1",
  cohesionRole: "any", cohesionValue: "1",
  charKey: "s", field: "total", op: "add", value: 1,
  sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false,
  rating: "", specialization: "",
  skillScope: "plain", skillKey: "", specKey: "", specialty: "",
  specChoiceKeys: [], rank: "untrained",
  weightScope: "all", weightMode: "kg", weightValue: 1,
  movementTarget: "spd", movementValue: 1,
  ignoreTerrainProps: [],
  equipMode: "direct", equipQty: 1
});

/** Черты расы или субрасы → записи Конструктора со ссылкой по имени. */
export function traitEntries(def) {
  return (def?.traits || []).map((t, i) => ({
    ...blankEntry(stableId(`${def.label}:trait:${i}:${t.name}`)),
    sourceName: t.name,
    sourceHasRating: !!t.hasRating,
    rating: t.hasRating ? (t.rating ?? 0) : ""
  }));
}

/** Одна И-группа со всеми Чертами; пусто — пустой массив, а не группа без записей. */
const mechanics = (def, seed) => {
  const entries = traitEntries(def);
  return entries.length ? [{ id: stableId(`${seed}:mech`), operator: "AND", entries }] : [];
};

const wrap = (name, type, key, system, mech, folder) => {
  const id = stableId(`${type}:${key}`);
  return {
    name, type, img: "icons/svg/oak.svg", folder,
    system: { key, ...system },
    _id: id, effects: [], sort: 0,
    flags: { [NS]: { mechanics: mech } },
    _key: `!items!${id}`
  };
};

/** Документы папок: четыре группы рас и одна для субрас. */
export function folderDocs() {
  const labels = [...RACE_GROUPS.map(g => g.label), "Субрасы"];
  return labels.map(label => {
    const id = stableId(`folder:${label}`);
    return {
      path: join(ROOT, label.replace(/\s+/g, "_"), "_Folder.json"),
      doc: {
        name: label, type: "Item", sorting: "m", _id: id,
        description: "", folder: null, sort: 0, color: null, flags: {},
        _key: `!folders!${id}`
      }
    };
  });
}

/** Документы рас и субрас: [{ path, doc }]. */
export function raceDocs() {
  const out = [];
  const folderId = label => stableId(`folder:${label}`);

  for (const [key, r] of Object.entries(RACES)) {
    const group = groupOf(key);
    const doc = wrap(r.label, "race", key, {
      group,
      chars: { ...(r.chars || {}) },
      bonusRolls: r.bonusRolls || 0,
      skills: r.skills || "", gear: r.gear || "",
      // talents в константах — массив имён; в схеме строка, как у Архетипа.
      talents: Array.isArray(r.talents) ? r.talents.join(", ") : (r.talents || ""),
      description: r.desc || "", notes: "",
      hasGeneSeed: !!r.hasGeneSeed,
      pastRaces: [...(r.pastRaces || [])],
      size: r.size || 0, bonusPoints: r.bonusPoints || 0, charShift: r.charShift || 0,
      fateRoll: r.fateRoll || "", skillsNote: r.skillsNote || "",
      adaptations: r.adaptations || "",
      bookSource: "DoomBC — Основная книга"
    }, mechanics(r, `race:${key}`), folderId(group));
    out.push({ path: join(ROOT, group.replace(/\s+/g, "_"), fileName(r.label, doc._id)), doc });
  }

  // Родитель субрасы — раса, в списке subraces которой она названа.
  const parentOf = sub => Object.entries(RACES)
    .find(([, r]) => (r.subraces || []).includes(sub))?.[0] || "";

  for (const [key, label] of Object.entries(SUBRACES)) {
    const s = SUBRACE_DATA[key] || {};
    const doc = wrap(label, "subrace", key, {
      parent: parentOf(key),
      cost: s.cost || 0, effect: s.effect || "", god: s.god || "",
      charMods: { ...(s.charMods || {}) },
      talents: Array.isArray(s.talents) ? s.talents.join(", ") : (s.talents || ""),
      removesTraits: [...(s.removesTraits || [])],
      description: s.effect || "", notes: "",
      bookSource: "DoomBC — Основная книга"
    }, mechanics(s, `subrace:${key}`), folderId("Субрасы"));
    out.push({ path: join(ROOT, "Субрасы", fileName(label, doc._id)), doc });
  }

  return out;
}

export function run({ write = false } = {}) {
  const all = [...folderDocs(), ...raceDocs()];
  if (write) {
    for (const { path, doc } of all) {
      mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
      writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    }
  }
  const races = all.filter(d => d.doc.type === "race").length;
  const subs  = all.filter(d => d.doc.type === "subrace").length;
  return { races, subraces: subs, folders: all.length - races - subs };
}

if (process.argv[1]?.endsWith("races-to-pack.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Рас: ${res.races}, субрас: ${res.subraces}, папок: ${res.folders}`);
}
```

- [ ] **Шаг 4: Прогнать тест генератора**

Запуск: `npx vitest run test/tools/races-to-pack.test.mjs`
Ожидание: PASS (8 тестов). Если падает сверка Черт — значит задача 3 не доделана.

- [ ] **Шаг 4б: Написать сквозной тест на числа**

Это главная проверка всей работы: раньше числа приходили из констант готовым значением
(`charBonusValue: 4`), теперь — из Черты по ссылке с пересчитанным рейтингом. Тест собирает бонусы
обоими способами и сравнивает.

```js
// test/tools/race-numbers.test.mjs
//
// Переезд рас не должен изменить НИ ОДНОГО числа на листе. Раньше расовая Черта
// создавалась из констант с готовым значением (charBonusValue: 4), теперь —
// копией из библиотеки с пересчётом по рейтингу. Тест повторяет обе дороги и
// сверяет итог по всем расам сразу.
//
// Зелёный тест здесь и означает «переезд состоялся». Красный — что персонаж
// после обновления получит не ту расу, что была.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { RACES } from "../../module/constants/races.mjs";
import { rescaleTraitByRating } from "../../module/apps/mechanics.mjs";
import { traitEntries } from "../../tools/races-to-pack.mjs";
import { normTraitName } from "../../tools/race-traits.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const LIB = new Map(packDocuments("traits", "trait")
  .map(({ doc }) => [normTraitName(doc.name), doc]));

/** Как считалось РАНЬШЕ: Черта создавалась из констант со своими effects. */
function bonusesFromConstants(race) {
  const sum = {};
  for (const t of race.traits || []) {
    const e = t.effects || {};
    if (e.charBonusStat && e.charBonusValue) sum[e.charBonusStat] = (sum[e.charBonusStat] || 0) + e.charBonusValue;
    for (const cb of e.charBonuses || []) if (cb?.stat) sum[cb.stat] = (sum[cb.stat] || 0) + cb.value;
  }
  return sum;
}

/** Как считается ТЕПЕРЬ: копия из библиотеки + пересчёт по рейтингу записи. */
function bonusesFromLibrary(race) {
  const sum = {};
  for (const entry of traitEntries(race)) {
    const src = LIB.get(normTraitName(entry.sourceName));
    if (!src) continue;
    const doc = rescaleTraitByRating(structuredClone(src), entry.rating);
    const e = doc.system.effects || {};
    if (e.charBonusStat && e.charBonusValue) sum[e.charBonusStat] = (sum[e.charBonusStat] || 0) + e.charBonusValue;
    for (const cb of e.charBonuses || []) if (cb?.stat) sum[cb.stat] = (sum[cb.stat] || 0) + cb.value;
  }
  return sum;
}

describe("числа рас после переезда", () => {

  it("Астартес: +4 Силы и +4 Стойкости, как в книге", () => {
    expect(bonusesFromLibrary(RACES.astartes)).toMatchObject({ s: 4, t: 4 });
  });

  it("Азуриане: +4 Ловкости и +4 Восприятия", () => {
    expect(bonusesFromLibrary(RACES.azuriane)).toMatchObject({ ag: 4, per: 4 });
  });

  it.each(Object.keys(RACES))("%s: бонусы из библиотеки совпали с прежними", key => {
    expect(bonusesFromLibrary(RACES[key])).toEqual(bonusesFromConstants(RACES[key]));
  });
});
```

Запуск: `npx vitest run test/tools/race-numbers.test.mjs`
Ожидание: PASS, 20 тестов (два именных плюс по одному на каждую из 18 рас).

Если какая-то раса красная — смотреть не на тест, а на её Черту в библиотеке: скорее всего у
шаблона «(X)» рейтинг и эффект разошлись, и задача 1 его не выправила.

- [ ] **Шаг 5: Записать пак и включить проверку схем**

```bash
node tools/races-to-pack.mjs --write
```

В `test/data/item-schemas.test.mjs` заменить у обоих типов `pack: null` на `pack: "races"`.

Запуск: `npx vitest run test/data/item-schemas.test.mjs`
Ожидание: PASS — все 34 документа проходят через схему без потерь. Поле, забытое в схеме, всплывёт
здесь списком «lost».

- [ ] **Шаг 6: Собрать паки и закоммитить**

```bash
npm run packs:build
npm test
npm run lint
git add tools/races-to-pack.mjs test/tools/races-to-pack.test.mjs packs-src/races \
        test/data/item-schemas.test.mjs
git commit -m "Расы и субрасы в компендиум: генератор и 34 записи (wdbc-n1k)"
```

---

### Задача 5: Библиотека рас — чтение из пака

**Файлы:**
- Создать: `module/apps/race-library.mjs`
- Создать: `test/apps/race-library.test.mjs`
- Изменить: `module/sheets/character-context.mjs:104-133`, `module/sheets/sheet-helpers.mjs:925`,
  `module/sheets/tabs/psychic.mjs:48`, `module/apps/archetypes.mjs:16,73`,
  `module/apps/mechanics.mjs:1681`, `module/rules/sources.mjs:42`
- Изменить: `warhammer-dbc.mjs` (импорт модуля ради хуков кэша)

**Интерфейсы:**
- Потребляет: пак `warhammer-dbc.races` (задача 4).
- Отдаёт:
  - `refreshRaceCache(): Promise<void>`
  - `raceEntries(): Record<string, RaceDef>` — `RaceDef` = `{ key, label, group, chars, bonusRolls, skills, gear, talents, desc, hasGeneSeed, pastRaces, subraces }`
  - `raceDef(key): RaceDef | null`
  - `subraceEntries(): Record<string, SubraceDef>` — `SubraceDef` = `{ key, label, parent, cost, effect, god, charMods, talents, removesTraits }`
  - `subracesOf(raceKey): Array<{ key, label }>`
  - `isAeldariRace(key): boolean`
  - `raceGroupList(): Array<{ label, races: Array<{ key, label }> }>`

- [ ] **Шаг 1: Написать падающий тест**

```js
// test/apps/race-library.test.mjs
//
// Библиотека рас: чтение пака с откатом на константы. Пока пак не прочитан
// (мир ещё грузится, тесты вне Foundry), система обязана работать по-старому —
// иначе Мастер создания и шапка листа опустеют на пустом месте.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { RACES, SUBRACES, AELDARI_RACES } from "../../module/constants/races.mjs";
import { raceEntries, raceDef, subracesOf, isAeldariRace, raceGroupList }
  from "../../module/apps/race-library.mjs";

describe("библиотека рас", () => {

  it("без прочитанного пака отдаёт константы", () => {
    expect(Object.keys(raceEntries()).sort()).toEqual(Object.keys(RACES).sort());
    expect(raceDef("astartes").chars).toEqual(RACES.astartes.chars);
  });

  it("субрасы отбираются по родителю", () => {
    const keys = subracesOf("drukhari").map(s => s.key).sort();

    expect(keys).toEqual([...RACES.drukhari.subraces].sort());
    expect(subracesOf("astartes")).toEqual([]);
  });

  it("метка субрасы берётся из библиотеки", () => {
    expect(subracesOf("drukhari").find(s => s.key === "mandrake").label)
      .toBe(SUBRACES.mandrake);
  });

  // Группа «Аэльдари» посимвольно совпадала с прежней константой — на этом
  // держится замена AELDARI_RACES полем group. Тест сторожит совпадение.
  it("признак аэльдари даёт ровно прежний набор рас", () => {
    const now = Object.keys(raceEntries()).filter(isAeldariRace).sort();

    expect(now).toEqual([...AELDARI_RACES].sort());
  });

  it("группы сохраняют порядок для optgroup", () => {
    expect(raceGroupList().map(g => g.label))
      .toEqual(["Люди", "Отродия", "Аэльдари", "Другие Ксеносы"]);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/apps/race-library.test.mjs`
Ожидание: FAIL — модуль `module/apps/race-library.mjs` не найден.

- [ ] **Шаг 3: Написать библиотеку**

```js
// module/apps/race-library.mjs
// ════════════════════════════════════════════════════════════════════════
//  Расы и субрасы из компендиума — источник для всего, что раньше читало
//  константу RACES. Приём тот же, что у Архетипов (apps/archetypes.mjs): свой
//  кэш ПОЛНЫХ документов, потому что плоский индекс origin-shared.mjs не
//  вмещает вложенные chars и записи Конструктора.
//
//  Пока пак не прочитан — отдаются константы. Так лист и Мастер создания
//  работают и до готовности мира, и в тестах вне Foundry.
//
//  Здесь только ЧТЕНИЕ. Применение расы к актору — apps/races.mjs.
// ════════════════════════════════════════════════════════════════════════

import { RACES, SUBRACES, SUBRACE_DATA, RACE_GROUPS } from "../constants/races.mjs";

const PACK = "warhammer-dbc.races";
const AELDARI_GROUP = "Аэльдари";

let RACE_CACHE = null;      // { key: RaceDef }
let SUB_CACHE  = null;      // { key: SubraceDef }

/** Группа расы по константам — резерв, пока пак не прочитан. */
const constGroup = key => RACE_GROUPS.find(g => g.races.includes(key))?.label || "";

const raceFromDoc = doc => ({
  key: doc.system?.key || doc.id, label: doc.name,
  group: doc.system?.group || "",
  chars: { ...(doc.system?.chars || {}) },
  bonusRolls: doc.system?.bonusRolls || 0,
  skills: doc.system?.skills || "", gear: doc.system?.gear || "",
  talents: doc.system?.talents || "", desc: doc.system?.description || "",
  hasGeneSeed: !!doc.system?.hasGeneSeed,
  pastRaces: [...(doc.system?.pastRaces || [])],
  uuid: doc.uuid
});

const raceFromConst = (key, r) => ({
  key, label: r.label, group: constGroup(key),
  chars: { ...(r.chars || {}) }, bonusRolls: r.bonusRolls || 0,
  skills: r.skills || "", gear: r.gear || "",
  talents: Array.isArray(r.talents) ? r.talents.join(", ") : (r.talents || ""),
  desc: r.desc || "", hasGeneSeed: !!r.hasGeneSeed,
  pastRaces: [...(r.pastRaces || [])], uuid: ""
});

const subFromDoc = doc => ({
  key: doc.system?.key || doc.id, label: doc.name,
  parent: doc.system?.parent || "", cost: doc.system?.cost || 0,
  effect: doc.system?.effect || "", god: doc.system?.god || "",
  charMods: { ...(doc.system?.charMods || {}) },
  talents: doc.system?.talents || "",
  removesTraits: [...(doc.system?.removesTraits || [])],
  uuid: doc.uuid
});

const subFromConst = (key, label) => {
  const s = SUBRACE_DATA[key] || {};
  return {
    key, label,
    parent: Object.entries(RACES).find(([, r]) => (r.subraces || []).includes(key))?.[0] || "",
    cost: s.cost || 0, effect: s.effect || "", god: s.god || "",
    charMods: { ...(s.charMods || {}) },
    talents: Array.isArray(s.talents) ? s.talents.join(", ") : (s.talents || ""),
    removesTraits: [...(s.removesTraits || [])], uuid: ""
  };
};

/** Перечитать компендиум. Пустой или отсутствующий пак кэш не портит. */
export async function refreshRaceCache() {
  try {
    const pack = game.packs.get(PACK);
    if (!pack) return;
    const docs = await pack.getDocuments();
    if (!docs.length) return;
    const races = {}, subs = {};
    for (const d of docs) {
      if (d.type === "race")    races[d.system?.key || d.id] = raceFromDoc(d);
      if (d.type === "subrace") subs[d.system?.key || d.id]  = subFromDoc(d);
    }
    RACE_CACHE = races;
    SUB_CACHE  = subs;
  } catch (e) { console.warn("Warhammer DBC | Кэш рас:", e); }
}

/** { key: RaceDef } — то, что раньше читали прямо из RACES. */
export function raceEntries() {
  if (RACE_CACHE) return RACE_CACHE;
  return Object.fromEntries(Object.entries(RACES).map(([k, r]) => [k, raceFromConst(k, r)]));
}

export function subraceEntries() {
  if (SUB_CACHE) return SUB_CACHE;
  return Object.fromEntries(Object.entries(SUBRACES).map(([k, l]) => [k, subFromConst(k, l)]));
}

export function raceDef(key) { return raceEntries()[key] || null; }

/** Субрасы расы: отбор по родителю, а не по списку внутри расы. */
export function subracesOf(raceKey) {
  if (!raceKey) return [];
  return Object.values(subraceEntries())
    .filter(s => s.parent === raceKey)
    .map(s => ({ key: s.key, label: s.label }));
}

/** Аэльдари — это группа, а не отдельный список: набор рас совпадает. */
export function isAeldariRace(key) { return raceDef(key)?.group === AELDARI_GROUP; }

/** Расы по группам, в порядке книги — для optgroup в списках. */
export function raceGroupList() {
  const all = Object.values(raceEntries());
  const order = RACE_GROUPS.map(g => g.label);
  const seen = [...new Set(all.map(r => r.group).filter(Boolean))]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return seen.map(label => ({
    label, races: all.filter(r => r.group === label).map(r => ({ key: r.key, label: r.label }))
  }));
}

Hooks.once("ready", () => refreshRaceCache());
for (const h of ["createItem", "deleteItem", "updateItem"])
  Hooks.on(h, (doc) => { if (doc?.pack === PACK) refreshRaceCache(); });
```

- [ ] **Шаг 4: Прогнать тест библиотеки**

Запуск: `npx vitest run test/apps/race-library.test.mjs`
Ожидание: PASS (5 тестов).

- [ ] **Шаг 5: Перевести потребителей**

`module/sheets/character-context.mjs` — заменить импорт констант на библиотеку и переписать блок
104-133:

```js
  context.races = raceEntries();
  const offRaces = disabledRaceKeys();
  context.raceGroups = raceGroupList().map(g => ({
    label: g.label,
    races: g.races.filter(r => r.key === system.race || !offRaces.includes(r.key))
  })).filter(g => g.races.length);
  context.availableSubraces = subracesOf(system.race);
  context.hasSubraces = context.availableSubraces.length > 0;
  context.isAeldari = isAeldariRace(system.race);
```

Списки Прошлого — оттуда же:

```js
  context.ynnariPastLabel   = raceDef(system.ynnariPast)?.label || "";
  context.ynnariPastOptions = (raceDef("ynnari")?.pastRaces || [])
    .map(k => ({ key: k, label: raceDef(k)?.label || k }));
```
(и так же для Арлекина, через `raceDef("harlequin")`).

`module/sheets/sheet-helpers.mjs:925`, `module/sheets/tabs/psychic.mjs:48`,
`module/apps/archetypes.mjs:73` — `AELDARI_RACES.includes(x)` → `isAeldariRace(x)`, импорт
`AELDARI_RACES` убрать.

`module/apps/mechanics.mjs:1681` — дропдаун требования «Раса»:

```js
      const opts = Object.values(raceEntries())
        .map(r => optHtml(r.key, r.label, e.raceKey === r.key)).join("");
```
и `mechanics.mjs:1537` — подпись требования: `raceDef(e.raceKey)?.label || e.raceKey`.

`module/rules/sources.mjs:42` — правила по расе больше не поле данных:

```js
import { ASTARTES_RULES } from "./library/astartes.mjs";

// Машинная часть расовых Черт остаётся кодом (этап 3 плана): в данные уехало
// описание расы, а не её правила.
const RACE_RULES = { astartes: ASTARTES_RULES };

registerRuleSource("race", a => RACE_RULES[a?.system?.race] ?? []);
```

`warhammer-dbc.mjs` — импорт `./module/apps/race-library.mjs` рядом с прочими `apps`, ради хуков кэша.

- [ ] **Шаг 6: Прогнать всё и закоммитить**

```bash
npm test
npm run lint
git add module/apps/race-library.mjs test/apps/race-library.test.mjs \
        module/sheets/character-context.mjs module/sheets/sheet-helpers.mjs \
        module/sheets/tabs/psychic.mjs module/apps/archetypes.mjs \
        module/apps/mechanics.mjs module/rules/sources.mjs warhammer-dbc.mjs
git commit -m "Библиотека рас: чтение пака вместо констант в восьми местах (wdbc-n1k)"
```

Ожидание: `test/rules/library/astartes.test.mjs` проходит без правок — источник правил тот же,
поменялся только способ его найти.

---

### Задача 6: Применение расы и субрасы

**Файлы:**
- Изменить: `module/apps/races.mjs` (добавить применение, снять jQuery-слушатели)
- Изменить: `warhammer-dbc.mjs` (хук `createItem` для расы, брошенной мимо листа)
- Создать: `test/apps/races-apply.test.mjs`

**Интерфейсы:**
- Потребляет: `raceDef`, `subraceEntries` (задача 5); `clearGrantedBy`, `charBonusesToMechanics` из `module/apps/origin-shared.mjs`; `applyItemMechanics` срабатывает сам по хуку `createItem`.
- Отдаёт:
  - `applyRace(actor, key, { tag = "race", mirror = true }): Promise<void>` — `tag`/`mirror` нужны Прошлому Иннари и Арлекина: те же бонусы, но под своим тегом и без записи в `system.race`
  - `applySubrace(actor, key): Promise<void>`
  - `clearRace(actor): Promise<void>` / `clearSubrace(actor): Promise<void>`
  - `actorRaceItem(actor): Item|null` / `actorSubraceItem(actor): Item|null`
  - `raceCharsUpdate(actor, chars): object` — карта правок характеристик, только для пустых полей; вынесена ради теста без Foundry.

- [ ] **Шаг 1: Написать падающий тест**

```js
// test/apps/races-apply.test.mjs
//
// Применение расы: носитель на акторе + выдача Конструктора + ключ-зеркало.
// Числа Черт здесь не проверяются — их считает актор из самих Черт; проверяется
// то, что делает именно применение.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { raceCharsUpdate } from "../../module/apps/races.mjs";

const chars = over => ({
  ws: { base: 0 }, bs: { base: 0 }, s: { base: 0 }, t: { base: 0 }, ag: { base: 0 },
  int: { base: 0 }, per: { base: 0 }, wp: { base: 0 }, fel: { base: 0 }, inf: { base: 0 },
  ...over
});

describe("стартовые характеристики расы", () => {

  it("пустые поля заполняются значениями расы", () => {
    const actor = { system: { characteristics: chars() } };

    expect(raceCharsUpdate(actor, { ws: 30, bs: 30 })).toEqual({
      "system.characteristics.ws.base": 30,
      "system.characteristics.bs.base": 30
    });
  });

  // Заполненное поле — это уже выбор игрока или бросок Мастера. Молча затирать
  // его нельзя: раса даёт основу, а не переписывает готового персонажа.
  it("заполненные поля не трогаются", () => {
    const actor = { system: { characteristics: chars({ ws: { base: 41 } }) } };

    expect(raceCharsUpdate(actor, { ws: 30, bs: 30 })).toEqual({
      "system.characteristics.bs.base": 30
    });
  });

  it("характеристики, которых у расы нет, не появляются", () => {
    const actor = { system: { characteristics: chars() } };

    expect(raceCharsUpdate(actor, {})).toEqual({});
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/apps/races-apply.test.mjs`
Ожидание: FAIL — `raceCharsUpdate` не экспортируется из `module/apps/races.mjs`.

- [ ] **Шаг 3: Написать применение**

В `module/apps/races.mjs` — заменить `applyRaceData` на пару функций, оставив `applyYnnari`,
`applyHarlequin` и `applyLegion` на месте:

```js
import { raceDef, subraceEntries } from "./race-library.mjs";
import { clearGrantedBy } from "./origin-shared.mjs";

const FLAG  = "warhammer-dbc";
const GRANT = "originGrant";

/** Предмет-носитель расы на акторе (или null). */
export function actorRaceItem(actor) {
  return actor?.items?.find(i => i.type === "race") || null;
}
export function actorSubraceItem(actor) {
  return actor?.items?.find(i => i.type === "subrace") || null;
}

/**
 * Стартовые характеристики расы — ТОЛЬКО в пустые поля. Заполненное значение
 * это уже выбор игрока или бросок Мастера, и раса его не переписывает.
 */
export function raceCharsUpdate(actor, chars) {
  const cur = actor?.system?.characteristics || {};
  const upd = {};
  for (const [k, v] of Object.entries(chars || {}))
    if ((cur[k]?.base || 0) === 0) upd[`system.characteristics.${k}.base`] = v;
  return upd;
}

/** Снимает расу, всё ею выданное и субрасу: субраса относилась к прежней расе. */
export async function clearRace(actor) {
  await clearSubrace(actor);
  await clearGrantedBy(actor, "race", actorRaceItem(actor));
}
export async function clearSubrace(actor) {
  await clearGrantedBy(actor, "subrace", actorSubraceItem(actor));
}

/**
 * Раса персонажа: снимает прежнюю, кладёт носитель (штатный createItem →
 * applyItemMechanics выдаёт Черты, таланты и навыки), пишет ключ-зеркало и
 * стартовые характеристики.
 *
 * Пустой ключ означает «снять расу», а не «ошибка».
 */
 * Прошлое Иннари и Арлекина — та же выдача под своим тегом `racePast`: оно
 * снимается отдельно от самой расы, иначе смена Прошлого уносила бы расу.
 *
 * @param {Actor} actor
 * @param {string} key
 * @param {{tag?: string, mirror?: boolean}} [opts]  tag — под каким тегом
 *   помечать выданное; mirror:false — не трогать system.race (так кладётся
 *   Прошлое: ключ расы остаётся «ynnari»)
 */
export async function applyRace(actor, key, { tag = "race", mirror = true } = {}) {
  if (!actor) return;
  await clearGrantedBy(actor, tag, tag === "race" ? actorRaceItem(actor) : null);
  if (tag === "race") await clearSubrace(actor);
  if (!key) {
    if (mirror) await actor.update({ "system.race": "", "system.subrace": "" });
    return;
  }

  const def = raceDef(key);
  // Пака в мире может не быть (свежий мир, отключённая библиотека): тогда
  // носителя не будет, но ключ и стартовые характеристики персонаж получит —
  // лист продолжит работать по ключу, как до переезда.
  const src = def?.uuid ? await fromUuid(def.uuid).catch(() => null) : null;
  if (src) {
    const data = src.toObject();
    delete data._id;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), [GRANT]: tag } };
    await actor.createEmbeddedDocuments("Item", [data]);
  }

  await actor.update({
    ...(mirror ? { "system.race": key, "system.subrace": "" } : {}),
    ...raceCharsUpdate(actor, def?.chars || {})
  });

  if (def?.hasGeneSeed) await grantAstartesImplants(actor);
  ui.notifications?.info(`🧬 ${mirror ? "Раса" : "Прошлое"}: ${def?.label || key}.`);
}

/**
 * Субраса: только своей расе. Чужая — отказ с пояснением, лист не меняется:
 * молчаливое применение чужой субрасы испортило бы персонажа незаметно.
 */
export async function applySubrace(actor, key) {
  if (!actor) return;
  await clearSubrace(actor);
  if (!key) { await actor.update({ "system.subrace": "" }); return; }

  const def  = subraceEntries()[key];
  const race = actor.system.race || "";
  if (!race) return ui.notifications?.warn("Сначала выберите расу.");
  if (def && def.parent && def.parent !== race) {
    const raceLabel = raceDef(race)?.label || race;
    const parentLabel = raceDef(def.parent)?.label || def.parent;
    return ui.notifications?.warn(
      `${def.label} — субраса расы «${parentLabel}», а у персонажа «${raceLabel}».`);
  }

  const src = def?.uuid ? await fromUuid(def.uuid).catch(() => null) : null;
  if (src) {
    const data = src.toObject();
    delete data._id;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), [GRANT]: "subrace" } };
    await actor.createEmbeddedDocuments("Item", [data]);
  }

  // Субрасы друкхари отменяют часть расовых Черт.
  const drop = (def?.removesTraits || []).map(n => String(n).toLowerCase().trim());
  if (drop.length) {
    const ids = actor.items
      .filter(i => i.type === "trait" && drop.includes(i.name.toLowerCase().trim()))
      .map(i => i.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  }

  await actor.update({ "system.subrace": key });
}
```

Старую функцию `activateRaceListeners` удалить целиком: её заменяют действия листа из задачи 7.

В `applyYnnari` и `applyHarlequin` вызов `applyRaceData(actor, past, callbacks)` заменить на:

```js
  // Прошлое — бонусы бывшей расы, но раса персонажа остаётся своей, поэтому
  // mirror:false, а свой тег даёт снять Прошлое, не трогая саму расу.
  if (past) await applyRace(actor, past, { tag: "racePast", mirror: false });
```

Повторное нажатие кнопки больше не плодит дубли: `clearGrantedBy(actor, "racePast", null)` в начале
`applyRace` снимает прежнее Прошлое со всем выданным.

- [ ] **Шаг 4: Прогнать тест**

Запуск: `npx vitest run test/apps/races-apply.test.mjs`
Ожидание: PASS (3 теста).

- [ ] **Шаг 5: Хук на расу, брошенную мимо листа**

В `warhammer-dbc.mjs`, рядом с `Hooks.on("createItem", ...)` (около строки 1186):

```js
  // Раса, попавшая на актора мимо листа — макросом, скриптом, копированием.
  // Флаг originGrant ставит сам applyRace, поэтому его собственная выдача сюда
  // не возвращается и цикла не образует.
  if (item.parent instanceof Actor && ["race", "subrace"].includes(item.type)
      && !item.getFlag("warhammer-dbc", "originGrant")) {
    const key = item.system?.key || "";
    await item.delete();
    if (item.type === "race") await applyRace(item.parent, key);
    else await applySubrace(item.parent, key);
    return;
  }
```

- [ ] **Шаг 6: Проверка и коммит**

```bash
npm test
npm run lint
git add module/apps/races.mjs warhammer-dbc.mjs test/apps/races-apply.test.mjs
git commit -m "Применение расы и субрасы предметом-носителем (wdbc-n1k)"
```

---

### Задача 7: Слоты Расы и Субрасы в шапке листа

**Файлы:**
- Изменить: `templates/actor/parts/header.hbs:2-12`
- Изменить: `module/sheets/character-context.mjs` (данные слотов)
- Изменить: `module/sheets/actor-sheet.mjs` (действия, `_onDropItem`)
- Создать: `module/sheets/race-picker.mjs`
- Изменить: `styles/sheets/actor-header.css` (или ближайший файл шапки)
- Изменить: `test/sheets/character-v2.test.mjs`

**Интерфейсы:**
- Потребляет: `applyRace`, `applySubrace`, `clearRace`, `clearSubrace`, `actorRaceItem`, `actorSubraceItem` (задача 6); `raceGroupList`, `subracesOf`, `raceDef` (задача 5).
- Отдаёт: `openRacePicker(actor, { subrace })` из `module/sheets/race-picker.mjs`; действия листа `racePick`, `raceOpen`, `raceClear`, `subracePick`, `subraceOpen`, `subraceClear`, `raceApply`; поля контекста `raceSlot`, `subraceSlot` вида `{ id, key, name, img, applied }`.

- [ ] **Шаг 1: Написать падающий тест**

В `test/sheets/character-v2.test.mjs` дописать:

```js
  it("слоты расы объявлены действиями листа", () => {
    const actions = Object.keys(WarhammerCharacterSheet.DEFAULT_OPTIONS.actions);

    expect(actions).toEqual(expect.arrayContaining([
      "racePick", "raceOpen", "raceClear", "raceApply",
      "subracePick", "subraceOpen", "subraceClear"
    ]));
  });
```

- [ ] **Шаг 2: Убедиться, что тест падает по нужной причине**

Запуск: `npx vitest run test/sheets/character-v2.test.mjs`
Ожидание: FAIL — действий нет в `DEFAULT_OPTIONS.actions`. Двусторонняя сверка `describeV2Sheet`
дополнительно потребует те же `data-action` в шаблоне.

- [ ] **Шаг 3: Данные слотов в контексте**

В `module/sheets/character-context.mjs` дописать импорты:

```js
import { actorRaceItem, actorSubraceItem } from "../apps/races.mjs";
import { raceDef, subraceEntries } from "../apps/race-library.mjs";
```

и рядом с `availableSubraces`/`hasSubraces` (они остаются — по ним рисуется свободный ввод для рас
без субрас) добавить:

```js
  // Слот показывает предмет-носитель, а если его нет — расу по ключу-зеркалу
  // с пометкой «не применена»: так выглядят персонажи, созданные до переезда.
  const raceItem = actorRaceItem(actor);
  const raceKey  = system.race || "";
  context.raceSlot = raceItem
    ? { id: raceItem.id, key: raceKey, name: raceItem.name, img: raceItem.img, applied: true }
    : (raceKey ? { id: "", key: raceKey, name: raceDef(raceKey)?.label || raceKey,
                   img: "icons/svg/oak.svg", applied: false } : null);

  const subItem = actorSubraceItem(actor);
  const subKey  = system.subrace || "";
  context.subraceSlot = subItem
    ? { id: subItem.id, key: subKey, name: subItem.name, img: subItem.img, applied: true }
    : (subKey ? { id: "", key: subKey, name: subraceEntries()[subKey]?.label || subKey,
                  img: "icons/svg/oak.svg", applied: false } : null);
```

- [ ] **Шаг 4: Разметка слотов**

В `templates/actor/parts/header.hbs` заменить ячейки Расы и Субрасы:

```hbs
<div class="header-cell header-cell-slot">
  <label>Раса</label>
  <div class="wh-slot{{#unless raceSlot}} empty{{/unless}}" data-slot="race">
    {{#if raceSlot}}
      <img class="wh-slot-img" src="{{raceSlot.img}}" alt=""/>
      <span class="wh-slot-name{{#unless raceSlot.applied}} pending{{/unless}}">{{raceSlot.name}}</span>
      {{#if raceSlot.applied}}
        <button type="button" class="wh-slot-btn" data-action="raceOpen" title="Открыть лист расы">⤢</button>
      {{else}}
        <button type="button" class="wh-slot-btn" data-action="raceApply" title="Применить расу">Применить</button>
      {{/if}}
      <button type="button" class="wh-slot-btn" data-action="raceClear" title="Снять расу">✕</button>
    {{else}}
      <button type="button" class="wh-slot-add" data-action="racePick">+ перетащите или нажмите</button>
    {{/if}}
  </div>
</div>
```

Ячейка субрасы — та же разметка с `data-slot="subrace"` и действиями `subracePick`/`subraceOpen`/
`subraceClear`. Под ней остаётся свободный ввод для рас без субрас:

```hbs
{{#unless hasSubraces}}
  <input type="text" name="system.subrace" value="{{system.subrace}}" placeholder="—"/>
{{/unless}}
```

Поля Дома Навигатора, Прошлого, Происхождения аэльдари и блок Астартес остаются как были.

- [ ] **Шаг 5: Действия и приём дропа**

В `module/sheets/actor-sheet.mjs` — функции действий рядом с прочими и записи в
`DEFAULT_OPTIONS.actions`:

```js
function onRacePick()  { return openRacePicker(this.actor, { subrace: false }); }
function onSubracePick(){ return openRacePicker(this.actor, { subrace: true }); }
function onRaceOpen()  { return actorRaceItem(this.actor)?.sheet?.render(true); }
function onSubraceOpen(){ return actorSubraceItem(this.actor)?.sheet?.render(true); }
function onRaceClear() { return clearRace(this.actor); }
function onSubraceClear(){ return clearSubrace(this.actor); }
// Персонаж из старого мира: ключ есть, носителя нет — применяем то, что стоит.
function onRaceApply() { return applyRace(this.actor, this.actor.system.race || ""); }
```
```js
      racePick:     whenEditable(onRacePick),
      raceOpen:     onRaceOpen,
      raceClear:    whenEditable(onRaceClear),
      raceApply:    whenEditable(onRaceApply),
      subracePick:  whenEditable(onSubracePick),
      subraceOpen:  onSubraceOpen,
      subraceClear: whenEditable(onSubraceClear),
```

Приём дропа — своего `_onDropItem` у листа персонажа нет, добавляется (образец —
`module/sheets/ship-sheet.mjs:605`):

```js
  /**
   * Раса и субраса на листе — не предмет в списке, а происхождение персонажа:
   * дроп уходит в применение, а обычное создание предмета не выполняется.
   * Бросить можно в любое место листа, слот лишь подсказывает куда целиться.
   */
  async _onDropItem(event, data) {
    const src = await Item.implementation.fromDropData(data);
    if (src?.type === "race")    return applyRace(this.actor, src.system?.key || "");
    if (src?.type === "subrace") return applySubrace(this.actor, src.system?.key || "");
    return super._onDropItem(event, data);
  }
```

В `_onRender` — подсветка слота при перетаскивании:

```js
    for (const slot of el.querySelectorAll(".wh-slot")) {
      slot.addEventListener("dragenter", () => slot.classList.add("drop-hint"));
      slot.addEventListener("dragleave", () => slot.classList.remove("drop-hint"));
      slot.addEventListener("drop",      () => slot.classList.remove("drop-hint"));
    }
```

`module/sheets/race-picker.mjs` — новый файл. Устройство как у `elite-picker.mjs` (поиск, карточки,
группировка), но на `DialogV2` и без jQuery: новый код не должен добавлять того, что убирает
wdbc-z0z.

```js
// module/sheets/race-picker.mjs
// ════════════════════════════════════════════════════════════════════════
//  Выбор расы и субрасы из библиотеки — то, что открывается кликом по пустому
//  слоту в шапке листа. Второй путь к тому же результату — перетащить предмет
//  из компендиума; оба ведут в applyRace/applySubrace.
//
//  Субрасы показываются только свои: чужая раса всё равно была бы отклонена
//  применением, и предлагать её значит звать игрока на ошибку.
// ════════════════════════════════════════════════════════════════════════

import { raceGroupList, subracesOf, raceDef } from "../apps/race-library.mjs";
import { applyRace, applySubrace } from "../apps/races.mjs";
import { esc } from "../helpers/utils.mjs";

const card = (key, name, meta) => `
  <button type="button" class="rp-item" data-key="${esc(key)}">
    <span class="rp-name">${esc(name)}</span>
    <span class="rp-meta">${esc(meta || "")}</span>
  </button>`;

/**
 * @param {Actor} actor
 * @param {{subrace?: boolean}} opts  subrace:true — выбор субрасы текущей расы
 */
export async function openRacePicker(actor, { subrace = false } = {}) {
  const raceKey = actor.system.race || "";

  let body;
  if (subrace) {
    const list = subracesOf(raceKey);
    if (!raceKey) return ui.notifications?.warn("Сначала выберите расу.");
    body = list.length
      ? `<div class="rp-list">${list.map(s => card(s.key, s.label, raceDef(raceKey)?.label)).join("")}</div>`
      : `<div class="rp-none">У расы «${esc(raceDef(raceKey)?.label || raceKey)}» субрас нет — впишите свою в поле под слотом.</div>`;
  } else {
    body = raceGroupList().map(g => `
      <div class="rp-sec">${esc(g.label)}</div>
      <div class="rp-list">${g.races.map(r => card(r.key, r.label, g.label)).join("")}</div>`).join("");
  }

  await foundry.applications.api.DialogV2.wait({
    window: { title: subrace ? "Субраса" : "Раса" },
    classes: ["warhammer-dbc", "wh-holo", "wh-race-picker"],
    position: { width: 520 },
    content: `<div class="rp-body">
      <input type="text" class="rp-search" placeholder="Поиск по названию…"/>
      ${body}
    </div>`,
    buttons: [{ action: "close", label: "Закрыть", default: true }],
    rejectClose: false,
    render: (_event, dialog) => {
      const root = dialog.element;
      root.querySelectorAll(".rp-item").forEach(btn =>
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          dialog.close();
          if (subrace) await applySubrace(actor, key);
          else await applyRace(actor, key);
        }));
      root.querySelector(".rp-search")?.addEventListener("input", ev => {
        const q = ev.currentTarget.value.trim().toLowerCase();
        root.querySelectorAll(".rp-item").forEach(el =>
          el.classList.toggle("rp-hidden", !!q && !el.textContent.toLowerCase().includes(q)));
      });
    }
  });
}
```

- [ ] **Шаг 6: Стили слота и пикера**

В `styles/sheets/actor-header.css` (или в тот файл шапки, что найдётся — проверить `grep -l
"header-cell" styles/`):

```css
/* Слот происхождения: иконка, имя, кнопки. Пустой слот — цель для перетаскивания. */
.warhammer-dbc .wh-slot {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 4px; min-height: 26px;
  border: 1px solid var(--wh-border, #3a4a55); border-radius: 3px;
}
.warhammer-dbc .wh-slot.empty { border-style: dashed; opacity: 0.7; }
.warhammer-dbc .wh-slot.drop-hint { border-color: var(--wh-accent, #7fd8ff); box-shadow: 0 0 4px var(--wh-accent, #7fd8ff); }
.warhammer-dbc .wh-slot-img { width: 20px; height: 20px; border: none; flex: 0 0 auto; }
.warhammer-dbc .wh-slot-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Ключ есть, носителя нет: персонаж из мира до переезда рас в библиотеку. */
.warhammer-dbc .wh-slot-name.pending { opacity: 0.6; font-style: italic; }
.warhammer-dbc .wh-slot-btn, .warhammer-dbc .wh-slot-add {
  flex: 0 0 auto; background: none; border: none; cursor: pointer;
  color: var(--wh-text, #cfe3ee); padding: 0 4px;
}
.warhammer-dbc .wh-slot-add { width: 100%; text-align: left; opacity: 0.7; }

.warhammer-dbc .wh-race-picker .rp-list { display: flex; flex-wrap: wrap; gap: 4px; }
.warhammer-dbc .wh-race-picker .rp-sec { margin: 8px 0 4px; opacity: 0.8; }
.warhammer-dbc .wh-race-picker .rp-item {
  display: flex; flex-direction: column; align-items: flex-start;
  min-width: 150px; padding: 4px 6px; cursor: pointer;
}
.warhammer-dbc .wh-race-picker .rp-meta { font-size: 0.8em; opacity: 0.6; }
.warhammer-dbc .wh-race-picker .rp-hidden { display: none; }
```

- [ ] **Шаг 7: Проверка и коммит**

```bash
npx vitest run test/sheets/character-v2.test.mjs
npm test
npm run lint
git add templates/actor/parts/header.hbs module/sheets/character-context.mjs \
        module/sheets/actor-sheet.mjs module/sheets/race-picker.mjs \
        styles/sheets/actor-header.css test/sheets/character-v2.test.mjs
git commit -m "Слоты Расы и Субрасы в шапке листа с драг-н-дропом (wdbc-n1k)"
```

---

### Задача 8: Мастер создания на общий путь

**Файлы:**
- Изменить: `module/apps/creation.mjs:13-14, 461-483, 525-621, 648-690, 753-757, 776`
- Тест: `test/apps/creation.test.mjs` (правок не требует — служит контролем)

**Интерфейсы:**
- Потребляет: `raceDef`, `subraceEntries`, `subracesOf`, `isAeldariRace`, `raceGroupList` (задача 5); `applyRace`, `applySubrace` (задача 6).
- Отдаёт: сигнатуры `resolveCreation`, `creationCharSum`, `creationBonusRolls` не меняются — их зовут тесты и диалог.

- [ ] **Шаг 1: Убедиться, что тесты Мастера сейчас зелёные**

Запуск: `npx vitest run test/apps/creation.test.mjs`
Ожидание: PASS. Это опорная точка: после правок список должен остаться тем же.

- [ ] **Шаг 2: Перевести чтение на библиотеку**

В `module/apps/creation.mjs` заменить импорт констант:

```js
import { raceDef, subraceEntries, subracesOf, isAeldariRace, raceGroupList }
  from "./race-library.mjs";
```

`resolveCreation` (строка 461):

```js
export function resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast }) {
  const race = raceDef(raceKey);
  const sub  = subraceEntries()[subraceKey] || null;
  const pastKey = raceKey === "ynnari" ? ynnariPast : (raceKey === "harlequin" ? harlequinPast : "");
  const past = pastKey ? raceDef(pastKey) : null;
  return { race, arch: archetypeEntries()[archKey] || null, sub, past, pastKey };
}
```

`creationBonusRolls` — `Number(raceDef(raceKey)?.bonusRolls) || 0`.

Списки диалога (строки 676-683, 753-757, 776) — через `raceGroupList()`, `subracesOf(rk)`,
`isAeldariRace(rk)`.

- [ ] **Шаг 3: Перевести выдачу на общий путь**

В главной функции создания (строки 525-621) убрать `createTraits(race?.traits)`,
`createTraits(sub.traits)` и `applyStartingTalents(race?.talents)`, поставив на их место:

```js
  // Раса и субраса выдаются тем же путём, что из слота и из дропа: иначе два
  // пути выдачи разойдутся при первой же правке библиотеки.
  await applyRace(actor, raceKey);
  if (subraceKey) await applySubrace(actor, subraceKey);

  // Характеристики пишет Мастер и ПОСЛЕ выдачи: его сумма учитывает архетип,
  // броски и распределение очков, а расовые chars в ней лишь слагаемое.
  // applyRace до этого заполнил пустые поля — здесь они перекрываются итогом.
  await actor.update(charUpdate);
```

- [ ] **Шаг 4: Прогнать тесты Мастера**

Запуск: `npx vitest run test/apps/creation.test.mjs`
Ожидание: PASS, ровно тот же список тестов, что на шаге 1. Тест «повторный прогон Мастера не
удваивает свободные слоты» — ключевой: теперь его обеспечивает `clearRace`, а не дедупликация по
имени.

- [ ] **Шаг 5: Проверка и коммит**

```bash
npm test
npm run lint
git add module/apps/creation.mjs
git commit -m "Мастер создания выдаёт расу общим путём (wdbc-n1k)"
```

---

### Задача 9: Документация

**Файлы:**
- Переписать: `docs/how-to-add-race.md`
- Изменить: `docs/architecture-plan.md` (отметить этап)

**Интерфейсы:**
- Потребляет: всё готовое из задач 1-8.

- [ ] **Шаг 1: Переписать инструкцию**

`docs/how-to-add-race.md` сейчас описывает правку `.mjs`. Новый порядок: завести предмет «Раса» в
библиотеке, заполнить характеристики и тексты, добавить Черты на вкладке МЕХАНИКА ссылками, при
необходимости завести субрасу с `parent`. Раздел про машинные правила
(`module/rules/library/`) сохранить: он не изменился, туда по-прежнему уезжает то, что система
считает. Добавить раздел «Если Черты ещё нет в библиотеке».

- [ ] **Шаг 2: Отметить этап в плане архитектуры**

В `docs/architecture-plan.md` — раздел про расы: пометка ✅ и абзац «Как вышло»: что уехало в
данные, что осталось кодом (правила), какие константы остались резервом.

- [ ] **Шаг 3: Проверка и коммит**

```bash
npm test
git add docs/how-to-add-race.md docs/architecture-plan.md
git commit -m "Документация: расы заводятся в библиотеке, не в коде (wdbc-n1k)"
```

---

## Порядок и зависимости

```
1 (рейтинг) ─┐
2 (типы)  ───┼→ 4 (генератор рас) → 5 (библиотека) → 6 (применение) ─┬→ 7 (слоты)
3 (Черты) ───┘                                                        └→ 8 (Мастер) → 9 (доки)
```

Задачи 1, 2 и 3 независимы и могут идти параллельно. Задача 9 — после 7 и 8.

## Проверка готовности

Работа считается сделанной, когда:

- `npm test` зелёный целиком, включая `test/apps/creation.test.mjs` без правок;
- `npm run lint` — 0 ошибок, предупреждений не больше, чем было;
- `npm run packs:build` проходит, пак `races` собирается;
- в живом мире: перетаскивание расы на лист заполняет характеристики и Черты; субраса чужой расы
  отклоняется с сообщением; крестик снимает расу вместе с выданным; персонаж, созданный до
  переезда, показывает расу с пометкой «не применена» и кнопкой «Применить».
