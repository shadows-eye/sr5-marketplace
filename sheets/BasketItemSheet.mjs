export class BasketItemSheet extends ItemSheet {
    /**
     * Default options for the Basket Item Sheet.
     * @returns {Object} - The default options.
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/sr5-marketplace/templates/item/basketItem.hbs",
            classes: ["sr5-marketplace", "sheet", "item"],
            width: 600,
            height: 500,
            resizable: true,
        });
    }

    /**
     * Get the data for rendering the Basket Item Sheet.
     * @param {Object} options - Options passed to the sheet.
     * @returns {Object} - The context data for the template.
     */
    async getData(options ={}) {
        // Get the base data from the parent class
        const context = await super.getData(options);
        const systemData = this.object.marketbasket;

        // Initialize contents if not already set
        if (!systemData.contents) {
            systemData.contents = [];
        }

        // Map contents to include item names for easier display
        context.contents = systemData.contents.map((content) => ({
            ...content,
            itemName: game.items.get(content.itemId)?.name || "Unknown Item",
        }));

        return context;
    }

    /**
     * Activate listeners for interactive UI elements.
     * @param {jQuery} html - The rendered HTML of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Add item to the basket
        html.find(".add-item").click(async () => {
            const itemId = html.find('select[name="item-select"]').val();
            const quantity = parseInt(html.find('input[name="item-quantity"]').val(), 10) || 1;
            const rating = parseInt(html.find('input[name="item-rating"]').val(), 10) || 1;

            if (!itemId) {
                return ui.notifications.warn("Please select an item to add.");
            }

            const newContent = { itemId, quantity, rating };
            const contents = [...(this.object.system.contents || []), newContent];

            await this.object.update({ "system.contents": contents });
            this.render(false);
        });

        // Remove an item from the basket
        html.find(".remove-item").click(async (event) => {
            const index = parseInt(event.currentTarget.dataset.index, 10);
            const contents = [...(this.object.marketbasket.contents || [])];

            if (index >= 0 && index < contents.length) {
                contents.splice(index, 1);
                await this.object.update({ "system.contents": contents });
                this.render(false);
            } else {
                ui.notifications.warn("Invalid item index.");
            }
        });

        // Update basket metadata
        html.find(".update-metadata").change(async (event) => {
            const field = event.target.name;
            const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

            await this.object.update({ [field]: value });
        });
    }

    /**
     * Enrich the basket contents for better presentation.
     * @param {Object[]} contents - The contents of the basket.
     * @returns {Promise<Object[]>} - The enriched contents.
     */
    async _enrichContents(contents) {
        return Promise.all(
            contents.map(async (content) => ({
                ...content,
                itemName: await TextEditor.enrichHTML(game.items.get(content.itemId)?.name || "Unknown Item", {
                    async: true,
                    secrets: this.object.isOwner,
                    relativeTo: this.object,
                }),
            }))
        );
    }
}