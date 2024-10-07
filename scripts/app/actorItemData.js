import ItemData from './itemData.js';  // Assuming itemData.js contains getOrderDataFromFlag
import { logActorHistory } from './actorHistoryLog.js';
import { getFormattedTimestamp } from './itemData.js'; 
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
    /**
     * 
     * @param {object} actor 
     * @param {string} skillKey 
     * @returns 
     */
    async increaseSkill(actor, skillKey) {
        if (!actor || !skillKey) return;
    
        console.log(`Attempting to increase skill '${skillKey}' for actor: ${actor.name}`);
    
        // Use the utility function to increase the skill value by 1
        await this.updateSkillValue(actor, skillKey, 1);
    
        console.log(`Successfully increased skill '${skillKey}'`);
    
        // Set up a hook to re-inject karma buttons for all skills after re-render
        Hooks.on("renderActorSheet", async (app, html) => {
            if (app.document.id !== actor.id) return;
    
            console.log(`Re-render detected for actor: ${actor.name}. Injecting karma adjust buttons for all skills.`);

            // Inject buttons for all skills
            this.injectKarmaAdjustButtonsForAllSkills(html, actor);

        });
        // Add the increase action to the actor's history log
        await this.logSkillChangeHistory(actor, skillKey, true);  // `true` indicates skill was increased
    }
    /**
     * 
     * @param {object} actor 
     * @param {string} skillKey 
     * @returns 
     */
    async decreaseSkill(actor, skillKey) {
        if (!actor || !skillKey) return;
    
        console.log(`Attempting to decrease skill '${skillKey}' for actor: ${actor.name}`);
    
        // Use the utility function to decrease the skill value by 1
        await this.updateSkillValue(actor, skillKey, -1);
    
        console.log(`Successfully decreased skill '${skillKey}'`);
    
        // Set up a hook to re-inject karma buttons for all skills after re-render
        Hooks.on("renderActorSheet", async (app, html) => {
            if (app.document.id !== actor.id) return;
    
            console.log(`Re-render detected for actor: ${actor.name}. Injecting karma adjust buttons for all skills.`);
            // Inject buttons for all skills
            this.injectKarmaAdjustButtonsForAllSkills(html, actor);
        
        });
        // Add the increase action to the actor's history log
        await this.logSkillChangeHistory(actor, skillKey, true);  // `true` indicates skill was increased
    }
    /**
     * Utility function to get the current value of a skill and update it.
     * It checks if the skill exists within active, knowledge, or language categories.
     * @param {Actor} actor - The actor to find the skill in.
     * @param {string} skillKey - The unique identifier of the skill to update.
     * @param {number} increment - The value to increase/decrease the skill by.
     */
    async updateSkillValue(actor, skillKey, increment) {
        let updated = false;
        const karmaCostPerIncrement = 4; // Cost for 'active' skills
        const karmaCostForKnowledge = 2; // Cost for 'knowledge' and 'language' skills

        // Helper function to check if the actor has enough karma
        const hasEnoughKarma = (cost) => {
            return (actor.system.karma.value) >= cost;
        };

        // Helper function to update the actor's karma
        const updateKarma = async (karmaChange) => {
            const currentKarma = actor.system.karma.value ;
            await actor.update({ "system.karma.value": currentKarma + karmaChange });
        };

        // Check if skill is in 'active' skills
        if (actor.system.skills.active[skillKey]) {
            const currentBaseValue = actor.system.skills.active[skillKey].base || 0;
            const newBaseValue = currentBaseValue + increment;
            const karmaCost = karmaCostPerIncrement * Math.abs(increment);

            console.log(`Updating active skill: ${skillKey}, currentBaseValue: ${currentBaseValue}, newBaseValue: ${newBaseValue}`);

            if (increment > 0 && !hasEnoughKarma(karmaCost)) {
                // Not enough karma to increase the skill
                ui.notifications.warn(`Not enough karma to increase ${skillKey}.`);
                return;
            }

            if (newBaseValue < 0) {
                // Prevent decreasing below zero
                ui.notifications.warn(`${skillKey} cannot be decreased below zero.`);
                return;
            }

            // Update the 'base' value, which is what the normal edit mode changes
            await actor.update({ [`system.skills.active.${skillKey}.base`]: newBaseValue });
            updated = true;

            // Update karma accordingly
            if (increment > 0) {
                await updateKarma(-karmaCost); // Deduct karma for increase
            } else if (increment < 0 && currentBaseValue > 0) {
                await updateKarma(karmaCost); // Refund karma for decrease
            }

            console.log(`Active skill '${skillKey}' updated to base value ${newBaseValue}`);
        }

        // Check if skill is in 'knowledge' skills
        for (const [knowledgeType, knowledgeData] of Object.entries(actor.system.skills.knowledge)) {
            if (knowledgeData.value && knowledgeData.value[skillKey]) {
                const currentBaseValue = knowledgeData.value[skillKey].base || 0;
                const newBaseValue = currentBaseValue + increment;
                const karmaCost = karmaCostForKnowledge * Math.abs(increment);

                console.log(`Updating knowledge skill: ${skillKey}, currentBaseValue: ${currentBaseValue}, newBaseValue: ${newBaseValue}`);

                if (increment > 0 && !hasEnoughKarma(karmaCost)) {
                    // Not enough karma to increase the skill
                    ui.notifications.warn(`Not enough karma to increase ${skillKey}.`);
                    return;
                }

                if (newBaseValue < 0) {
                    // Prevent decreasing below zero
                    ui.notifications.warn(`${skillKey} cannot be decreased below zero.`);
                    return;
                }

                // Update the 'base' value
                await actor.update({ [`system.skills.knowledge.${knowledgeType}.value.${skillKey}.base`]: newBaseValue });
                updated = true;

                // Update karma accordingly
                if (increment > 0) {
                    await updateKarma(-karmaCost); // Deduct karma for increase
                } else if (increment < 0 && currentBaseValue > 0) {
                    await updateKarma(karmaCost); // Refund karma for decrease
                }

                console.log(`Knowledge skill '${skillKey}' updated to base value ${newBaseValue}`);
            }
        }

        // Check if skill is in 'language' skills
        if (actor.system.skills.language.value[skillKey]) {
            const currentBaseValue = actor.system.skills.language.value[skillKey].base || 0;
            const newBaseValue = currentBaseValue + increment;
            const karmaCost = karmaCostForKnowledge * Math.abs(increment);

            console.log(`Updating language skill: ${skillKey}, currentBaseValue: ${currentBaseValue}, newBaseValue: ${newBaseValue}`);

            if (increment > 0 && !hasEnoughKarma(karmaCost)) {
                // Not enough karma to increase the skill
                ui.notifications.warn(`Not enough karma to increase ${skillKey}.`);
                return;
            }

            if (newBaseValue < 0) {
                // Prevent decreasing below zero
                ui.notifications.warn(`${skillKey} cannot be decreased below zero.`);
                return;
            }

            // Update the 'base' value
            await actor.update({ [`system.skills.language.value.${skillKey}.base`]: newBaseValue });
            updated = true;

            // Update karma accordingly
            if (increment > 0) {
                await updateKarma(-karmaCost); // Deduct karma for increase
            } else if (increment < 0 && currentBaseValue > 0) {
                await updateKarma(karmaCost); // Refund karma for decrease
            }

            console.log(`Language skill '${skillKey}' updated to base value ${newBaseValue}`);
        }

        if (updated) {
            console.log(`Successfully updated skill '${skillKey}' with increment: ${increment}`);
        } else {
            console.warn(`Skill with key '${skillKey}' not found in any category or invalid update.`);
        }
    }

    /**
     * Injects karma adjust buttons into all skill items on the actor sheet.
     * @param {JQuery} html - The HTML element of the actor sheet to inject buttons into.
     * @param {Actor} actor - The actor whose sheet is being modified.
     */
    injectKarmaAdjustButtonsForAllSkills(html, actor) {
        console.log(`Injecting karma adjust buttons for all skills on actor sheet for actor: ${actor.name}`);

        // Locate the skill list items, which represent each skill on the actor sheet
        const skillItems = html.find('.list-item[data-item-type="skill"]');

        // Iterate over each skill item to inject the +/- buttons
        skillItems.each((index, skillElement) => {
            const $skillElement = $(skillElement);

            // Locate the .item-right div inside the skill element
            const itemRight = $skillElement.find('.item-right');

            // Locate the .item-text.rtg element where we want to place the karma-adjust-buttons right behind
            const rtgElement = itemRight.find('.item-text.rtg');

            // Check if buttons already exist to avoid duplication
            if (rtgElement.next('.karma-adjust-buttons').length > 0) return;

            // Create the HTML for the plus and minus buttons using FontAwesome icons
            const buttonsHtml = `
                <div class="karma-adjust-buttons" style="display: inline-block; margin-left: 10px;">
                    <plus class="karma-plus-button"><i class="fas fa-plus"></i></plus>
                    <minus class="karma-minus-button"><i class="fas fa-minus"></i></minus>
                </div>
            `;

            // Insert the buttons directly after the `.item-text.rtg` element
            $(buttonsHtml).insertAfter(rtgElement);

            // Set up an event listener for the plus button to increase the skill value
            itemRight.find('.karma-plus-button').on('click', async (event) => {
                event.preventDefault();
                console.log(`Increase button clicked for skill: ${$skillElement.data('item-id')}`);

                const skillKey = $skillElement.data('item-id');
                await this.increaseSkill(actor, skillKey);
            });

            // Set up an event listener for the minus button to decrease the skill value
            itemRight.find('.karma-minus-button').on('click', async (event) => {
                event.preventDefault();
                console.log(`Decrease button clicked for skill: ${$skillElement.data('item-id')}`);

                const skillKey = $skillElement.data('item-id');
                await this.decreaseSkill(actor, skillKey);
            });
        });

        console.log(`Injected karma adjust buttons for all skills on the actor sheet.`);
    }


    /**
     * Logs the skill change (increase or decrease) in the actor's history flag.
     * @param {Actor} actor - The actor whose skill history is being logged.
     * @param {string} skillKey - The key identifying the skill in actor data.
     * @param {boolean} gain - Whether the skill was increased (true) or decreased (false).
     */
    async logSkillChangeHistory(actor, skillKey, gain) {
        if (!actor || !skillKey) return;

        // Retrieve the actor's current history flag
        let historyFlag = actor.getFlag('sr5-marketplace', 'history') || [];

        // Ensure the history flag is an array (conversion if needed)
        if (!Array.isArray(historyFlag)) {
            console.warn("History flag is not an array. Converting...");
            if (typeof historyFlag === 'object' && historyFlag !== null) {
                historyFlag = Object.keys(historyFlag).map(key => historyFlag[key]);
            } else {
                historyFlag = [];
            }
        }

        // Get formatted timestamps for the log entry
        const { flagTimestamp } = await getFormattedTimestamp();

        // Retrieve the old and new karma spent for the skill, as well as the skill name
        let oldKarmaSpent = 0;
        let newKarmaSpent = 0;
        let skillKeyLocalized = '';
        let oldSkillValue = 0;
        let newSkillValue = 0;
        let karmaCostPerLevel = 4; // Default for active skills
        
        // Determine if the skill is active, knowledge, or language and calculate old and new karma costs accordingly
        if (actor.system.skills.active[skillKey]) {
            // Active skills (karma cost 4 per level)
        skillKeyLocalized = game.i18n.localize(skillKeyLocalized);
            oldSkillValue = actor.system.skills.active[skillKey].value || 0;
            newSkillValue = oldSkillValue + (gain ? 1 : -1);
            oldKarmaSpent = oldSkillValue * karmaCostPerLevel;
            newKarmaSpent = newSkillValue * karmaCostPerLevel;
        } else if (Object.keys(actor.system.skills.knowledge).some(type => actor.system.skills.knowledge[type].value[skillKey])) {
            // For knowledge skills, karma cost is 2 per level
            const type = Object.keys(actor.system.skills.knowledge).find(t => actor.system.skills.knowledge[t].value[skillKey]);
            const currentValue = actor.system.skills.knowledge[type].value[skillKey].value || 0;
            oldKarmaSpent = currentValue * 2;
            newKarmaSpent = (currentValue + (gain ? 1 : -1)) * 2;
        } else if (actor.system.skills.language.value[skillKey]) {
            // For language skills, karma cost is 2 per level
            const currentValue = actor.system.skills.language.value[skillKey].value || 0;
            oldKarmaSpent = currentValue * 2;
            newKarmaSpent = (currentValue + (gain ? 1 : -1)) * 2;
        }

        // Calculate the difference in karma cost
        const karmaSpent = newKarmaSpent - oldKarmaSpent;

        // Construct the new history entry for the skill change
        const newHistoryEntry = {
            actorFlagId: actor.id,
            items: null,  // No items involved in skill adjustment
            karma: karmaSpent, // Karma spent for the skill change (positive or negative)
            gain: gain,  // True if increased, false if decreased
            surgicalDamage: 0,
            timestamp: flagTimestamp,
            skillChange: {
                skillKey: skillKey,
                oldValue: oldSkillValue,
                newValue: newSkillValue,
                karmaSpent: karmaSpent
            }
        };

        // Add the new history entry to the history flag
        historyFlag.push(newHistoryEntry);

        // Update the history flag on the actor
        await actor.setFlag('sr5-marketplace', 'history', historyFlag);

        console.log(`Logged history for skillKey '${skillKey}' for actor: ${actor.name}`);
        // Log the change in the actor's journal
        await logActorHistory(actor);
    }
}
// End of ActorItemData class