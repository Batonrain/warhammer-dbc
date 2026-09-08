// test/rules/aptitude-binding-group.test.mjs
//
// Привязку Склонностей (wdbc-1pvq) можно было менять только у обычных Навыков
// и Характеристик. У Групповых Навыков (Знания, Ремесло, Навигация) и у их
// специализаций значок Д/Н/В был неинтерактивным, а хранение не различало
// «Группа целиком» и «одна специализация» вовсе (wdbc-fzbu).
//
// Различать обязательно: у специализации привязка СВОЯ — «Навигация (Варп) —
// это Воля, а не Интеллект группы». Одна запись по ключу группы, накрывающая
// все специализации разом, испортила бы ровно то, ради чего специализации и
// заведены.
//
// Поэтому уровней хранения два, и приоритет между ними жёсткий:
//   1) переопределение НА ЗАПИСИ специализации (entry.aptitudes) — сильнее;
//   2) переопределение группы целиком (system.aptitudeBinding.skill.<группа>);
//   3) книжная привязка — [Характеристика записи или группы, вторая склонность].
//
// Запись на самой специализации, а не ключом «группа/название»: специализация
// живёт объектом в массиве (system.groupSkills.<группа>[i]), у неё уже так
// хранятся ранг, цена и модификатор, и путь Foundry-документа не приходится
// собирать из свободного текста, в котором игрок волен поставить точку.

import { describe, it, expect } from "vitest";
import {
  objectAptitudes,
  entryAptitudeOverride,
  isAptitudeBindingOverridden,
  setEntryBinding,
  aptBindingContext
} from "../../module/rules/aptitude-binding.mjs";

const BOOK = ["int", "knowledge"];

describe("привязка Склонностей у Группового Навыка и его специализаций", () => {
  it("нет ни одной записи — книжная привязка", () => {
    const actor = { system: {} };
    expect(objectAptitudes(actor, "skill", "scholasticLore", BOOK)).toEqual(BOOK);
    expect(objectAptitudes(actor, "skill", "scholasticLore", BOOK, null)).toEqual(BOOK);
  });

  it("переопределение группы накрывает специализацию, у которой своего нет", () => {
    const actor = { system: { aptitudeBinding: { skill: { scholasticLore: ["wp", "knowledge"] } } } };
    expect(objectAptitudes(actor, "skill", "scholasticLore", BOOK)).toEqual(["wp", "knowledge"]);
    expect(objectAptitudes(actor, "skill", "scholasticLore", BOOK, null)).toEqual(["wp", "knowledge"]);
  });

  it("своё переопределение специализации сильнее группового", () => {
    const actor = { system: { aptitudeBinding: { skill: { scholasticLore: ["wp", "knowledge"] } } } };
    const entry = { specialty: "Тактика", aptitudes: ["int", "offence"] };
    expect(objectAptitudes(actor, "skill", "scholasticLore", BOOK, entryAptitudeOverride(entry)))
      .toEqual(["int", "offence"]);
  });

  it("пустой список на записи записью не считается — падаем на группу/книгу", () => {
    // Тот же приём, что у переопределения актора: пустой массив неотличим от
    // «переопределяли и вернули назад» и молча сделал бы объект Нейтральным.
    expect(entryAptitudeOverride({ aptitudes: [] })).toBeNull();
    expect(entryAptitudeOverride({ aptitudes: ["  ", ""] })).toBeNull();
    expect(entryAptitudeOverride({})).toBeNull();
    expect(entryAptitudeOverride(null)).toBeNull();

    const actor = { system: {} };
    expect(objectAptitudes(actor, "skill", "scholasticLore", BOOK, entryAptitudeOverride({ aptitudes: [] })))
      .toEqual(BOOK);
  });

  it("setEntryBinding пишет копию записи, а не правит исходную", () => {
    const entry = { specialty: "Тактика", rank: "trained", cost: 300 };
    const next  = setEntryBinding(entry, ["wp", "knowledge"]);

    expect(next).not.toBe(entry);
    expect(entry.aptitudes).toBeUndefined();
    expect(next.aptitudes).toEqual(["wp", "knowledge"]);
    expect(next.rank).toBe("trained");   // остальные поля записи целы
    expect(next.cost).toBe(300);
  });

  it("setEntryBinding с пустым списком снимает запись, а не пишет пустой массив", () => {
    const entry = { specialty: "Тактика", aptitudes: ["wp", "knowledge"] };
    const next  = setEntryBinding(entry, []);

    expect("aptitudes" in next).toBe(false);
    expect(entryAptitudeOverride(next)).toBeNull();
  });

  it("контекст строки отмечает переопределение и на группе, и на специализации", () => {
    const actor = { system: { aptitudeBinding: { skill: { scholasticLore: ["wp", "knowledge"] } } } };
    const label = a => a.toUpperCase();

    const group = aptBindingContext(actor, "skill", "scholasticLore", BOOK, label);
    expect(group.aptOverridden).toBe(true);
    expect(group.aptBoundLabel).toBe("WP + KNOWLEDGE");

    // Специализация со своей привязкой: помечена переопределённой сама по себе,
    // даже если бы у группы записи не было.
    const clean = { system: {} };
    const spec  = aptBindingContext(clean, "skill", "scholasticLore", BOOK, label,
                                    entryAptitudeOverride({ aptitudes: ["int", "offence"] }));
    expect(spec.aptOverridden).toBe(true);
    expect(spec.aptBoundLabel).toBe("INT + OFFENCE");

    // А без своей — наследует пометку группы, потому что реально считается по ней.
    const inherited = aptBindingContext(actor, "skill", "scholasticLore", BOOK, label, null);
    expect(inherited.aptOverridden).toBe(true);
    expect(inherited.aptBound).toEqual(["wp", "knowledge"]);
  });

  it("isAptitudeBindingOverridden по-прежнему отвечает только про запись актора", () => {
    const actor = { system: {} };
    expect(isAptitudeBindingOverridden(actor, "skill", "scholasticLore")).toBe(false);
  });
});
