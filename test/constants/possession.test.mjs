// test/constants/possession.test.mjs
//
// module/constants/possession.mjs — Одержимый (DoomBC_Core, стр. 129-132):
// демоны Двойного Духа, таблица Проявления по Cor, каталоги Даров/Талантов.

import { describe, it, expect } from "vitest";
import {
  TWIN_SPIRIT_DEMONS, TWIN_SPIRIT_MAP, twinSpiritMeta,
  MANIFEST_TABLE, manifestProfile,
  POSSESSION_GIFTS, POSSESSION_TALENTS
} from "../../module/constants/possession.mjs";

describe("twinSpiritMeta", () => {
  it("подмешивает цвет/сигил/лейбл бога-патрона демона", () => {
    const meta = twinSpiritMeta("bloodletter");
    expect(meta.key).toBe("bloodletter");
    expect(meta.godLabel).toBeTruthy();
    expect(meta.color).toBeTruthy();
    expect(meta.sigil.startsWith("systems/warhammer-dbc/assets/")).toBe(true);
  });

  it("неизвестный ключ демона — откатывается на Катарта (Undivided)", () => {
    const meta = twinSpiritMeta("no-such-demon");
    expect(meta.key).toBe("katart");
  });
});

describe("MANIFEST_TABLE / manifestProfile", () => {
  it("покрывает весь диапазон Cor 0-100 без дыр и наложений", () => {
    for (let cor = 0; cor <= 100; cor++) {
      const p = manifestProfile(cor);
      expect(p).toBeTruthy();
      if (cor >= 1) expect(cor).toBeGreaterThanOrEqual(p.min);
      expect(cor).toBeLessThanOrEqual(p.max);
    }
  });

  it("Cor 0 и отрицательные/нечисловые значения — клампятся на первую полосу", () => {
    expect(manifestProfile(0)).toBe(MANIFEST_TABLE[0]);
    expect(manifestProfile(-50)).toBe(MANIFEST_TABLE[0]);
    expect(manifestProfile(undefined)).toBe(MANIFEST_TABLE[0]);
    expect(manifestProfile("не число")).toBe(MANIFEST_TABLE[0]);
  });

  it("Cor выше 100 — клампится на последнюю полосу", () => {
    expect(manifestProfile(150)).toBe(MANIFEST_TABLE[MANIFEST_TABLE.length - 1]);
  });

  it("границы полос стыкуются встык (max одной = min-1 следующей)", () => {
    for (let i = 0; i < MANIFEST_TABLE.length - 1; i++) {
      expect(MANIFEST_TABLE[i + 1].min).toBe(MANIFEST_TABLE[i].max + 1);
    }
  });

  it("daemonic/fear/unnaturalS/gifts растут монотонно по полосам", () => {
    for (let i = 1; i < MANIFEST_TABLE.length; i++) {
      expect(MANIFEST_TABLE[i].daemonic).toBeGreaterThanOrEqual(MANIFEST_TABLE[i - 1].daemonic);
      expect(MANIFEST_TABLE[i].unnaturalS).toBeGreaterThanOrEqual(MANIFEST_TABLE[i - 1].unnaturalS);
      expect(MANIFEST_TABLE[i].gifts).toBeGreaterThanOrEqual(MANIFEST_TABLE[i - 1].gifts);
    }
  });
});

describe("TWIN_SPIRIT_DEMONS / TWIN_SPIRIT_MAP", () => {
  it("ровно 5 демонов, все ключи уникальны и есть в карте", () => {
    expect(TWIN_SPIRIT_DEMONS).toHaveLength(5);
    const keys = TWIN_SPIRIT_DEMONS.map(d => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(TWIN_SPIRIT_MAP[k]).toBeTruthy();
  });
});

describe("POSSESSION_GIFTS", () => {
  it("у каждого Дара валидная цена и группа, имена внутри группы не повторяются", () => {
    const seenByGroup = {};
    for (const g of POSSESSION_GIFTS) {
      expect(g.cost).toBeGreaterThanOrEqual(0);
      expect(g.group).toBeTruthy();
      expect(g.name).toBeTruthy();
      const bucket = (seenByGroup[g.group] ??= new Set());
      expect(bucket.has(g.name)).toBe(false);
      bucket.add(g.name);
    }
  });

  it("ни в одной группе нет двух Базовых Даров (cost:0) сразу", () => {
    const groups = [...new Set(POSSESSION_GIFTS.map(g => g.group))];
    for (const group of groups) {
      const free = POSSESSION_GIFTS.filter(g => g.group === group && g.cost === 0);
      expect(free.length, `группа «${group}»`).toBeLessThanOrEqual(1);
    }
  });
});

describe("POSSESSION_TALENTS", () => {
  it("названия уникальны, у каждого есть уровень и требование", () => {
    const names = POSSESSION_TALENTS.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of POSSESSION_TALENTS) {
      expect(t.level).toBeGreaterThanOrEqual(1);
      expect(t.req).toBeTruthy();
      expect(t.text).toBeTruthy();
    }
  });
});
