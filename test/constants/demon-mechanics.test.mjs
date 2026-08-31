// test/constants/demon-mechanics.test.mjs
//
// wdbc-l07y: «Кхорн ненавидит колдовство» жила тремя отдельными копиями в
// module/sheets/daemon-sheet.mjs (context.daemon.canPsyker, дефолт isPsyker
// у preCreateActor, сброс isPsyker в updateActor при смене Покровительства) —
// теперь одно поле canPsyker:false у Кхорна в DEMON_ALLEGIANCES, все три места
// читают allegianceMeta(key).canPsyker.

import { describe, it, expect } from "vitest";
import { DEMON_ALLEGIANCES, allegianceMeta } from "../../module/constants/demon-mechanics.mjs";

describe("allegianceMeta().canPsyker", () => {
  it("Кхорн — canPsyker:false", () => {
    expect(allegianceMeta("khorne").canPsyker).toBe(false);
  });

  it("остальные Боги и Неделимый — не false (псайкеры разрешены)", () => {
    for (const key of ["undivided", "nurgle", "tzeentch", "slaanesh"]) {
      expect(allegianceMeta(key).canPsyker).not.toBe(false);
    }
  });

  it("неизвестный ключ падает на Неделимого — псайкеры разрешены", () => {
    expect(allegianceMeta("не-бог").canPsyker).not.toBe(false);
  });

  it("ровно один Бог в реестре запрещает псайкеров", () => {
    const forbidding = DEMON_ALLEGIANCES.filter(a => a.canPsyker === false).map(a => a.key);
    expect(forbidding).toEqual(["khorne"]);
  });
});
