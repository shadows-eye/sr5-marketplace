export class MarketplaceActorSheet extends ActorSheet {
    get template() {
        console.log("Using custom MarketplaceActorSheet.");
        return `modules/sr5-marketplace/templates/marketplace-edit.html`;

            //this.isEditable ? "edit" : "view"
        //}.html`;
    }

    async getData(options = {}) {
        const context = await super.getData(options);
        // Initialize descriptions if they don't exist
        if (!this.object.system.description) {
            this.object.system.description = {};
        }
        if (!this.object.system.description.long) {
            this.object.system.description.long = "";
        }
        if (!this.object.system.description.short) {
            this.object.system.description.short = "";
        }
        context.actorName = this.object.name;
        context.img = this.object.img;
        context.description = {
          long: await TextEditor.enrichHTML(this.object.system.description.long, {
            async: true,
            secrets: this.object.isOwner,
            relativeTo: this.object,
          }),
          short: await TextEditor.enrichHTML(this.object.system.description.short, {
            async: true,
            secrets: this.object.isOwner,
            relativeTo: this.object,
          }),
        };
        context.items = this.object.items;
        return context;
    }
    activateListeners(html) {
        super.activateListeners(html);
    
        // Add event listener for name change
        html.find('input[name="name"]').change(event => {
            const newName = event.target.value;
            this.object.update({ name: newName });
        });
    
        // Edit description button listener
        html.find('.edit-description').click(event => this._onEditDescription(event, html));

    }
    // Toggle editing of description
    async _onEditDescription(event, html) {
        const descriptionContainer = html.find('.description-container');
        const currentDescription = this.object.system.description.long || "";

        // Replace the description with an editable textarea
        descriptionContainer.html(`
            <textarea class="sr5-marketplace description-edit">${currentDescription}</textarea>
            <button type="button" class="sr5-marketplace save-description">Save</button>
        `);

        // Bind the save button listener after rendering it
        html.find('.save-description').click(event => this._onSaveDescription(event, html));
    }

    // Save the description when the user clicks "Save"
    async _onSaveDescription(event, html) {
        const newDescription = html.find('.description-edit').val();

        // Update the actor with the new description
        await this.object.update({
            'system.description.long': newDescription
        });

        // Re-render the sheet to reflect the new description
        this.render();
    }
}
