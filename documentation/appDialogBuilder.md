# App Dialog Builder Reference

[← Back to Main Overview](file:///home/shadow/Documents/GitHub/sr5-marketplace/documentation/main.md)

`AppDialogBuilder` acts as a router and template context builder that constructs parameters for availability tests and contact negotiations. It reads persistent test states stored in user flags, parses attribute/skill values, calculates modifier dice pools, and processes dice rolls to produce template variables.

The API is accessible via:
* `game.sr5marketplace.api.AppDialogBuilder` (The `AppDialogBuilder` class)

You can instantiate it in script files:
```javascript
const builder = new game.sr5marketplace.api.AppDialogBuilder();
```

---

## Public Methods

### `buildTestDialogContext(testState, basket)`
Accepts a test state descriptor flag, inspects its status, routes context calculation to the appropriate helper, and returns localized data for the shopping cart's inline dialog.
* **Parameters**:
  - `testState` (Object): The active test state flag containing values like `status`, `actorUuid`, `skill`, `attribute`, `connectionUuid`.
  - `basket` (Object, optional): The user's active shopping cart (needed for cost-based delivery times and extended test calculations).
* **Returns**: `Promise<object|null>` - Returns context containing dice pool breakdowns, roll results, threshold counters, and success metrics.

---

## Test Lifecycle Contexts

Depending on `testState.status`, the builder maps variables as follows:

### 1. `initial`
Context for building initial dice pools before rolling.
* **Returns**: `{ actor, availabilityStr, modifierGroups, dicePoolBreakdown, totalDicePool, connectionUsed }`.
* Calculates base pool (Skill + Attribute) and merges active modifiers.

### 2. `result`
Context for opposed rolls before resistance tests.
* **Returns**: `{ renderedDice, hits, glitches, isGlitch }`.

### 3. `extended-inprogress`
Context for multi-turn extended tests.
* **Returns**: `{ cumulativeHits, threshold, currentPool, renderedDice }`.

### 4. `resolved`
Once completed, it formats outcomes based on the chosen test type rule setting:
* **`raw`**: Opposes player negotiation against item availability. Adjusts delivery time based on net hits.
* **`opposed`**: Standard opposed test.
* **`simple`**: Hits vs static availability threshold.
* **`extended`**: Extended interval rolls. Calculates final delivery time based on intervals required to meet the threshold.

---

## Code Examples

### Example: Simulating a Dialog Context Render
Use this GM/developer macro to dry-run template variables generation for a player's active availability test:

```javascript
const userId = game.user.id;
const basketService = new game.sr5marketplace.api.BasketService();

// Retrieve user cart and test states
const basket = await basketService.getBasket(userId);
const flagState = await game.user.getFlag("sr5-marketplace", "testStates") || {};
const activeTest = Object.values(flagState)[0]; // Find first active test state

if (activeTest) {
    const builder = new game.sr5marketplace.api.AppDialogBuilder();
    const uiContext = await builder.buildTestDialogContext(activeTest, basket);
    
    console.log("Calculated UI context variables:", uiContext);
    ui.notifications.info(`Active test total pool: ${uiContext.totalDicePool ?? uiContext.currentPool} dice.`);
} else {
    ui.notifications.warn("No active availability test found for this user.");
}
```
