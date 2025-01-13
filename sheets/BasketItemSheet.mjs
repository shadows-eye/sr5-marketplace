export class BasketItemSheet extends ItemSheet {
    /**
     * Return the default options for this ItemSheet
     * @return {Object}
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/sr5-marketplace/templates/item/basketItem.hbs",
            classes: ["sr5-marketplace", "sheet", "item"],
            width: 600,
            height: 400,
            resizable: true,
        });
    }

    /**
     * Get data to be provided to the handlebars template.
     * @param {Object} options - Options passed to the sheet
     * @returns {Object} - Data context for the template
     */
    async getData(options) {
        // Get the base data
        const context = await super.getData(options);

        // Access the item's system data
        const systemData = this.object.system;

        // Initialize the contents if not already present
        if (!systemData.contents) {
            systemData.contents = [];
        }

        // Prepare additional data for rendering
        context.contents = systemData.contents.map((content) => ({
            ...content,
            itemName: game.items.get(content.itemId)?.name || "Unknown Item",
        }));

        return context;
    }

    /**
     * Activate listeners for the sheet
     * @param {jQuery} html - The HTML of the rendered sheet
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Add item to basket contents
        html.find(".add-item").click(() => {
            const itemId = html.find('select[name="item-select"]').val();
            const quantity = parseInt(html.find('input[name="item-quantity"]').val(), 10) || 1;
            const rating = parseInt(html.find('input[name="item-rating"]').val(), 10) || 1;

            if (!itemId) {
                return ui.notifications.warn("No item selected.");
            }

            const newContent = { itemId, quantity, rating };
            const contents = this.object.system.contents || [];
            contents.push(newContent);

            this.object.update({ "system.contents": contents });
        });

        // Remove item from basket contents
        html.find(".remove-item").click((event) => {
            const index = event.currentTarget.dataset.index;
            const contents = this.object.system.contents || [];
            contents.splice(index, 1);

            this.object.update({ "system.contents": contents });
        });
    }
}