# Формат правил

Справочник к этапам 1–3 [плана](architecture-plan.md). Описывает, как записать
игровое правило данными вместо кода.

## Зачем это нужно

Сейчас правило существует как русский текст:

```js
// module/constants/races.mjs
{ name: "Nimble / Проворный",
  benefit: "Атакующим по нему −A.b к попаданию.",
  effects: {} }
```

Человек прочитает, система применить не сможет. Поэтому каждое действующее правило
пишется отдельно, кодом, и расходится с текстом при первой же правке.

Формат ниже добавляет машинную часть **рядом** с текстом. Текст остаётся описанием
для игрока и не удаляется никогда.

## Форма записи

```js
{
  id:        "eldarten",              // обязателен, уникален в системе
  label:     "Eldarten / Эльдарское Тело",
  when:      { /* условия */ },       // пусто = действует всегда
  effects:   [ /* эффекты */ ],
  overrides: [ "id_другого_правила" ] // необязательно
}
```

`id` пишется в нижнем регистре, точка разделяет уровни: `smite.astartes`,
`aeldari.path.warlock`. По этому идентификатору правило вытесняется другим, поэтому
менять его после выхода релиза нельзя, как нельзя менять имя поля в базе.

## Условия (`when`)

Правило действует, когда истинны **все** условия одновременно. Пустой `when`
означает «всегда».

| Ключ | Значение | Истинно, когда |
|---|---|---|
| `race` | массив ключей рас | раса актора в списке |
| `subrace` | массив ключей субрас | субраса актора в списке |
| `alignment` | массив мировоззрений | мировоззрение актора в списке |
| `sizeMax` | число | `system.sizeMod` не больше указанного |
| `sizeMin` | число | `system.sizeMod` не меньше указанного |
| `charMin` | объект `{ ключ: число }` | все указанные характеристики не ниже порога |
| `hasTalent` | строка или массив | у актора есть талант с таким именем |
| `hasTrait` | строка или массив | у актора есть черта с таким именем |
| `psyRatingMin` | число | пси-рейтинг не ниже указанного |
| `weaponClass` | массив | класс оружия в контексте броска подходит |
| `discipline` | массив | дисциплина психосилы в контексте подходит |
| `targetHasTrait` | строка или массив | у цели есть такая черта |

Подпись предиката всегда одна:

```js
// module/rules/predicates.mjs
export const PREDICATES = {
  race:    (actor, ctx, value) => value.includes(actor.system.race),
  sizeMax: (actor, ctx, value) => (actor.system.sizeMod ?? 0) <= value,
  charMin: (actor, ctx, value) => Object.entries(value)
             .every(([k, n]) => (actor.system.characteristics[k]?.total ?? 0) >= n),
  weaponClass: (actor, ctx, value) => value.includes(ctx.weapon?.system.weaponClass)
};
```

Три требования к предикату, и они не обсуждаются:

1. **Чистая функция.** Никаких обращений к `game`, `ui`, `canvas`, никаких бросков.
   Иначе правило не протестировать без запуска Foundry, а весь смысл был в этом.
2. **Безопасен к отсутствию данных.** У подставного актора в тесте может не быть
   половины полей. Отсюда `?.` и `?? 0` в каждом обращении.
3. **Возвращает строго `true` или `false`.** Не `undefined`, не число.

Неизвестный ключ условия даёт ошибку в консоль и `false`. Опечатка в данных не
должна проходить молча: тихо не сработавшее правило ищется днями.

## Эффекты

| `kind` | Поля | Что делает |
|---|---|---|
| `charBonus` | `target`, `value` | плюс к бонусу характеристики (Unnatural) |
| `charTotal` | `target`, `value` | плюс к значению характеристики |
| `rollBonus` | `target`, `value` | модификатор к тесту |
| `rollMode` | `target`, `mode`, `rolls` | несколько бросков с выбором (`keepBest`, `keepWorst`) |
| `penaltyMul` | `target`, `factor` | множитель штрафов, `0.5` = половина |
| `apBonus` | `target`, `value` | броня по локации или `all` |
| `damageBonus` | `target`, `value` | плюс к урону |
| `damageDice` | `target`, `value` | замена формулы урона |
| `grantValue` | `target`, `value` | плюс к производному полю (реакции, скорость) |
| `fearRating` | `value` | рейтинг страха, берётся максимум, не сумма |
| `grantItem` | `uuid`, `qty` | выдать предмет при получении источника |
| `script` | `code` | аварийный выход, см. предупреждение ниже |

`target` для бросков пишется с областью через двоеточие: `initiative`,
`skill:psyniscience`, `char:wp`, `power:smite`, `weapon:melee`.

Про `fearRating`: складывать нельзя. Два источника с рейтингом 2 дают 2, а не 4.
Это уже учтено в существующем коде
([effect-keys.mjs](../module/constants/effect-keys.mjs), тип `upgrade`), и новый
реестр должен вести себя так же.

Про `script`: свободный JS в правиле возвращает нас туда, откуда мы уходили.
Допустим только когда правило действительно нельзя выразить данными, и в этом
случае к нему пишется комментарий с объяснением, почему.

## Вытеснение (`overrides`)

Механизм, ради которого затевался весь план. Правило может отменить другое по его
идентификатору. Это и есть ответ на «у эльдар этот талант работает иначе» и «у
Астартес своя версия психосилы».

```js
// Базовая версия
export const SMITE = {
  id: "smite.baseline",
  effects: [{ kind: "damageDice", target: "power:smite", value: "1d10" }]
};

// Версия Астартес вытесняет базовую
export const SMITE_ASTARTES = {
  id: "smite.astartes",
  overrides: ["smite.baseline"],
  when: { race: ["astartes"], hasTrait: "Gene-Seed" },
  effects: [{ kind: "damageDice", target: "power:smite", value: "1d10+PR" }]
};
```

У астартеса действует вторая, у человека первая. Форк кода не нужен, обе версии
лежат рядом и обе читаемы.

Порядок разбора в `collectRules`: сначала собрать все правила от всех источников,
потом отобрать по `when`, и **только потом** снимать вытесненные. Наоборот нельзя:
правило с невыполненным условием не должно ничего вытеснять.

Если два прошедших отбор правила вытесняют друг друга, это ошибка в данных.
Пишем в консоль и оставляем оба: молча выбирать одно из двух хуже, чем показать
двойной эффект, который сразу заметят.

## Источники правил

Правила приходят из разных мест, а собираются в один список.

```js
// module/rules/sources.mjs
registerRuleSource("race",      a => RACES[a.system.race]?.rules ?? []);
registerRuleSource("subrace",   a => SUBRACES[a.system.subrace]?.rules ?? []);
registerRuleSource("homeworld", a => HOMEWORLD_BY_KEY[hwKey(a)]?.rules ?? []);
registerRuleSource("path",      a => pathRules(a));
registerRuleSource("items",     a => a.items.flatMap(i => i.system.rules ?? []));
```

Добавить книгу означает зарегистрировать источник и положить данные. Ядро не
меняется. Реестр подсистем
[features.mjs](../module/constants/features.mjs) уже умеет включать и выключать
книги, и выключенная книга должна убирать свои правила из сборки автоматически.

## Полный пример

Черта эльдар «Eldarten» из
[races.mjs](../module/constants/races.mjs). В книге это абзац на десять строк.
Машинная часть:

```js
export const ELDARTEN = {
  id: "aeldari.eldarten",
  label: "Eldarten / Эльдарское Тело",
  when: {
    race: ["azuriane", "drukhari", "harlequin", "exodite"],
    sizeMax: 1                       // «теряется при Размере 2+»
  },
  effects: [
    { kind: "grantValue", target: "reactions",  value: 1 },
    { kind: "rollBonus",  target: "initiative", value: 4 },
    { kind: "rollMode",   target: "initiative", mode: "keepBest", rolls: 3 },
    { kind: "penaltyMul", target: "skill:psyniscience", factor: 0.5 }
  ]
};
```

Оговорка «теряется при Размере 2+» стала условием `sizeMax: 1`, а не примечанием,
которое надо помнить. Остальные пункты черты (иммунитет к людским болезням,
долгожительство, отношение слаанешитских ветвей) в машинную часть не переводятся:
их применяет мастер, и они остаются в тексте `benefit`. Переводить в данные надо
то, что система считает, а не всё подряд.

## Как проверять

Правило тестируется на литерале, без Foundry:

```js
import { describe, it, expect } from "vitest";
import { matchRule } from "../module/rules/collect.mjs";
import { ELDARTEN } from "../module/rules/library/aeldari.mjs";

const actor = (over = {}) => ({
  system: { race: "azuriane", sizeMod: 0, characteristics: {}, ...over },
  items: []
});

describe("Eldarten", () => {
  it("действует у азуриан обычного размера", () => {
    expect(matchRule(ELDARTEN, actor(), {})).toBe(true);
  });

  it("не действует при Размере 2", () => {
    expect(matchRule(ELDARTEN, actor({ sizeMod: 2 }), {})).toBe(false);
  });

  it("не действует у людей", () => {
    expect(matchRule(ELDARTEN, actor({ race: "human" }), {})).toBe(false);
  });
});
```

Три теста на правило: подходит, не подходит по основному условию, не подходит по
расе. Этого достаточно, чтобы правило не сломалось молча.
