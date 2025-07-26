const { fields } = foundry.data;

/**
 * Defines and returns the custom ShopActor classes.
 * This must be called during the 'ready' hook.
 * @returns {{ShopActor: typeof Actor, ShopActorData: typeof foundry.abstract.TypeDataModel}}
 */
export function defineShopActorClasses() {
    const SR5Actor = CONFIG.Actor.documentClass;
    const CharacterData = CONFIG.Actor.dataModels.character;

    class ShopActorData extends CharacterData {
        static defineSchema() {
            const parentSchema = super.defineSchema();
            const shopSchema = {
                owner: new fields.StringField({ initial: "" }),
                employees: new fields.ArrayField(new fields.StringField()),
                connection: new fields.StringField({ initial: "" }),
                modifierValue: new fields.NumberField({ initial: 0 }),
                modifierType: new fields.StringField({ initial: "discount", choices: ["discount", "fee"] })
            };
            return { ...parentSchema, shop: new fields.SchemaField(shopSchema) };
        }
    }

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