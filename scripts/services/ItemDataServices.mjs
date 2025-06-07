// Import necessary dependencies
export default class ItemDataServices {
    constructor() {
        this.items = [];
        this.excludedItems = [];
        this.filteredItems = [];
        this._isDataLoaded = false;
    }

    /**
     * Fetch items from the world and compendiums.
     * This method now caches its results and will only perform a full fetch once,
     * showing a progress bar in the notifications area during the initial load.
     */
    async fetchItems() {
        if (this._isDataLoaded) {
            return;
        }

        // 1. Create a permanent notification. ui.notifications.info returns a standard HTMLElement.
        const progressNote = ui.notifications.info("Preparing to index marketplace items...", { permanent: true });

        // 2. Find all item compendia to determine the total for our progress bar.
        const itemPacks = game.packs.filter(pack => pack.metadata.type === "Item");
        const totalPacks = itemPacks.length;
        let packsProcessed = 0;

        if (totalPacks === 0) {
            progressNote.innerHTML = "No item compendia found to index.";
            setTimeout(() => ui.notifications.remove(progressNote.id), 2000); // Remove the notification via its ID
            this._isDataLoaded = true;
            return;
        }

        console.log(`SR5 Marketplace | Starting indexing of ${totalPacks} item compendia...`);

        const worldItems = game.items.contents.filter(item => !item.name.includes('#[CF_tempEntity]'));
        const compendiumItems = [];

        // 3. Loop through the packs and update the progress bar after each one.
        for (const pack of itemPacks) {
            const content = await pack.getDocuments();
            compendiumItems.push(...content.filter(item => !item.name.includes('#[CF_tempEntity]')));

            packsProcessed++;
            const progress = Math.round((packsProcessed / totalPacks) * 100);
            
            // Create the HTML for the progress bar and update the notification using innerHTML.
            const message = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <span>Indexing: ${pack.metadata.label} (${packsProcessed}/${totalPacks})</span>
                    <progress value="${progress}" max="100" style="width: 100%;"></progress>
                </div>
            `;
            progressNote.innerHTML = message;
        }
        
        this.items = [...worldItems, ...compendiumItems].filter(item => !["contact"].includes(item.type));

        this.excludedItems = this.items.filter(item =>
            ["adept_power", "call_in_action", "critter_power", "echo", "host", "metamagic", "sprite_power"].includes(item.type)
        );

        this.filteredItems = this.items.filter(item =>
            !["adept_power", "call_in_action", "critter_power", "echo", "host", "metamagic", "sprite_power"].includes(item.type)
        );
        
        // --- Finalize: Remove the progress notification and show a new, temporary one. ---
        ui.notifications.remove(progressNote.id);
        ui.notifications.info("Item indexing complete!");

        this._isDataLoaded = true;
        console.log("SR5 Marketplace | Item data fetch complete and cached for this session.");
    }

    /**
     * Organize items by type for UI rendering.
     */
    get itemsByType() {
        const categories = {
            rangedWeapons: { label: "SR5.Marketplace.ItemTypes.RangedWeapons", items: this.getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5.Marketplace.ItemTypes.MeleeWeapons", items: this.getItemsByCategory("weapon", "melee") },
            armor: { label: "SR5.Marketplace.ItemTypes.Armor", items: this.getItemsByType("armor") },
            cyberware: { label: "SR5.Marketplace.ItemTypes.Cyberware", items: this.getItemsByType("cyberware") },
            bioware: { label: "SR5.Marketplace.ItemTypes.Bioware", items: this.getItemsByType("bioware") },
            devices: { label: "SR5.Marketplace.ItemTypes.Devices", items: this.getItemsByType("device") },
            equipment: { label: "SR5.Marketplace.ItemTypes.Equipment", items: this.getItemsByType("equipment") },
            spells: {label: "SR5.Marketplace.ItemTypes.Spells", items: this.getItemsByType("spell")},
            qualitys: {label: "SR5.Marketplace.ItemTypes.Qualitys", items: this.getItemsByType("qualitys")},
            complex_form: {label: "SR5.Marketplace.ItemTypes.complex_form", items: this.getItemsByType("complex_form")},
        };
        return categories;
    }

    getItemsByType(type) {
        return this.items.filter(item => item.type === type);
    }

    getItemsByCategory(type, category) {
        return this.items.filter(item => item.type === type && item.system.category === category);
    }
    /**
     * Calculate the total cost, weight, or other metrics for items in the basket.
     * @param {Array} basket - The array of items in the basket.
     * @returns {Object} - An object containing calculated totals (e.g., cost, weight).
     */
    calculateBasketTotals(basket) {
        return basket.reduce(
            (totals, item) => {
                const quantity = item.buyQuantity || 1; // Default quantity to 1 if not set
                const rating = item.selectedRating || 1; // Default rating to 1 if not set

                // Calculate cost
                const cost = item.system?.technology?.cost || 0;
                totals.cost += cost * quantity * rating;

                // Calculate weight (if applicable)
                const weight = item.system?.technology?.weight || 0;
                totals.weight += weight * quantity;

                return totals;
            },
            { cost: 0, weight: 0 } // Initial totals
        );
    }

}