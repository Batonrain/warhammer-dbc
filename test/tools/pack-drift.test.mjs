// Сторож обратного рассинхрона: исходники новее базы (wdbc-uozs).
//
// Проверяется то, чего не хватало 2026-09-05: `packs:unpack` извлекает базу
// поверх packs-src с clean:true, поэтому документ, которого в базе нет, из
// исходников исчезает молча. Тогда так пропали 45 файлов — ветка психосил
// «Мировой Певец» и Черта «Аура Смирения» лежали в исходниках и отсутствовали
// в собранном компендиуме.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { docsMissingInDb, docIdsIn } from "../../tools/pack-drift.mjs";

describe("docsMissingInDb: что пропало бы при извлечении", () => {
  it("документ есть в исходниках и нет в базе — он и пропал бы", () => {
    expect(docsMissingInDb(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });

  it("база полнее исходников — терять нечего, это нормальный случай", () => {
    // Правки, сделанные в игре: их unpack и должен снять в исходники.
    expect(docsMissingInDb(["a"], ["a", "b", "c"])).toEqual([]);
  });

  it("составы совпадают — пусто", () => {
    expect(docsMissingInDb(["a", "b"], ["b", "a"])).toEqual([]);
  });

  it("пустая база при непустых исходниках — пропало бы всё", () => {
    // Ровно этот случай и был у ветки «Мировой Певец»: в компендиуме её не
    // существовало вовсе.
    expect(docsMissingInDb(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("повторы в исходниках не задваивают отчёт", () => {
    expect(docsMissingInDb(["a", "a", "b"], [])).toEqual(["a", "b"]);
  });
});

describe("docIdsIn: состав каталога исходника", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dbc-drift-test-"));
  const write = (rel, data) => {
    const full = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(data), "utf8");
    return full;
  };

  it("собирает _id из вложенных папок и запоминает путь", () => {
    write("Оружие/Меч_abc.json", { _id: "abc", name: "Меч" });
    write("Оружие/Ветка/Копьё_def.json", { _id: "def", name: "Копьё" });
    const ids = docIdsIn(tmp);
    expect([...ids.keys()].sort()).toEqual(["abc", "def"]);
    expect(ids.get("abc")).toContain("Меч_abc.json");
  });

  it("папки считаются документами — их пропажа так же реальна", () => {
    write("Оружие/_Folder.json", { _id: "folder1", name: "Оружие" });
    expect([...docIdsIn(tmp).keys()]).toContain("folder1");
  });

  it("файл без _id и битый JSON пропускаются молча", () => {
    write("Оружие/Безымянный.json", { name: "нет id" });
    fs.writeFileSync(path.join(tmp, "Оружие", "Битый.json"), "{не json", "utf8");
    expect(() => docIdsIn(tmp)).not.toThrow();
    expect([...docIdsIn(tmp).keys()].sort()).toEqual(["abc", "def", "folder1"]);
  });

  it("несуществующий каталог — пусто, а не падение", () => {
    expect(docIdsIn(path.join(tmp, "нет-такого")).size).toBe(0);
  });
});
