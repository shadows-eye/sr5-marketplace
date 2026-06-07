# In-Game Marketplace API & UI Reference

[← Back to Main Overview](./main.md)

The In-Game Marketplace provides the main storefront interface, actor selection, and purchase flow integration for players and GMs. 

Programmatic control is handled via two primary interfaces:
1. `game.sr5marketplace.api.inGameMarketplace` - The modern `ApplicationV2` class for direct UI lifecycle management.
2. `game.sr5marketplace.api.marketplace` - A convenience API instance wrapper containing helper methods for shopping cart, basket, and actor state management. *(Note: This namespace is maintained for backwards compatibility. Developer integrations should prioritize using the primary service and UI classes directly).*

---

## 1. UI Class: `inGameMarketplace`

### Constructor Options
When creating a new instance of the marketplace, you can configure it via its constructor options:

```javascript
const app = new game.sr5marketplace.api.inGameMarketplace({
    shopActorUuid: "Actor.xyz123abc456", // UUID of the Shop Actor to open (optional)
    initialSearchTerm: "pistol"           // Initial search string to pre-filter items (optional)
});
```

* **`shopActorUuid`**: (String, optional) If provided, the marketplace opens as a shop window showing the specified Shop Actor's customized inventory and prices. If omitted, it defaults to **Global Mode** (showing all items across compendiums and world items) or automatically detects if the purchasing actor is inside a Shop Region on the canvas.
* **`initialSearchTerm`**: (String, optional) Pre-populates the live search filter in the shop.

### Instance Methods

* **`render(force, options)`**: Standard Foundry ApplicationV2 rendering method.
* **`close(options)`**: Closes the application sheet.

---

## 2. Operations Wrapper API: `inGameMarketplaceAPI`

The methods below are exposed on the legacy/compatibility helper instance `game.sr5marketplace.api.marketplace`.

### Method Summary

#### `open(options)`
Opens the main Marketplace window.
* **Parameters**:
  - `options` (Object):
    - `options.actorUuid` (String): Pre-selects a character Actor.
    - `options.itemUuid` (String): Automatically adds this item to the basket (requires `actorUuid`).
* **Returns**: `Promise<void>`

#### `close()`
Closes the marketplace window if it is currently open.
* **Returns**: `Promise<void>`

#### `addItem(itemUuid, actorUuid, options)`
Adds an item to the shopping basket.
* **Parameters**:
  - `itemUuid` (String): UUID of the Item.
  - `actorUuid` (String): UUID of the Actor purchasing the item.
  - `options` (Object, optional):
    - `options.userId` (String): The ID of the user whose basket the item should be added to (defaults to current user).
* **Returns**: `Promise<void>`

#### `setActor(actorUuid)`
Sets the active purchasing actor and updates the marketplace UI.
* **Parameters**:
  - `actorUuid` (String): Actor UUID.
* **Returns**: `Promise<void>`

#### `clearActor()`
Clears the active actor selection.
* **Returns**: `Promise<void>`

#### `getBasket()`
Gets the current user's basket items.
* **Returns**: `Promise<Array<object>>`

#### `remove(basketItemUuid)`
Removes an item from the basket.
* **Parameters**:
  - `basketItemUuid` (String): The unique ID of the item instance in the cart (`basket.xxxxxx`).
* **Returns**: `Promise<void>`

#### `submitForReview(userId)`
Submits the active basket for GM review.
* **Parameters**:
  - `userId` (String): ID of the user.
* **Returns**: `Promise<void>`

#### `rejectBasket(userId, basketUUID)`
Rejects a pending purchase request.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
* **Returns**: `Promise<void>`

#### `approveBasket(userId, basketUUID)`
Approves a pending purchase request and deduces resources.
* **Parameters**:
  - `userId` (String)
  - `basketUUID` (String)
* **Returns**: `Promise<void>`

---

## Code Examples

### Example 1: Opening a Shop Programmatically
Use this macro to open a specific shop for a player:

```javascript
const shopActor = game.actors.getName("Ares Weapons Depot");
if (shopActor) {
    const marketplace = new game.sr5marketplace.api.inGameMarketplace({
        shopActorUuid: shopActor.uuid
    });
    marketplace.render(true);
}
```

### Example 2: Programmatically Modifying a Cart
Use this macro to add an item directly to the current user's shopping basket:

```javascript
const character = game.user.character;
const itemUuid = "Compendium.sr5e-equipment.Equipment.xyz123";

if (character) {
    // Legacy API convenience call
    await game.sr5marketplace.api.marketplace.addItem(itemUuid, character.uuid);
    ui.notifications.info("Item added to basket!");
} else {
    ui.notifications.warn("Please assign a character to your user.");
}
```
