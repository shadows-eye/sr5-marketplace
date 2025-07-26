

/**
 * Defines and returns the custom ShopActor classes.
 * This must be called during the 'ready' hook.
 * @returns {{ShopActor: typeof Actor, ShopActorData: typeof foundry.abstract.TypeDataModel}}
 */
export function defineShopActorClass() {
    const SR5Actor = CONFIG.Actor.documentClass;
    const CharacterData = CONFIG.Actor.dataModels.character;
    const SHOP_ACTOR_TYPE = "sr5-marketplace.shop";
    class ShopActorData extends CharacterData {
        static defineSchema() {
            const parentSchema = super.defineSchema();
            const shopSchema = () => ({
                owner: new foundry.data.fields.StringField({ initial: "" }),
                employees: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField()),
                connection: new foundry.data.fields.StringField({ initial: "" }),
                modifierValue: new foundry.data.fields.NumberField({ initial: 0 }),
                modifierType: new foundry.data.fields.StringField({ initial: "discount", choices: ["discount", "fee"] })
            });
            return { ...parentSchema, shop: new foundry.data.fields.SchemaField(shopSchema()) };
        }
    }
    CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = ShopActorData;
    // --- Define the Actor Class ---
    // This class inherits all methods from the base SR5Actor.
    class ShopActor extends SR5Actor {
        get shop() {
            return this.system.shop;
        }

        async getOwner() {
            if (!this.shop.owner) return null;
            return fromUuid(this.shop.owner);
        }

        async getEmployees() {
            if (!this.shop.employees?.length) return [];
            const employeeUuids = this.shop.employees.filter(uuid => uuid);
            return fromUuid.multi(employeeUuids);
        }
        
        async getConnection() {
            if (!this.shop.connection) return null;
            return fromUuid(this.shop.connection);
        }
    }

    return { ShopActor, ShopActorData };
}