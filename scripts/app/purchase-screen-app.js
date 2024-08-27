import ItemData from './itemData.js';

export class PurchaseScreenApp extends Application {
    constructor(options = {}) {
        super(options);
    
        // Determine if the current user is a GM
        this.isGM = game.user.isGM;
      }
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
            "modules/sr5-marketplace/templates/basket.hbs",  // Preload the basket partial
            "modules/sr5-marketplace/templates/shop.hbs",
            "modules/sr5-marketplace/templates/orderReview.hbs"]
        );
        console.log("User role:", game.user.role);
        console.log("Is the current user a GM?", this.isGM);
        return {
            itemsByType: this.itemData.itemsByType, // Pass item types with items
            basketItems: this.itemData.basketItems, // Pass basket items to be rendered
            isGM: this.isGM
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
        // Listen for search input
        html.find(".marketplace-search").on("input", event => this._onSearchInput(event, html));
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
        
        // Function to handle tab switching
        const handleTabSwitch = (selectedTab) => {
            // Hide all tab content
            html.find(".tab-content").hide();
    
            // Show the selected tab content
            html.find(`.tab-content[data-tab-content="${selectedTab}"]`).show();
    
            // Update active tab state
            html.find(".marketplace-tab").removeClass("active");
            html.find(`#id-${selectedTab}`).addClass("active");
        };
    
        // Set up click listeners for tab buttons
        html.find("#id-shop").click(() => handleTabSwitch("shop"));
        html.find("#id-orderReview").click(() => handleTabSwitch("orderReview"));
    
        // Initialize by showing the shop tab content
        handleTabSwitch("shop");
    }

    _onSearchInput(event, html) {
        const searchText = event.target.value.toLowerCase();
        const items = html.find(".marketplace-item");
    
        items.each((index, item) => {
            const itemName = $(item).find("h4").text().toLowerCase();
            if (itemName.includes(searchText)) {
                $(item).css("display", "flex"); // Show matching item
            } else {
                $(item).css("display", "none"); // Hide non-matching item
            }
        });
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
        html.find("#total-cost").html(`Total: ${totalCost} <i class="fa-duotone fa-solid fa-circle-yen"></i>`);
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
Hooks.on("renderPurchaseScreenApp", (app, html, data) => {
    // Function to handle tab switching
    function handleTabSwitch(selectedTab) {
        // Hide all tab content
        html.find(".tab-content").hide();

        // Show the selected tab content
        html.find(`.tab-content[data-tab-content="${selectedTab}"]`).show();

        // Update active tab state
        html.find(".marketplace-tab").removeClass("active");
        html.find(`#id-${selectedTab}`).addClass("active");
    }

    // Set up click listeners for tab buttons
    html.find("#id-shop").click(() => handleTabSwitch("shop"));
    html.find("#id-orderReview").click(() => handleTabSwitch("orderReview"));

    // Initialize by showing the shop tab content
    handleTabSwitch("shop");
});
  