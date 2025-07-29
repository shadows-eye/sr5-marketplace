/**
 * A mixin that augments a Document Sheet with common Application V2 behavior.
 * @template {Constructor<foundry.applications.api.DocumentSheet>} BaseDocumentSheet
 * @param {BaseDocumentSheet} base
 * @returns {BaseDocumentSheet}
 */
export default base => {
  const { HandlebarsApplicationMixin } = foundry.applications.api;

  return class MarketplaceDocumentSheet extends HandlebarsApplicationMixin(base) {
    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
      form: {
        // This tells the application to call our _processFormData method on submit.
        handler: this.prototype._processFormData,
        submitOnChange: true,
        closeOnSubmit: false,
      },
      window: {
        resizable: true,
      },
    };

    /**
     * Processes the form data before updating the document.
     * @param {SubmitEvent} event           The submission event.
     * @param {HTMLFormElement} form        The form element.
     * @param {FormDataExtended} formData   The form data.
     * @returns {object}                    The data to update the document with.
     * @protected
     */
    _processFormData(event, form, formData) {
      // This default implementation just expands the form data.
      // Specific sheets can override this method to add custom logic.
      const data = formData.object;
      this.document.update(data);
      return data;
    }

    /**
     * @override
     * Prepares the context object for rendering the template.
     */
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      
      // Add common data useful for all sheets.
      context.actor = this.document;
      context.system = this.document.system;
      context.flags = this.document.flags;
      context.isOwner = this.document.isOwner;
      context.isEditable = this.isEditable;
      context.limited = this.document.limited;
      
      return context;
    }
  };
};