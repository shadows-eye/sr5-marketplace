export class ShopModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            // General information fields
            description: new fields.SchemaField({
                long: new fields.HTMLField({ required: false, blank: true }),
                short: new fields.HTMLField({ required: false, blank: true }),
            }),
            img: new fields.FilePathField({
                required: false,
                categories: ["IMAGE"],
            }),
            // Custom attributes for the shop actor
            charisma: new fields.NumberField({ required: true, default: 0 }),
            negotiation: new fields.NumberField({ required: true, default: 0 }),
            connection: new fields.NumberField({ required: true, default: 0 }),
            loyalty: new fields.NumberField({ required: true, default: 0 }),
            group: new fields.BooleanField({ required: true, default: false }),
            family: new fields.BooleanField({ required: true, default: false }),
            blackmail: new fields.BooleanField({ required: true, default: false }),
            socialLimit: new fields.NumberField({ required: true, default: 0 }),  // Social Limit field
            // Array to store the items sold by the shop
            itemsForSale: new fields.ArrayField(new fields.SchemaField({
                itemId: new fields.StringField({ required: true }),
                price: new fields.NumberField({ required: true, default: 0 }),
                quantity: new fields.NumberField({ required: true, default: 1 }),
            })),
        };
    }

    prepareDerivedData() {
        // Any derived data calculations go here
    }
}
