// basketModel.mjs
export class BasketModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            description: new fields.SchemaField({
                long: new fields.HTMLField({ required: false, blank: true, default: "" }),
                short: new fields.HTMLField({ required: false, blank: true, default: "" }),
            }),
            img: new fields.FilePathField({
                required: false,
                categories: ["IMAGE"],
                default: "icons/svg/treasure.svg",
            }),
            basketUuid: new fields.StringField({ required: true, default: "" }),
            system: new fields.SchemaField({
                basketQuantity: new fields.NumberField({ required: true, default: 1 }),
                basketPrice: new fields.NumberField({ required: true, default: 0 }),
                basketAvailability: new fields.StringField({ required: true, default: "0" }),
                basketItems: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true, default: "Unknown Item" }),
                        uuid: new fields.StringField({ required: true }),
                        img: new fields.FilePathField({
                            required: false,
                            categories: ["IMAGE"],
                            default: "icons/svg/item-bag.svg",
                        }),
                        basketItemRating: new fields.NumberField({ required: true, default: 1 }),
                        basketItemQuantity: new fields.NumberField({ required: true, default: 1 }),
                    })
                ),
            }),
            totalCost: new fields.NumberField({ required: false, default: 0 }),
            totalEssence: new fields.NumberField({ required: false, default: 0 }),
            totalKarma: new fields.NumberField({ required: false, default: 0 }),
        };
    }

    prepareDerivedData() {
        const systemData = this.system || {};
        const basketItems = systemData.basketItems || [];
    
        // Calculate total cost
        this.totalCost = basketItems.reduce(
            (total, item) => total + item.basketItemQuantity * item.basketItemRating,
            0
        );
    
        // Calculate total essence
        this.totalEssence = basketItems.reduce(
            (total, item) => total + (item.essenceCost || 0) * item.basketItemQuantity,
            0
        );
    
        // Calculate total karma
        this.totalKarma = basketItems.reduce(
            (total, item) => total + (item.karmaCost || 0) * item.basketItemQuantity,
            0
        );
    
        // Initialize availability variables
        let totalAvailabilityNumeric = 0;
        let highestPriorityText = "";
    
        const priorityMap = { "": 0, "R": 1, "F": 2 };
        const textMapping = {
            en: { "R": "R", "F": "F", "": "" },
            de: { "R": "E", "F": "V", "": "" }, // Example for German localization
        };
    
        // Reverse text mapping for lookup
        const reverseTextMapping = Object.keys(textMapping).reduce((acc, lang) => {
            acc[lang] = Object.entries(textMapping[lang]).reduce((revMap, [key, value]) => {
                revMap[value] = key;
                return revMap;
            }, {});
            return acc;
        }, {});
    
        // Determine the current language
        const currentLang = game.i18n.lang || "en";
    
        basketItems.forEach(item => {
            const availability = item.availability || "";
    
            // Extract numeric part
            const numericPart = parseInt(availability.match(/\d+/), 10) || 0;
            totalAvailabilityNumeric += numericPart;
    
            // Extract and normalize text part
            let textPart = availability.replace(/\d+/g, '').trim().toUpperCase();
    
            // Translate to the base priority letter using reverse mapping
            const baseText = reverseTextMapping[currentLang]?.[textPart] || textPart;
    
            // If baseText exists in the priority map, update the highest priority text
            if (priorityMap[baseText] > priorityMap[highestPriorityText]) {
                highestPriorityText = baseText;
            }
        });
    
        // Localize the highest priority text
        const localizedText = highestPriorityText
            ? game.i18n.localize(`SR5.Marketplace.system.avail.${highestPriorityText}`)
            : "";
    
        // Set the total availability
        this.totalAvailability = `${totalAvailabilityNumeric}${localizedText}`;
    }    
}
