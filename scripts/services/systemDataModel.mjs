/**
 * SystemDataModel Service
 *
 * Provides a dynamic, authoritative introspection and mutation layer for
 * Shadowrun 5e Actor and Item data models using Foundry's CONFIG registry.
 */
export class SystemDataModel {

    /**
     * Resolves the DataModel schema for a given item or item type from CONFIG.
     * @param {string|object} itemOrType - The item type string, item document, or item raw data.
     * @returns {foundry.data.fields.SchemaField|null}
     */
    getItemSchema(itemOrType) {
        const type = typeof itemOrType === "string" ? itemOrType : itemOrType?.type;
        return CONFIG.Item?.dataModels?.[type]?.schema ?? null;
    }

    /**
     * Resolves the DataModel schema for a given actor or actor type from CONFIG.
     * @param {string|object} actorOrType - The actor type string, actor document, or actor raw data.
     * @returns {foundry.data.fields.SchemaField|null}
     */
    getActorSchema(actorOrType) {
        const type = typeof actorOrType === "string" ? actorOrType : actorOrType?.type;
        return CONFIG.Actor?.dataModels?.[type]?.schema ?? null;
    }

    /**
     * Dynamically determines whether an item type uses the technology schema (system.technology.*).
     * @param {string|object} itemOrType
     * @returns {boolean}
     */
    hasTechnology(itemOrType) {
        const schema = this.getItemSchema(itemOrType);
        if (schema?.fields?.technology) return true;
        if (typeof itemOrType === "object" && itemOrType !== null) {
            return "technology" in (itemOrType.system || {});
        }
        return false;
    }

    /**
     * Discovers the exact dot-path for an item's quantity field.
     * @param {string|object} itemOrType
     * @returns {string}
     */
    getQuantityPath(itemOrType) {
        const schema = this.getItemSchema(itemOrType);
        if (schema) {
            if (schema.fields?.technology?.fields?.quantity) return "system.technology.quantity";
            if (schema.fields?.quantity) return "system.quantity";
        }
        if (typeof itemOrType === "object" && itemOrType?.system) {
            if ("technology" in itemOrType.system) return "system.technology.quantity";
        }
        return "system.technology.quantity";
    }

    /**
     * Discovers the exact dot-path for an item's cost field.
     * @param {string|object} itemOrType
     * @returns {string}
     */
    getCostPath(itemOrType) {
        const schema = this.getItemSchema(itemOrType);
        if (schema) {
            if (schema.fields?.technology?.fields?.cost) return "system.technology.cost";
            if (schema.fields?.cost) return "system.cost";
        }
        if (typeof itemOrType === "object" && itemOrType?.system) {
            if ("technology" in itemOrType.system) return "system.technology.cost";
        }
        return "system.technology.cost";
    }

    /**
     * Discovers the exact dot-path for an item's rating field.
     * @param {string|object} itemOrType
     * @returns {string}
     */
    getRatingPath(itemOrType) {
        const schema = this.getItemSchema(itemOrType);
        if (schema) {
            if (schema.fields?.technology?.fields?.rating) return "system.technology.rating";
            if (schema.fields?.rating) return "system.rating";
        }
        if (typeof itemOrType === "object" && itemOrType?.system) {
            if ("technology" in itemOrType.system) return "system.technology.rating";
        }
        return "system.technology.rating";
    }

    /**
     * Discovers the exact dot-path for an item's availability field.
     * @param {string|object} itemOrType
     * @returns {string}
     */
    getAvailabilityPath(itemOrType) {
        const schema = this.getItemSchema(itemOrType);
        if (schema) {
            if (schema.fields?.technology?.fields?.availability) return "system.technology.availability";
            if (schema.fields?.availability) return "system.availability";
        }
        if (typeof itemOrType === "object" && itemOrType?.system) {
            if ("technology" in itemOrType.system) return "system.technology.availability";
        }
        return "system.technology.availability";
    }

    /**
     * Reads the current integer quantity of an item.
     * @param {object} item - Item document or raw item data.
     * @returns {number}
     */
    getItemQuantity(item) {
        if (!item) return 1;
        const path = this.getQuantityPath(item);
        const val = foundry.utils.getProperty(item, path);
        if (val !== undefined && val !== null && !isNaN(Number(val))) {
            return Number(val);
        }
        // Fallback check on alternate property
        const fallback = item.system?.quantity ?? item.system?.technology?.quantity;
        return Number(fallback) || 1;
    }

    /**
     * Sets the quantity on an item data object across its schema-defined path and fallbacks.
     * @param {object} itemData - Mutable item data object.
     * @param {number} quantity - Quantity to assign.
     */
    setItemQuantity(itemData, quantity) {
        if (!itemData || typeof itemData !== "object") return;
        const qty = Math.max(0, Number(quantity) || 0);
        const path = this.getQuantityPath(itemData);
        foundry.utils.setProperty(itemData, path, qty);

        // Defensively keep system.quantity in sync if technology schema is used
        if (itemData.system && path !== "system.quantity") {
            itemData.system.quantity = qty;
        }
    }

    /**
     * Retrieves the pack quantity (number of individual units per purchase lot) for an item.
     * For ammo, defaults to 10 if not explicitly defined with a higher quantity.
     * @param {object} item - Compendium item, item document, or raw data.
     * @returns {number}
     */
    getPackQuantity(item) {
        if (!item) return 1;
        const type = item.type;
        const currentQty = this.getItemQuantity(item);

        if (type === "ammo") {
            // In Shadowrun 5e, ammo is sold in boxes of 10 rounds unless specified otherwise
            return currentQty > 1 ? currentQty : 10;
        }

        return currentQty > 0 ? currentQty : 1;
    }

    /**
     * Calculates the total transfer quantity to give an actor upon purchase.
     * Multiplies pack quantity by the cart buy quantity (e.g. 10 * 8 = 80).
     * @param {object} basketItem - The item entry in the shopping cart.
     * @param {object} [sourceItem] - The original item document from compendium/world if available.
     * @returns {number}
     */
    calculateTransferQuantity(basketItem, sourceItem = null) {
        if (!basketItem) return 1;
        const buyQty = Math.max(1, Number(basketItem.buyQuantity) || 1);
        const packQty = Number(basketItem.itemQuantity)
            || (sourceItem ? this.getPackQuantity(sourceItem) : 1);
        return buyQty * Math.max(1, packQty);
    }

    /**
     * Reads the configured or default behavior mode for an item type ("stack", "single", or "unique").
     * @param {string|object} itemOrType
     * @returns {"stack"|"single"|"unique"}
     */
    getItemBehavior(itemOrType) {
        const type = typeof itemOrType === "string" ? itemOrType : itemOrType?.type;
        const behaviors = game.settings?.get("sr5-marketplace", "itemTypeBehaviors") || {};
        if (behaviors[type]) return behaviors[type];

        // System defaults if not configured in settings
        const defaults = {
            ammo: "stack",
            modification: "stack",
            armor: "single",
            weapon: "single",
            equipment: "single",
            device: "single",
            sin: "single",
            action: "unique",
            adept_power: "unique",
            complex_form: "unique",
            critter_power: "unique",
            cyberware: "unique",
            bioware: "unique",
            echo: "unique",
            quality: "unique",
            spell: "unique",
            sprite_power: "unique"
        };
        return defaults[type] || "single";
    }

    /**
     * Dynamically determines whether an item type should be excluded from marketplace display.
     * Checks known administrative types and inspects the schema for absence of cost/karma fields.
     * @param {string} type - Item type string.
     * @returns {boolean}
     */
    isIgnoredItemType(type) {
        const administrativeTypes = new Set([
            "contact", "host", "grid", "lifestyle", "metatype", "call_in_action", "skill"
        ]);
        if (administrativeTypes.has(type)) return true;

        const schema = this.getItemSchema(type);
        if (!schema) return false;

        // An item must have cost, technology.cost, or karma to be purchasable
        const hasCost = ("cost" in schema.fields) || !!(schema.fields.technology?.fields?.cost);
        const hasKarma = "karma" in schema.fields;
        const hasTech = "technology" in schema.fields;

        return !hasCost && !hasKarma && !hasTech;
    }

    /**
     * Dynamically determines whether an actor type is supported for character/marketplace transactions.
     * @param {string} type - Actor type string.
     * @returns {boolean}
     */
    isAllowedActorType(type) {
        const allowed = new Set(["character", "vehicle"]);
        return allowed.has(type);
    }

    /**
     * Reads rating from an item.
     * @param {object} item
     * @returns {number}
     */
    getRating(item) {
        if (!item) return 0;
        const path = this.getRatingPath(item);
        const val = foundry.utils.getProperty(item, path);
        return Number(val) || 0;
    }

    /**
     * Sets rating on an item data object.
     * @param {object} itemData
     * @param {number} rating
     */
    setRating(itemData, rating) {
        if (!itemData) return;
        const r = Math.max(0, Number(rating) || 0);
        const path = this.getRatingPath(itemData);
        foundry.utils.setProperty(itemData, path, r);
    }

    /**
     * Reads numeric cost from an item (handling number or modifiable object { value }).
     * @param {object} item
     * @returns {number}
     */
    getCost(item) {
        if (!item) return 0;
        const path = this.getCostPath(item);
        const raw = foundry.utils.getProperty(item, path);
        if (raw !== null && typeof raw === "object" && "value" in raw) {
            return Number(raw.value) || 0;
        }
        if (raw !== undefined && raw !== null && !isNaN(Number(raw))) {
            return Number(raw);
        }
        // Fallback for vehicle actors or alternative root cost
        const fallback = item.system?.cost;
        if (fallback !== null && typeof fallback === "object" && "value" in fallback) {
            return Number(fallback.value) || 0;
        }
        return Number(fallback) || 0;
    }

    /**
     * Sets cost on an item data object.
     * @param {object} itemData
     * @param {number} cost
     */
    setCost(itemData, cost) {
        if (!itemData) return;
        const c = Math.max(0, Number(cost) || 0);
        const path = this.getCostPath(itemData);
        const current = foundry.utils.getProperty(itemData, path);
        if (current !== null && typeof current === "object" && "value" in current) {
            foundry.utils.setProperty(itemData, `${path}.value`, c);
        } else {
            foundry.utils.setProperty(itemData, path, c);
        }
    }

    /**
     * Reads availability string from an item.
     * @param {object} item
     * @returns {string}
     */
    getAvailability(item) {
        if (!item) return "0";
        const path = this.getAvailabilityPath(item);
        const raw = foundry.utils.getProperty(item, path);
        if (raw !== null && typeof raw === "object") {
            return raw.label ?? raw.value ?? "0";
        }
        return String(raw || "0");
    }

    /**
     * Reads essence cost from an item.
     * @param {object} item
     * @returns {number}
     */
    getEssence(item) {
        if (!item) return 0;
        const raw = item.system?.technology?.essence ?? item.system?.essence;
        if (raw !== null && typeof raw === "object" && "value" in raw) {
            return Number(raw.value) || 0;
        }
        return Number(raw) || 0;
    }

    /**
     * Reads karma cost from an item.
     * @param {object} item
     * @returns {number}
     */
    getKarma(item) {
        if (!item) return 0;
        const raw = item.system?.karma;
        if (raw !== null && typeof raw === "object" && "value" in raw) {
            return Number(raw.value) || 0;
        }
        return Number(raw) || 0;
    }

    /**
     * Reads nuyen balance from an actor document.
     * @param {Actor} actor
     * @returns {number}
     */
    getNuyen(actor) {
        return Number(actor?.system?.nuyen) || 0;
    }

    /**
     * Sets nuyen balance on an actor document.
     * @param {Actor} actor
     * @param {number} nuyen
     * @returns {Promise<Actor>}
     */
    async setNuyen(actor, nuyen) {
        if (!actor) return null;
        return actor.update({ "system.nuyen": Math.max(0, Number(nuyen) || 0) });
    }

    /**
     * Reads current karma value from an actor document.
     * @param {Actor} actor
     * @returns {number}
     */
    getKarmaValue(actor) {
        return Number(actor?.system?.karma?.value) || 0;
    }

    /**
     * Sets karma value on an actor document.
     * @param {Actor} actor
     * @param {number} karma
     * @returns {Promise<Actor>}
     */
    async setKarmaValue(actor, karma) {
        if (!actor) return null;
        return actor.update({ "system.karma.value": Math.max(0, Number(karma) || 0) });
    }

    /**
     * Finds a matching stackable item already present in the actor's inventory.
     * Checks matching type, identical name or compendium sourceId, and matching rating if applicable.
     * @param {Actor} actor - The target actor document.
     * @param {object} itemData - Raw item data or source document.
     * @param {number} [selectedRating] - Selected rating to match.
     * @returns {Item|null}
     */
    findMatchingStackItem(actor, itemData, selectedRating = null) {
        if (!actor?.items || !itemData) return null;

        const incomingType = itemData.type;
        const incomingName = itemData.name?.trim().toLowerCase();
        const incomingSourceId = itemData.flags?.core?.sourceId || itemData.uuid;

        return actor.items.find(i => {
            if (i.type !== incomingType) return false;

            // Match by source UUID or name
            const sourceMatches = (incomingSourceId && i.flags?.core?.sourceId === incomingSourceId)
                || (incomingName && i.name?.trim().toLowerCase() === incomingName);
            if (!sourceMatches) return false;

            // If rating is relevant, match rating
            if (selectedRating !== null && selectedRating !== undefined) {
                const existingRating = this.getRating(i);
                if (existingRating !== Number(selectedRating)) return false;
            }

            return true;
        }) || null;
    }

    /**
     * Checks if the actor already possesses this unique item.
     * @param {Actor} actor
     * @param {object} itemData
     * @returns {boolean}
     */
    actorHasItem(actor, itemData) {
        return !!this.findMatchingStackItem(actor, itemData);
    }

    /**
     * Returns the array of compendium index fields needed for marketplace indexing.
     * Dynamically constructed to match system data paths.
     * @returns {string[]}
     */
    getItemIndexFields() {
        return [
            "system.category",
            "system.type",
            "system.technology.cost",
            "system.technology.rating",
            "system.technology.availability",
            "system.technology.quantity",
            "system.karma",
            "system.essence",
            "system.range.ranges.category",
            "system.drain",
            "system.mount_point",
            "system.mod_weapon.mount_point",
            "system.slots",
            "system.modification_category"
        ];
    }
}

export const systemDataModel = new SystemDataModel();
