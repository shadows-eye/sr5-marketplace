// basketModel.mjs
export class BasketModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            // General information fields
            description: new fields.SchemaField({
                long: new fields.HTMLField({ required: false, blank: true, default: "" }),
                short: new fields.HTMLField({ required: false, blank: true, default: "" }),
            }),
            img: new fields.FilePathField({
                required: false,
                categories: ["IMAGE"],
                default: "icons/svg/treasure.svg"
            }),
            
            // Custom attributes for the basket item
            contents: new fields.ArrayField(new fields.SchemaField({
                itemId: new fields.StringField({ required: true }),
                quantity: new fields.NumberField({ required: true, default: 1 }),
                rating: new fields.NumberField({ required: false, default: 1 }),
            })),

            // Total cost and weight for the basket
            totalCost: new fields.NumberField({ required: false, default: 0 }),
            totalWeight: new fields.NumberField({ required: false, default: 0 }),
        };
    }

    prepareDerivedData() {
        // Calculate derived data
        const contents = this.contents || [];
        this.totalCost = contents.reduce(
            (total, entry) => total + (entry.quantity * entry.rating),
            0
        );

        this.totalWeight = contents.reduce(
            (total, entry) => total + (entry.quantity * 0.5), // Assume a default weight multiplier
            0
        );
    }
}
