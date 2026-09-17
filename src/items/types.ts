export type SharedItemCategory = "attack" | "defense" | "utility";

export interface SharedItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly category: SharedItemCategory;
  readonly description: string;
  readonly consumable: boolean;
}

export type ItemInventory<ItemId extends string> = Readonly<Partial<Record<ItemId, number>>>;

export interface ItemStack<ItemId extends string> {
  readonly itemId: ItemId;
  readonly quantity: number;
}

/**
 * A shared item has one account identity, but each concrete game decides what that
 * item means inside its own rules. Effect objects intentionally live outside the
 * shared item catalog so the item layer never imports a concrete game.
 */
export type GameItemEffects<ItemId extends string, Effect> = Readonly<Partial<Record<ItemId, Effect>>>;
