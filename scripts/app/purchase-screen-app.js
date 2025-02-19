import ItemData from './itemData.js';
import {getFormattedTimestamp} from './itemData.js';
import {fetchAndSelectLanguage} from './itemData.js';
import {ActorItemData} from './actorItemData.js';
import { logActorHistory } from './actorHistoryLog.js';
import GlobalHelper from './global.js';
import {BasketHelper} from './global.js';
import { MarketplaceHelper } from './global.js';
export class PurchaseScreenApp extends Application {
    constructor(options = {}) {
        super(options);
        // Define the socket as a class property for access throughout the app
        this.socket = socketlib.registerModule("sr5-marketplace");
        // Determine if the current user is a GM
        this.isGM = game.user.isGM;
        this.currentUser = game.user;
        this.userActor = game.user.character;
        this.selectedActor = game.canvas.tokens.controlled[0]?.actor || this.userActor  || {};
        this.tab = options.tab || "shop"; // Default to "shop" tab
        this.orderData = options.orderData || {};
        this.completeItemsArray = Array.isArray(options.completeItemsArray) ? options.completeItemsArray : [];
        this.itemData = new ItemData();  // Instantiate ItemData here to use its methods
        this.hasEnhancedItems = game.user.getFlag('sr5-marketplace', 'enhancedItemsFlag') || false;
      }
      static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "purchase-screen",
            title: game.i18n.localize("SR5.PurchaseScreen"),
            template: "modules/sr5-marketplace/templates/purchase.hbs",
            width: 1000,
            height: 850,
            resizable: false,
            classes: ["sr5-market"],
            dragDrop: [
                {
                    dragSelector: ".directory-item.entity.actor",  // Selector for draggable actors
                    dropSelector: "#shopActorDropzone"            // Drop target for actors
                },
                {
                    dragSelector: ".directory-item.entity.item",  // Selector for draggable items
                    dropSelector: "#connectionItemDropzone"       // Drop target for items
                }
            ]
        });
    }

    async getData() {
        this.itemData = new ItemData();
        let getDataUserId = game.user.id;
        await this.socket.executeAsGM("initializePurchaseScreenSetting", getDataUserId);
        // Check if shop actor is set
        const hasShopActor = await this.socket.executeAsGM("getHasShopActor");
        if (hasShopActor) {
            // Fetch items directly from the shop actor
            await this.itemData.fetchActorItems();
        } else {
            // Fallback to the normal item fetch if no shop actor is set
            await this.itemData.fetchItems();
        } // Fetch all items in your system
        this.completeItemsArray = this.completeItemsArray || [];
        // Restore basket items from flags (if needed)
        const savedBasket = game.user.getFlag('sr5-marketplace', 'basket') || [];
        this.itemData.basketItems = savedBasket;
        // Clone user and actor data to prepare for socket execution
        const purchaseScreenUser = foundry.utils.deepClone(this.currentUser);
        const playerActor = this.currentUser.character;
        const purchaseScreenActor = foundry.utils.deepClone(this.selectedActor);
        console.log("Purchase screen user:", purchaseScreenUser);
        console.log("Player actor:", playerActor);
        console.log("Selected actor for purchase screen:", purchaseScreenActor);
        let userIsGM = this.isGM;
        let returnHasEnhancedData = foundry.utils.deepClone(this.hasEnhancedItems);
        // Retrieve current PurchaseScreen data, including selected actor
        let purchaseScreenData = await this.socket.executeAsGM("getPurchaseScreenData", purchaseScreenUser, playerActor, purchaseScreenActor);
        console.log("Purchase screen data retrieved:", purchaseScreenData);

        // Enrich HTML for actor objects only if fields are non-null
        if (purchaseScreenData.selectedActorBox && purchaseScreenData.selectedActorBox.id) {
            purchaseScreenData.selectedActorBox.uuid = `Actor.${purchaseScreenData.selectedActorBox.id}`;
            purchaseScreenData.selectedActorBox.enrichedName = await TextEditor.enrichHTML(
                `<a data-entity-link data-uuid="${purchaseScreenData.selectedActorBox.uuid}">${purchaseScreenData.selectedActorBox.name}</a>`,
                { entities: true }
            );
        }

        if (purchaseScreenData.shopActorBox && purchaseScreenData.shopActorBox.shopId) {
            purchaseScreenData.shopActorBox.shopUuid = `Actor.${purchaseScreenData.shopActorBox.shopId}`;
            purchaseScreenData.shopActorBox.enrichedName = await TextEditor.enrichHTML(
                `<a data-entity-link data-uuid="${purchaseScreenData.shopActorBox.shopUuid}">${purchaseScreenData.shopActorBox.shopName}</a>`,
                { entities: true }
            );
        }

        // Update `connectionBox` UUID to include both actor and item IDs if present
        if (purchaseScreenData.connectionBox && purchaseScreenData.connectionBox.connectionId && purchaseScreenData.connectionBox.connectionUuid) {
            const actorId = purchaseScreenData.connectionBox.connectionId; // Actor ID
            const itemId = purchaseScreenData.connectionBox.connectionUuid.split('.').pop(); // Extract item ID
            purchaseScreenData.connectionBox.uuid = purchaseScreenData.connectionBox.connectionUuid || `Actor.${actorId}.Item.${itemId}`;

            purchaseScreenData.connectionBox.enrichedName = await TextEditor.enrichHTML(
                `<a data-entity-link data-uuid="${purchaseScreenData.connectionBox.connectionUuid}">${purchaseScreenData.connectionBox.connectionName}</a>`,
                { entities: true }
            );
        }

    //console.log("Final purchase screen data with enriched links:", purchaseScreenData);

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
            hasEnhancedItems: returnHasEnhancedData,
            completeItemsArray: this.completeItemsArray, // Ensure the array is available in the template context
            ...purchaseScreenData, // Pass the PurchaseScreen data to the template
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', '[data-entity-link]', async (event) => {
            event.preventDefault();
            const uuid = event.currentTarget.getAttribute('data-uuid');
            if (uuid) {
                // Retrieve the document based on the UUID and open its sheet
                const doc = await fromUuid(uuid);
                if (doc && doc.sheet) {
                    doc.sheet.render(true);
                } else {
                    console.warn(`No document found for UUID: ${uuid}`);
                }
            }
        });
        html.on('click', '.remove-link', (event) => this._onRemoveSelectedActorItemShopActor(event, purchaseScreenUser));
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
        // Add the listener for the Enhance Items button
        html.on('click', '#enhance-items-button', async (event) => {
            event.preventDefault();

            if (this.hasEnhancedItems) {
                const confirmed = await Dialog.confirm({
                    title: "Overwrite Enhancements",
                    content: "Items have already been enhanced. Do you want to overwrite the changes?",
                });
                if (!confirmed) return;  // Exit if not confirmed
            }

            // Call the fetchAndSelectLanguage function to trigger the selection and enhancement process
            const enhancedItems = await fetchAndSelectLanguage();

            if (enhancedItems && enhancedItems.length > 0) {
                // Set a flag to indicate that items have been enhanced
                await game.user.setFlag('sr5-marketplace', 'enhancedItemsFlag', true);
                this.hasEnhancedItems = true;

                // Notify the user that items were successfully enhanced
                ui.notifications.info(`${enhancedItems.length} items successfully enhanced.`);

                // Reload the screen to reflect the new data
                this.render(true);
            }
        });
        html.on('change', '.item-rating', event => this._onRatingChange(event, html));
        html.on('click', '.add-to-cart', event => {
            // Call the existing function to add the item to the basket
            let basketSelectedActor = foundry.utils.deepClone(this.selectedActor);
            console.log("Event userActor:", basketSelectedActor);

            const passSelectedActor = foundry.utils.deepClone(this.selectedActor);
            const basketItemUser = foundry.utils.deepClone(this.currentUser);
            console.log("Event userId:", basketItemUser);
            this._onAddToBasket(event, html, basketItemUser, passSelectedActor);
        
            // Use setTimeout to ensure the DOM is fully updated before updating the basket count
            setTimeout(() => {
                this._updateBasketCount(html);
            }, 100); // Small delay of 100ms to ensure the basket DOM is updated
        });
        html.on('click', '.remove-item', event => {
            const passSelectedActor = foundry.utils.deepClone(this.selectedActor);
            const basketItemUser = foundry.utils.deepClone(this.currentUser);
            // Call the existing function to remove the item from the basket
            this._onRemoveFromBasket(event, html, basketItemUser, passSelectedActor);
        
            // Use setTimeout to ensure the DOM is fully updated before updating the basket count
            setTimeout(() => {
                this._updateBasketCount(html);
            }, 100); // Small delay of 100ms to ensure the basket DOM is updated
        });
        html.on('click', '.minus', event => {
            // Retrieve the necessary data attributes from the clicked element
            let basketId = $(event.currentTarget).data('basket-id'); // Get basket ID
            let itemId = $(event.currentTarget).data('item-id');     // Get item ID
        
            // Clone the current user and actor details to pass into _onMinus
            const passSelectedActor = foundry.utils.deepClone(this.selectedActor);
            const basketItemUser = foundry.utils.deepClone(this.currentUser);
        
            // Call _onMinus to handle the decrease logic
            this._onMinus(event, html, basketId, itemId, basketItemUser, passSelectedActor);
        });        
        
        //Order Review Change
        html.on('change', '.order-review-rating', event => this._onRatingChangeOrderReview(event, html));
        // Tab Switching Logic
        html.find("#id-shop").click(() => this._handleTabSwitch(html, "shop"));
        html.find("#id-orderReview").click(() => this._handleTabSwitch(html, "orderReview"));
    
        // Initialize by showing the shop tab content
        this._handleTabSwitch(html, "shop");
    
        // Handle the "Send Request to GM" button click
        html.on('click', '#send-request-button', event => this._onSendRequest(event, html, this.selectedActor));
    
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

        // Handle the "Reject Request" button click
        html.on('click', '.send-request-button.cancel', event => this._onCancelOrder(event, html));
        this._initializeDragAndDropListeners();
    }
    // Define _initializeDragAndDropListeners with clear logging
    _initializeDragAndDropListeners() {
        const shopActorDropzone = document.getElementById("shopActorDropzone");
        const connectionItemDropzone = document.getElementById("connectionItemDropzone");

        if (shopActorDropzone && connectionItemDropzone) {
            shopActorDropzone.addEventListener("dragenter", (event) => this._onDragEnter(event, this.currentUser));
            shopActorDropzone.addEventListener("dragover", (event) => this._onDragOver(event, this.currentUser));
            shopActorDropzone.addEventListener("drop", (event) => this._onDrop(event, this.currentUser));

            connectionItemDropzone.addEventListener("dragenter", (event) => this._onDragEnter(event, this.currentUser));
            connectionItemDropzone.addEventListener("dragover", (event) => this._onDragOver(event, this.currentUser));
            connectionItemDropzone.addEventListener("drop", (event) => this._onDrop(event));
        } else {
            console.warn("Drag-and-drop elements not found for shop actor or connection item setup.");
        }
    }
    /**
     * 
     * @param {*} event drag event that can provide actor or item data to the purchase-screen-app
     */
    async _onDrop(event) {
        event.preventDefault();
        
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
        const dropTarget = event.target.id;
        const currentUserDrop = game.user || this.currentUser;
        const isGM = this.currentUser.isGM;
    
        if (dropTarget === "shopActorDropzone" && dragData.type === "Actor") {
            if (!isGM) {
                ui.notifications.warn("Only GMs can set the shop actor.");
                return;
            }
    
            // Retrieve the actor from the UUID
            const actor = await fromUuid(dragData.uuid);
            if (actor) {
                // Log the actor and its items for debugging
                console.log("Dropped Actor:", actor);
                console.log("Actor Items:", actor.items.contents);
    
                // Map the actor's items into the structure for shop items
                let shopItems = actor.items.map(item => ({
                    shopActorItem: item,
                    shopQuantity: 1,
                    shopItemId: foundry.utils.randomID(),
                    originalItemUuid: item.uuid,
                    worldItemUuid: game.items.get(item.id)?.uuid || null
                }));
    
                // Log the mapped items to ensure they are structured correctly
                console.log("Mapped Shop Items:", shopItems);
    
                // Construct the shop actor data
                let shopActorData = {
                    id: actor.id,
                    name: actor.name,
                    img: actor.img,
                    uuid: dragData.uuid,
                    shopActorItems: shopItems
                };
    
                // Log the complete shopActorData before sending it to settings
                console.log("Complete Shop Actor Data to Save:", shopActorData);
    
                await this.socket.executeAsGM("setShopActor", shopActorData);
                let onDropSelectedActor = this.selectedActor
                const displayData = await this.socket.executeAsGM("getPurchaseScreenData", currentUserDrop, onDropSelectedActor);
                this.render(false, displayData);
            }
        } else if (dropTarget === "connectionItemDropzone" && dragData.type === "Item") {
            let item = await fromUuid(dragData.uuid);
            if (item) {
                let connectionItemData = {
                    id: item.id,
                    name: item.name,
                    img: item.img,
                    uuid: dragData.uuid
                };
    
                await this.socket.executeAsGM("setConnectionItem", currentUserDrop, connectionItemData);
                let selectedActor;
                const displayData = await this.socket.executeAsGM("getPurchaseScreenData", currentUserDrop, selectedActor = null);
                this.render(false, displayData);
            }
        } else {
            console.warn("Dropped data is not an actor or item, or drop target is invalid.");
        }
    }
    
    /**
     * Handle the cancel order button, sends a rejection message, and removes the flag and associated data.
     * @param {*} event 
     * @param {*} html 
     */
    async _onCancelOrder(event, html) {
        event.preventDefault();

        // Retrieve the flag ID from the button's data attribute
        const flagId = $(event.currentTarget).data('flag-id');
        if (!flagId) {
            console.warn('No flag ID found for the cancel button.');
            return;
        }

        // Get order data from the flag
        const orderData = await this.itemData.getOrderDataFromFlag(flagId);
        if (!orderData) {
            console.warn(`No order data found for flag ID: ${flagId}`);
            return;
        }

        // Extract information for the rejection message
        const requesterId = orderData.requesterId;
        const requesterUser = game.users.get(requesterId) || game.user;  // Fallback to current user if requester not found

        // Create the rejection message data
        const messageData = {
            requesterName: requesterUser.name,
            items: orderData.items.map(item => item.name),  // List item names in the rejection message
            rejectionMessage: game.i18n.localize('SR5.Marketplace.OrderRejected')  // Localized rejection text
        };

        // Send a rejection message to the requester
        const chatContent = await renderTemplate('modules/sr5-marketplace/templates/orderRejection.hbs', messageData);
        ChatMessage.create({
            user: requesterUser.id,
            content: chatContent,
            whisper: [requesterUser.id],  // Send as a private message to the requester
        });

        // Remove the order flag from the GM
        const gmUser = game.users.find(u => u.isGM);  // Find the GM user
        if (gmUser) {
            await gmUser.unsetFlag('sr5-marketplace', flagId);
            ui.notifications.info(`Order data for flag ${flagId} removed from GM user flags.`);
        }

        // Delete the associated chat message for the order
        const oldChatMessage = game.messages.contents.find(msg => msg.content.includes(`data-request-id="${flagId}"`));
        if (oldChatMessage) {
            await oldChatMessage.delete();
        }

        // Close the Purchase-Screen-App after the cancellation
        const purchaseApp = Object.values(ui.windows).find(app => app instanceof PurchaseScreenApp);
        if (purchaseApp) {
            purchaseApp.close();
        }
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
        let templateData = { items: items };
        const renderedHtml = await renderTemplate("modules/sr5-marketplace/templates/libraryItem.hbs", templateData);
        itemListContainer.append(renderedHtml);
    }

    async _saveBasketState() {
        await game.user.setFlag('sr5-marketplace', 'basket', this.itemData.getBasketItems());
    }

    async _onAddToBasket(event, html, currentBasketUser, userActor) {
        event.preventDefault();
        const currentUser = currentBasketUser || game.user.id;
        const basketActor = userActor || game.user.character || game.user;
        await this.socket.executeAsGM("initializeBasketsSetting");
        // Retrieve the item ID from the event data
        let itemId = $(event.currentTarget).data('itemId');
        // Retrieve the item from the basket to pass its details to BasketHelper
        console.log("UserId:", currentUser.id);
        await this.socket.executeAsGM("saveItemToGlobalBasket", itemId, currentUser, basketActor);
        await this.itemData.addItemToBasket(itemId); // Add item to the basket
        this._renderBasketAsync(html);

        //this._renderBasket(html); // Re-render the basket with updated items
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

    async _onRemoveFromBasket(event, html, currentUser, userActor) {
        event.preventDefault();
        const currentUserRemove = currentUser;
        const removeBasketActor = userActor;
        await this.socket.executeAsGM("initializeBasketsSetting");
        const basketId = "basket." + $(event.currentTarget).data('basketId'); //item of the basket not the basket itself
        await this.socket.executeAsGM("removeItemFromGlobalBasket", basketId, currentUserRemove, removeBasketActor); // Global basket removal of item
        this.itemData.removeItemFromBasket(basketId); // Remove item using the unique basketId
        await this._renderBasketAsync(html); // Re-render the basket with updated items

        this._saveBasketState(); // Save the updated basket state
    }
    async _onMinus(event, html, basketId, itemId, currentUser, userActor) {
        let currentUserId = currentUser.id;
        let removeBasketActor = userActor;
    
        // Fetch the user's basket from global settings
        let userBasket = await this.socket.executeAsGM("getUserBasket", currentUserId);
        
        // Locate the specific basket item by basketId and itemId
        const basketItem = userBasket.find(item => item.basketId === basketId && item.id_Item === itemId);
    
        if (basketItem) {
            if (basketItem.buyQuantity > 1) {
                // If quantity is greater than 1, decrease the quantity
                basketItem.buyQuantity -= 1;
                await this.socket.executeAsGM("decreaseItemQuantityInGlobalBasket", basketId, currentUserId, removeBasketActor);
    
                // Re-render the basket to show updated quantity
                await this._renderBasketAsync(html);
                this._saveBasketState();
            } else {
                // If buyQuantity is 1, remove the item entirely
                await this._onRemoveFromBasket(event, html, currentUser, userActor);
            }
    
            // Update the basket count after a short delay
            setTimeout(() => {
                this._updateBasketCount(html);
            }, 100);
        }
    }
    /**
     * Updates the basket count displayed on the shopping cart icon.
     * @param {HTMLElement} html - The HTML content of the marketplace.
     */
    _updateBasketCount(html) {
        // Initialize total item count
        let itemCount = 0;
    
        // Find all `.item-quantity` elements in the basket
        const quantityElements = html.find('.basket-grid .item-quantity');
    
        // Calculate the total item count based on each item's quantity
        quantityElements.each((_, element) => {
            const quantity = parseInt($(element).text()) || 1; // Default to 1 if no quantity is set
            itemCount += quantity; // Add the full quantity of the item to the count
        });
    
        // Find the basket count element
        const basketCountElement = html.find('.basket-count');
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
        let templateData = { items: basketItems };
        renderTemplate("modules/sr5-marketplace/templates/basket.hbs", templateData).then(renderedHtml => {
            html.find("#basket-items").html(renderedHtml);
            this._updateTotalCost(html);
        });
    }
    async _updateTotalCostAsync(html, basketItems) {
        // Calculate the total cost and availability using itemData's calculation functions
        let checkCalculation = basketItems;
        if (checkCalculation.length === 0) {
            return;
        }
        const totalCost = await this.itemData.calculateTotalCost() || 0; // Await if async
        const totalAvailability = await this.itemData.calculateTotalAvailability() || 0 ;// Await if async
        const totalKarmaCost = await this.itemData.calculateTotalKarmaCost() ||0; // Await if async
        // Update the total cost in the DOM
        html.find("#total-cost").html(`${game.i18n.localize("SR5.Marketplace.TotalCost")}: ${totalCost} <i class="fa-duotone fa-solid fa-circle-yen"></i>`);

        // Update the total availability in the DOM
        html.find("#total-availability").text(`${game.i18n.localize("SR5.Marketplace.TotalAvailability")}: ${totalAvailability}`);

        // Update the total karma cost in the DOM
        html.find("#total-karma").text(`${game.i18n.localize("SR5.Marketplace.TotalKarma")}: ${totalKarmaCost} <i class="fa-duotone fa-solid fa-circle-star"></i>`);
    }

    async _renderBasketAsync(html) {
        await this.socket.executeAsGM("initializeBasketsSetting");
        const basketItems = await this.socket.executeAsGM("getUserBasket", game.user.id);
        let templateData = { items: basketItems };
        let renderedHtml = await renderTemplate("modules/sr5-marketplace/templates/basket.hbs", templateData);
        html.find("#basket-items").html(renderedHtml);
        html.find("#basket-summary").html(renderedHtml);
        await this._updateTotalCostAsync(html, basketItems);
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
            essence: item.calculatedEssence || 0, // Use calculated essence or fallback to 0
            karma: item.flags['sr5-marketplace']?.Karma || 0
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
                actor: oldFlagData.actor, // Keep the original actor
                karma: updatedOrderData.totalKarmaCost
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
    
            // Localize the availability text part
            const textMapping = {
                "E": "E",  // German for Restricted
                "V": "V",  // German for Forbidden
                "R": "R",  // English Restricted
                "F": "F",  // English Forbidden
                "": ""     // No text
            };
            
            // Extract the numeric and text parts of availability
            const baseAvailability = parseInt(item.calculatedAvailability) || 0;
            const textPart = item.calculatedAvailability.replace(/^\d+/, '').trim();
            
            // Normalize the text part and localize it
            const normalizedText = textMapping[textPart.toUpperCase()] || '';
            const localizedText = normalizedText ? game.i18n.localize(`SR5.Marketplace.system.avail.${normalizedText}`) : '';
    
            // Combine the numeric and localized text parts
            const availabilityCalculation = `${baseAvailability}${localizedText}`.trim();
    
            return {
                ...item,
                enrichedName,         // Enriched item name
                enrichedActor,        // Enriched actor if available
                calculatedAvailability: availabilityCalculation // Localized availability
            };
        }));
    }    
    /**
     * Render the order review tab with the updated data
     */
    async _renderOrderReview(html, flagId, completeItemsArray) {
        // Enrich each item with fallback data from flags if `calculated` properties are missing
        const enrichedItems = completeItemsArray.map(item => ({
            ...item,
            flags: {
                Availability: item.calculatedAvailability || item.flags?.['sr5-marketplace']?.Availability || "0",
                Cost: item.calculatedCost || item.flags?.['sr5-marketplace']?.Cost || 0,
                karma: item.calculatedKarma || item.flags?.['sr5-marketplace']?.karma || 0,
            }
        }));

        // Assign enriched items to itemData for further calculations
        this.itemData.orderReviewItems = enrichedItems;

        // Calculate totals using enriched items
        const totalCost =  this.itemData.calculateOrderReviewTotalCost();
        const totalAvailability =  this.itemData.calculateOrderReviewTotalAvailability();
        const totalEssenceCost =  this.itemData.calculateOrderReviewTotalEssenceCost();
        const totalKarmaCost =  this.itemData.calculateOrderReviewTotalKarmaCost();

        // Enrich the item names and any additional info using TextEditor.enrichHTML
        const ItemsLinks = await this.enrichItems(enrichedItems);

        const templateData = {
            flagId,
            items: ItemsLinks,
            totalCost,
            totalAvailability,
            totalEssenceCost,
            totalKarmaCost,
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
    async _onSendRequest(event, html, userActor) {
        event.preventDefault();
        let orderReviewActorRequester = userActor;
        // Prepare data for the chat message
        const basketItems = this.itemData.getBasketItems();
        const totalCost = await this.itemData.calculateTotalCost();
        const totalAvailability = await this.itemData.calculateTotalAvailability();
        const totalEssenceCost = await this.itemData.calculateTotalEssenceCost();
        const totalKarmaCost = await this.itemData.calculateTotalKarmaCost();
        const requestingUser = game.user;
        const isGM = requestingUser.isGM;
    
        // Get the actorId of the requesting user (can be null if GM has no actor)
        const actor = requestingUser.character || null;
        const actorId = actor ? actor._id : orderReviewActorRequester.id;
    
        if (isGM && !actorId) {
            console.warn("GM has no actor assigned. Proceeding without actor linkage.");
        }
    
        const requestId = foundry.utils.randomID(); // Generate a unique request ID
    
        // Clean up unnecessary flags on each item in the world
        await Promise.all(basketItems.map(async (itemData) => {
            const item = game.items.get(itemData.id_Item || itemData._id);
    
            if (item) {
                const existingMarketplaceFlags = item.flags?.['sr5-marketplace'] || {};
    
                // Clean up flags by retaining only "Availability", "Cost", and "karma" if they exist
                const cleanedFlags = {
                    ...(existingMarketplaceFlags.Availability && { Availability: existingMarketplaceFlags.Availability }),
                    ...(existingMarketplaceFlags.Cost && { Cost: existingMarketplaceFlags.Cost }),
                    ...(existingMarketplaceFlags.karma && { karma: existingMarketplaceFlags.karma }) // Only lowercase "karma" retained
                };
    
                // Update the item's flags in the world to contain only cleaned flags
                await item.update({ 'flags.sr5-marketplace': cleanedFlags });
    
                console.log(`Cleaned flags for item ${item.name}:`, cleanedFlags);
            }
        }));
    
        // Prepare item details for chat message, with compatibility for system.technology
        const itemDetails = basketItems.map(itemData => {
            // Retrieve values from either system.technology or sr5-marketplace flags
            const availability = itemData.system?.technology?.availability || itemData.flags?.['sr5-marketplace']?.Availability || "0";
            const cost = itemData.system?.technology?.cost || itemData.flags?.['sr5-marketplace']?.Cost || 0;
            const rating = itemData.system?.technology?.rating || itemData.selectedRating || 1;
    
            return {
                id: itemData.id_Item || itemData._id,
                name: itemData.name,
                image: itemData.img || "icons/svg/item-bag.svg",
                description: itemData.system.description?.value || "",
                type: itemData.type,
                cost: cost,
                rating: rating,
                essence: itemData.calculatedEssence || 0,
                karma: itemData.calculatedKarma || itemData.flags?.['sr5-marketplace']?.karma || 0,
                flags: {
                    ...(availability && { Availability: availability }),
                    ...(cost && { Cost: cost }),
                    ...(itemData.flags?.['sr5-marketplace']?.karma && { karma: itemData.flags['sr5-marketplace'].karma })
                }
            };
        });
    
        // Log final item details and total values for verification
        console.log("Final itemDetails to be sent in chat:", itemDetails);
        console.log("Total Cost:", totalCost);
        console.log("Total Availability:", totalAvailability);
        console.log("Total Essence Cost:", totalEssenceCost);
        console.log("Total Karma Cost:", totalKarmaCost);
        // Prepare the flag data for the user request
        const flagData = {
            id: requestId,
            items: itemDetails,
            requester: isGM ? "GM" : requestingUser.name,
        };
    
        if (actorId) {
            flagData.actor = actor;
            flagData.actorId = actorId;
        }
        // Add or update the global review request with the same data
        await this.socket.executeAsGM("initializeGlobalSetting");
        await this.socket.executeAsGM("addOrUpdateReviewRequest", requestId, flagData);
        // Add the flag data to the requesting user (GM or player)
        await requestingUser.setFlag('sr5-marketplace', requestId, flagData);
    
        // Prepare the message data to display in chat
        const messageData = {
            items: itemDetails,
            totalCost: totalCost,
            totalAvailability: totalAvailability,
            totalEssenceCost: totalEssenceCost,
            totalKarmaCost: totalKarmaCost,
            requesterName: isGM ? "GM" : requestingUser.name,
            id: requestId,
            actorId: actorId,
            isGM: isGM
        };

        // Render the message using the chatMessageRequest.hbs template
        renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', messageData).then(htmlContent => {
            ChatMessage.create({
                user: requestingUser.id,
                content: htmlContent,
                whisper: isGM ? [] : game.users.filter(u => u.isGM).map(u => u.id)
            });
    
        });
        // Empty the basket
        this.itemData.basketItems = [];
        // Render the empty basket
        await this._renderBasketAsync(html);
    }
    async _onDecrementQuantity(event, html, currentUser, userActor) {
        event.preventDefault();
        const basketId = $(event.currentTarget).data('basketId'); // Get the unique basket ID
        const item = this.itemData.basketItems.find(item => item.basketId === basketId);
        let currentUserId = currentUser.id;
    
        if (item) {
            if (item.buyQuantity > 1) {
                // Decrease buyQuantity and update calculated properties
                item.buyQuantity -= 1;
                item.calculatedCost = await this.itemData.calculateCost(item, item.selectedRating) * item.buyQuantity;
                item.calculatedAvailability = await this.itemData.calculateAvailability(item, item.selectedRating);
                item.calculatedEssence = await this.itemData.calculateEssence(item, item.selectedRating);
                item.calculatedKarma = await this.itemData.calculatedKarmaCost(item);
            } else {
                // If buyQuantity reaches 0, remove the item completely
                await this._onRemoveFromBasket(event, html, currentUser, userActor);
                return; // Exit the function after removal
            }
        }
    
        // Update the global basket and re-render
        await this.socket.executeAsGM("removeItemFromGlobalBasket", basketId, currentUserId, userActor);
        await this._renderBasketAsync(html); // Refresh the basket display
        this._updateBasketCount(html); // Update the basket item count display
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
        await this.socket.executeAsGM("initializeGlobalSetting");
        await this.socket.executeAsGM("getReviewRequest", flagId);
        await this.socket.executeAsGM("deleteReviewRequest", flagId);
        const orderData = await this.itemData.getOrderDataFromFlag(flagId);
        let DeapCloneOrderData = foundry.utils.deepClone(orderData);
        let buyActorId = foundry.utils.deepClone(orderData.actorId);
        console.log("Buy Actor ID:", buyActorId);
        console.log("Order Data in _onBuyStart:", DeapCloneOrderData);
        // Check if a token is selected on the canvas for the GM and prioritize its actor
        let actor;
        if (canvas.tokens.controlled.length > 0) {
            actor = canvas.tokens.controlled[0].actor;
            console.log("Using selected token actor:", actor.name);
        } else {
            // Fallback to the sidebar actor if no token is selected
            actor = game.actors.get(buyActorId);
            console.log("Using sidebar actor:", actor.name);
        }

        if (!actor) {
            ui.notifications.warn("No actor selected. Please select an actor to confirm the order.");
            $(event.currentTarget).find('i').addClass('fa-exclamation-circle');
            return;
        }
    
        // Retrieve actor's current nuyen amount
        let currentNuyen = actor.system.nuyen || 0;  // Default to 0 if no nuyen found
        console.log("Current Nuyen:", currentNuyen);
    
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
        let ActorOrderData = foundry.utils.deepClone(orderData);
        const createdItems = await actorItemData.createItemsOnActor(actor, creationItems, ActorOrderData);
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
        // Calculate the total availability for the order confirmation
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

            await this.socket.executeAsGM("deleteGlobalUserBasket", buyActorId);
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
    async _onRemoveSelectedActorItemShopActor(event, currentUser) {
        event.preventDefault();
        
        // Get the current user
        let removeCurrentUser = currentUser;
    
        // Identify the type of removal based on data attributes
        let shopId = $(event.currentTarget).data("shopId");
        let actorId = $(event.currentTarget).data("actorId");
        let itemId = $(event.currentTarget).data("itemId");
    
        // Execute removal based on the type of item, ensuring GM permissions
        if (shopId) {
            // Trigger shop actor removal as GM
            await this.socket.executeAsGM("removeShopActor");
            this.render(false);
            ui.notifications.info("Shop Actor removed successfully.");
        } else if (actorId) {
            // Trigger selected actor removal as GM
            await this.socket.executeAsGM("removeSelectedActor",removeCurrentUser, actorId)
            this.render(true);
            ui.notifications.info("Selected Actor removed successfully.");
        } else if (itemId) {
            // Trigger connection item removal as GM
            await this.socket.executeAsGM("removeConnectionItem", removeCurrentUser, itemId);
            this.render(true);
            ui.notifications.info("Connection Item removed successfully.");
        }
    }                                               
}
  