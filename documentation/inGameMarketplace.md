# In-Game Marketplace API & UI Reference

[← Back to Main Overview](./main.md)

The In-Game Marketplace provides the main storefront interface, actor selection, and purchase flow integration for players and GMs. 

Programmatic control is handled via:
* `game.sr5marketplace.inGameMarketplace` - The modern `ApplicationV2` class for direct UI lifecycle management.

---

## 1. UI Class: `inGameMarketplace`

### Constructor Options & Startup Readiness (v14.004.1)
The marketplace top-bar search bar and controls are available immediately upon joining the game world, allowing instant search filtering while item database indexing runs seamlessly in the background.

When creating a new instance of the marketplace, you can configure it via its constructor options:

```javascript
const app = new game.sr5marketplace.inGameMarketplace({
    shopActorUuid: "Actor.xyz123abc456", // UUID of the Shop Actor to open (optional)
    initialSearchTerm: "pistol"           // Initial search string to pre-filter items (optional)
});
```

* **`shopActorUuid`**: (String, optional) If provided, the marketplace opens as a shop window showing the specified Shop Actor's customized inventory and prices. If omitted, it defaults to **Global Mode** (showing all items across compendiums and world items) or automatically detects if the purchasing actor is inside a Shop Region on the canvas.
* **`initialSearchTerm`**: (String, optional) Pre-populates the live search filter in the shop.

---

## 2. Shop Actor Sheet Configuration

GMs can configure shop behavior directly on the `ShopActorSheet` management tab:
* **Markup Percentage**: Set shop price markup or markdown percentage.
* **Shop Radius**: Set token detection radius on canvas.
* **Factory / Workshop Integration**:
  * `system.shop.isFactory` (`Boolean`): Toggles whether the shop functions as a factory/workshop.
  * `system.shop.factoryRating` (`Number`): Workshop rating scale from 1 to 6.
* **Serving Employee**: Assigns an employee Actor document to provide social test skill bases.

---

### Instance Methods

* **`render(force, options)`**: Standard Foundry ApplicationV2 rendering method.
* **`close(options)`**: Closes the application sheet.

---

## Code Examples

### Example 1: Opening a Shop Programmatically
Use this macro to open a specific shop for a player:

```javascript
const shopActor = game.actors.getName("Ares Weapons Depot");
if (shopActor) {
    const marketplace = new game.sr5marketplace.inGameMarketplace({
        shopActorUuid: shopActor.uuid
    });
    marketplace.render(true);
}
```

### Example 2: Programmatically Modifying a Cart
Use this macro to add an item directly to the current user's shopping basket using the modern `BasketService`:

```javascript
const character = game.user.character;
const itemUuid = "Compendium.sr5e-equipment.Equipment.xyz123";

if (character) {
    const basketService = new game.sr5marketplace.api.BasketService();
    await basketService.addToBasket(itemUuid, character.uuid);
    ui.notifications.info("Item added to basket!");
} else {
    ui.notifications.warn("Please assign a character to your user.");
}
```
