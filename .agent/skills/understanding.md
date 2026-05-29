# 🧠 Foundry Codebase & Rules Understander Skill

This skill explains the architectural layers of the `sr5-marketplace` module, including its data models, sheet mixins, UI applications, and automated rules systems.

---

## 🏛️ Project Architecture Layers

The module's architecture is split into four distinct layers:
1.  **Models** (`models/`): Schema definitions and data models extending the core Foundry data structures.
2.  **Sheets** (`sheets/`): Custom sheet controllers utilizing the V13 ApplicationV2 API.
3.  **Apps** (`scripts/apps/`): Custom frontend UI applications (Marketplace, Item Builder, Settings).
4.  **Services/Rules** (`scripts/services/`): Business logic, price scaling, and math computations.

---

## 💾 Layer 1: Data Models (`models/actor/shopActor.mjs`)

The `ShopActorData` model defines the schema under `actor.system.shop`.

### Data Schema Properties
-   `owner` (String): The UUID of the Actor document that owns the shop.
-   `employees` (Array of Strings): UUIDs of actor documents acting as employees.
-   `connection` (String): The UUID of the Contact Item representing the shop's connection.
-   `modifierValue` (Schema: `{ value, base }`): The price modifier applied globally.
-   `modifierType` (String): Either `"discount"` or `"fee"`.
-   `shopRadius` (Schema: `{ value, base }`): Token proximity detection range.
-   `tokenInRadius` (Object): Active tracker mapping `tokenId` to coordinate/UUID data for tokens within range.
-   `inventory` (Object): Key-value pair of dynamic entry IDs to unique inventory item schemas:
    -   `itemUuid` (String, required): Source Item UUID.
    -   `qty` (Number, integer >= 0, default `1`).
    -   `sellPrice` (Schema: `{ value, base }`): Selling price.
    -   `buyPrice` (Schema: `{ value, base }`): Buying price.
    -   `availability` (Schema: `{ value, base }`): E.g., `"12R"`, `"8F"`.
    -   `buyTime` (Schema: `{ value, unit }`): Numeric value and unit (`"hours"`, `"days"`, etc.).
    -   `comments` (HTMLField): Rich-text notes.

### Document Methods API
The custom `ShopActor` class overrides the standard character document and provides a rich helper API:
-   **Owner**: `getOwner()`, `updateOwner(uuid)`, `removeOwner()`
-   **Employees**: `getEmployees()`, `addEmployee(uuid)`, `removeEmployee(uuid)`
-   **Connection**: `getConnection()`, `updateConnection(uuid)`, `removeConnection()`
-   **Modifiers**: `updateModifier({ value, type })`
-   **Inventory Operations**:
    -   `addItemToInventory(itemData, shopData)`: Formulates a unique inventory entry and appends it to `system.shop.inventory`.
    -   `updateInventoryItem(entryId, updateData)`: Modifies nested inventory item fields.
    -   `removeItemFromInventory(entryId)`: Uses a database syntax operator `-=` to remove the specified item entry:
        ```javascript
        this.update({ [`system.shop.inventory.-=${entryId}`]: null })
        ```

---

## 🎨 Layer 2: Sheets & Mixins (`sheets/ShopActorSheet.mjs`)

The `ShopActorSheet` is built using the **ApplicationV2** API, inheriting from `MarketplaceDocumentSheetMixin(ActorSheet)`.

### Play vs. Edit Modes
-   `_mode = "play"` (default) vs. `_mode = "edit"`.
-   If a non-GM (player) triggers `render()`, the code intercepts this and diverts them directly to the `inGameMarketplace` app:
    ```javascript
    render(options, _options) {
        if (!game.user.isGM) {
            new inGameMarketplace({ shopActorUuid: this.document.uuid }).render(true);
            return this;
        }
        return super.render(options, _options);
    }
    ```

### Part Composition (`static PARTS`)
-   `header`: Renders character metadata.
-   `tabs`: Tab navigation controls.
-   `actorShop`: The core details template showing inventory.
-   `management`: GM settings (Owner, Employees, Connection).
-   `biography`: Rich text biographical descriptions.

### Drag and Drop Zones
Under `_onDrop(event)` data is mapped to target drop zones using HTML `data-drop-zone` tags:
-   `inventory`: Checks if the drop is an `Item`, computes cost/availability via the rules engine, and appends it.
-   `connection`: Accepts Items of type `contact` only.
-   `owner`/`employees`: Accepts `Actor` drops.

---

## 🖥️ Layer 3: Application UIs (`scripts/apps/`)

-   **`inGameMarketplace.mjs`**: Coordinates the player shopping basket, price calculations (applying discounts/fees), connection modifiers, availability checks, and order transactions.
-   **`ItemBuilderApp.mjs`**: Rich canvas for designing/testing customized weapons, gear, and software before putting them up for sale.

---

## ⚖️ Layer 4: Services & Rules (`scripts/services/`)

-   **`InventoryRules`**: Computes sell prices, buy-back value, availability multipliers, and shipping times based on employee social skills (Intimidation, Negotiation) and contact connection/loyalty ratings.

---

## 🧭 Guidelines for Code Modifications
1.  **Schema Alignment**: If you add any property to the actor's shop, remember to update `ShopActorData.defineSchema()` inside `models/actor/shopActor.mjs` first, then register/bind it to the HTML form elements using namespaced paths (e.g. `system.shop.[fieldName]`).
2.  **Context Bindings**: When modifying sheet tabs or parts, verify that the required data is properly bundled and returned within `_preparePartContext` for that specific tab ID.
3.  **Vite Bundling Safety**: Avoid inline dynamic imports or variable class names that could get compiled incorrectly. Always use exact string literals for registration hooks.
