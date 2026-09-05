# Basket Service Reference

[← Back to Main Overview](./main.md)

`BasketService` manages player shopping baskets and shopping cart flags. It handles stock limits against Shop Actors, unique item validation (checking if the actor already possesses the unique item), rating recalculations, availability codes summation, and payment source tracking (Nuyen cash or Credstick items).

The service is accessible via:
* `game.sr5marketplace.BasketService` (The `BasketService` class)

You can also instantiate a new service in custom scripts:
```javascript
const basketService = new game.sr5marketplace.BasketService();
```

---

## Basket State Structure

The basket object stored in the user flag contains the following key properties:

* `basketUUID` (String): Unique identifier for the basket session.
* `createdForActor` (String|null): UUID of the purchasing Actor document.
* `selectedContactUuid` (String|null): UUID of the selected purchasing agent (Contact).
* `shopActorUuid` (String|null): UUID of the active Shop Actor providing stock and prices.
* `paymentSourceUuid` (String): Selected payment source (`"nuyen"` for cash or UUID of a Credstick item on the actor).
* `shoppingCartItems` (Array<Object>): Array of item instances currently in the active cart.
* `orderReviewItems` (Array<Object>): Array of submitted purchase requests waiting for GM review.
* `totalCost` (Number): Total cost in Nuyen (¥).
* `totalKarma` (Number): Total Karma cost.
* `totalEssenceCost` (Number): Total Essence cost.
* `totalAvailability` (String): Combined availability rating code (e.g. `"12R"`).

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

### `addToBasket(itemUuid, actorUuid, userId, options)`
Resolves and adds an item to the shopping cart, updating its default technology rating, cost, essence, and karma values according to rules and settings.
* **Parameters**:
  - `itemUuid` (String): UUID of the Item to add.
  - `actorUuid` (String): UUID of the Actor purchasing the item.
  - `userId` (String, optional): User ID. Defaults to current user.
  - `options` (Object, optional): Custom override parameters.
* **Returns**: `Promise<void>`

### `removeFromBasket(basketItemUuid, userId)`
Removes an item instance from the shopping cart based on its unique cart identifier (`basket.xxxxxx`) and updates totals.
* **Parameters**:
  - `basketItemUuid` (String): The unique ID of the item instance in the cart.
  - `userId` (String, optional): User ID.
* **Returns**: `Promise<void>`

### `updateItemQuantity(basketItemUuid, actorUuid, change, userId)`
Increments or decrements an item's quantity in the basket.
* **Parameters**:
  - `basketItemUuid` (String): Unique basket item UUID.
  - `actorUuid` (String): Purchasing actor UUID.
  - `change` (Number): Quantity change (e.g. `+1` or `-1`).
  - `userId` (String, optional): User ID.
* **Returns**: `Promise<void>`

### `updateItemProperty(basketItemUuid, property, value, userId)`
Updates properties (such as selectedRating) on an item instance in the cart, cloning the source item dynamically to recalculate essence, cost, and availability variables.
* **Parameters**:
  - `basketItemUuid` (String): Unique basket item UUID.
  - `property` (String): Dot-notation path of property to update.
  - `value` (Any): New value.
  - `userId` (String, optional): User ID.
* **Returns**: `Promise<void>`

### `setSelectedContact(contactUuid, userId)`
Sets a contact to act as the purchasing agent in the active shopping cart.
* **Parameters**:
  - `contactUuid` (String): UUID of the Contact item.
  - `userId` (String, optional): User ID.
* **Returns**: `Promise<void>`

### `setShopActor(actorUuid, userId)`
Sets the active shop context in the basket, binding custom inventory rules and prices to the cart.
* **Parameters**:
  - `actorUuid` (String): UUID of the Shop Actor.
  - `userId` (String, optional): User ID.
* **Returns**: `Promise<void>`

### `setPaymentSource(paymentSourceUuid, userId)`
Updates the selected payment source in the user's active shopping cart flag (`"nuyen"` for cash or UUID of a Credstick item document). See [credstick.md](./credstick.md) for credstick validation and balance management.
* **Parameters**:
  - `paymentSourceUuid` (String): UUID of the Credstick item on the purchasing actor, or `"nuyen"` for cash.
  - `userId` (String, optional): User ID. Defaults to current user.
* **Returns**: `Promise<void>`

### `clearBasket(userId)`
Resets the basket flag for a user to its empty, default state.
* **Parameters**:
  - `userId` (String, optional): Defaults to current user.
* **Returns**: `Promise<void>`

---

## Code Examples

### Example 1: Querying Cart Total & Payment Source
Use this macro to retrieve and display the current user's shopping cart stats and active payment method:

```javascript
const service = new game.sr5marketplace.BasketService();
const basket = await service.getBasket();

if (basket.shoppingCartItems.length === 0) {
    ui.notifications.info("Your shopping cart is empty.");
} else {
    const paymentSource = basket.paymentSourceUuid === "nuyen" ? "Cash (Nuyen)" : `Credstick (${basket.paymentSourceUuid})`;
    ui.notifications.info(`Cart holds ${basket.shoppingCartItems.length} items. Total: ${basket.totalCost}¥. Payment Source: ${paymentSource}`);
}
```

### Example 2: Selecting a Credstick as Payment Source
Use this script to find a Credstick item in a character's inventory and set it as the payment method for the active basket:

```javascript
const character = game.user.character;
const credstick = character?.items.find(i => i.flags?.["sr5-marketplace"]?.credstick === true);

if (credstick) {
    const service = new game.sr5marketplace.BasketService();
    await service.setPaymentSource(credstick.uuid);
    ui.notifications.info(`Selected ${credstick.name} as payment source.`);
} else {
    ui.notifications.warn("No credstick found in character inventory.");
}
```
