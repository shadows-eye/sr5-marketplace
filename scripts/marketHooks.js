import ItemData from './app/itemData.js';
import {fetchAndSelectLanguage} from './app/itemData.js';
import { ActorItemData } from './app/actorItemData.js';
import { PurchaseScreenApp } from './app/purchase-screen-app.js';
import { registerBasicHelpers } from './lib/helpers.js';
import GlobalHelper from './app/global.js';
// Call the function to register helpers
registerBasicHelpers();
Hooks.once('init', () => {
    console.log("Initializing SR5 Marketplace Module...");

    game.settings.register("sr5-marketplace", "resetItemLoad", {
        name: "Reset Item Load",
        hint: "This will allow the karma values and cost/availability of world and compendium items to get their flags reinitialized. Setting this setting to true will undo any changes you made to Karma, cost, or Availability of the items.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            if (value) {
                console.log("Reset Item Load is enabled; item flags will be reset on load.");
            } else {
                console.log("Reset Item Load is disabled; item flags will not be reset on load.");
            }
        }
    });
    game.settings.register("sr5-marketplace", "reviewRequests", {
        name: "Hidden Review Requests",
        scope: "world",
        config: false,  // Hidden from UI
        type: Object,   // Store as an object with multiple requests
        default: {}     // Initialize as an empty object
    });
    
    game.settings.register("sr5-marketplace", "baskets", {
        name: "Hidden Baskets",
        scope: "world",
        config: false,  // Hidden from UI
        type: Object,   // Store as an object with multiple baskets
        default: {}     // Initialize as an empty object
    });
    game.settings.register("sr5-marketplace", "Purchase-Screen", {
        name: "Purchase Screen Settings",
        scope: "client",
        config: false,
        type: Object,
        default: {
            selectedActor: null,          // Actor chosen upon opening the screen
            shopActor: null,              // Actor dragged onto SR5ShopActor-box
            connectionItem: null,         // Item dragged or selected as connection
            hasSelection: false           // Boolean indicator if actor/item is set
        }
    });
});
Hooks.on('renderChatMessage', (message, html, data) => {
    // Check if the current user is a GM
    if (game.user.isGM) {
        // Select the button with the 'hide-for-non-gm' class
        const button = html.find('.review-request-button.hide-for-non-gm');
        
        // If the button exists, remove the 'hide-for-non-gm' class
        if (button.length) {
            button.removeClass('hide-for-non-gm');
        }
    }
});
Hooks.once('ready', async function() {
    const itemData = new ItemData();
    await itemData.fetchItems();
    // Check if the user is not a GM
    if (!game.user.isGM) {
        // Select all review-request-button elements
        const buttons = document.querySelectorAll('.review-request-button');
        
        buttons.forEach(button => {
            // Check if the button already has the 'hide-for-non-gm' class
            if (!button.classList.contains('hide-for-non-gm')) {
                // Add the class if it's not already present
                button.classList.add('hide-for-non-gm');
            }
        });
    }
    console.log("Cleaning up unused flags in sr5-marketplace...");
    const currentUser = game.user;  // Get the current user
    const isGM = currentUser.isGM;  // Check if the current user is a GM

    // Define the function to clean flags for a user
    async function cleanFlagsForUser(user) {
        const userFlags = user.flags['sr5-marketplace'] || {};

        // For each flag in sr5-marketplace, check if a corresponding chat message exists
        for (const flagId in userFlags) {
            const flagData = userFlags[flagId];

            // Check if there's a chat message with the corresponding flag ID in its content
            const chatMessageExists = game.messages.contents.some(msg => msg.content.includes(`data-request-id="${flagId}"`));

            if (!chatMessageExists) {
                // If no corresponding chat message is found, remove the flag
                console.log(`Removing unused flag: ${flagId} for user: ${user.name}`);
                await user.unsetFlag('sr5-marketplace', flagId);
            }
        }
    }

    // If the current user is a GM, clean flags for all users
    if (isGM) {
        console.log("GM detected, cleaning flags for all users.");
        for (const user of game.users.contents) {
            await cleanFlagsForUser(user);  // Clean flags for each user
        }
    } else {
        // If the user is not a GM, only clean flags for the current user
        console.log(`Cleaning flags for current user: ${currentUser.name}`);
        await cleanFlagsForUser(currentUser);  // Clean flags for the current user only
    }
    console.log("Flag cleanup complete.");
    // Listen for the review-request-button click
    $(document).on('click', '.review-request-button', async function(event) {
        event.preventDefault();
    
        const flagId = $(this).data('request-id');  // Get the flag ID from the button's data attribute
        console.log('Clicked review button with flag ID:', flagId);

        // Retrieve order data from the flag and wait for the asynchronous call to finish
        const orderData = await itemData.getOrderDataFromFlag(flagId);  // Fetch order data from the flag
    
        if (orderData) {
            console.log('Order Data:', orderData);

            // Safeguard: Ensure completeItemsArray is valid or default to an empty array
            const completeItemsArray = orderData.items || [];
    
            // Log the completeItemsArray for debugging
            console.log('Complete Items Array with flag data:', completeItemsArray);
    
            // Open the PurchaseScreenApp and pass the flag data for rendering
            const purchaseScreenApp = new PurchaseScreenApp({
                orderData: orderData,
                completeItemsArray: completeItemsArray  // Pass the complete items array
            });
            purchaseScreenApp.render(true);
    
            Hooks.once('renderPurchaseScreenApp', (app, html, orderdata) => {
                console.log('PurchaseScreenApp is now open.');
                orderdata = orderData;
                const orderReviewButton = html.find("#id-orderReview");
    
                if (orderReviewButton.length) {
                    orderReviewButton.click();  // Switch to the orderReview tab
                    console.log('Switched to the orderReview tab.');
                } else {
                    console.warn('OrderReview button not found.');
                }

                // Render the review tab with the enriched item data
                app._renderOrderReview(html, flagId, completeItemsArray);  // Pass flagId and completeItemsArray that contains the lightweight items
            });
        } else {
            console.log(`No order review data found for flag ID ${flagId}`);
        }
    });
    // Check the "Reset Item Load" setting
    const resetItemLoad = game.settings.get("sr5-marketplace", "resetItemLoad");
    if (!resetItemLoad) {
        console.log("Reset Item Load is disabled; skipping Karma flag reinitialization.");
        return; // Exit if resetItemLoad is false
    }

    console.log("Initializing sr5-marketplace Karma flag for specified item types...");
    const itemTypesToFlag = ["quality", "adept_power", "spell", "complex_form"];

    async function updateItemWithKarmaFlag(item) {
        const spellPowerAvailabilityCost = {
            "health": { karma: 5, availability: "4R", cost: 500 },
            "illusion": { karma: 5, availability: "8R", cost: 1000 },
            "combat": { karma: 5, availability: "8R", cost: 2000 },
            "manipulation": { karma: 5, availability: "8R", cost: 1500 },
            "detection": { karma: 5, availability: "4R", cost: 500 }
        };

        const marketplaceHistory = item.flags?.['sr5-marketplace-history'] || null;
        await item.update({ 'flags.sr5-marketplace': {} });

        let newFlags = {};
        if (item.type === "quality" && item.system.karma !== undefined) {
            newFlags.karma = item.system.karma;
        } else if (["spell", "complex_form"].includes(item.type)) {
            newFlags.karma = 5;
            const category = item.system.category;
            if (spellPowerAvailabilityCost[category]) {
                const { availability, cost } = spellPowerAvailabilityCost[category];
                newFlags.Availability = availability;
                newFlags.Cost = cost;
            }
        } else if (!newFlags.karma) {
            newFlags.karma = 0;
        }

        await item.update({ 'flags.sr5-marketplace': newFlags });
        if (marketplaceHistory) {
            await item.update({ 'flags.sr5-marketplace-history': marketplaceHistory });
        }
    }

    async function initializeKarmaFlags() {
        console.log("Initializing Karma flags for world items...");
        for (let item of game.items.contents) {
            if (itemTypesToFlag.includes(item.type)) {
                await updateItemWithKarmaFlag(item);
            }
        }

        console.log("Initializing Karma flags for compendium items...");
        for (let pack of game.packs) {
            if (pack.documentName === "Item") {
                const items = await pack.getDocuments();
                for (let item of items) {
                    if (itemTypesToFlag.includes(item.type)) {
                        await updateItemWithKarmaFlag(item);
                    }
                }
            }
        }
    }

    // Call the function to initialize the Karma flags if the setting is true
    await initializeKarmaFlags();
    console.log("sr5-marketplace Karma flag initialization completed.");
});
Hooks.on('getSceneControlButtons', (controls) => {
    const mainControl = controls.find(c => c.name === 'token'); // Use the main control

    // Add a new button to call fetchAndSelectLanguage
    if (game.user.isGM) { 
        mainControl.tools.push({
        name: 'enhance-item-data',
        title: 'Enhance Item Data',
        icon: 'fas fa-language', // You can choose a different FontAwesome icon if you like
        onClick: () => {
            fetchAndSelectLanguage();
        },
        button: true
    });
    }
});
Hooks.on('getSceneControlButtons', (controls) => {
    const mainControl = controls.find(c => c.name === 'token'); // Use main control or any existing control
    mainControl.tools.push({
        name: 'sr5-marketplace',
        title: 'Open Marketplace',
        icon: 'fas fa-shopping-cart',
        onClick: () => {
            new PurchaseScreenApp().render(true);
        },
        button: true
    });
});
// Hook to modify the item sheet when rendered
Hooks.on("renderItemSheet", (app, html, data) => {
    const item = app.document;  // Access the item document from the app

    // Define the allowed types that should have a karma field
    const allowedTypes = ["quality", "adept_power", "spell", "complex_form"];

    // Ensure the item type is one of the allowed types
    if (!allowedTypes.includes(item.type)) return;

    // Ensure the source div is available after render
    setTimeout(() => {
        const sourceDiv = html.find('.source');
        if (!sourceDiv.length) return;

        // Use system.karma if available, otherwise fallback to the flag value
        let karmaValue = 0;
        if (item.type === "quality" && item.system.karma !== undefined) {
            karmaValue = item.system.karma;
        } else {
            karmaValue = item.getFlag('sr5-marketplace', 'karma') || 0;
        }

        // Create the karma input field HTML
        const karmaInputHtml = `
            <div class="karma-field">
                <label>Karma:</label>
                <input type="number" class="karma-input" value="${karmaValue}" min="0" />
            </div>
        `;

        // Append the karma input to the source div
        sourceDiv.append(karmaInputHtml);

        // Set up an event listener to update the karma flag when the input changes
        html.find('.karma-input').on('change', async function() {
            const newKarmaValue = parseInt($(this).val()) || 0;

            // Update the item flag with the new karma value
            await item.setFlag('sr5-marketplace', 'karma', newKarmaValue);

            // Also update system.karma if the item is a quality
            if (item.type === "quality") {
                await item.update({ 'system.karma': newKarmaValue });
            }

            // Log the change or display a notification
            //console.log(`Updated karma value for ${item.name} to ${newKarmaValue}`);
            //ui.notifications.info(`Karma value for ${item.name} updated to ${newKarmaValue}`);
        });
    }, 100);  // Delay injection slightly to ensure full render
});
// Listen for updates to items and synchronize karma values for qualities
Hooks.on("updateItem", async (item, change, options, userId) => {
    // Only act if the item's type is "quality" and system.karma has changed
    if (item.type === "quality" && change?.system?.karma !== undefined) {
        const newKarmaValue = change.system.karma;
        console.log(`Updating Karma flag for quality: ${item.name} to new system.karma value of ${newKarmaValue}`);
        await item.setFlag('sr5-marketplace', 'karma', newKarmaValue);
    }
});
// Hook that runs when an SR5 actor sheet is rendered
Hooks.on("renderActorSheet", (app, html, data) => {
    // Ensure we're dealing with the SR5 actor sheet
    if (!html.hasClass("sr5")) return;

    // Delay injection slightly to ensure the sheet is fully rendered
    setTimeout(() => {
        // Locate the character sheet by its specific window container
        const sheetId = `#SR5CharacterSheet-Actor-${app.document.id}`;
        const sheetElement = $(sheetId);

        // Ensure the sheet element is present
        if (!sheetElement.length) {
            console.warn(`Character Sheet element with ID ${sheetId} not found.`);
            return;
        }

        // Locate the skill list items, which represent each skill on the actor sheet
        const skillItems = html.find('.list-item[data-item-type="skill"]');

        // Iterate over each skill item to inject the +/- buttons
        skillItems.each(function () {
            const skillElement = $(this);

            // Locate the .item-right div inside the skill element
            const itemRight = skillElement.find('.item-right');

            // Check if buttons already exist to avoid duplication
            if (itemRight.find('.karma-adjust-buttons').length > 0) return;

            // Locate the `.item-text.rtg` element
            const rtgElement = itemRight.find('.item-text.rtg');
            if (!rtgElement.length) {
                console.warn(`Rating element not found in item-right for skill: ${skillElement.data('item-id')}`);
                return;
            }

            // Create the HTML for the plus and minus buttons using FontAwesome icons
            const buttonsHtml = `
                <div class="karma-adjust-buttons" style="display: inline-block; margin-left: -20px;">
                    <plus class="karma-plus-button"><i class="fas fa-plus"></i></plus>
                    <minus class="karma-minus-button"><i class="fas fa-minus"></i></minus>
                </div>
            `;

            // Insert the buttons right after the `.item-text.rtg` element
            $(buttonsHtml).insertAfter(rtgElement);

            // Set up an event listener for the plus button to increase the skill value
            itemRight.find('.karma-plus-button').on('click', async function (event) {
                event.preventDefault();

                // Get the skill key from the element's data-item-id attribute
                const skillKey = skillElement.data('item-id');

                // Call the increaseSkill function
                await ActorItemData.prototype.increaseSkill(app.document, skillKey, true);
            });

            // Set up an event listener for the minus button to decrease the skill value
            itemRight.find('.karma-minus-button').on('click', async function (event) {
                event.preventDefault();

                // Get the skill key from the element's data-item-id attribute
                const skillKey = skillElement.data('item-id');

                // Call the decreaseSkill function
                await ActorItemData.prototype.decreaseSkill(app.document, skillKey, false);
            });
        });
    }, 100);  // Delay injection to ensure full render
});



