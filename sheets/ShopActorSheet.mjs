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
        // Add event listener for the toggle edit switch
        // Set the toggle switch to match the current edit state
        const isEditable = this.object.getFlag('sr5-marketplace', 'editMode') ?? false;
        html.find('#toggle-edit').prop('checked', isEditable);
        this._toggleEditMode(isEditable, html);

        // Add event listener for the toggle edit switch
        html.find('#toggle-edit').change(async event => {
            const isEditable = event.target.checked;

            // Update the flag on the actor to save the edit state
            await this.object.setFlag('sr5-marketplace', 'editMode', isEditable);

            // Enable or disable inputs accordingly
            this._toggleEditMode(isEditable, html);
        });
        // Add event listener for name change
        html.find('input[name="name"]').change(event => {
            const newName = event.target.value;
            this.object.update({ name: newName });
        });
        // Add event listeners for charisma, negotiation, connection, and loyalty changes
        html.find('input[name="system.charisma"], input[name="system.negotiation"], input[name="system.connection"], input[name="system.loyalty"]').change(async (event) => {
            const fieldName = event.target.name;  // e.g., 'system.charisma'
            const newValue = parseInt(event.target.value, 10) || 0;  // Ensure it's parsed as an integer, fallback to 0
        
            //console.log(`Attempting to update ${fieldName} with value:`, newValue);
        
            try {
                await this.object.update({ [fieldName]: newValue });
                //console.log(`Successfully updated ${fieldName} with value:`, this.object.system.charisma);
            } catch (error) {
                console.error(`Failed to update ${fieldName}`, error);
            }
        });

        // Add event listeners for checkbox fields (e.g., group, family, blackmail)
        html.find('input[type="checkbox"]:not(#toggle-edit)').change(event => {
            const fieldName = event.target.name;  // e.g., 'system.group'
            const newValue = event.target.checked;  // Boolean value (true/false)

            // Update the actor's data using the full field path
            this.object.update({ [fieldName]: newValue });
        });
    }
    // Function to toggle between edit modes
    _toggleEditMode(isEditable, html) {
        const inputFields = html.find('input[type="text"], input[type="number"], input[type="checkbox"]:not(#toggle-edit), textarea');
        inputFields.prop('disabled', !isEditable);
    }
    _prepareActorData(actor) {
        const systemData = actor.system;
    
        // Initialize fields ONLY if they are undefined or null
        systemData.charisma = (systemData.charisma !== undefined && systemData.charisma !== null) ? systemData.charisma : 0;
        systemData.negotiation = (systemData.negotiation !== undefined && systemData.negotiation !== null) ? systemData.negotiation : 0;
        systemData.connection = (systemData.connection !== undefined && systemData.connection !== null) ? systemData.connection : 0;
        systemData.loyalty = (systemData.loyalty !== undefined && systemData.loyalty !== null) ? systemData.loyalty : 0;
    
        // Avoid unnecessary update calls; just make sure the initial state is set if needed
    }
}
