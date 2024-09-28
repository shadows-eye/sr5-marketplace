export class MarketplaceActorSheet extends ActorSheet {
    get template() {
        console.log("Using custom MarketplaceActorSheet.");
        return `modules/sr5-marketplace/templates/marketplace-edit.html`;

            //this.isEditable ? "edit" : "view"
        //}.html`;
    }

    async getData(options = {}) {
        const context = await super.getData(options);
        const systemData = this.object.system;
    
        // 1. Initialize descriptions if they don't exist
        if (!systemData.description) {
            systemData.description = {};
        }
        if (!systemData.description.long) {
            systemData.description.long = "";
        }
        if (!systemData.description.short) {
            systemData.description.short = "";
        }
    
        // Enrich the descriptions asynchronously
        context.description = {
            long: await TextEditor.enrichHTML(systemData.description.long, {
                async: true,
                secrets: this.object.isOwner,
                relativeTo: this.object,
            }),
            short: await TextEditor.enrichHTML(systemData.description.short, {
                async: true,
                secrets: this.object.isOwner,
                relativeTo: this.object,
            }),
        };
    
        // 2. Initialize numeric fields only if they are null or undefined to avoid overwriting valid data
        systemData.charisma = (systemData.charisma !== undefined && systemData.charisma !== null) ? systemData.charisma : 0;
        systemData.negotiation = (systemData.negotiation !== undefined && systemData.negotiation !== null) ? systemData.negotiation : 0;
        systemData.connection = (systemData.connection !== undefined && systemData.connection !== null) ? systemData.connection : 0;
        systemData.loyalty = (systemData.loyalty !== undefined && systemData.loyalty !== null) ? systemData.loyalty : 0;
    
        // 3. Provide the necessary data context for rendering
        context.actorName = this.object.name;
        context.img = this.object.img;
    
        // Use a deep clone to avoid issues with direct object references
        context.system = foundry.utils.deepClone(systemData);
    
        // Include additional data like items
        context.items = this.object.items;
    
        // Retrieve the edit mode from the actor flags
        context.isEditable = this.object.getFlag('sr5-marketplace', 'editMode') ?? false;
        return context;
    }
    
    activateListeners(html) {
        super.activateListeners(html);
    
        // Set the toggle switch to match the current edit state
        const isEditable = this.object.getFlag('sr5-marketplace', 'editMode') ?? false;
        html.find('#toggle-edit').prop('checked', isEditable);
        this._toggleEditMode(isEditable, html);
    
        // Event listener for the toggle edit switch
        html.find('#toggle-edit').change(async event => {
            const isEditable = event.target.checked;
    
            // Update the flag on the actor to save the edit state
            await this.object.setFlag('sr5-marketplace', 'editMode', isEditable);
    
            // Enable or disable inputs accordingly
            this._toggleEditMode(isEditable, html);
            
            // Explicitly re-render the form to refresh the fields and maintain current values
            this.render(false);
        });
    
        // Event listener for name change
        html.find('input[name="name"]').change(async event => {
            const newName = event.target.value.trim();
    
            if (newName) {
                try {
                    await this.object.update({ name: newName });
                    // Explicitly set the value in the input field to ensure it stays visible
                    event.target.value = newName;
                    this.render(false); // Re-render the sheet to reflect the updated name
                } catch (error) {
                    console.error('Failed to update name:', error);
                }
            }
        });
    
        // Event listeners for numeric fields (charisma, negotiation, connection, loyalty)
        html.find('input[name^="system."]').change(async event => {
            const fieldName = event.target.name;  // E.g., 'system.charisma'
            const newValue = parseInt(event.target.value, 12) || 0;  // Ensure it's parsed as an integer, fallback to 0
    
            try {
                await this.object.update({ [fieldName]: newValue });
                this.render(false); // Re-render to make sure the value is updated visually
            } catch (error) {
                console.error(`Failed to update ${fieldName}`, error);
            }
        });
    
        // Event listeners for checkbox fields (e.g., group, family, blackmail)
        html.find('input[type="checkbox"]:not(#toggle-edit)').change(async event => {
            const fieldName = event.target.name;  // E.g., 'system.group'
            const newValue = event.target.checked;  // Boolean value (true/false)
    
            try {
                await this.object.update({ [fieldName]: newValue });
                this.render(false); // Re-render the sheet to reflect the updated value
            } catch (error) {
                console.error(`Failed to update ${fieldName}`, error);
            }
        });
    
        // Event listeners for drag and drop on the linkedConnection field
        const connectionField = html.find('.linked-connection-dropzone');
        connectionField.on('dragover', this._onDragOver.bind(this));
        connectionField.on('drop', this._onDropConnection.bind(this));
        // Display the enriched UUID when the linkedConnection exists
        this._handleLinkedConnectionDisplay(html);

        // Add event listeners for drag and drop on the items-for-sale dropzone
        const itemsForSaleDropzone = html.find('#items-for-sale-dropzone');
        itemsForSaleDropzone.on('dragover', this._onDragOver.bind(this));
        itemsForSaleDropzone.on('drop', this._onDropItemForSale.bind(this));
    }
    async _handleLinkedConnectionDisplay(html) {
        const linkedConnectionValue = foundry.utils.getProperty(this.object, 'system.connectionLink');
    
        const connectionContainer = html.find('.linked-connection-dropzone');
    
        if (linkedConnectionValue) {
            // Hide the input dropzone
            connectionContainer.hide();
    
            // Enrich the UUID link to make it clickable

            let enrichedHTML = await TextEditor.enrichHTML(`@UUID[${linkedConnectionValue}]`, {
                async: true, 
                relativeTo: this.object
            });

            // Add the enriched UUID link and remove button
            const enrichedContent = `
            <div class="sr5-marketplace linked-connection-display">
                <div class="sr5-marketplace linked-connection-info">
                    ${enrichedHTML}
                </div>
                <button type="button" class="sr5-marketplace remove-connection-button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            `;

            connectionContainer.after(enrichedContent);
    
            // Add event listener for the remove button
            html.find('.remove-connection-button').click(() => this._removeLinkedConnection(html));
        } else {
            // Show the input dropzone if there's no linked connection
            connectionContainer.show();
        }
    }
    // Handle drop event to retrieve and save item UUID
    async _onDropConnection(event) {
        event.preventDefault();

        // Extract data from the drop event
        const dataTransfer = event.originalEvent.dataTransfer;
        if (!dataTransfer) return;

        const json = dataTransfer.getData('text/plain');
        if (!json) return;

        let data;
        try {
            data = JSON.parse(json);
        } catch (err) {
            console.error("Failed to parse dropped item data", err);
            return;
        }

        // Ensure that the dropped data is an item
        if (data.type !== "Item") {
            ui.notifications.warn("Only items can be linked.");
            return;
        }

        // Retrieve the dropped item from the game by its UUID
        const droppedItem = await fromUuid(data.uuid);
        if (!droppedItem) {
            ui.notifications.error("Could not retrieve dropped item.");
            return;
        }

        // Ensure the item is of the correct type (e.g., "connection")
        if (droppedItem.type !== "contact") {
            ui.notifications.warn("Only connection items can be linked here.");
            return;
        }

        // Update the actor's connectionLink field with the item's UUID
        await this.object.update({
            'system.connectionLink': droppedItem.uuid
        });

        // Re-render the sheet to reflect the updated connection link
    }
    // Handle dragover event to allow dropping
    _onDragOver(event) {
        event.preventDefault();
        return false;
    }
    // Function to toggle between edit modes
    async _toggleEditMode(isEditable, html) {
        const inputFields = html.find('input[type="text"], input[type="number"], input[type="checkbox"]:not(#toggle-edit), textarea');
    
        // Enable or disable input fields based on the edit mode
        inputFields.prop('disabled', !isEditable);
    
        // Make sure we explicitly set the values of the input fields to match the actor's current data
        inputFields.each((index, element) => {
            const fieldName = $(element).attr('name');
            if (fieldName) {
                // Use foundry.utils.getProperty to get the value
                const fieldValue = foundry.utils.getProperty(this.object, fieldName);
                $(element).val(fieldValue);
            }
        });
    
        // Apply visual feedback to input fields if necessary
        inputFields.each((_, field) => {
            if (isEditable) {
                $(field).removeClass('disabled-visual');
            } else {
                $(field).addClass('disabled-visual');
            }
        });
    }    
    _prepareActorData(actor) {
        const systemData = actor.system;
    
        // Attributes
        if (!systemData.attributes) {
            systemData.attributes = {
                charisma: 0,
                intuition: 0,
                logic: 0,
                willpower: 0,
                agility: 0,
                strength: 0,
                reaction: 0,
                body: 0,
            };
        } else {
            if (systemData.attributes.charisma === undefined) systemData.attributes.charisma = 0;
            if (systemData.attributes.intuition === undefined) systemData.attributes.intuition = 0;
            if (systemData.attributes.logic === undefined) systemData.attributes.logic = 0;
            if (systemData.attributes.willpower === undefined) systemData.attributes.willpower = 0;
            if (systemData.attributes.agility === undefined) systemData.attributes.agility = 0;
            if (systemData.attributes.strength === undefined) systemData.attributes.strength = 0;
            if (systemData.attributes.reaction === undefined) systemData.attributes.reaction = 0;
            if (systemData.attributes.body === undefined) systemData.attributes.body = 0;
        }
    
        // Skills
        if (!systemData.skills) {
            systemData.skills = {
                negotiation: 0,
                con: 0,
                etiquette: 0,
                intimidation: 0,
            };
        } else {
            if (systemData.skills.negotiation === undefined) systemData.skills.negotiation = 0;
            if (systemData.skills.con === undefined) systemData.skills.con = 0;
            if (systemData.skills.etiquette === undefined) systemData.skills.etiquette = 0;
            if (systemData.skills.intimidation === undefined) systemData.skills.intimidation = 0;
        }
    
        // Shop Actor Specific Fields
        if (!systemData.shopActor) {
            systemData.shopActor = {
                connection: 0,
                loyalty: 0,
                group: false,
                family: false,
                blackmail: false,
            };
        } else {
            if (systemData.shopActor.connection === undefined) systemData.shopActor.connection = 0;
            if (systemData.shopActor.loyalty === undefined) systemData.shopActor.loyalty = 0;
            if (systemData.shopActor.group === undefined) systemData.shopActor.group = false;
            if (systemData.shopActor.family === undefined) systemData.shopActor.family = false;
            if (systemData.shopActor.blackmail === undefined) systemData.shopActor.blackmail = false;
        }
    
        // Social Limit
        if (systemData.socialLimit === undefined) systemData.socialLimit = 0;
    
        // Links
        if (systemData.connectionLink === undefined) systemData.connectionLink = "";
        if (systemData.shopItemLink === undefined) systemData.shopItemLink = "";
    
        // Items for Sale
        if (!systemData.itemsForSale) {
            systemData.itemsForSale = [];
        }
    }
    // Method to remove the linked connection item
    /**
     * 
     * @param {*} html 
     */
    async _removeLinkedConnection(html) {
        try {
            // Update the actor to remove the linked connection value
            await this.object.update({ 'system.connectionLink': '' });

            // Re-render the sheet to remove the enriched HTML and show the input field again
            this.render(false);
        } catch (error) {
            console.error('Failed to remove linked connection:', error);
        }
    }
    /**
     * 
     * @param {*} event 
     * @returns 
     */
    async _onDropItemForSale(event) {
        event.preventDefault();
    
        // Retrieve the dropped item's data
        const data = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
    
        if (data.type !== "Item") {
            return ui.notifications.warn("Only items can be added to the shop.");
        }
    
        // Retrieve the item document
        let item = await Item.implementation.fromDropData(data);
    
        // Ensure the item is not of a type that is excluded from being sold
        const excludedItemTypes = ["adept_power", "call_in_action", "complex_form", "critter_power", "echo", "host", "metamagic", "quality", "sprite_power"];
        if (excludedItemTypes.includes(item.type)) {
            return ui.notifications.warn("This item type cannot be sold in the shop.");
        }
    
        // Prepare the item data for storage
        const itemsForSale = this.object.system.itemsForSale || [];
    
        itemsForSale.push({
            actorShopItem: item,  // Store the full item data here
            quantity: 1,  // Default quantity is 1
        });
    
        // Update the actor's data to include the new item in the "itemsForSale"
        await this.object.update({
            'system.itemsForSale': itemsForSale
        });
    
        // Re-render the sheet to show the newly added item
        this.render(false);
    }    
}