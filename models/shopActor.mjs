const { fields } = foundry.data;

/**
 * The schema for the custom fields to be added to the Shop Actor's data model.
 */
export const shopSchema = {
    owner: new fields.StringField({ initial: "", label: "SR5.Marketplace.Shop.OwnerUuid" }),
    employees: new fields.ArrayField(new fields.StringField(), { label: "SR5.Marketplace.Shop.Employees" }),
    connection: new fields.StringField({ initial: "", label: "SR5.Marketplace.Shop.ConnectionUuid" }),
    modifierValue: new fields.NumberField({ initial: 0, label: "SR5.Marketplace.Shop.ModifierValue" }),
    modifierType: new fields.StringField({ initial: "discount", choices: ["discount", "fee"], label: "SR5.Marketplace.Shop.ModifierType" })
};

/**
 * A collection of methods to add to the ShopActor's prototype.
 * These are perfectly valid for an ActorSheetV2 to call via `this.document`.
 */
export const shopActorMethods = {
    get shop() {
        return this.system.shop;
    },
    async getOwner() {
        if (!this.shop.owner) return null;
        return fromUuid(this.shop.owner);
    },
    async getEmployees() {
        if (!this.shop.employees?.length) return [];
        const employeeUuids = this.shop.employees.filter(uuid => uuid);
        return fromUuid.multi(employeeUuids);
    },
    async getConnection() {
        if (!this.shop.connection) return null;
        return fromUuid(this.shop.connection);
    }
};