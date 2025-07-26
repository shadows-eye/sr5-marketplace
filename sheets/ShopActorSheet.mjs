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
        context.flags = this.actor.flags;

        // Prepare employees string for the textarea.
        context.shopEmployees = this.actor.system.shop?.employees?.join('\n') || "";

        // **THE FIX:** Use enrichHTML to prepare the biography content, just like the core system does.
        if (context.system.description) {
            context.biographyHTML = await TextEditor.enrichHTML(context.system.description.value, {
                secrets: this.actor.isOwner,
                rollData: this.actor.getRollData(),
                async: true,
                relativeTo: this.actor
            });
        }

        return context;
    }
    /**
     * @override
     * Add event listeners for sheet interactivity.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Make the rich text editor clickable to open the full editor window.
        html.find('.editor-edit').click(ev => {
            const editor = $(ev.currentTarget).siblings('.editor-content');
            const target = editor.data('edit');
            TextEditor.create({
                target: target,
                html: this.actor.system.description.value,
                document: this.actor
            }).then(editor => editor.render(true));
        });
    }
    
    /**
     * @override
     * Handle form submissions to update the actor.
     */
    _updateObject(event, formData) {
        const expandedData = foundry.utils.expandObject(formData);
        
        if (expandedData.system?.shop?.employees) {
            expandedData.system.shop.employees = expandedData.system.shop.employees
                .split('\n')
                .map(e => e.trim())
                .filter(e => e);
        }

        const finalData = foundry.utils.flattenObject(expandedData);
        return this.document.update(finalData);
    }
}