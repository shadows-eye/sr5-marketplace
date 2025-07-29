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

    /**
     * The custom Actor class for Shops.
     */
    class ShopActor extends SR5Actor {
        get shop() {
            return this.system.shop;
        }

        async getOwner() {
            if (!this.shop.owner) return null;
            return fromUuid(this.shop.owner);
        }

        async getEmployees() {
            if (!this.shop.employees?.length) return [];
            const employeeUuids = this.shop.employees.filter(uuid => uuid);
            return fromUuid.multi(employeeUuids);
        }

        async getConnection() {
            if (!this.shop.connection) return null;
            return fromUuid(this.shop.connection);
        }

        // --- INVENTORY MANAGEMENT METHODS ---

        /**
         * Finds an inventory entry by the source item's UUID.
         * @param {string} itemUuid The UUID of the source item.
         * @returns {[string, object]|undefined} The [inventoryId, itemObject] if found.
         */
        findInventoryItem(itemUuid) {
            return Object.entries(this.shop.inventory).find(([id, item]) => item.itemUuid === itemUuid);
        }

        /**
         * Adds an item to the inventory.
         * @param {Item} itemData The full Item document to add.
         * @param {object} [shopData={}] Shop-specific data.
         * @returns {Promise<Actor>}
         */
        async addItemToInventory(itemData, shopData = {}) {
            if (!itemData?.uuid) throw new Error("Item data must include a UUID.");
            if (this.findInventoryItem(itemData.uuid)) {
                return ui.notifications.warn("This item is already in the shop's inventory.");
            }
            const newItemId = foundry.utils.randomID();
            const newInventoryItem = {
                itemUuid: itemData.uuid,
                qty: shopData.qty ?? 1,
                sellPrice: { value: shopData.sellPrice ?? 0, base: shopData.sellPrice ?? 0 },
                buyPrice: { value: shopData.buyPrice ?? 0, base: shopData.buyPrice ?? 0 },
                availability: { value: shopData.availability ?? "1R", base: shopData.availability ?? "1R" },
                buyTime: shopData.buyTime ?? { value: 24, unit: "hours" },
                comments: ""
            };
            return this.update({
                [`system.shop.inventory.${newItemId}`]: newInventoryItem
            });
        }

        /**
         * Updates an item in the inventory.
         * @param {string} inventoryEntryId The unique ID of the inventory entry.
         * @param {object} updateData Data to change, e.g., { qty: 5, "sellPrice.value": 150 }.
         * @returns {Promise<Actor>}
         */
        async updateInventoryItem(inventoryEntryId, updateData) {
            const expandedUpdateData = {};
            for (const [key, value] of Object.entries(updateData)) {
                expandedUpdateData[`system.shop.inventory.${inventoryEntryId}.${key}`] = value;
            }
            return this.update(expandedUpdateData);
        }

        /**
         * Removes an item from the inventory.
         * @param {string} inventoryEntryId The unique ID of the inventory entry.
         * @returns {Promise<Actor>}
         */
        async removeItemFromInventory(inventoryEntryId) {
            return this.update({
                [`system.shop.inventory.${inventoryEntryId}`]: foundry.utils.DELETE
            });
        }
    }

    return { ShopActor, ShopActorData };
}