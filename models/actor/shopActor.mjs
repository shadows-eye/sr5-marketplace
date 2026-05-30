
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
                itemPrice: new foundry.data.fields.SchemaField({
                    value: new foundry.data.fields.NumberField({ required: true, min: 0, initial: 0, label: "Item Price" }),
                    base: new foundry.data.fields.NumberField({ required: true, min: 0, initial: 0, label: "Unmodified Sell Price" })
                }),
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
                servingEmployee: new foundry.data.fields.StringField({ initial: "", label: "Serving Employee" }),
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
    
    // Copy allowed item types from character to shop so the shop can hold embedded skill items, gear, etc.
    if (CONFIG.Actor.allowedItemTypes) {
        CONFIG.Actor.allowedItemTypes[SHOP_ACTOR_TYPE] = CONFIG.Actor.allowedItemTypes.character || [];
    }
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

        /** @override */
        isType(type) {
            if (this.type !== "sr5-marketplace.shop") return super.isType(type);
            if (type === "character") return true;
            return super.isType(type);
        }

        /** @override */
        prepareBaseData() {
            if (this.type !== "sr5-marketplace.shop") {
                super.prepareBaseData();
                return;
            }
            const originalType = this.type;
            try {
                this.type = "character";
                super.prepareBaseData();
            } finally {
                this.type = originalType;
            }
        }

        /** @override */
        prepareDerivedData() {
            if (this.type !== "sr5-marketplace.shop") {
                super.prepareDerivedData();
                return;
            }
            const originalType = this.type;
            try {
                this.type = "character";
                super.prepareDerivedData();
            } finally {
                this.type = originalType;
            }
        }

        /** @override */
        async _preUpdate(changed, options, user) {
            await super._preUpdate(changed, options, user);
            if (this.type !== "sr5-marketplace.shop") return;
            if (foundry.utils.hasProperty(changed, "system.shop.servingEmployee")) {
                const newUuid = foundry.utils.getProperty(changed, "system.shop.servingEmployee");
                if (newUuid) {
                    const employeeActor = await fromUuid(newUuid);
                    if (employeeActor) {
                        for (const attrKey of ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "magic", "resonance", "essence", "edge"]) {
                            const val = employeeActor.system.attributes[attrKey]?.base ?? employeeActor.system.attributes[attrKey]?.value ?? 0;
                            foundry.utils.setProperty(changed, `system.attributes.${attrKey}.base`, val);
                            foundry.utils.setProperty(changed, `system.attributes.${attrKey}.value`, val);
                        }

                        // Derive legacy skills
                        if (employeeActor.system.skills) {
                            foundry.utils.setProperty(changed, "system.skills", foundry.utils.duplicate(employeeActor.system.skills));
                        }

                        // Derive embedded skill items
                        const currentSkillIds = this.items.filter(i => i.type === "skill").map(i => i.id);
                        if (currentSkillIds.length > 0) {
                            await this.deleteEmbeddedDocuments("Item", currentSkillIds, { render: false });
                        }
                        const employeeSkills = employeeActor.items.filter(i => i.type === "skill");
                        const itemsToCreate = employeeSkills.map(i => {
                            const itemObj = i.toObject();
                            delete itemObj._id;
                            return itemObj;
                        });
                        if (itemsToCreate.length > 0) {
                            await this.createEmbeddedDocuments("Item", itemsToCreate, { render: false });
                        }
                    }
                } else {
                    for (const attrKey of ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "magic", "resonance", "essence", "edge"]) {
                        foundry.utils.setProperty(changed, `system.attributes.${attrKey}.base`, 0);
                        foundry.utils.setProperty(changed, `system.attributes.${attrKey}.value`, 0);
                    }

                    // Reset legacy skills
                    foundry.utils.setProperty(changed, "system.skills", {});

                    // Delete embedded skill items
                    const currentSkillIds = this.items.filter(i => i.type === "skill").map(i => i.id);
                    if (currentSkillIds.length > 0) {
                        await this.deleteEmbeddedDocuments("Item", currentSkillIds, { render: false });
                    }
                }
            }
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
            if (this.type !== "sr5-marketplace.shop") return;
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
            const employees = this.shop.employees || [];
            if (employees.includes(actorUuid)) return;
            return this.update({ "system.shop.employees": [...employees, actorUuid] });
        }

        /**
         * Removes an employee from the shop.
         * @param {string} actorUuid The UUID of the actor to remove.
         * @returns {Promise<this>} The updated ShopActor document.
         */
        async removeEmployee(actorUuid) {
            const employees = (this.shop.employees || []).filter(uuid => uuid !== actorUuid);
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
         * @param {object} [shopData={}] Shop-specific data (calculated by InventoryRules).
         * @returns {Promise<this>}
         */
        async addItemToInventory(itemData, shopData = {}) {
            if (!itemData?.uuid) throw new Error("Item data must include a UUID.");
            if (this.findInventoryItem(itemData.uuid)) {
                return ui.notifications.warn("This item is already in the shop's inventory.");
            }
            const newItemId = foundry.utils.randomID();
            
            // Safely unwrap the nested objects returned by the Rules Engine
            const itemPriceVal = shopData.itemPrice?.value ?? shopData.itemPrice ?? 0;
            const sellPriceVal = shopData.sellPrice?.value ?? shopData.sellPrice ?? 0;
            const buyPriceVal = shopData.buyPrice?.value ?? shopData.buyPrice ?? 0;
            const availVal = shopData.availability?.value ?? shopData.availability ?? "1R";

            const newInventoryItem = {
                itemUuid: itemData.uuid,
                qty: shopData.qty ?? 1,
                itemPrice: { value: itemPriceVal, base: itemPriceVal },
                sellPrice: { value: sellPriceVal, base: sellPriceVal },
                buyPrice: { value: buyPriceVal, base: buyPriceVal },
                availability: { value: availVal, base: availVal },
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
         * @param {string} inventoryEntryId The unique ID of the inventory entry to remove.
         * @returns {Promise<this>}
         */
        /**
         * Removes an item from the shop's inventory.
         * @param {string} inventoryEntryId The unique ID of the inventory entry to remove.
         * @returns {Promise<this>}
         */
        async removeItemFromInventory(inventoryEntryId) {
            const updateData = {
                [`system.shop.inventory.-=${inventoryEntryId}`]: null
            };
            
            console.log("Attempting to apply update:", updateData);
            return this.update(updateData);
        }

        /**
         * Returns the shop's embedded Host item if one exists.
         * @type {SR5Item|null}
         */
        get hostItem() {
            return this.items.find(i => i.type === "host") || null;
        }

        /**
         * Calculates the default Host Rating dynamically based on connection contacts in the world.
         * @returns {number} The calculated Host Rating (1-12).
         */
        calculateDefaultHostRating() {
            const ownerUuid = this.shop.owner;
            if (!ownerUuid) return 1;

            let highestRating = 1;
            if (game.actors) {
                for (const actor of game.actors) {
                    const contacts = actor.itemTypes.contact || actor.items.filter(i => i.type === "contact") || [];
                    for (const contact of contacts) {
                        if (contact.system.linkedActor === ownerUuid) {
                            const connectionRating = contact.system.connection ?? 1;
                            if (connectionRating > highestRating) {
                                highestRating = connectionRating;
                            }
                        }
                    }
                }
            }
            return highestRating;
        }

        /**
         * Synchronizes employee actors and commlinks/cyberdecks to the shop's host.
         */
        async syncEmployeeDevicesToHost() {
            if (this._syncingDevices) return;
            this._syncingDevices = true;

            try {
                const host = this.hostItem;
                if (!host) return;

                const baseEmployees = await this.getEmployees();
                
                // Gather all actor documents to sync (both base sidebar actors and any active token actors on canvas)
                const employees = [];
                for (const emp of baseEmployees) {
                    // Always add the sidebar actor
                    if (!employees.some(e => e.uuid === emp.uuid)) {
                        employees.push(emp);
                    }
                    // Add any active token actors
                    if (typeof emp.getActiveTokens === "function") {
                        const tokens = emp.getActiveTokens() || [];
                        for (const t of tokens) {
                            if (t.document?.actor) {
                                if (!employees.some(e => e.uuid === t.document.actor.uuid)) {
                                    employees.push(t.document.actor);
                                }
                            }
                        }
                    }
                }

                // 1. Sync employee actors themselves to the host network
                const currentSlaved = host.slaves || [];
                const currentSlavedActors = currentSlaved.filter(s => s.documentName === "Actor");
                
                const actorsToAdd = employees.filter(emp => !currentSlavedActors.some(s => s.uuid === emp.uuid));
                const actorsToRemove = currentSlavedActors.filter(s => !employees.some(emp => emp.uuid === s.uuid));

                for (const emp of actorsToRemove) {
                    console.log(`SR5 Marketplace | Disconnecting employee actor "${emp.name}" from Host "${host.name}"`);
                    if (game.shadowrun5e?.storage?.matrix?.networks) {
                        await game.shadowrun5e.storage.matrix.networks.removeSlave(host, emp);
                    } else if (typeof emp.disconnectNetwork === "function") {
                        await emp.disconnectNetwork();
                    } else {
                        await host.removeSlave(emp);
                    }
                }

                for (const emp of actorsToAdd) {
                    console.log(`SR5 Marketplace | Connecting employee actor "${emp.name}" to Host "${host.name}"`);
                    if (typeof host.addSlave === "function") {
                        await host.addSlave(emp, { triggerUpdate: false });
                    } else if (typeof emp.connectNetwork === "function") {
                        await emp.connectNetwork(host);
                    } else {
                        await host.addSlave(emp, { triggerUpdate: true });
                    }
                }

                // 2. Clean up any previously slaved devices belonging to our employees from the host WAN
                const employeeDevices = [];
                for (const employee of employees) {
                    const devices = employee.items.filter(i => 
                        i.type === "device" && 
                        ["commlink", "cyberdeck"].includes(i.system.category)
                    );
                    employeeDevices.push(...devices);
                }

                const currentSlavedDevices = currentSlaved.filter(s => s.documentName === "Item" && s.type === "device");
                const devicesToRemove = currentSlavedDevices.filter(s => employeeDevices.some(d => d.uuid === s.uuid));

                for (const dev of devicesToRemove) {
                    console.log(`SR5 Marketplace | Cleaning up employee device "${dev.name}" from Host "${host.name}"`);
                    if (game.shadowrun5e?.storage?.matrix?.networks) {
                        await game.shadowrun5e.storage.matrix.networks.removeSlave(host, dev);
                    } else {
                        await host.removeSlave(dev);
                    }
                }

                // 3. Rerender all active sheets locally and synchronously to ensure UI update without database conflicts
                if (this.sheet) this.sheet.render();
                for (const emp of employees) {
                    if (emp.sheet) emp.sheet.render();
                }
            } finally {
                this._syncingDevices = false;
            }
        }
    }
    
    CONFIG.Actor.documentClass = ShopActor;
    //console.debug("sr5-marketplace | ShopActor parent:", Object.getPrototypeOf(ShopActor.prototype).constructor.name);
    return { ShopActor, ShopActorData};
}