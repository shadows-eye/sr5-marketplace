# SR5 Marketplace ↔ Shadows Creater History Integration Contract

This document defines the cross-module hook contract between **`sr5-marketplace`** and **`shadows-creater`** for recording completed equipment, augmentation, vehicle, and workshop/factory purchases in an actor's canonical `shadows-creater` history log (`flags.shadows-creater.history`).

---

## 1. Ownership & Lifecycle Responsibilities

- **`sr5-marketplace`** owns the full equipment/ware/vehicle shopping cart, credstick/nuyen/karma deduction, workshop/factory installation, and GM purchase review workflow:
  - `scripts/services/basketService.mjs` (`BasketService`)
  - `scripts/services/purchaseService.mjs` (`PurchaseService.submitForReview`, `PurchaseService.approveBasket`, `PurchaseService.directPurchase`)
  - `scripts/services/factoryFlow.mjs` (`FactoryFlow.installModification`)
  - `scripts/services/credstickService.mjs` (`CredstickService.deductCredstickFunds`)
  - `scripts/services/systemDataModel.mjs` (`systemDataModel.setNuyen`, `systemDataModel.setKarmaValue`)
- **`shadows-creater`** owns character creation and Level-Up advancement (`src/scripts/services/HistoryService.mjs`, `HistoryDataModel.mjs`, `DateService.mjs`, `ReviewService.mjs`).
  - Level-Up confirmation in `shadows-creater` (`ReviewService.approveLevelUp`) applies **only** incremental Level-Up deltas (attributes, skills, qualities, magic/adept/technomancer, contacts, lifestyles) and preserves all marketplace-owned embedded items (`weapon`, `armor`, `equipment`, `ammo`, `device`, `modification`, `cyberware`, `bioware`, `vehicle`).
  - `shadows-creater` **never** approves or modifies pending (`approved: false`) marketplace history entries during Level-Up confirmation.
- **Required Emission Rule**: Once a purchase or GM-approved order completes in `sr5-marketplace` (e.g., at the end of `PurchaseService.directPurchase(actor, basket, options)`, after `PurchaseService.approveBasket(userId, basketUUID)` succeeds, or after a paid workshop/factory installation), `sr5-marketplace` **must** emit:

```js
Hooks.callAll("sr5-marketplace.purchaseCompleted", payload);
```

with `approved: true`.

---

## 2. Hook Name & Expected `payload` Schema

Hook event: `"sr5-marketplace.purchaseCompleted"`  
Listener in `shadows-creater`: `HistoryService.registerMarketplaceIntegration()` (`src/scripts/services/HistoryService.mjs`)

### Payload TypeScript / JSDoc Shape

```ts
interface PurchaseCompletedPayload {
  /** Foundry Actor ID (preferred if available; falls back to actorUuid) */
  actorId?: string;
  /** Foundry Actor UUID (e.g., actor.uuid or basket.createdForActor) */
  actorUuid?: string;

  /** Purchased item summaries (used when `basket` / `factory` is omitted) */
  items?: Array<{
    name?: string;
    itemName?: string;
    uuid?: string;
    itemUuid?: string;
    cost?: number;
    karma?: number;
    buyQuantity?: number;
    quantity?: number;
    selectedRating?: number;
  }>;

  /** Total Nuyen spent (positive number; defaults to basket.totalCost ?? 0) */
  totalCost: number;
  /** Total Karma spent (positive number; defaults to basket.totalKarma ?? 0) */
  totalKarma?: number;

  /** Set true for workshop/factory builds or installations; false/omitted for standard purchases */
  isFactory?: boolean;
  /** Optional workshop/factory Actor UUID (also sets isFactory = true) */
  workshopActorUuid?: string;

  /**
   * Approval state for HistoryEntryDataModel.
   * MUST be `true` when emitted after directPurchase / approveBasket completes,
   * because unapproved (`approved: false`) entries are hidden from the Actor Sheet History tab.
   */
  approved: boolean;

  /** Optional full basket object (from PurchaseService / BasketService) */
  basket?: {
    basketUUID?: string;
    shopActorUuid?: string;
    paymentSourceUuid?: string;
    totalCost?: number;
    totalKarma?: number;
    basketItems?: Array<object>;
    shoppingCartItems?: Array<object>;
    [key: string]: unknown;
  };

  /** Optional workshop/factory build payload when `isFactory` is true */
  factory?: Record<string, unknown>;

  /**
   * Recommended in-game calendar snapshot captured at purchase completion.
   * When omitted, `HistoryService.logTransaction()` falls back to `DateService.getGameDateContext()`,
   * or reads top-level `worldTime` / `calendarComponents` if provided.
   */
  gameDate?: {
    isoDate: string;          // Canonical "YYYY-MM-DD" (1-based month & day)
    displayDate?: string;     // Localized display date, e.g. "DD.MM.YYYY"
    worldTime?: number | null; // `game.time.worldTime`
    calendarComponents?: {
      year: number;
      month: number;          // 0-based (0 = January .. 11 = December)
      day: number;            // 1-based (1..31)
      dayOfMonth: number;     // 0-based (0..30)
      hour?: number;
      minute?: number;
      second?: number;
    };
    source?: "simple-calendar" | "foundry-calendar" | "system-clock";
  };

  /** Optional top-level fallbacks if `gameDate` is not nested */
  worldTime?: number | null;
  calendarComponents?: Record<string, number>;
}
```

### Example Emission in `PurchaseService.directPurchase`

```js
// In scripts/services/purchaseService.mjs after payment deduction & item creation succeed:
Hooks.callAll("sr5-marketplace.purchaseCompleted", {
    actorId: actor.id,
    actorUuid: actor.uuid,
    items: basketItems.map(i => ({
        name: i.name,
        uuid: i.itemUuid,
        cost: Number(i.cost) || 0,
        karma: Number(i.karma) || 0,
        buyQuantity: Number(i.buyQuantity ?? i.quantity) || 1,
        selectedRating: i.selectedRating
    })),
    totalCost: Number(basket.totalCost) || 0,
    totalKarma: Number(basket.totalKarma) || 0,
    isFactory: false,
    approved: true,
    basket: {
        basketUUID: basket.basketUUID,
        shopActorUuid: basket.shopActorUuid,
        paymentSourceUuid: basket.paymentSourceUuid || "nuyen",
        totalCost: Number(basket.totalCost) || 0,
        totalKarma: Number(basket.totalKarma) || 0,
        basketItems: foundry.utils.deepClone(basketItems)
    },
    gameDate: resolveGameDateContext() // See Section 4
});
```

---

## 3. How `shadows-creater` Maps the Payload

`HistoryService.registerMarketplaceIntegration()` listens to `"sr5-marketplace.purchaseCompleted"` and calls `HistoryService.logTransaction(actor, ...)` which persists a validated `HistoryEntryDataModel` under `actor.flags["shadows-creater"].history`:

1. **Actor Resolution**: Resolves `data.actorId` via `game.actors.get(data.actorId)` or falls back to `data.actorUuid` via `fromUuidSync` / `fromUuid` (`resolved?.actor || resolved`), then resolves to the root world actor (`HistoryService.getRootActor(actor)`).
2. **Entry Name**: `"Workshop / Factory"` if `Boolean(data.isFactory || data.workshopActorUuid || data.factory)` is `true`, otherwise `"Marketplace Purchase"`.
3. **Costs & Balances**:
   - `costs`: `{ karma: -Math.abs(totalKarma), nuyen: -Math.abs(totalCost) }`
   - `adjustActor: false` — `shadows-creater` does **not** deduct Nuyen/Karma again, because `sr5-marketplace` has already mutated actor funds / credsticks prior to emitting the hook.
   - `objectChanged.from` / `objectChanged.to`: Reconstructs pre- and post-purchase `nuyen` (and `karma` when `totalKarma > 0`) from the actor's post-deduction `system.nuyen` and `system.karma.value`.
4. **Target & Date Preservation (`objectChanged.target`)**:
   - Base target is `data.basket || data.factory || { items: data.items || [], totalCost, totalKarma }`.
   - `gameDate` fields (`isoDate`, `displayDate` → `date`, `worldTime`, `calendarComponents`, `source`) and top-level `worldTime` / `calendarComponents` are preserved directly on `objectChanged.target`.
   - If `data.gameDate` is omitted, `HistoryService.logTransaction` automatically populates `isoDate`, `date`, `worldTime`, and `calendarComponents` via `DateService.getGameDateContext()`.
5. **Approval State**: `approved: Boolean(data.approved ?? false)`. Only `approved: true` entries are displayed by `HistoryService.getApprovedHistory(actor)` on the Actor Sheet's History tab.

---

## 4. Dual-Calendar Game-Date Resolution

To ensure `sr5-marketplace` and `shadows-creater` record identical calendar dates across all worlds, `sr5-marketplace` should resolve `gameDate` using the same priority order and 0-based/1-based normalization as `DateService.getGameDateContext()` (`src/scripts/services/DateService.mjs`):

1. **Simple Calendar (`SimpleCalendar.api.getCurrentDate()`)** — `source: "simple-calendar"`
   - `scDate.month` is **0-based** (`0..11`). Add `+ 1` when formatting `YYYY-MM-DD` and `DD.MM.YYYY`.
   - `scDate.day` is **1-based** (`1..31`). Normalize `dayOfMonth = Math.max(0, day - 1)`.
   - `displayDate`: `scDate.display?.date || "${dd}.${mm}.${yyyy}"`.
   - `worldTime`: `Number(game.time.worldTime)` when finite, else `null`.
2. **Foundry v14 Built-In Calendar (`game.time.calendar`)** — `source: "foundry-calendar"`
   - Read components via `calendar.timeToComponents?.(game.time.worldTime ?? 0) || game.time.components`.
   - `year = (calendar.years?.yearZero ?? 0) + Number(comp.year ?? 0)`.
   - `comp.month` is **0-based** (`0..11`); add `+ 1` for `isoDate`/`displayDate`.
   - `comp.dayOfMonth` is **0-based** (`0..30`); compute `day = Number(comp.dayOfMonth ?? 0) + 1` for `isoDate`/`displayDate`.
   - Store `{ year, month, day, dayOfMonth, hour, minute, second }` in `calendarComponents`.
3. **System Clock Fallback (`new Date()`)** — `source: "system-clock"`
   - `year = now.getFullYear()`, `month = now.getMonth()` (0-based), `day = now.getDate()` (1-based), `dayOfMonth = Math.max(0, day - 1)`.

> **Important off-by-one guard:** Foundry v14 `calendar.timeToComponents()` returns **0-based** `month` and **0-based** `dayOfMonth`, whereas `SimpleCalendar.api.getCurrentDate()` returns **0-based** `month` and **1-based** `day`. Always normalize both into `{ month (0-based), day (1-based), dayOfMonth (0-based) }` and format `isoDate` as `YYYY-(month+1)-day` (`1`-based month and day).
