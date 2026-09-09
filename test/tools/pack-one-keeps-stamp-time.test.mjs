// test/tools/pack-one-keeps-stamp-time.test.mjs
//
// Точечная сборка/распаковка пака обновляет в .pack-stamp ОТПЕЧАТКИ, но не
// время. tools/pack.mjs отсеивает паки по времени ДО того, как считать
// отпечатки (см. там же: «дата осталась быстрым предфильтром»), поэтому
// поднятое до «сейчас» время выводит из-под подозрения ЛЮБОЙ другой пак,
// который правили в игре раньше, — и следующий общий packs:build снесёт его
// базу молча. Ровно от этого сценария _pack-one и заведён.
//
// Проверяется по исходнику: чистые stampAfterPack*/stampAfterUnpack возвращают
// только отпечатки, а первый аргумент writeStamp живёт в самом инструменте и
// ни одним из 15 их кейсов не виден.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

describe("точечная сборка пака не двигает время общей отметки", () => {
  for (const tool of ["tools/_pack-one.mjs", "tools/_unpack-one.mjs"]) {
    it(`${tool} зовёт writeStamp с прежним временем`, () => {
      const src = fs.readFileSync(path.join(root, tool), "utf8");
      const call = src.match(/writeStamp\(([^)]*)\)/);
      expect(call, `${tool}: вызова writeStamp нет вовсе`).toBeTruthy();
      expect(call[1], `${tool}: время отметки поднято до «сейчас»`)
        .not.toMatch(/^\s*Date\.now\(\)/);
      expect(call[1], `${tool}: время должно браться из прочитанной отметки`)
        .toMatch(/stamp/);
    });
  }
});
