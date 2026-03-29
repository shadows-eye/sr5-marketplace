/**
 * Universal rules engine for calculating marketplace inventory dynamic values.
 */
export class InventoryRules {
    /**
     * Calculates dynamic Buy/Sell prices and delivery times for a new inventory item.
     * @param {Actor} shopActor The Shop Actor document.
     * @param {Item} item The Item document being evaluated.
     * @returns {Promise<Object>} An object containing the calculated initial data.
     */
    static async getCalculatedItemData(shopActor, item) {
        console.group("Marketplace | InventoryRules Calculation");
        console.log(`Evaluating Item: ${item.name} (${item.uuid})`);

        // SR5 items store these values under system.technology
        const baseCost = item.system?.technology?.cost ?? item.system?.cost ?? 0;
        const baseAvailability = item.system?.technology?.availability ?? item.system?.availability ?? "1R";
        
        console.log("Base Cost extracted:", baseCost);
        console.log("Base Availability extracted:", baseAvailability);

        // 1. Gather Unique Actors (Owner + Employees) to avoid double counting
        const actorUuids = new Set();
        if (shopActor.system.shop?.owner) {
            actorUuids.add(shopActor.system.shop.owner);
        }
        if (shopActor.system.shop?.employees) {
            shopActor.system.shop.employees.forEach(uuid => actorUuids.add(uuid));
        }
        console.log("Unique Actor UUIDs for Connection check:", Array.from(actorUuids));

        let totalConnection = 0;
        let highestConnection = 0;

        // 2. Fetch actors and calculate Connection pools based on SR5 NPC structure
        for (const uuid of actorUuids) {
            const actor = await fromUuid(uuid);
            if (actor) {
                let conn = 0;

                // Check if the actor is an NPC
                if (actor.system?.is_npc) {
                    // Find the embedded 'contact' item that shares the actor's exact name
                    const contactItem = actor.items.find(i => i.type === "contact" && i.name === actor.name);
                    
                    if (contactItem) {
                        conn = contactItem.system?.connection || 0;
                        console.log(`Found NPC Contact Item for '${actor.name}' | Connection Rating: ${conn}`);
                    } else {
                        console.warn(`Actor '${actor.name}' is an NPC but is missing a matching 'contact' item.`);
                    }
                } else {
                    console.log(`Actor '${actor.name}' is not an NPC. Skipping connection check.`);
                }
                
                totalConnection += conn;
                if (conn > highestConnection) {
                    highestConnection = conn;
                }
            } else {
                console.warn(`Could not resolve actor from UUID: ${uuid}`);
            }
        }

        console.log(`Aggregated Stats -> Total Connection: ${totalConnection}, Highest Connection: ${highestConnection}`);

        // 3. Calculate Prices based on Connection Ratings
        // Buy price: Cost - 5% per total connection point (Capped at 100% discount)
        const buyDiscountFactor = Math.min(totalConnection * 0.05, 1); 
        const buyPrice = Math.max(Math.floor(baseCost - (baseCost * buyDiscountFactor)), 0);

        // Sell price: Cost + 5% for the highest connection point
        const sellMarkupFactor = highestConnection * 0.05;
        const sellPrice = Math.floor(baseCost + (baseCost * sellMarkupFactor));

        console.log(`Calculated Buy Price: ${buyPrice} (Discount Factor: ${buyDiscountFactor})`);
        console.log(`Calculated Sell Price: ${sellPrice} (Markup Factor: ${sellMarkupFactor})`);

        // 4. Calculate Availability Time based on Base Cost
        let buyTimeValue = 24;
        let buyTimeUnit = "hours";

        if (baseCost > 10000) {
            buyTimeValue = 1;
            buyTimeUnit = "months";
        } else if (baseCost > 5000) {
            buyTimeValue = 1;
            buyTimeUnit = "weeks";
        } else if (baseCost > 1000) {
            buyTimeValue = 1;
            buyTimeUnit = "days";
        }

        console.log(`Calculated Delivery Time: ${buyTimeValue} ${buyTimeUnit}`);

        // Compile the final return object
        const calculatedData = {
            itemPrice: { value: baseCost },
            buyPrice: { value: buyPrice },
            sellPrice: { value: sellPrice },
            buyTime: { value: buyTimeValue, unit: buyTimeUnit },
            availability: baseAvailability
        };

        console.log("Final Data Object returned to Sheet:", calculatedData);
        console.groupEnd();

        return calculatedData;
    }
}