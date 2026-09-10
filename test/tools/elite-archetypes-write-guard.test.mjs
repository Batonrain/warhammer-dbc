// test/tools/elite-archetypes-write-guard.test.mjs
//
// wdbc-b6fd (08.09.2026): elite-archetypes-to-pack.mjs --write разошёлся с
// packs-src/elite-archetypes — генератор знает 58 архетипов, а пак несёт уже
// 88 (30 добавлены помимо него); arch.name — только русская половина, а
// карточки пака названы двуязычно («Insorcist / Инзорцист») —
// packFileName(arch.name, id) строит ДРУГОЙ путь у 57 из 58, --write создал
// бы дубли документов с тем же _id; doc.system.description здесь всегда ""
// — у 56 из 88 карточек оно непустое (перенесено из книги вручную), --write
// бы его стёрло. run({write:true}) без --force теперь отказывает.
//
// node:fs замокан на весь файл — иначе force:true реально писал бы в
// packs-src/elite-archetypes и воспроизводил бы саму находку.

import { describe, it, expect, vi, beforeEach } from "vitest";

const fsMock = vi.hoisted(() => ({ mkdirSync: vi.fn(), writeFileSync: vi.fn() }));
vi.mock("node:fs", () => fsMock);

import { run } from "../../tools/elite-archetypes-to-pack.mjs";

beforeEach(() => {
  fsMock.mkdirSync.mockClear();
  fsMock.writeFileSync.mockClear();
});

describe("elite-archetypes-to-pack.mjs — --write остановлен до починки генератора", () => {
  it("write:true без force — бросает с упоминанием тикета, ничего не пишет", () => {
    expect(() => run({ write: true })).toThrow(/wdbc-b6fd/);
    expect(fsMock.writeFileSync).not.toHaveBeenCalled();
  });

  it("write:true с force:true — не бросает, пишет как раньше", () => {
    expect(() => run({ write: true, force: true })).not.toThrow();
    expect(fsMock.writeFileSync).toHaveBeenCalled();
  });

  it("без write (по умолчанию) — не бросает и не требует force, ничего не пишет", () => {
    expect(() => run()).not.toThrow();
    expect(() => run({ write: false })).not.toThrow();
    expect(fsMock.writeFileSync).not.toHaveBeenCalled();
  });
});
