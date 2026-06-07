# Purchase Service Reference

[← Back to Main Overview](file:///home/shadow/Documents/GitHub/sr5-marketplace/documentation/main.md)

`PurchaseService` provides the backend workflow logic for submits, reviews, rejections, approvals, and resource updates. It handles GM approval workflows, posts confirmation cards to the chat log, and manages resource deduction (Nuyen/Karma) on purchasing characters.

The API is accessible via:
* `game.sr5marketplace.api.PurchaseService` (The `PurchaseService` class)
* `game.sr5marketplace.PurchaseService` (Backward compatibility namespace)

---

## Static Methods

### `getPendingRequestCount()`
Returns the total count of pending purchase requests waiting for GM review across all players. Only returns values for GMs.
* **Returns**: `Number`

### `getAllPendingRequests()`
Retrieves an array of all pending purchase requests across all players. Only returns data for GM accounts.
* **Returns**: `Promise<Array<object>>` - Returns array of requests with `{ user, basket, actor }` properties.

### `submitForReview(userId)`
Submits the active shopping cart for a user to the GM's review queue, clears their active shopping cart fields, and posts a review request card to the chat log.
* **Parameters**:
  - `userId` (String): ID of the user submitting the request.
* **Returns**: `Promise<void>`

### `updatePendingItem(userId, basketUUID, basketItemUuid, property, value)`
Updates properties (such as price, rating, or count overrides) on a pending item inside the review queue and recalculates cart totals.
* **Parameters**:
  - `userId` (String): User ID.
  - `basketUUID` (String): Basket UUID.
  - `basketItemUuid` (String): Basket item instance UUID.
  - `property` (String): Dot-notation property path (e.g. `'cost'`, `'selectedRating'`).
  - `value` (Any): New value.
* **Returns**: `Promise<void>`

### `rejectItemFromRequest(userId, basketUUID, basketItemUuid)`
Rejects and removes a single item from a player's pending purchase request and posts a rejection notification to the chat.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
  - `basketItemUuid` (String)
* **Returns**: `Promise<void>`

### `rejectBasket(userId, basketUUID)`
Rejects and removes an entire pending request from the queue, notifies the player via sockets, and post a rejection summary card to the chat.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
* **Returns**: `Promise<void>`

### `approveBasket(userId, basketUUID)`
Approves a pending request, triggers character inventory creation, deducts resources, and clears the review queue slot.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
* **Returns**: `Promise<void>`

### `directPurchase(actor, basket, options)`
Directly executes the purchase transaction. Validates resources (Nuyen and Karma), deducts the totals from the character document, clones compendium item schemas onto the actor, and renders a chat confirmation card.
* **Parameters**:
  - `actor` (Actor): The purchasing actor document.
  - `basket` (Object): The basket or request details object.
  - `options` (Object, optional):
    - `options.userName` (String): Name of the purchaser.
* **Returns**: `Promise<boolean>` - `true` if the transaction succeeded, `false` otherwise.

---

## Code Examples

### Example 1: Direct Purchase Macro (Skipping GM Approval)
Use this macro to purchase items directly for a character immediately:

```javascript
const character = game.user.character;
if (!character) {
    ui.notifications.warn("Please select a character.");
} else {
    const basketData = {
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

    const success = await game.sr5marketplace.api.PurchaseService.directPurchase(character, basketData, {
        userName: game.user.name
    });

    if (success) {
        ui.notifications.info("Purchase completed successfully!");
    }
}
```

### Example 2: GM Approve All Pending Orders
Use this GM macro to approve all pending purchase requests in the game session instantly:

```javascript
if (!game.user.isGM) {
    ui.notifications.error("This is a GM-only macro.");
} else {
    const PurchaseService = game.sr5marketplace.api.PurchaseService;
    const pending = await PurchaseService.getAllPendingRequests();
    
    if (pending.length === 0) {
        ui.notifications.info("No pending purchase requests.");
    } else {
        for (const req of pending) {
            console.log(`Approving basket ${req.basket.basketUUID} for user ${req.user.name}`);
            await PurchaseService.approveBasket(req.user._id, req.basket.basketUUID);
        }
        ui.notifications.info(`Approved ${pending.length} baskets.`);
    }
}
```
