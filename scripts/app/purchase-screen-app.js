import ItemData from './itemData.js';
import {getFormattedTimestamp} from './itemData.js';
import {ActorItemData} from './actorItemData.js';
import { logActorHistory } from './actorHistoryLog.js';
export class PurchaseScreenApp extends Application {
    constructor(options = {}) {
        super(options);
    
        // Determine if the current user is a GM
        this.isGM = game.user.isGM;
        this.tab = options.tab || "shop"; // Default to "shop" tab
        this.orderData = options.orderData || {};
        this.completeItemsArray = Array.isArray(options.completeItemsArray) ? options.completeItemsArray : [];
        this.itemData = new ItemData();  // Instantiate ItemData here to use its methods
      }
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "purchase-screen",
            title: "Purchase Screen",
            template: "modules/sr5-marketplace/templates/purchase.hbs",
            width: 1000,
            height: 850,
            resizable: true,
            classes: ["sr5-market"]
        });
    }

    async getData() {
        // Ensure itemData is properly instantiated and fetch items
        this.itemData = new ItemData();
        await this.itemData.fetchItems(); // Fetch all items in your system
    
        // Initialize the completeItemsArray if not already set (may come from passed options)
        this.completeItemsArray = this.completeItemsArray || [];
    
        // Restore basket items from flags (if needed)
        const savedBasket = game.user.getFlag('sr5-marketplace', 'basket') || [];
        this.itemData.basketItems = savedBasket;
    
        // Preload the partial templates
        await loadTemplates([
            "modules/sr5-marketplace/templates/libraryItem.hbs",
            "modules/sr5-marketplace/templates/basket.hbs",  // Preload the basket partial
            "modules/sr5-marketplace/templates/shop.hbs",
            "modules/sr5-marketplace/templates/orderReview.hbs"
        ]).then(() => {
            // Register partials after loading them
            Handlebars.registerPartial('shop', 'modules/sr5-marketplace/templates/shop.hbs');
            Handlebars.registerPartial('orderReview', 'modules/sr5-marketplace/templates/orderReview.hbs');
        });
    
        console.log("User role:", game.user.role);
        console.log("Is the current user a GM?", this.isGM);
    
        // Set up review data if needed
        const reviewData = this.reviewData ? this.reviewData : {};
    
        // Return the data to the template for rendering
        return {
            itemsByType: this.itemData.itemsByType, // Pass item types with items
            basketItems: this.itemData.basketItems, // Pass basket items to be rendered
            isGM: this.isGM,
            reviewData: reviewData,
            completeItemsArray: this.completeItemsArray // Ensure the array is available in the template context
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Existing listeners for search, selection, basket, etc.
        html.find(".item-type-selector").change(event => this._onFilterChange(event, html));
        const firstType = html.find(".item-type-selector option:first").val();
        if (firstType) {
            this._renderItemList(this._getItemsByType(firstType), html);
            html.find(".item-type-selector").val(firstType);
        }
        html.find(".marketplace-search").on("input", event => this._onSearchInput(event, html));
        if (this.itemData.basketItems.length > 0) {
            this._renderBasket(html);
        }
        html.on('change', '.item-rating', event => this._onRatingChange(event, html));
        html.on('click', '.add-to-cart', event => {
            // Call the existing function to add the item to the basket
            this._onAddToBasket(event, html);
        
            // Use setTimeout to ensure the DOM is fully updated before updating the basket count
            setTimeout(() => {
                this._updateBasketCount(html);
            }, 100); // Small delay of 100ms to ensure the basket DOM is updated
        });
        html.on('click', '.remove-item', event => {
            // Call the existing function to remove the item from the basket
            this._onRemoveFromBasket(event, html);
        
            // Use setTimeout to ensure the DOM is fully updated before updating the basket count
            setTimeout(() => {
                this._updateBasketCount(html);
            }, 100); // Small delay of 100ms to ensure the basket DOM is updated
        });
        //Order Review Change
        html.on('change', '.order-review-rating', event => this._onRatingChangeOrderReview(event, html));
        // Tab Switching Logic
        html.find("#id-shop").click(() => this._handleTabSwitch(html, "shop"));
        html.find("#id-orderReview").click(() => this._handleTabSwitch(html, "orderReview"));
    
        // Initialize by showing the shop tab content
        this._handleTabSwitch(html, "shop");
    
        // Handle the "Send Request to GM" button click
        html.on('click', '#send-request-button', event => this._onSendRequest(event, html));
    
        // Handle the "Review and Confirm" button click
        html.on('click', '.review-request-button', event => this._onReviewRequest(event, html));
        
        // Handle basket toggle click
        html.find('.basket-toggle-bar').on('click', event => this._toggleBasket(html));

        // Event listener for removing items in the order review
        html.on('click', '.remove-item', async event => {
            event.preventDefault();
        
            // Retrieve the item ID and flag ID from the DOM
            const itemId = $(event.currentTarget).data('itemId');
            const flagId = $(event.currentTarget).closest('#order-review-items').data('flagId');
        
            // Search for the flag across all users
            let orderData;
            let userWithFlag;
            
            for (const user of game.users) {
                const userFlags = user.getFlag('sr5-marketplace', flagId);
                if (userFlags) {
                    orderData = userFlags;
                    userWithFlag = user;
                    break;  // Stop the search once we find the flag
                }
            }
        
            if (!orderData) {
                console.warn(`No order data found for flag ID ${flagId}`);
                return;
            }
        
            // Find the index of the item in the flag's items array
            const itemIndex = orderData.items.findIndex(item => item._id === itemId || item.id === itemId);
            if (itemIndex === -1) {
                console.warn(`Item with ID ${itemId} not found in flag data`);
                return;
            }
        
            // Remove the item from the array
            orderData.items.splice(itemIndex, 1);
        
            // Check if only one item was left before deletion, in which case, remove the chat message
            if (orderData.items.length === 0) {
                // Find and delete the chat message with the matching button id (flagId)
                const chatMessage = game.messages.contents.find(msg => {
                    return msg.content.includes(`data-request-id="${flagId}"`);
                });
        
                if (chatMessage) {
                    await chatMessage.delete();  // Delete the chat message
                }
            }
        
            // Update the flag data without the removed item on the correct user
            await userWithFlag.setFlag('sr5-marketplace', flagId, orderData);
        
            // Fetch the updated flag data after the deletion
            const updatedOrderData = await this.itemData.getOrderDataFromFlag(flagId);
        
            // Re-render the order review with the updated data
            this._renderOrderReview(html, flagId, updatedOrderData.items);
        });
        // Handle the "Buy Items Conformation" button click, will add the items to the actor's inventory and pay the total cost in nuyen, add flag to actor (history)
        html.on('click', '.send-request-button.confirm', event => this._onBuyItems(event, html));
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
    /**
     * Toggles the visibility of the basket and the basket count.
     * @param {HTMLElement} html - The HTML content of the marketplace.
     */
    _toggleBasket(html) {
        const gridContainer = html.find('.grid-container');
        const basketContent = html.find('.basket-content');
        const basketCountElement = html.find('.basket-count');

        // Check if the basket is currently hidden (collapsed)
        const isHidden = basketContent.hasClass('hidden');

        // Toggle the hidden class on the basket content (expands/collapses basket)
        basketContent.toggleClass('hidden');

        // Toggle the expanded class on the grid container (adjusts grid layout)
        gridContainer.toggleClass('expanded');

        // If the basket is currently hidden and is being expanded, hide the count
        if (isHidden) {
            basketCountElement.addClass('hidden'); // Hide the count when the basket is expanded
        } else {
            // When collapsing, show the count if there are items
            const itemCount = html.find('#basket-items .basket-item').length;
            if (itemCount > 0) {
                basketCountElement.removeClass('hidden'); // Show the count when the basket is collapsed
            }
        }
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

    async _onAddToBasket(event, html) {
        event.preventDefault();

        const itemId = $(event.currentTarget).data('itemId');
        await this.itemData.addItemToBasket(itemId); // Add item to the basket

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

    async _onRemoveFromBasket(event, html) {
        event.preventDefault();

        const basketId = $(event.currentTarget).data('basketId');
        this.itemData.removeItemFromBasket(basketId); // Remove item using the unique basketId

        this._renderBasket(html); // Re-render the basket with updated items

        this._saveBasketState(); // Save the updated basket state
    }
    /**
     * Updates the basket count displayed on the shopping cart icon.
     * @param {HTMLElement} html - The HTML content of the marketplace.
     */
    _updateBasketCount(html) {
        // Find all elements with class 'basket-item' within '#basket-items'
        const basketItems = html.find('#basket-items .basket-item');
        const itemCount = basketItems.length;

        // Find the basket count element
        const basketCountElement = html.find('.basket-count');

        // Find the basket content to check if it's expanded or collapsed
        const basketContent = html.find('.basket-content');

        // Update the count text
        basketCountElement.text(itemCount);

        // If the basket is collapsed (hidden), show the count if there are items
        if (basketContent.hasClass('hidden')) {
            if (itemCount > 0) {
                basketCountElement.removeClass('hidden');
            } else {
                basketCountElement.addClass('hidden');
            }
        } else {
            // If the basket is expanded, always hide the count
            basketCountElement.addClass('hidden');
        }
    }
    _onRatingChange(event, html) {
        const basketId = $(event.currentTarget).data('basketId');
        const selectedRating = parseInt(event.currentTarget.value);

        this.itemData.updateBasketItem(basketId, selectedRating);
        this._renderBasket(html);
    }

    _updateTotalCost(html) {
        // Calculate the total cost and availability using itemData's calculation functions
        const totalCost = this.itemData.calculateTotalCost(); 
        const totalAvailability = this.itemData.calculateTotalAvailability(); 
        
        // Update the total cost in the DOM
        html.find("#total-cost").html(`Total: ${totalCost} <i class="fa-duotone fa-solid fa-circle-yen"></i>`);
        
        // Update the total availability in the DOM
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
    
    async _onRatingChangeOrderReview(event, html) {
        event.preventDefault();
    
        const itemId = $(event.currentTarget).data('itemId'); // Get item ID
        const flagId = $(event.currentTarget).closest('#order-review-items').data('flagId'); // Get flag ID
    
        if (!itemId || !flagId) {
            console.warn(`Missing itemId or flagId: itemId = ${itemId}, flagId = ${flagId}`);
            return;
        }
    
        const newRating = parseInt($(event.currentTarget).val()); // Get the new rating value from the dropdown
    
        // Fetch the current order data from the flag
        const orderData = await this.itemData.getOrderDataFromFlag(flagId);
        if (!orderData) {
            console.warn(`No order data found for flag ID ${flagId}`);
            return;
        }
    
        // Find the item in the order data
        const flagItem = orderData.items.find(item => item._id === itemId || item.id === itemId);
        if (!flagItem) {
            console.warn(`Item with ID ${itemId} not found in flag data`);
            return;
        }
    
        // Update the item's rating in the flag data
        flagItem.rating = newRating;
    
        // Get the old flag data to retain original requester/actor info
        const oldFlagData = await this.itemData.getOrderDataFromFlag(flagId);
    
        // Save the updated flag with the new rating
        await game.user.setFlag('sr5-marketplace', flagId, orderData);
    
        // Fetch the updated order data (with new rating) from the flag
        const updatedOrderData = await this.itemData.getOrderDataFromFlag(flagId);
    
        // Safeguard: Ensure the completeItemsArray is valid
        const completeItemsArray = updatedOrderData.items || [];
    
        // Iterate over the updated items and extract their details
        const updatedItemDetails = completeItemsArray.map(item => ({
            id: item.id_Item || item._id, // Use id_Item if available, fallback to _id
            name: item.name, // Item name
            image: item.img || "icons/svg/item-bag.svg", // Item image or default icon
            description: item.system.description?.value || "", // Safely access description text
            type: item.type, // Item type
            cost: item.calculatedCost || 0, // Use calculated cost or fallback to 0
            rating: item.selectedRating || 1, // Use selected rating or fallback to 1
            essence: item.calculatedEssence || 0 // Use calculated essence or fallback to 0
        }));
    
        // Update the chat message with the latest data
        const chatMessage = game.messages.contents.find(msg => msg.content.includes(`data-request-id="${flagId}"`));
        if (chatMessage) {
            // Prepare the updated message data based on the updatedOrderData
            const messageData = {
                id: flagId, // Include the flag ID
                items: updatedItemDetails, // Updated items with new ratings and costs
                totalCost: updatedOrderData.totalCost, // Updated total cost
                totalAvailability: updatedOrderData.totalAvailability, // Updated total availability
                totalEssenceCost: updatedItemDetails.reduce((sum, item) => sum + (item.essence || 0), 0), // Updated total essence cost
                requesterName: oldFlagData.requester, // Keep the original requester name
                actorId: oldFlagData.actorId, // Keep the original actor ID
                actor: oldFlagData.actor // Keep the original actor
            };
    
            // Re-render the chat message with the updated data
            const htmlContent = await renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', messageData);
    
            // Update the chat message with the newly rendered content
            await chatMessage.update({ content: htmlContent });
        }
    
        // Re-render the order review with the updated data
        this._renderOrderReview(html, flagId, completeItemsArray);
    }
    _onRemoveFromOrderReview(event, html) {
        event.preventDefault();
        const itemId = $(event.currentTarget).data('itemId');
        this.itemData.removeItemFromOrderReview(itemId);  // Delegate to itemData.js

        // Re-render the review
        this._renderOrderReview(html);
    }
    /**
     * Render the shopping basket summary for the chat message
     * @param {Object} orderData - The updated order data
     * @returns {string} - The rendered HTML content for the chat message
     */
    async _renderShoppingBasketSummary(orderData, flagId) {
        const templateData = {
            id: flagId,
            requester: orderData.requester,
            items: orderData.items,
            totalCost: orderData.items.reduce((sum, item) => sum + item.cost, 0)  // Calculate total cost
        };

        // Render the shopping basket summary template with the updated data
        return await renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', templateData);
    }
    async enrichItems(completeItemsArray) {
        // Use Promise.all to ensure asynchronous processing of all items
        return await Promise.all(completeItemsArray.map(async item => {
            // Check if the item comes from a compendium
            let enrichedName;
            if (item.flags?.core?.sourceId) {
                // This item is from a compendium, extract compendium and item ID
                const [compendiumName, itemId] = item.flags.core.sourceId.split('.');
                enrichedName = await TextEditor.enrichHTML(`@Compendium[${compendiumName}.${itemId}]{${item.name}}`);
            } else {
                // The item is from the world
                enrichedName = await TextEditor.enrichHTML(`@Item[${item._id}]{${item.name}}`);
            }
    
            // Enrich actor name if available
            const enrichedActor = item.actorId ? await TextEditor.enrichHTML(`@Actor[${item.actorId}]{${item.actor.name}}`) : "";
    
            return {
                ...item,
                enrichedName, // Enriched item name
                enrichedActor // Enriched actor if available
            };
        }));
    }
    /**
     * Render the order review tab with the updated data
     */
    async _renderOrderReview(html, flagId, completeItemsArray) {
        // Ensure the items are passed to itemData for further calculations
        this.itemData.orderReviewItems = completeItemsArray;  // Assign the array to itemData

        // Use itemData methods to calculate totals
        const totalCost = this.itemData.calculateOrderReviewTotalCost();
        const totalAvailability = this.itemData.calculateOrderReviewTotalAvailability();
        // Enrich the item and actor names using TextEditor.enrichHTML
        const ItemsLinks = await this.enrichItems(completeItemsArray);
         const templateData = {
            flagId: flagId,
            items: ItemsLinks,  // Pass the enriched item data
            totalCost,
            totalAvailability,
        };

        // Log template data for debugging
        console.log('Rendering Order Review with template data:', templateData);

        // Render the order review template with the prepared data
        renderTemplate('modules/sr5-marketplace/templates/orderReview.hbs', templateData).then(htmlContent => {
            html.find(`.tab-content[data-tab-content="orderReview"]`).html(htmlContent);
        }).catch(err => {
            console.error("Error rendering order review:", err);
        });
    }
    _handleTabSwitch(html, selectedTab) {
        console.log(`Switching to tab: ${selectedTab}`); // Debugging output
    
        // Hide all tab content by removing 'active' class
        html.find(".tab-content").removeClass("active");
    
        // Show the selected tab content by adding 'active' class
        html.find(`.tab-content[data-tab-content="${selectedTab}"]`).addClass("active");
    
        // Update active tab state
        html.find(".marketplace-tab").removeClass("active");
        html.find(`#id-${selectedTab}`).addClass("active");
    }
    /// send basket to GM
    async _onSendRequest(event, html) {
        event.preventDefault();
    
        // Prepare the data for the chat message
        const basketItems = this.itemData.getBasketItems(); // Assuming itemData is accessible
        const totalCost = this.itemData.calculateTotalCost(); // Use itemData to calculate total cost
        const totalAvailability = this.itemData.calculateTotalAvailability(); // Use itemData to calculate total availability
        const totalEssenceCost = this.itemData.calculateTotalEssenceCost(); // Use itemData to calculate total essence cost
        const totalKarmaCost = this.itemData.calculateTotalKarmaCost(); // Use itemData to calculate total karma cost
        const requestingUser = game.user; // The user who clicked the button
        const isGM = requestingUser.isGM;
    
        // Get the actorId of the requesting user (can be null if GM has no actor)
        const actor = requestingUser.character || null; // Get actor if it exists
        const actorId = actor ? actor._id : null; // Extract actor ID if actor exists
    
        // If the requesting user is a GM without an actor, log a warning, but continue without actor linkage
        if (isGM && !actorId) {
            console.warn("GM has no actor assigned. Proceeding without actor linkage.");
        }
    
        const requestId = foundry.utils.randomID(); // Generate a unique request ID
    
        // Get an array of detailed item objects from the basket items
        const itemDetails = basketItems.map(item => ({
            id: item.id_Item || item._id, // Use id_Item if available, otherwise fallback to _id
            name: item.name, // Item name
            image: item.img || "icons/svg/item-bag.svg", // Use the item image or default icon
            description: item.system.description?.value || "", // Safely access description text
            type: item.type, // Item type
            cost: item.calculatedCost || 0, // Use calculated cost or fallback to 0
            rating: item.selectedRating || 1, // Use selected rating or default to 1
            essence: item.calculatedEssence || 0, // Use calculated essence or fallback to 0
            karma: item.calculatedKarma || 0 // Use calculated karma or fallback to 0
        }));
    
        // Prepare the flag data
        const flagData = {
            id: requestId,
            items: itemDetails, // Store detailed item objects
            requester: isGM ? "GM" : requestingUser.name, // Identify the requester
        };
    
        // Include actor data only if actorId exists
        if (actorId) {
            flagData.actor = actor; // Include the full actor object
            flagData.actorId = actorId; // Include the actorId
        }
    
        // Add the flag data to the requesting user (GM or player)
        await requestingUser.setFlag('sr5-marketplace', requestId, flagData);
    
        // Prepare the message data to display in chat
        const messageData = {
            items: itemDetails, // Use detailed items in the chat message
            totalCost: totalCost,
            totalAvailability: totalAvailability,
            totalEssenceCost: totalEssenceCost,
            totalKarmaCost: totalKarmaCost, // Default karma cost
            requesterName: isGM ? "GM" : requestingUser.name, // Show "GM" if the request is from a GM
            id: requestId, // Include the request ID in the data
            actorId: actorId, // Include actorId (if present)
            isGM: isGM
        };
    
        // Render the message using the chatMessageRequest.hbs template
        renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', messageData).then(htmlContent => {
            ChatMessage.create({
                user: requestingUser.id, // Use the requesting user's ID
                content: htmlContent,
                whisper: isGM ? [] : game.users.filter(u => u.isGM).map(u => u.id) // Whisper to GM(s) if not GM
            });
    
            // Empty the basket
            this.itemData.basketItems = [];
    
            // Render the empty basket
            this._renderBasket(html); // Update the UI to reflect the empty basket
        });
    }
    /**
     * 
     * @param {*} event 
     * @param {*} html 
     * @returns 
     */
    async _onBuyItems(event, html) {
        event.preventDefault();
    
        // Retrieve the flag ID from the button's data attribute
        const flagId = $(event.currentTarget).data('flag-id');
        if (!flagId) {
            console.warn('No flag ID found for the clicked button.');
            return;
        }
    
        const orderData = await this.itemData.getOrderDataFromFlag(flagId);
    
        // Check if actorId is available in flag data
        let actorId = orderData.actorId || null;
        if (!actorId && canvas.tokens.controlled.length > 0) {
            const selectedToken = canvas.tokens.controlled[0];
            actorId = selectedToken.actor?._id || null;
        }
    
        if (!actorId) {
            ui.notifications.warn("No actor selected. Please select an actor to confirm the order.");
            $(event.currentTarget).find('i').addClass('fa-exclamation-circle');
            return;
        }
    
        const actor = game.actors.get(actorId);
    
        // Retrieve actor's current nuyen amount
        let currentNuyen = actor.system.nuyen || 0;  // Default to 0 if no nuyen found
    
        // Calculate the total cost of the items in the order
        const totalCost = orderData.items.reduce((total, item) => total + (item.calculatedCost || 0), 0);
    
        // Check if the actor has enough nuyen for the purchase
        if (currentNuyen < totalCost) {
            ui.notifications.error(`Not enough nuyen. You need ${totalCost}¥ but only have ${currentNuyen}¥.`);
            return;
        }
    
        // Subtract the total cost from the actor's nuyen
        currentNuyen -= totalCost;
    
        // Update the actor's nuyen amount
        await actor.update({ "system.nuyen": currentNuyen });
    
        // Retrieve base items and create new items on the actor
        const actorItemData = new ActorItemData(actor);
        await actorItemData.initWithFlag(flagId);
        actorItemData.logItems();
    
        const creationItems = await actorItemData.createItemsWithInjectedData();
        const createdItems = await actorItemData.createItemsOnActor(actor, creationItems, orderData);
        // Check if the actor already has a history flag for the provided flagId
        let historyFlag = actor.getFlag('sr5-marketplace', 'history') || [];
            
        // Check if the history flag is still an object and needs conversion to an array
        if (!Array.isArray(historyFlag)) {
            console.warn("History flag is not an array. Converting...");
            
            // Convert object history (old structure) into an array format
            historyFlag = Object.keys(historyFlag).map(key => historyFlag[key]);
        }
        
    // Now `historyFlag` is guaranteed to be an array
    // Check if the flagId already exists in the actor's history
    const existingHistoryEntry = historyFlag.find(entry => entry.flagId === flagId);
        const { chatTimestamp, flagTimestamp } = await getFormattedTimestamp(); // Get formatted timestamps from itemData.js
        // If no history entry exists for the flag, create a new one
        if (!existingHistoryEntry) {
        console.log(createdItems);
        const newHistoryEntry = {
            actorflagId: flagId,
            items: createdItems.map(item => ({
                id: {
                    baseId: item.baseId,  // Base Item ID
                    creationItemId: item.creationItemId // Creation Item ID
                },
                name: item.name,
                calculatedCost: item.calculatedCost,
                selectedRating: item.selectedRating,
                calculatedAvailability: item.calculatedAvailability,
                calculatedEssence: item.calculatedEssence,
                calculatedKarma: item.calculatedKarma  // Karma value
            })),
            karma: createdItems.reduce((total, item) => total + (item.calculatedKarma || 0), 0),
            gain: true,
            surgicalDamage: createdItems.reduce((total, item) => total + (item.calculatedEssence || 0) * 5, 0),
            delete: false,
            timestamp: flagTimestamp  // Timestamp for the flag
        };
    
            historyFlag.push(newHistoryEntry);
    
            // Update the history flag on the actor
            await actor.setFlag('sr5-marketplace', 'history', historyFlag);
        } else {
            // If the history flag already exists, skip creation and move to the chat message
            ui.notifications.info(`A history flag already exists for flagId: ${flagId}. Skipping flag creation.`);
        }
        
        // Prepare the message data for the chat
        const messageData = {
            items: creationItems.map(item => ({
                _id: item._id,
                name: item.name
            })),
            totalCost: totalCost,
            totalAvailability: orderData.totalAvailability,
            totalEssenceCost: orderData.totalEssenceCost,
            totalKarmaCost: orderData.totalKarmaCost,
            actorId: actor._id,
            actorName: actor.name,
            timestamp: chatTimestamp  // Use chat-specific timestamp
        };

        // Render the message using the orderConfirmation.hbs template
        const chatContent = await renderTemplate('modules/sr5-marketplace/templates/orderConfirmation.hbs', messageData);

        // Get the actor's ownership details and find a valid user
        let recipientUser;
        let actorOwners = Object.keys(actor._source.ownership || {});

        // Filter out invalid or inactive users
        actorOwners = actorOwners.filter(ownerId => {
            const user = game.users.get(ownerId);
            return user && user.active;  // Ensure the user exists and is active
        });

        // Select the first valid recipient or fallback to the requester
        if (actorOwners.length > 0) {
            recipientUser = game.users.get(actorOwners[0]);  // Choose the first active owner
        } else {
            recipientUser = game.users.get(orderData.requesterId) || game.user;  // Use the requester or fallback to current user
        }

        // Prepare the data for ChatMessage.create
        const chatMessageData = {
            user: recipientUser.id,  // Send the message to the recipient
            content: chatContent
        };

        // Whisper only if the recipient is not a GM
        if (!recipientUser.isGM) {
            chatMessageData.whisper = [recipientUser.id];  // Whisper to the recipient if not a GM
        }

        // Create the chat message
        ChatMessage.create(chatMessageData);
        // Now, delete the flag on the GM user (order processed)
        const gmUser = game.users.find(u => u.isGM);  // Find the GM user
        if (gmUser) {
            await gmUser.unsetFlag('sr5-marketplace', flagId);  // Remove the flag from the GM user
            ui.notifications.info(`Order data cleared from GM user flags.`);
        }
        // Delete the old chat message associated with the flag
        const oldChatMessage = game.messages.contents.find(msg => msg.content.includes(`data-request-id="${flagId}"`));
        if (oldChatMessage) {
            await oldChatMessage.delete();
        }
        // Close the Purchase-Screen-App after the transaction is complete
        const purchaseApp = Object.values(ui.windows).find(app => app instanceof PurchaseScreenApp);
        if (purchaseApp) {
            purchaseApp.close();
        }
        // Call logActorHistory after purchase to update the journal
        await logActorHistory(actor);
    }                                       
}
  