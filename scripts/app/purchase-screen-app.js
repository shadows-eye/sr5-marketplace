import ItemData from './itemData.js';

export class PurchaseScreenApp extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "purchase-screen",
            title: "Purchase Screen",
            template: "modules/sr5-marketplace/templates/purchase.hbs",
            width: 900,
            height: 700,
            resizable: true,
            classes: ["sr5-market"]
        });
    }

    async getData() {
        this.itemData = new ItemData();
        await this.itemData.fetchItems();

        // Restore basket items from flags
        const savedBasket = game.user.getFlag('sr5-marketplace', 'basket') || [];
        this.itemData.basketItems = savedBasket;

        // Preload the partial templates
        await loadTemplates([
            "modules/sr5-marketplace/templates/libraryItem.hbs",
            "modules/sr5-marketplace/templates/basket.hbs"  // Preload the basket partial
        ]);

        return {
            itemsByType: this.itemData.itemsByType, // Pass item types with items
            basketItems: this.itemData.basketItems, // Pass basket items to be rendered
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        // Listen for changes on any item type selector
        html.find(".item-type-selector").change(event => this._onFilterChange(event, html));
    
        // Trigger the initial render with the first item type
        const firstType = html.find(".item-type-selector option:first").val();
        if (firstType) {
            this._renderItemList(this._getItemsByType(firstType), html);
            html.find(".item-type-selector").val(firstType); // Set the first option as selected
        }
        // Render the basket if it already has items
        if (this.itemData.basketItems.length > 0) {
            this._renderBasket(html);
        }
        // Handle rating changes
        html.on('change', '.item-rating', event => this._onRatingChange(event, html));
        // Listen for Add to Basket button clicks
        html.on('click', '.add-to-cart', event => this._onAddToBasket(event, html));
        // Listen for Remove from Basket button clicks
        html.on('click', '.remove-item', event => this._onRemoveFromBasket(event, html));
    }

    _onFilterChange(event, html) {
        const selectedType = event.target.value;
        const items = this._getItemsByType(selectedType);
        this._renderItemList(items, html);
    }

    _getItemsByType(type) {
        return this.itemData.itemsByType[type] || [];
    }

    async _renderItemList(items, html) {
        const itemListContainer = html.find("#marketplace-items");
        itemListContainer.empty();

        // Re-render the marketplace items using Handlebars
        const templateData = { items: items };
        const renderedHtml = await renderTemplate("modules/sr5-marketplace/templates/libraryItem.hbs", templateData);
        itemListContainer.append(renderedHtml);
    }

    async _saveBasketState() {
        await game.user.setFlag('sr5-marketplace', 'basket', this.itemData.getBasketItems());
    }

    _onAddToBasket(event, html) {
        event.preventDefault();

        const itemId = $(event.currentTarget).data('itemId');
        this.itemData.addItemToBasket(itemId); // Add item to the basket

        this._renderBasket(html); // Re-render the basket with updated items
    }

    async close(options = {}) {
        if (this.itemData.basketItems.length > 0) {
            const confirmed = await Dialog.confirm({
                title: "Save Changes",
                content: "Do you want to save your basket before closing?",
            });
            if (confirmed) {
                await this._saveBasketState();
            }
        } else {
            await game.user.unsetFlag('sr5-marketplace', 'basket'); // Clear the basket flag if empty
        }
        return super.close(options);
    }

    _onRemoveFromBasket(event, html) {
        event.preventDefault();

        const basketId = $(event.currentTarget).data('basketId');
        this.itemData.removeItemFromBasket(basketId); // Remove item using the unique basketId

        this._renderBasket(html); // Re-render the basket with updated items

        this._saveBasketState(); // Save the updated basket state
    }

    _onRatingChange(event, html) {
        const basketId = $(event.currentTarget).data('basketId');
        const selectedRating = parseInt(event.currentTarget.value);

        this.itemData.updateBasketItem(basketId, selectedRating);
        this._renderBasket(html);
    }

    _updateTotalCost(html) {
        const totalCost = this.itemData.calculateTotalCost();
        const totalAvailability = this.itemData.calculateTotalAvailability();
        html.find("#total-cost").text(`Total: ${totalCost} ¥`);
        html.find("#total-availability").text(`Total Availability: ${totalAvailability}`);
    }

    _renderBasket(html) {
        const basketItems = this.itemData.getBasketItems();
        const templateData = { items: basketItems };
        renderTemplate("modules/sr5-marketplace/templates/basket.hbs", templateData).then(renderedHtml => {
            html.find("#basket-items").html(renderedHtml);
            this._updateTotalCost(html);
        });
    } 
}
  