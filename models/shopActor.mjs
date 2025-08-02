
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
        static get LOCALIZATION_PREFIXES() {
            return super.LOCALIZATION_PREFIXES.concat("SR5" ,"SR5.Marketplace.Shop");
        }
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
                    value: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 24, label: "Buy Time" }),
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
                owner: new foundry.data.fields.StringField({ initial: "", label: "Owner "}),
                employees: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField({initial: "", label: "Employees"})),
                connection: new foundry.data.fields.StringField({ initial: "", label: "Connection"}),
                modifierValue: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.NumberField({ initial: 0 }),
                    base: new foundry.data.fields.NumberField({ initial: 0 })
                }),
                modifierType: new foundry.data.fields.StringField({ initial: "discount", choices: ["discount", "fee"], label:"Modifier Type", hint: "does a discount or fee apply"}),
                shopRadius: new foundry.data.fields.SchemaField({
                        value: new foundry.data.fields.NumberField({ initial: 1, min: 1, label: "Shop Radius", hint: "Used to detect if you buy from this Actor" }),
                        base: new foundry.data.fields.NumberField({ initial: 1, min: 1 })
                    }),
                tokenInRadius: new foundry.data.fields.ObjectField({ initial: {}, label: "Token in Radius" }),

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
                    initial: {}, label: "Inventory"
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
     * The custom Actor class for Shops, with a full API for data management.
     */
    class ShopActor extends SR5Actor {
        /**
         * A convenience getter for the shop-specific data.
         * @type {object}
         */
        get shop() {
            return this.system.shop;
        }

        /**
         * @override
         * This method is called after the Actor's data has been updated. We use it to trigger
         * a rescan for tokens in the shop's radius if the radius has changed.
         * @param {object} data         The data that was changed.
         * @param {object} options      Options for the update.
         * @param {string} userId       The ID of the user who triggered the update.
         */
        _onUpdate(data, options, userId) {
            super._onUpdate(data, options, userId);
            if (foundry.utils.hasProperty(data, "system.shop.shopRadius")) {
                this._updateTokensInRadius();
            }
        }

        // --- Owner Management ---

        /**
         * Retrieves the Actor document for the shop's owner.
         * @returns {Promise<Actor5e|null>} The owner actor document, or null if not set.
         */
        async getOwner() {
            if (!this.shop.owner) return null;
            return fromUuid(this.shop.owner);
        }

        /**
         * Sets the owner of the shop.
         * @param {string} actorUuid The UUID of the actor to set as the owner.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async updateOwner(actorUuid) {
            return this.update({ "system.shop.owner": actorUuid });
        }

        /**
         * Removes the owner from the shop.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async removeOwner() {
            return this.update({ "system.shop.owner": "" });
        }

        // --- Employee Management ---

        /**
         * Retrieves an array of Actor documents for the shop's employees.
         * This version correctly handles fetching multiple documents from UUIDs.
         * @returns {Promise<Actor[]>} An array of employee actor documents.
         */
        async getEmployees() {
            // Return an empty array if there are no employee UUIDs to process.
            if (!this.shop.employees?.length) return [];

            // Filter out any empty strings from the array before processing.
            const employeeUuids = this.shop.employees.filter(uuid => uuid);
            if (employeeUuids.length === 0) return [];

            // Create an array of promises, one for each UUID lookup.
            const promises = employeeUuids.map(uuid => fromUuid(uuid));

            // Use Promise.all to wait for all lookups to complete.
            const employees = await Promise.all(promises);

            // Filter out any null results in case a UUID was invalid or the document was deleted.
            return employees.filter(e => e);
        }

        /**
         * Adds an employee to the shop.
         * @param {string} actorUuid The UUID of the actor to add as an employee.
         * @returns {Promise<this>|void} The updated ShopActor document, or void if the employee already exists.
         */
        async addEmployee(actorUuid) {
            const employees = this.shop.employees;
            if (employees.includes(actorUuid)) return;
            return this.update({ "system.shop.employees": [...employees, actorUuid] });
        }

        /**
         * Removes an employee from the shop.
         * @param {string} actorUuid The UUID of the actor to remove.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async removeEmployee(actorUuid) {
            const employees = this.shop.employees.filter(uuid => uuid !== actorUuid);
            return this.update({ "system.shop.employees": employees });
        }

        // --- Connection Management ---

        /**
         * Retrieves the Item document for the shop's connection.
         * @returns {Promise<Item5e|null>} The connection item document, or null if not set.
         */
        async getConnection() {
            if (!this.shop.connection) return null;
            return fromUuid(this.shop.connection);
        }

        /**
         * Sets the connection item for the shop.
         * @param {string} itemUuid The UUID of the item to set as the connection.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async updateConnection(itemUuid) {
            return this.update({ "system.shop.connection": itemUuid });
        }

        /**
         * Removes the connection from the shop.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async removeConnection() {
            return this.update({ "system.shop.connection": "" });
        }

        // --- Modifier Management ---

        /**
         * Updates the shop's global price modifier.
         * @param {object} [modifierData={}] The data to update.
         * @param {number} [modifierData.value] The new base value for the modifier.
         * @param {string} [modifierData.type]  The new type of modifier ('discount' or 'fee').
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async updateModifier({ value, type } = {}) {
            const updateData = {};
            if ( value !== undefined ) updateData["system.shop.modifierValue.base"] = value;
            if ( type !== undefined ) updateData["system.shop.modifierType"] = type;
            return this.update(updateData);
        }

        // --- Shop Radius & Token Detection ---

        /**
         * Updates the base radius of the shop for detecting nearby tokens.
         * @param {number} baseRadius The new radius.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async updateShopRadius(baseRadius) {
            return this.update({ "system.shop.shopRadius.base": baseRadius });
        }

        /**
         * Retrieves the Token documents for all tokens currently within the shop's radius.
         * @returns {Promise<TokenDocument[]>} An array of TokenDocuments.
         */
        async getTokensInRadius() {
            if (!this.shop.tokenInRadius) return [];
            const tokenUuids = Object.values(this.shop.tokenInRadius).map(data => data.uuid);
            return fromUuid.multi(tokenUuids);
        }

        /**
         * Finds all tokens on the current canvas within the shop's radius and updates the actor's data.
         * @private
         */
        async _updateTokensInRadius() {
            if (!canvas.ready || !this.token) return;
            const shopToken = this.token;
            const radius = this.system.shop.shopRadius.value;
            const tokensInRange = {};
            const otherTokens = canvas.tokens.placeables.filter(t => t.id !== shopToken.id);

            for (const token of otherTokens) {
                const distance = canvas.grid.measureDistance(shopToken, token);
                if (distance <= radius) {
                    tokensInRange[token.id] = { uuid: token.uuid, x: token.x, y: token.y };
                }
            }
            await this.update({ "system.shop.tokenInRadius": tokensInRange });
            console.log(`Found ${Object.keys(tokensInRange).length} tokens within the shop's radius.`);
        }

        // --- Inventory Management ---

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
         * @returns {Promise<this>}
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
         * A generic method to update any properties of an item in the inventory.
         * @param {string} inventoryEntryId The unique ID of the inventory entry.
         * @param {object} updateData Data to change, e.g., { qty: 5, "sellPrice.value": 150 }.
         * @returns {Promise<this>}
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
         * @param {string} inventoryEntryId The unique ID of the inventory entry.
         * @returns {Promise<this>}
         */
        async removeItemFromInventory(inventoryEntryId) {
            return this.update({
                [`system.shop.inventory.${inventoryEntryId}`]: foundry.utils.DELETE
            });
        }
    
    }
    
    CONFIG.Actor.documentClass = ShopActor;
    return { ShopActor, ShopActorData };
}