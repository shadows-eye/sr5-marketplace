# 🌍 Foundry Module Localisation Agent Skill

This skill is designed to guide agents in finding hardcoded English text in `.hbs`/`.html` templates and replacing them with Foundry VTT localization strings, as well as keeping translation files (`en.json` and `de.json`) in sync.

---

## 📋 Skill Objectives
1.  **Identify Hardcoded Text**: Scan `.html` and `.hbs` files in `templates/` to find any plain English text.
2.  **Formulate Structural Keys**: Generate organized, nested hierarchical localization keys within the `SR5Marketplace` root namespace.
3.  **Perform Safe Replacement**: Replace raw text in templates using standard Handlebars and JavaScript localization syntax.
4.  **Sync Language JSON Files**: Safely insert keys in `languages/en.json` (English) and `languages/de.json` (German).
5.  **Validation**: Verify translations using automated workspace scripts.

---

## 🛠️ Step-by-Step Execution Workflow

### Step 1: Scan and Detect Hardcoded Text
Search inside the `templates/` folder. Common places for hardcoded strings include:
- Text nodes inside tags: `<div>Purchase Items</div>`, `<span>Add Item</span>`, `<h1>Shop Biography</h1>`.
- Button labels and placeholder attributes: `<input placeholder="Search items..."/>`, `<button>Buy</button>`.
- Tooltip attributes: `data-tooltip="Select employee to manage"`.

> [!WARNING]
> Do NOT replace standard variables (e.g. `{{item.name}}`, `{{actor.name}}`) or already localized strings (`{{localize "FIELDS.name.label"}}`). Only target plain, raw English text.

### Step 2: Formulate standard keys
Always place keys under the `SR5Marketplace` namespace. Use a clear, logical hierarchical structure:

- **UI Elements (Tabs, Buttons, Table Columns, Headers)**: 
  `SR5Marketplace.UI.[Category].[Key]`
  - *Example*: `SR5Marketplace.UI.ActiveSkills`, `SR5Marketplace.UI.Quantity`
- **Marketplace Core Application Pages (Shop, Order Review)**: 
  `SR5Marketplace.Marketplace.[Feature].[Key]`
  - *Example*: `SR5Marketplace.Marketplace.Basket.AddToCart`, `SR5Marketplace.Marketplace.OrderReview.YourItems`
- **Shop Actor & Sheets Management**: 
  `SR5Marketplace.Marketplace.Actor.[Key]` or `SR5Marketplace.Marketplace.Contacts.[Key]`
  - *Example*: `SR5Marketplace.Marketplace.Actor.SelectAnActor`

### Step 3: Insert Translation Keys
We have two ways to add new localization keys to the codebase:

#### Option A: Direct Editing
Edit the existing `languages/en.json` and `languages/de.json` files directly. Keep both keys perfectly mirrored. If you do not know the German translation, add a placeholder or translate simple terms.

#### Option B: Deep Merge Helper (Recommended)
You can write a temporary `new_en.json` and `new_de.json` file in the workspace root, containing just your new translation keys, and run:
```bash
node merge-locales.js
```
This script will merge your new definitions into `languages/en.json` and `languages/de.json` and sort them alphabetically.
*(Note: Remember to delete your temporary `new_en.json` and `new_de.json` files after merging).*

### Step 4: Replace Syntax in Source Files

#### Inside Handlebars Templates (`.hbs`, `.html`)
Use the standard double curly-bracket localize helper:
```html
<!-- Before -->
<div class="header">Basket Inventory</div>
<button>Add to Cart</button>

<!-- After -->
<div class="header">{{localize "SR5Marketplace.UI.BasketInventory"}}</div>
<button>{{localize "SR5Marketplace.Marketplace.Basket.AddToCart"}}</button>
```

#### Inside JavaScript (`.mjs`, `.js`)
Use `game.i18n.localize`:
```javascript
// Before
ui.notifications.warn("Please select an actor first.");

// After
ui.notifications.warn(game.i18n.localize("SR5Marketplace.Marketplace.Actor.SelectAnActor"));
```

---

## 🔍 Validation and Quality Assurance
After updating strings and JSON files, we must validate that translations are complete, structurally correct, and render perfectly in the live UI.

### Step 1: Static Workspace Checks
1. Run the localization checker script to make sure no keys are missing or misplaced between language JSONs:
   ```bash
   node check-locales.js
   ```
2. Verify that there are no syntax errors or duplicate entries in the JSON bundles.
3. Rebuild the bundle to copy all localization JSONs and templates to `dist/`:
   ```bash
   npm run build
   ```

### Step 2: Active HTML Rendering & Key Resolution Checks
A common issue in VTT sheets is that a newly added Handlebars translation key (e.g. `{{localize "SR5Marketplace.UI.ActiveSkills"}}`) renders as a **raw un-translated key** (literally `"SR5Marketplace.UI.ActiveSkills"`) because of typos or missing entries in `en.json`/`de.json`.

To prevent this, write a browser integration test (using Puppeteer) to actively check the sheet's rendered HTML.

#### A. Scanning for Raw Keys in DOM
In your test's `page.evaluate()`, you can scan the rendered sheet HTML for any elements containing raw `SR5Marketplace` strings:
```javascript
const sheetEl = actor.sheet.element;
const rawKeys = [];

// Recursive DOM scanner to find any text nodes containing raw keys
const walker = document.createTreeWalker(sheetEl, NodeFilter.SHOW_TEXT, null, false);
let node;
while (node = walker.nextNode()) {
    const text = node.nodeValue.trim();
    if (text.includes("SR5Marketplace.")) {
        rawKeys.push(text);
    }
}

if (rawKeys.length > 0) {
    console.error("❌ Localization Failure: Raw translation keys found on screen:", rawKeys);
}
```

#### B. Active Key Resolution Comparison
Assert that specific elements (headers, tabs, buttons, placeholders) match their localized values exactly at runtime:
```javascript
const tabLabel = sheetEl.querySelector('a[data-tab="actorShop"]').innerText.trim();
const expectedLabel = game.i18n.localize("SR5Marketplace.UI.ShopDetails") || "Shop Details";

if (tabLabel !== expectedLabel) {
    console.error(`❌ Localization Mismatch: Tab label was "${tabLabel}" but expected "${expectedLabel}"`);
}
```
Using these active checks guarantees that your localization additions are fully compiled, correctly spelled, and rendering perfectly for end-users.
