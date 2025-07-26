/**
 * A custom V1 Actor Sheet for the ShopActor type.
 * It extends the base Foundry ActorSheet to provide a unique, compatible interface.
 */
export class ShopActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sr5", "sheet", "actor", "shop", "sr5-marketplace-shop"],
            template: "modules/sr5-marketplace/templates/actor/shop-actor-sheet.html",
            width: 600,
            height: 650,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
        });
    }

    /**
     * @override
     * Prepare the data context for rendering the sheet.
     */
    async getData(options) {
        const context = await super.getData(options);
        context.system = this.actor.system;
        
        // Prepare the employees array as a string for the textarea.
        //context.shopEmployees = this.actor.system.shop?.employees?.join('\n') || "";

        return context;
    }

    /**
     * @override
     * Handle form submissions to update the actor.
     */
    _updateObject(event, formData) {
        const expandedData = foundry.utils.expandObject(formData);
        
        // Convert the 'employees' textarea string back into an array of UUIDs.
        if (expandedData.system?.shop?.employees) {
            expandedData.system.shop.employees = expandedData.system.shop.employees
                .split('\n')
                .map(e => e.trim())
                .filter(e => e); // Remove any empty lines
        }

        const finalData = foundry.utils.flattenObject(expandedData);
        return this.document.update(finalData);
    }
}