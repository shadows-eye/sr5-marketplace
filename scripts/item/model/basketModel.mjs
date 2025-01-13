// basketModel.mjs
export class BasketModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new fields.SchemaField({
                long: new fields.HTMLField({ required: false, blank: true }),
                short: new fields.HTMLField({ required: false, blank: true }),
            }),
            img: new fields.FilePathField({ required: false, categories: ["IMAGE"] }),
            contents: new fields.ArrayField(
                new fields.SchemaField({
                    itemId: new fields.StringField({ required: true }),
                    quantity: new fields.NumberField({ required: true, default: 1 }),
                    rating: new fields.NumberField({ required: false, default: 0 }),
                })
            ),
            totalCost: new fields.NumberField({ required: false, default: 0 }),
        };
    }

    prepareDerivedData() {
        super.prepareDerivedData();
        this.totalCost = this.contents.reduce(
            (total, entry) => total + (entry.quantity * (entry.rating || 1)),
            0
        );
    }
}
