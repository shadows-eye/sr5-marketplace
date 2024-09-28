export class ShopModel extends foundry.abstract.TypeDataModel {
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
                default: "icons/svg/mystery-man.svg"
            }),
            
            // Custom attributes for the shop actor grouped under `attributes`
            attributes: new fields.SchemaField({
                charisma: new fields.NumberField({ required: true, default: 0 }),
                intuition: new fields.NumberField({ required: true, default: 0 }),
                logic: new fields.NumberField({ required: true, default: 0 }),
                willpower: new fields.NumberField({ required: true, default: 0 }),
                agility: new fields.NumberField({ required: true, default: 0 }),
                strength: new fields.NumberField({ required: true, default: 0 }),
                reaction: new fields.NumberField({ required: true, default: 0 }),
                body: new fields.NumberField({ required: true, default: 0 }),

            }),
            skills: new fields.SchemaField({
                negotiation: new fields.NumberField({ required: true, default: 0 }),
                con: new fields.NumberField({ required: true, default: 0 }),
                etiquette: new fields.NumberField({ required: true, default: 0 }),
                intimidation: new fields.NumberField({ required: true, default: 0 }),
            }),
            connection: new fields.NumberField({ required: true, default: 0 }),
            loyalty: new fields.NumberField({ required: true, default: 0 }),
            group: new fields.BooleanField({ required: true, default: false }),
            family: new fields.BooleanField({ required: true, default: false }),
            blackmail: new fields.BooleanField({ required: true, default: false }),
            socialLimit: new fields.NumberField({ required: true, default: 0 }), // Social Limit field
            connectionLink: new fields.StringField({ required: false, default: "" }), // Connection Link field
            shopItemLink: new fields.StringField({ required: false, default: "" }), // Shop Item Link field
            // Array to store the items sold by the shop
            itemsForSale: new fields.ArrayField(new fields.SchemaField({
                actorShopItem: new fields.StringField({ required: false }),
                quantity: new fields.StringField({ required: false}),
            })),
        };
    }

    prepareDerivedData() {
        // Any derived data calculations go here
    }
}
