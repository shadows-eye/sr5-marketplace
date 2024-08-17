// scripts/app/itemData.js
export default class ItemData {

    constructor() {
        this.items = [];
    }

    async fetchItems() {
        const worldItems = game.items.contents;

        const compendiumItems = [];
        for (let pack of game.packs) {
            if (pack.metadata.type === "Item") {
                const content = await pack.getDocuments();
                compendiumItems.push(...content);
            }
        }

        this.items = [...worldItems, ...compendiumItems].filter(item => item.type !== "contact");
    }

    get itemsByType() {
        return {
            actions: this.getItemsByType("action"),
            adeptPowers: this.getItemsByType("adept_power"),
            ammo: this.getItemsByType("ammo"),
            armor: this.getItemsByType("armor"),
            bioware: this.getItemsByType("bioware"),
            callInActions: this.getItemsByType("call_in_action"),
            complexForms: this.getItemsByType("complex_form"),
            critterPowers: this.getItemsByType("critter_power"),
            cyberware: this.getItemsByType("cyberware"),
            devices: this.getItemsByType("device"),
            echoes: this.getItemsByType("echo"),
            equipment: this.getItemsByType("equipment"),
            hosts: this.getItemsByType("host"),
            lifestyles: this.getItemsByType("lifestyle"),
            metamagic: this.getItemsByType("metamagic"),
            modifications: this.getItemsByType("modification"),
            programs: this.getItemsByType("program"),
            qualities: this.getQualities(),
            rituals: this.getItemsByType("ritual"),
            sins: this.getItemsByType("sin"),
            spells: this.getItemsByType("spell"),
            spritePowers: this.getItemsByType("sprite_power"),
            weapons: this.getItemsByType("weapon"),
        };
    }

    getItemsByType(type) {
        return this.items.filter(item => item.type === type);
    }

    getQualities() {
        let unsorted = this.items.filter(item => item.type === "quality");
        return {
            negative: unsorted.filter(quality => quality.system.type === "negative"),
            positive: unsorted.filter(quality => quality.system.type === "positive"),
        };
    }
}
