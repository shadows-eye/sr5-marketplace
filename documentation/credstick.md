# Credstick & Equipment Sheet Reference

[← Back to Main Overview](./main.md)

`CredstickService` and `MarketplaceEquipmentSheet` provide credstick balance management, fund deductions during marketplace checkout, and dynamic equipment sheet integration for credstick items in **Shadowrun 5e**.

The service is accessible via:
* `game.sr5marketplace.CredstickService` (The `CredstickService` class)
* `MarketplaceEquipmentSheet` (Dynamic `SR5ItemSheet` extension registered on `Hooks.on("ready")` in Foundry VTT v14)

---

## 1. Credstick Types & Limits

Credsticks are classified into 5 tiers with specific ratings, Nuyen purchase costs, availability codes, maximum capacity limits, and UI badge colors:

| Type Key | Label | Rating | Cost (¥) | Availability | Max Capacity (¥) | Badge Color |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `standard` | Standard Credstick | 1 | 5 ¥ | 0 | 5,000 ¥ | `#888888` (Gray) |
| `silver` | Silver Credstick | 2 | 20 ¥ | 0 | 20,000 ¥ | `#c0c0c0` (Silver) |
| `gold` | Gold Credstick | 3 | 100 ¥ | 5 | 100,000 ¥ | `#ffd700` (Gold) |
| `platinum` | Platinum Credstick | 4 | 500 ¥ | 10 | 500,000 ¥ | `#e5e4e2` (Platinum) |
| `ebony` | Ebony Credstick | 5 | 1,000 ¥ | 20 | 1,000,000 ¥ | `#2b2b2b` (Ebony) |

---

## 2. Static Methods

### `CredstickService.isCredstick(item)`
Checks whether an `Item` document is configured as a credstick. Evaluates module flags (`flags['sr5-marketplace'].credstick`) or infers credstick status from item name or subcategory (`id-credsticks`).
* **Parameters**:
  - `item` (Item): The Item document.
* **Returns**: `boolean`

### `CredstickService.ensureCredstickFlags(item)`
Ensures that an item flagged or inferred as a credstick has its module configuration flags initialized when rendered. Sets default type, `currentValue`, `maxValue`, and syncs system rating, cost, and availability parameters.
* **Parameters**:
  - `item` (Item): The Item document.
* **Returns**: `Promise<Item|void>`

### `CredstickService.getCredstickData(item)`
Retrieves a structured credstick configuration object from an item's flags.
* **Parameters**:
  - `item` (Item): The Item document.
* **Returns**: `Object`:
  ```json
  {
      "credstick": true,
      "credstickType": "gold",
      "currentValue": 45000,
      "maxValue": 100000,
      "isOverCapacity": false,
      "badgeColor": "#ffd700",
      "balanceColor": "#fbbf24"
  }
  ```

### `CredstickService.updateCredstickConfig(item, updates)`
Updates a credstick item's configuration flags and synchronizes system technology parameters (rating, base cost, availability).
* **Parameters**:
  - `item` (Item): The Item document.
  - `updates` (Object): Update properties (`credstick`, `credstickType`, `currentValue`, `maxValue`).
* **Returns**: `Promise<Item>`

### `CredstickService.deductCredstickFunds(item, amount)`
Deducts a specified Nuyen amount from a credstick's current balance, ensuring the balance does not drop below 0.
* **Parameters**:
  - `item` (Item): The Credstick Item document.
  - `amount` (Number): Nuyen amount to deduct.
* **Returns**: `Promise<Item>`

---

## 3. Equipment Sheet Extension (`MarketplaceEquipmentSheet`)

On the `ready` hook (aligned with Foundry VTT v14 sheet initialization lifecycle), `registerMarketplaceEquipmentSheet()` registers `MarketplaceEquipmentSheet` for equipment item documents (`type === "equipment"`).

### Key Features
* **Credstick Header & Footer**: Injects credstick controls into the sheet when `flags['sr5-marketplace'].credstick` is enabled.
* **Type Selector & Balance Inputs**: Allows GMs and item owners to select credstick tier and adjust current/maximum balances.
* **Visual Warning Indicator**: Highlights balance in red (`#ef4444`) when `currentValue > maxValue`.
* **Automatic Attribute Locking**: Hides redundant cost and availability scaling checkboxes in Edit Mode when configured as a credstick.

---

## 4. Code Examples

### Example 1: Checking Character Credstick Balances
Use this macro to find all credsticks in a character's inventory and output their current balances:

```javascript
const character = game.user.character;
if (character) {
    const CredstickService = game.sr5marketplace.CredstickService;
    const credsticks = character.items.filter(i => CredstickService.isCredstick(i));
    
    console.log(`Credsticks owned by ${character.name}:`);
    for (const item of credsticks) {
        const data = CredstickService.getCredstickData(item);
        console.log(`- ${item.name} [${data.credstickType.toUpperCase()}]: ${data.currentValue} ¥ / ${data.maxValue} ¥`);
    }
} else {
    ui.notifications.warn("Please select a character.");
}
```

### Example 2: Programmatically Deducting Funds from a Credstick
Use this script to deduct Nuyen directly from a credstick:

```javascript
const character = game.user.character;
const credstick = character?.items.find(i => game.sr5marketplace.CredstickService.isCredstick(i));

if (credstick) {
    const CredstickService = game.sr5marketplace.CredstickService;
    await CredstickService.deductCredstickFunds(credstick, 250);
    ui.notifications.info(`Deducted 250 ¥ from ${credstick.name}.`);
} else {
    ui.notifications.warn("No credstick found.");
}
```
