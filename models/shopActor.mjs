/**
 * Defines and returns the custom ShopActor classes.
 * This must be called during the 'ready' hook.
 *
 * The returned ShopActorData model defines a 'shop' object on the actor's system data (`actor.system.shop`).
 * The `shop` object contains the following properties:
 *
 * @property {string} owner The UUID of the Actor who owns the shop. Access with `actor.system.shop.owner`.
 * @property {string[]} employees An array of Actor UUIDs for the shop's employees. Access with `actor.system.shop.employees`.
 * @property {string} connection The UUID of the Item representing the shop's connection level. Access with `actor.system.shop.connection`.
 * @property {object} modifierValue Contains the shop's general price modifier. Access with `actor.system.shop.modifierValue`.
 * @property {number} modifierValue.value The final, calculated value of the modifier. Access with `actor.system.shop.modifierValue.value`.
 * @property {number} modifierValue.base The original, unmodified base value of the modifier. Access with `actor.system.shop.modifierValue.base`.
 * @property {string} modifierType The type of modifier ('discount' or 'fee'). Access with `actor.system.shop.modifierType`.
 * @property {object} inventory A collection of inventory items, where each key is a unique entry ID and each value is an item object. Access with `actor.system.shop.inventory`.
 *
 * Each item object within the `inventory` has the following structure:
 * @property {string} itemUuid The UUID of the source item. Access with `inventoryItem.itemUuid`.
 * @property {number} qty The quantity of the item. Access with `inventoryItem.qty`.
 * @property {object} sellPrice The selling price object. Access with `inventoryItem.sellPrice`.
 * @property {number} sellPrice.value The final, calculated selling price. Access with `inventoryItem.sellPrice.value`.
 * @property {number} sellPrice.base The original, unmodified base selling price. Access with `inventoryItem.sellPrice.base`.
 * @property {object} buyPrice The buying price object. Access with `inventoryItem.buyPrice`.
 * @property {number} buyPrice.value The final, calculated buying price. Access with `inventoryItem.buyPrice.value`.
 * @property {number} buyPrice.base The original, unmodified base buying price. Access with `inventoryItem.buyPrice.base`.
 * @property {object} availability The availability object. Access with `inventoryItem.availability`.
 * @property {string} availability.value The final, calculated availability string. Access with `inventoryItem.availability.value`.
 * @property {string} availability.base The original, unmodified base availability string. Access with `inventoryItem.availability.base`.
 * @property {object} buyTime The time it takes for the shop to acquire this item. Access with `inventoryItem.buyTime`.
 * @property {number} buyTime.value The numeric value of the time (e.g., 24). Access with `inventoryItem.buyTime.value`.
 * @property {string} buyTime.unit The unit of time ('hours', 'days', etc.). Access with `inventoryItem.buyTime.unit`.
 * @property {string} comments A rich text field for notes and comments. Access with `inventoryItem.comments`.
 *
 * @returns {{ShopActor: typeof Actor, ShopActorData: typeof foundry.abstract.TypeDataModel}} An object containing the defined classes.
 */
export function defineShopActorClass() {
    const SR5Actor = CONFIG.Actor.documentClass;
    const CharacterData = CONFIG.Actor.dataModels.character;
    const SHOP_ACTOR_TYPE = "sr5-marketplace.shop";
    /**
     * Defines the custom data model for a Shop Actor, extending the base CharacterData from Shadowrun5e system.
     */
    class ShopActorData extends CharacterData {
        static defineSchema() {
            const parentSchema = super.defineSchema();
            const fields = foundry.data.fields;

            // Defined the schema for a SINGLE inventory item as a constant ---
            const inventoryItemSchema = new foundry.data.fields.SchemaField({
                itemUuid: new foundry.data.fields.StringField({ required: true, blank: false, label: "Item UUID" }),
                qty: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),
                sellPrice: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.NumberField({ required: true, min: 0, initial: 0, label: "Sell Price" }),
                    base: new foundry.data.fields.NumberField({ required: true, min: 0, initial: 0, label: "Unmodified Sell Price" })
                }),
                buyPrice: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.NumberField({ required: true, min: 0, initial: 0, label: "Buy Price" }),
                    base: new foundry.data.fields.NumberField({ required: true, min: 0, initial: 0, label: "Unmodified Buy Price" })
                }),
                availability: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.StringField({ required: true, blank: false, initial: "", label: "Availability" }),
                    base: new foundry.data.fields.StringField({ required: true, blank: false, initial: "", label: "Unmodified Availability" })
                }),
                buyTime: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 24 }),
                    unit: new foundry.data.fields.StringField({
                        required: true,
                        choices: ["hours", "days", "weeks", "months"],
                        initial: "hours"
                    })
                }),
                comments: new foundry.data.fields.HTMLField({ label: "Comments" })
            });

            //@function shopSchema, this integrates the shema with the Shadowrun Actor without this wrapper it will not register the Data Model!!! Do not Touch!
            const shopSchema = () => ({
                owner: new foundry.data.fields.StringField({ initial: "" }),
                employees: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField()),
                connection: new foundry.data.fields.StringField({ initial: "" }),
                modifierValue: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.NumberField({ initial: 0 }),
                    base: new foundry.data.fields.NumberField({ initial: 0 })
                }),
                modifierType: new foundry.data.fields.StringField({ initial: "discount", choices: ["discount", "fee"] }),
                
                // Validating the inventory as an object with dynamic keys
                // Each key is an inventory entry ID, and each value is an inventory item object.
                inventory: new foundry.data.fields.ObjectField({
                    validate: obj => {
                        for ( const itemData of Object.values(obj) ) {
                            try {
                                inventoryItemSchema.clean(itemData, {});
                            } catch (error) {
                                console.error("Shop Inventory Validation Failed on Item:", itemData, error);
                                return false;
                            }
                        }
                        return true;
                    },
                    initial: {}
                })
            });
            return {
                ...parentSchema,
                shop: new foundry.data.fields.SchemaField(shopSchema())
            };
        }
    }

    CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = ShopActorData;
    // --- Define the Actor Class ---
    // This class inherits all methods from the base SR5Actor.
    class ShopActor extends SR5Actor {
        /**
         * A convenience getter for the shop-specific data.
         * @returns {object} The shop data object from the system data.
         */
        get shop() {
            return this.system.shop;
        }

        /**
         * Retrieves the Actor document for the shop's owner.
         * @returns {Promise<Actor|null>} The owner actor, or null if not set.
         */
        async getOwner() {
            if (!this.shop.owner) return null;
            return fromUuid(this.shop.owner);
        }

        /**
         * Retrieves an array of Actor documents for the shop's employees.
         * @returns {Promise<Actor[]>} An array of employee actors.
         */
        async getEmployees() {
            if (!this.shop.employees?.length) return [];
            const employeeUuids = this.shop.employees.filter(uuid => uuid);
            return fromUuid.multi(employeeUuids);
        }
        
        /**
         * Retrieves the Item document for the shop's connection.
         * @returns {Promise<Item|null>} The connection item, or null if not set.
         */
        async getConnection() {
            if (!this.shop.connection) return null;
            return fromUuid(this.shop.connection);
        }

        // --- NEW INVENTORY MANAGEMENT METHODS ---

        /**
         * Finds a specific item within the shop's inventory by its UUID.
         * @param {string} itemUuid The UUID of the item to find.
         * @returns {object|undefined} The inventory entry object if found, otherwise undefined.
         */
        findInventoryItem(itemUuid) {
            return this.shop.inventory.find(i => i.itemUuid === itemUuid);
        }

        /**
         * Finds a specific item within the shop's inventory by its UUID.
         * Note: Since inventory is now an object, this returns the [key, value] pair.
         * @param {string} itemUuid The UUID of the item to find.
         * @returns {Array|undefined} The [inventoryEntryId, inventoryEntryObject] if found.
         */
        findInventoryItem(itemUuid) {
            return Object.entries(this.shop.inventory).find(([id, item]) => item.itemUuid === itemUuid);
        }

        /**
         * Adds a new item to the shop's inventory.
         * @param {object} itemData - The data for the item to add, must include a 'uuid'.
         * @param {object} [shopData={}] - Shop-specific data for the item.
         * @param {number} [shopData.qty=1] - The quantity to add.
         * @param {number} [shopData.sellPrice=itemData.system.technology.cost || 0] - The base selling price.
         * @param {number} [shopData.buyPrice=0] - The base buying price.
         * @param {string} [shopData.availability="1R"] - The base availability string.
         * @param {object} [shopData.buyTime={value: 24, unit: "hours"}] - The delivery time.
         * @returns {Promise<Document>} The promise from the actor update.
         */
        async addItemToInventory(itemData, shopData = {}) {
            if (!itemData?.uuid) throw new Error("Item data must include a UUID.");
            if (this.findInventoryItem(itemData.uuid)) {
                ui.notifications.warn("This item is already in the shop's inventory.");
                return;
            }

            const newItemId = foundry.utils.randomID(); // Generate a simple, safe ID for the key
            const newInventoryItem = {
                itemUuid: itemData.uuid,
                qty: shopData.qty ?? 1,
                sellPrice: { value: shopData.sellPrice ?? 0, base: shopData.sellPrice ?? 0 },
                buyPrice: { value: shopData.buyPrice ?? 0, base: shopData.buyPrice ?? 0 },
                availability: { value: shopData.availability ?? "1R", base: shopData.availability ?? "1R" },
                buyTime: shopData.buyTime ?? { value: 24, unit: "hours" },
                comments: ""
            };

            // This is the atomic update you were looking for!
            return this.update({
                [`system.shop.inventory.${newItemId}`]: newInventoryItem
            });
        }

        /**
         * Updates an existing item in the shop's inventory.
         * This becomes much simpler with an object structure.
         * @param {string} inventoryEntryId - The unique ID of the inventory entry (NOT the item's UUID).
         * @param {object} updateData - An object with the data to change, e.g., { qty: 5, "sellPrice.value": 150 }.
         * @returns {Promise<Document>} The promise from the actor update.
         */
        async updateInventoryItem(inventoryEntryId, updateData) {
            const expandedUpdateData = {};
            for (const [key, value] of Object.entries(updateData)) {
                expandedUpdateData[`system.shop.inventory.${inventoryEntryId}.${key}`] = value;
            }
            return this.update(expandedUpdateData);
        }

        /**
         * Removes an item from the shop's inventory.
         * @param {string} inventoryEntryId - The unique ID of the inventory entry to remove.
         * @returns {Promise<Document>} The promise from the actor update.
         */
        async removeItemFromInventory(inventoryEntryId) {
            // To remove a key from an object, we update it to be deleted.
            const keyToRemove = `system.shop.inventory.${inventoryEntryId}`;
            return this.update({ [keyToRemove]: foundry.utils.DELETE });
        }
    }
    return { ShopActor, ShopActorData };
}