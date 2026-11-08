import { onWastelandEnter } from "../combat/plague-marine.mjs";

export const WASTELAND_ZONE_TYPE = "wastelandZone";

export class WastelandZoneBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      carrierUuid: new fields.StringField({ required: true, initial: "" }),
      diseaseId: new fields.StringField({ required: true, initial: "" }),
      expiresAt: new fields.NumberField({ required: true, initial: 0 }),
      tested: new fields.ObjectField({ required: true, initial: {} })
    };
  }

  static async #onEnter(event) {
    if (!game.user.isGM) return;
    const token = event.data?.token;
    if (!token?.actor || this.tested?.[token.id]) return;
    await this.behavior.update({ [`system.tested.${token.id}`]: true });
    await onWastelandEnter(this, token, this.region?.name);
  }

  /** @override */
  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: this.#onEnter
  };
}
