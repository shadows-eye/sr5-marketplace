# Purchase Service Reference

[← Back to Main Overview](./main.md)

`PurchaseService` provides the backend workflow logic for submits, reviews, rejections, approvals, and resource updates. It handles GM approval workflows, posts confirmation cards to the chat log (or Smartphone app), and manages resource deduction (Nuyen cash, Karma, and Credstick balances) on purchasing characters.

The service is accessible via:
* `game.sr5marketplace.PurchaseService` (The `PurchaseService` class)

---

## Static Methods

### `getPendingRequestCount()`
Returns the total count of pending purchase requests waiting for GM review across all players. Only returns values for GMs.
* **Returns**: `Number`

### `getAllPendingRequests()`
Retrieves an array of all pending purchase requests across all players. Only returns data for GM accounts. Automatically resolves payment source names (e.g. `"Nuyen (Cash)"` or the specific Credstick item name).
* **Returns**: `Promise<Array<object>>` - Returns array of request objects with `{ user, basket, actor }` properties, where `basket.paymentSourceName` contains the formatted payment method label.

### `submitForReview(userId)`
Submits the active shopping cart for a user to the GM's review queue, clears their active shopping cart fields, preserves test states and payment source, and posts a review request card to the chat log.
* **Parameters**:
  - `userId` (String): ID of the user submitting the request.
* **Returns**: `Promise<void>`

### `updatePendingItem(userId, basketUUID, basketItemUuid, property, value)`
Updates properties (such as cost, selectedRating, or buyQuantity overrides) on a pending item inside the GM review queue and automatically recalculates cart totals in real-time. Enforces a minimum rating floor (`effectiveRating >= 1`) for rating 0 item configurations.
* **Parameters**:
  - `userId` (String): User ID.
  - `basketUUID` (String): Basket UUID.
  - `basketItemUuid` (String): Basket item instance UUID.
  - `property` (String): Dot-notation property path (e.g. `'cost'`, `'selectedRating'`).
  - `value` (Any): New value.
* **Returns**: `Promise<void>`

### `rejectItemFromRequest(userId, basketUUID, basketItemUuid)`
Rejects and removes a single item from a player's pending purchase request, recalculates request totals, and posts a rejection notification to the chat or Smartphone app.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
  - `basketItemUuid` (String)
* **Returns**: `Promise<void>`

### `rejectBasket(userId, basketUUID)`
Rejects and removes an entire pending request from the queue, notifies the player via sockets, and posts a rejection summary card to the chat or Smartphone app.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
* **Returns**: `Promise<void>`

### `approveBasket(userId, basketUUID)`
Approves a pending request, triggers character inventory creation or vehicle actor spawning, deducts resources (cash, Karma, or Credstick balance via `CredstickService`), and removes the approved request from the queue. Automatically bypasses money overrule setting requirements when GM approval workflow is disabled.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
* **Returns**: `Promise<void>`

### `directPurchase(actor, basket, options)`
Directly executes the purchase transaction. Validates payment resources (Nuyen cash, Karma, or Credstick balance via `CredstickService`), deducts totals from the actor or credstick item (`CredstickService.deductCredstickFunds`), clones compendium item schemas onto the actor (or creates vehicle actors), and renders a chat/smartphone confirmation card. Resolves human-readable payment source names (e.g. `"Nuyen (Cash)"` vs Credstick item label).
* **Parameters**:
  - `actor` (Actor): The purchasing actor document.
  - `basket` (Object): The basket or request details object.
  - `options` (Object, optional):
    - `options.userName` (String): Name of the purchaser.
* **Returns**: `Promise<boolean>` - `true` if the transaction succeeded, `false` otherwise.

---

## Payment & Credstick Deductions

When executing a purchase via `directPurchase`:

1. **Credstick Payment**:
   - If `basket.paymentSourceUuid` points to a Credstick item on the actor (UUID != `"nuyen"`):
     - Resolves the Credstick item on the actor using `CredstickService.getCredstickData(item)`.
     - Validates that `credData.currentValue >= basket.totalCost` (unless GM overrule is enabled via `allowGmOverruleMoney`).
     - Calls `CredstickService.deductCredstickFunds(credItem, basket.totalCost)` to deduct the purchase cost directly from the credstick's balance flag.
     - Deducts any required Karma from `actor.system.karma.value`.
2. **Nuyen Cash Payment**:
   - If `paymentSourceUuid` is `"nuyen"` (or credstick is invalid/unselected):
     - Validates that `actor.system.nuyen >= basket.totalCost` (unless GM overrule is enabled).
     - Deducts cost from `actor.system.nuyen` and Karma from `actor.system.karma.value`.

---

## Code Examples

### Example 1: Direct Purchase Macro with Credstick Payment
Use this macro to purchase items directly for a character using a Credstick as the payment source:

```javascript
const character = game.user.character;
if (!character) {
    ui.notifications.warn("Please select a character.");
} else {
    // Find a credstick in the character's inventory
    const credstick = character.items.find(i => i.flags?.["sr5-marketplace"]?.credstick === true);
    
    const basketData = {
        paymentSourceUuid: credstick ? credstick.uuid : "nuyen",
        totalCost: 1500,
        totalKarma: 0,
        totalEssenceCost: 0,
        totalAvailability: "4R",
        basketItems: [
            {
                itemUuid: "Compendium.sr5e-equipment.Equipment.xyz123",
                buyQuantity: 2,
                cost: 750,
                selectedRating: 1
            }
        ]
    };

    const success = await game.sr5marketplace.PurchaseService.directPurchase(character, basketData, {
        userName: game.user.name
    });

    if (success) {
        ui.notifications.info(`Purchase completed successfully using ${credstick ? credstick.name : "Nuyen Cash"}!`);
    }
}
```

### Example 2: GM Approve All Pending Orders
Use this GM macro to approve all pending purchase requests in the game session instantly:

```javascript
if (!game.user.isGM) {
    ui.notifications.error("This is a GM-only macro.");
} else {
    const PurchaseService = game.sr5marketplace.PurchaseService;
    const pending = await PurchaseService.getAllPendingRequests();
    
    if (pending.length === 0) {
        ui.notifications.info("No pending purchase requests.");
    } else {
        for (const req of pending) {
            console.log(`Approving basket ${req.basket.basketUUID} for user ${req.user.name} (Payment: ${req.basket.paymentSourceName})`);
            await PurchaseService.approveBasket(req.user._id, req.basket.basketUUID);
        }
        ui.notifications.info(`Approved ${pending.length} baskets.`);
    }
}
```
