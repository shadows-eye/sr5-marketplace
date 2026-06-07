# System API Bridge Reference

[← Back to Main Overview](file:///home/shadow/Documents/GitHub/sr5-marketplace/documentation/main.md)

The System API Bridge acts as a centralized interface for retrieving, caching, and localizing configurations and modules from the core **Shadowrun 5e** system. It avoids timing issues during Foundry startup by capturing and processing CONFIG configurations reactively.

The API is accessible via:
* `game.sr5marketplace.api.system` (Instance of `SR5SystemAPI`)

---

## Properties

### System Hooks & Configurations
* **`config`**: (Object) Reference to raw, un-localized `CONFIG.SR5`.
* **`ActionFlow`**: (Class) Reference to `game.shadowrun5e.ActionFlow`.
* **`documentTypes`**: (Object) Reference to `game.system.documentTypes`.
* **`tests`**: (Array) A list of structured test object configs containing `id` and localized `value` properties:
  ```json
  [
    { "id": "OpposedTest", "value": "Opposed Test" }
  ]
  ```

### Localized Config Maps
The bridge automatically processes and translates configurations. It exposes these translations as `*_l` objects:

| Property Name | Localized Content Description |
| :--- | :--- |
| `attributes_l` | Attributes (Strength, Agility, Charisma, etc.) |
| `activeSkills_l` | Active Character Skills (Negotiation, Blades, Con, etc.) |
| `itemTypes_l` | Item Type mappings |
| `compendiums_l` | Compendium collection localizations |
| `weaponRanges_l` | Range definitions and categories |
| `cyberwareGrades_l` | Augmentation grades (Standard, Alpha, Delta, etc.) |
| `spellCategories_l`| Spell category mappings (Combat, Detection, etc.) |
| `lifestyleTypes_l` | Lifestyle tiers (Low, Medium, High, Luxury) |

---

## Method Details

### `init()`
Initializes the bridge, captures the live `CONFIG.SR5` parameters, and generates all `*_l` localized configuration properties recursively. Called automatically during the Foundry VTT `ready` hook.
* **Returns**: `Promise<void>`

### `getLocalizationMapForKey(key)`
Returns a pre-localized configuration map matching a given actor data key. Useful for mapping database fields to translation structures.
* **Parameters**:
  - `key` (String): The key from the actor's system database (e.g., `'skills'`, `'matrix'`, `'modifiers'`).
* **Returns**: `Object` - Pre-localized config object, or empty object `{}` if not found.

```javascript
const skillTranslations = game.sr5marketplace.api.system.getLocalizationMapForKey("skills");
console.log(skillTranslations.negotiation); // e.g. "Negotiation"
```

---

## Code Examples

### Example: Translating an Attribute Programmatically
Use this script to safely resolve an attribute key into its localized label:

```javascript
const systemApi = game.sr5marketplace.api.system;
const attrKey = "agility";

// Access the localized config mapping directly
const localizedLabel = systemApi.attributes_l[attrKey];
if (localizedLabel) {
    console.log(`Attribute label: ${localizedLabel}`); // e.g. "Agility"
} else {
    console.log("Translation key not found.");
}
```
