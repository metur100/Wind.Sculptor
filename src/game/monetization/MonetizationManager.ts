/**
 * Integration points for future monetisation. Nothing here talks to a real ad network or store:
 * the default providers report "not available", and the game is fully playable without them.
 *
 * To integrate later (e.g. AdMob / Google Play Billing via Capacitor plugins), implement
 * `AdProvider` and/or `PurchaseProvider` and pass them to `Monetization.configure()` at start-up.
 *
 * Products:
 *   remove-ads          one-time purchase, sets entitlements.removeAds
 *   pack-<id>           cosmetic particle packs (see PARTICLE_PACKS), adds to entitlements.particlePacks
 *   bonus-daily         unlocks a second daily level each day (entitlements.bonusDaily)
 * Rewarded placements:
 *   rewarded-hint       optional extra hint – the core game always offers free hints as well
 */

export type ProductId = 'remove-ads' | 'bonus-daily' | `pack-${string}`;

export interface AdProvider {
  isRewardedReady(placement: 'rewarded-hint'): boolean;
  /** Resolves true when the reward was earned. */
  showRewarded(placement: 'rewarded-hint'): Promise<boolean>;
}

export interface PurchaseProvider {
  /** Resolves true when the purchase completed. */
  purchase(product: ProductId): Promise<boolean>;
  restore(): Promise<ProductId[]>;
}

export interface Entitlements {
  removeAds: boolean;
  particlePacks: string[];
  bonusDaily: boolean;
}

/** Cosmetic particle packs that could be sold later. Purely visual – they never change physics. */
export const PARTICLE_PACKS = [
  { id: 'golden', name: 'Golden Hour', description: 'Warm metallic tints for every material' },
  { id: 'pastel', name: 'Pastel Dream', description: 'Soft candy colours' },
  { id: 'neon', name: 'Neon Night', description: 'Glowing outlines' },
] as const;

const unavailableAds: AdProvider = {
  isRewardedReady: () => false,
  showRewarded: async () => false,
};

const unavailableStore: PurchaseProvider = {
  purchase: async () => false,
  restore: async () => [],
};

class MonetizationManager {
  private ads: AdProvider = unavailableAds;
  private store: PurchaseProvider = unavailableStore;

  configure(providers: { ads?: AdProvider; store?: PurchaseProvider }): void {
    if (providers.ads) this.ads = providers.ads;
    if (providers.store) this.store = providers.store;
  }

  /** Should a "watch for a hint" option be offered? */
  rewardedHintAvailable(entitlements: Entitlements): boolean {
    return !entitlements.removeAds && this.ads.isRewardedReady('rewarded-hint');
  }

  showRewardedHint(): Promise<boolean> {
    return this.ads.showRewarded('rewarded-hint');
  }

  /** Applies a completed purchase to the entitlements (returns a new object). */
  async purchase(product: ProductId, entitlements: Entitlements): Promise<Entitlements> {
    const ok = await this.store.purchase(product);
    return ok ? applyProduct(entitlements, product) : entitlements;
  }

  async restore(entitlements: Entitlements): Promise<Entitlements> {
    const products = await this.store.restore();
    return products.reduce(applyProduct, entitlements);
  }
}

export function applyProduct(entitlements: Entitlements, product: ProductId): Entitlements {
  if (product === 'remove-ads') return { ...entitlements, removeAds: true };
  if (product === 'bonus-daily') return { ...entitlements, bonusDaily: true };
  const pack = product.slice('pack-'.length);
  return entitlements.particlePacks.includes(pack) ? entitlements : { ...entitlements, particlePacks: [...entitlements.particlePacks, pack] };
}

export const Monetization = new MonetizationManager();
