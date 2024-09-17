import ItemData from './itemData.js';  // Assuming itemData.js contains getOrderDataFromFlag

export class ActorItemData extends ItemData {
    constructor(actor = null) {
        super();
        this.actor = actor;  // Actor will be set later, if available
        this.flagItemsArray = [];  // Array to hold items from the flag
        this.baseItemsArray = [];  // Array to hold base items from the world
    }
    /**
     * 
     * @param {*} flagId 
     */
    async initWithFlag(flagId) {
        try {
            const orderData = await this.getOrderDataFromFlag(flagId);  // Fetch flag data
            if (!orderData) {
                throw new Error(`No flag data found for flag ID ${flagId}`);
            }
    
            this.flagItemsArray = orderData.items || [];
    
            // Process flag items and get the base items using fromUuid
            const baseItemPromises = this.flagItemsArray.map(async (flagItem) => {
                try {
                    // Check if the item has a uuid field, otherwise fallback to using _id
                    const itemUuid = flagItem.uuid || `Item.${flagItem._id}`;
                    
                    // Retrieve the base item using fromUuid
                    const baseItem = await fromUuid(itemUuid);
    
                    if (!baseItem) {
                        console.warn(`Base item not found for UUID: ${itemUuid}`);
                    }
                    return baseItem;
                } catch (error) {
                    console.error(`Error retrieving base item for flag item:`, flagItem, error);
                    return null;
                }
            });
    
            // Await all base item promises and filter out any null results
            this.baseItemsArray = (await Promise.all(baseItemPromises)).filter(item => item !== null);
    
            if (this.baseItemsArray.length === 0) {
                console.warn('No base items could be loaded from UUIDs.');
            }
        } catch (error) {
            console.error(`Error processing flag data for flag ID ${flagId}:`, error);
        }
    }
    /**
     * 
     * @returns {Array} - The items with injected data.
     */
    async createItemsWithInjectedData() {
        // Ensure both arrays are populated
        if (!this.flagItemsArray || !this.baseItemsArray) {
            console.error("Flag items or base items are not loaded.");
            return;
        }
    
        // Array to hold the final items with injected data
        const creationItems = [];
    
        // Iterate over flagItemsArray and match with baseItemsArray by _id or uuid
        this.flagItemsArray.forEach(flagItem => {
            // Find the corresponding base item by _id or uuid
            const baseItem = this.baseItemsArray.find(base => base._id === flagItem._id || base.uuid === flagItem.uuid);
    
            if (baseItem) {
                // Create a deep copy of the base item to avoid mutating the original
                const enrichedItem = JSON.parse(JSON.stringify(baseItem));
    
                // Inject necessary values from flagItem into the enrichedItem
                enrichedItem.system.technology.cost = flagItem.system.technology.cost || baseItem.system.technology.cost;
                enrichedItem.system.technology.rating = flagItem.system.technology.rating || flagItem.selectedRating || baseItem.system.technology.rating;
                enrichedItem.system.technology.availability = flagItem.system.technology.availability || flagItem.calculatedAvailability || baseItem.system.technology.availability;
                enrichedItem.system.technology.essence = flagItem.system.technology.essence || flagItem.calculatedEssence || baseItem.system.technology.essence;
    
                // Handle the effects array safely
                enrichedItem.effects = (baseItem.effects || []).map((baseEffect, index) => {
                    const effect = { ...baseEffect }; // Deep copy the effect
    
                    // If the flag item has an effect that matches, enrich it
                    if (flagItem.effects && flagItem.effects[index]) {
                        const flagEffect = flagItem.effects[index];
    
                        // Enrich each part of the effect
                        effect.origin = baseEffect.origin;
                        effect.duration.startTime = baseEffect.duration?.startTime || null;
                        effect.duration.endTime = baseEffect.duration?.endTime || null;
                        effect.disabled = baseEffect.disabled || false;
                        effect.name = baseEffect.name || "";
                        
                        // Ensure `changes` array is handled properly
                        effect.changes = (baseEffect.changes || []).map(change => ({
                            key: change.key || "",
                            mode: change.mode || 0,
                            value: change.value || flagItem.selectedRating || baseItem.system.technology.rating || 0,
                            priority: change.priority || null
                        }));
    
                        effect.transfer = baseEffect.transfer || false;
                        effect.img = baseEffect.img || "";
                        effect.type = baseEffect.type || "";
                        effect.sort = baseEffect.sort || 0;
                    }
    
                    return effect;
                });
    
                // Add the enriched item to the creationItems array
                creationItems.push(enrichedItem);
            } else {
                console.warn(`No matching base item found for flag item with ID: ${flagItem._id}`);
            }
        });
    
        // Log or return the creationItems for later use
        console.log('Creation Items:', creationItems);
    
        // Return creationItems for further processing (e.g., creating items on the actor)
        return creationItems;
    }
    logItems() {
        console.log("Flag Items:", this.flagItemsArray);
        console.log("Base Items:", this.baseItemsArray);
    }
    /**
     * Creates items on an actor using the provided creation items.
     * @param {Actor} actor - The actor to create the items on.
     * @param {Array} creationItems - The items to create on the actor.
     */
    async createItemsOnActor(actor, creationItems) {
        if (!actor) {
            console.error("No valid actor provided.");
            return;
        }
    
        // Iterate over the creationItems and create each item on the actor
        for (let itemData of creationItems) {
            try {
                // Create the item on the actor and retrieve the created item to get the actorItemId
                const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
                console.log(`Created item: ${createdItem.name} on actor: ${actor.name}`);
    
                // Create the mapping of IDs
                createdItems.push({
                    baseId: itemData._id,  // The ID from the base item
                    actorItemId: createdItem.id,  // The ID of the item created on the actor
                    creationItemId: itemData._id,  // This can be the same as the base item for now
                    name: createdItem.name,
                    calculatedCost: createdItem.system.technology.cost,
                    selectedRating: createdItem.system.technology.rating,
                    calculatedAvailability: createdItem.system.technology.availability,
                    calculatedEssence: createdItem.system.technology.essence,
                    calculatedKarma: createdItem.system.technology.karma,
                });
    
            } catch (error) {
                console.error(`Error creating item: ${itemData.name}`, error);
            }
        }
    
        return createdItems;  // Return the array with updated IDs
    }
}