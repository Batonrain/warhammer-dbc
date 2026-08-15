import { factionKeyFromName, getFactionIndex } from "../rules/factions.mjs";

export class WarhammerItem extends Item {
  prepareData() { super.prepareData(); }

  /**
   * Ключ Фракции выдаётся при создании и дальше не меняется.
   *
   * Руками его не пишут: на ключ ссылаются `parentKey` других Фракций и цели
   * Талантов, и правка ключа втихую разрывает эти ссылки. Поэтому поле на
   * листе только показывает результат, а заполняется он здесь — на любом пути
   * создания, включая импорт и создание прямо в компендиуме.
   *
   * Уже заданный ключ не трогаем: у копии и у импорта он свой и осмысленный.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (this.type !== "faction" || String(this.system?.key ?? "").trim()) return;
    this.updateSource({
      "system.key": factionKeyFromName(this.name, getFactionIndex().keys())
    });
  }
}
