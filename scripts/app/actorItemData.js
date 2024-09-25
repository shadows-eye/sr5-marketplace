import ItemData from './itemData.js';  // Assuming itemData.js contains getOrderDataFromFlag
import { logActorHistory } from './actorHistoryLog.js';
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
                    // Use `uuid` instead of `Uuid`, and fallback to `_id`
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
            } else {
                console.log('Base items loaded:', this.baseItemsArray);
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
        const allowedTypes = ["quality", "adept_power", "spell", "complex_form"];  // Allowed Item types for karma flag on the item
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
                // Inject the karma flag into the enriched item if necessary
                // Only enrich with the karma flag if the item type is one of the allowed types
                if (allowedTypes.includes(enrichedItem.type)) {
                    if (!enrichedItem.flags?.['sr5-marketplace']?.karma) {
                        enrichedItem.flags = enrichedItem.flags || {};
                        enrichedItem.flags['sr5-marketplace'] = enrichedItem.flags['sr5-marketplace'] || {};
                        enrichedItem.flags['sr5-marketplace'].karma = flagItem.karma || 0;  // Set karma from flag or default to 0
                    } else {
                        // Keep the existing karma value if it already exists
                        enrichedItem.flags['sr5-marketplace'].karma = enrichedItem.flags['sr5-marketplace'].karma;
                    }
                }
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
    async createItemsOnActor(actor, creationItems, orderData) {
        if (!actor) {
            console.error("No valid actor provided.");
            return;
        }
        // Initialize the createdItems array to store the new item mappings
        const createdItems = [];
        const createdItemsUuid = [];
        // Iterate over the creationItems and create each item on the actor
    for (let i = 0; i < creationItems.length; i++) {
        const itemData = creationItems[i];
        const flagItem = orderData.items[i];  // Corresponding flag item from the orderData

        try {
            // Create the item on the actor and retrieve the created item
            const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
            console.log(`Created item: ${createdItem.name} on actor: ${actor.name}`);
            createdItemsUuid.push([createdItem.uuid]);

            // Retrieve karma value from the sr5-marketplace flag if it exists
            const itemKarmaFlag = createdItem.getFlag('sr5-marketplace', 'karma') || 0;

            // Retrieve the most recently modified item by name on the actor
            const recentItem = actor.items
                .filter(i => i.name === createdItem.name)  // Filter by name
                .sort((a, b) => b._stats.modifiedTime - a._stats.modifiedTime)[0];  // Sort by modifiedTime and get the most recent one

            if (!recentItem) {
                console.warn(`Could not find the recently created item on actor: ${actor.name} for item ${createdItem.name}`);
            }

            // Create the mapping of IDs
            createdItems.push({
                baseId: flagItem._id,  // The ID from the base item (compendium or world)
                creationItemId: recentItem.uuid,  // The ID of the most recently modified item on the actor
                name: createdItem.name,
                calculatedCost: createdItem.system.technology.cost,
                selectedRating: createdItem.system.technology.rating,
                calculatedAvailability: createdItem.system.technology.availability,
                calculatedEssence: createdItem.system.technology.essence,
                calculatedKarma: itemKarmaFlag,
            });
        } catch (error) {
            console.error(`Error creating item: ${itemData.name}`, error);
        }
    }   
    console.log(actor, createdItems);
        return createdItems;  // Return the array with updated IDs
    }
}