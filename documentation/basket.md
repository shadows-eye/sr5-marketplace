# Basket Service Reference

[← Back to Main Overview](./main.md)

`BasketService` manages player shopping baskets and shopping cart flags. It handles stock limits against Shop Actors, unique item validation (checking if the actor already possesses the unique item), rating recalculations, and availability codes summation.

The service is accessible via:
* `game.sr5marketplace.BasketService` (The `BasketService` class)

You can also instantiate a new service in custom scripts:
```javascript
const basketService = new game.sr5marketplace.BasketService();
```

---

## Instance Methods

### `getBasket(userId)`
Gets the entire basket state for a user, automatically merged with structural defaults. Localized values and prices are automatically synced if a Shop Actor context is loaded in the basket.
* **Parameters**:
  - `userId` (String, optional): User ID to query. Defaults to the current user if null.
* **Returns**: `Promise<object>` - Struct containing `basketUUID`, `shoppingCartItems`, `orderReviewItems`, and totals.

### `saveBasket(basket, userId)`
Saves the modified basket object to the user's persistent flags.
* **Parameters**:
  - `basket` (Object): The updated basket state.
  - `userId` (String, optional): The user ID. Defaults to current user if null.
* **Returns**: `Promise<User>`

### `addToBasket(itemUuid, actorUuid)`
Resolves and adds an item to the shopping cart, updating its default technology rating, cost, essence, and karma values according to rules and settings.
* **Parameters**:
  - `itemUuid` (String): UUID of the Item to add.
  - `actorUuid` (String): UUID of the Actor purchasing the item.
* **Returns**: `Promise<void>`

### `removeFromBasket(basketItemUuid)`
Removes an item instance from the shopping cart based on its unique cart identifier (`basket.xxxxxx`) and updates totals.
* **Parameters**:
  - `basketItemUuid` (String): The unique ID of the item instance in the cart.
* **Returns**: `Promise<void>`

### `updateItemQuantity(basketItemUuid, actorUuid, change)`
Increments or decrements an item's quantity in the basket.
* **Parameters**:
  - `basketItemUuid` (String): Unique basket item UUID.
  - `actorUuid` (String): Purchasing actor UUID.
  - `change` (Number): Quantity change (e.g. `+1` or `-1`).
* **Returns**: `Promise<void>`

### `updateItemProperty(basketItemUuid, property, value)`
Updates properties (such as selectedRating) on an item instance in the cart, cloning the source item dynamically to recalculate essence, cost, and availability variables.
* **Parameters**:
  - `basketItemUuid` (String)
  - `property` (String)
  - `value` (Any)
* **Returns**: `Promise<void>`

### `setSelectedContact(contactUuid)`
Sets a contact to act as the purchasing agent in the active shopping cart.
* **Parameters**:
  - `contactUuid` (String): UUID of the Contact item.
* **Returns**: `Promise<void>`

### `setShopActor(actorUuid)`
Sets the active shop context in the basket, binding custom inventory rules to the cart.
* **Parameters**:
  - `actorUuid` (String): UUID of the Shop Actor.
* **Returns**: `Promise<void>`

### `clearBasket(userId)`
Resets the basket flag for a user to its empty, default state.
* **Parameters**:
  - `userId` (String, optional): Defaults to current user.
* **Returns**: `Promise<void>`

---

## Code Examples

### Example 1: Querying the Cart Total
Use this macro to retrieve and display the current user's basket stats:

```javascript
const service = new game.sr5marketplace.BasketService();
const basket = await service.getBasket();

if (basket.shoppingCartItems.length === 0) {
    ui.notifications.info("Your shopping cart is empty.");
} else {
    ui.notifications.info(`Cart holds ${basket.shoppingCartItems.length} items. Total Cost: ${basket.totalCost}¥, Total Karma: ${basket.totalKarma}K`);
}
```

### Example 2: Selecting a Purchasing Agent
Use this script to assign a contact as the active purchasing agent in the basket:

```javascript
const character = game.user.character;
const contact = character?.items.find(i => i.type === "contact");

if (contact) {
    const service = new game.sr5marketplace.BasketService();
    await service.setSelectedContact(contact.uuid);
    ui.notifications.info(`Selected contact ${contact.name} as purchasing agent.`);
} else {
    ui.notifications.warn("No contact found on character.");
}
```
