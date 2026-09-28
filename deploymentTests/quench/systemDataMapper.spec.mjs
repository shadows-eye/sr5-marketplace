/**
 * @fileoverview Quench unit tests for SystemDataMapperService and DataModel mapping
 */

export function registerSystemDataMapperBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.systemDataMapper",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("SystemDataMapper API Container", () => {
                it("is accessible via game.sr5marketplace.api.systemDataMapper and SystemDataMapperService", () => {
                    assert.isOk(game.sr5marketplace.api.systemDataMapper, "systemDataMapper should exist on api");
                    assert.isOk(game.sr5marketplace.api.SystemDataMapperService, "SystemDataMapperService should exist on api");
                });

                it("exposes expected mapping and parser methods", () => {
                    const mapper = game.sr5marketplace.api.systemDataMapper;
                    const expectedMethods = [
                        "parseAvailability",
                        "normalizeActiveEffect",
                        "mapItemData",
                        "mapVehicleData",
                        "getMappableKeys"
                    ];

                    for (const method of expectedMethods) {
                        assert.isFunction(mapper[method], `Method ${method} should be a function`);
                    }
                });
            });

            describe("Availability Parsing and Composition", () => {
                it("parses standard Shadowrun availability strings accurately into DataModel objects", () => {
                    const mapper = game.sr5marketplace.api.systemDataMapper;

                    const resRestricted = mapper.parseAvailability("8R");
                    assert.equal(resRestricted.base, 8);
                    assert.equal(resRestricted.value, 8);
                    assert.equal(resRestricted.restriction, "restricted");
                    assert.equal(resRestricted.label, "8R");

                    const resForbidden = mapper.parseAvailability("12F");
                    assert.equal(resForbidden.base, 12);
                    assert.equal(resForbidden.value, 12);
                    assert.equal(resForbidden.restriction, "forbidden");
                    assert.equal(resForbidden.label, "12F");

                    const resLegal = mapper.parseAvailability("6");
                    assert.equal(resLegal.base, 6);
                    assert.equal(resLegal.value, 6);
                    assert.equal(resLegal.restriction, "none");
                    assert.equal(resLegal.label, "6");

                    const resZero = mapper.parseAvailability(0);
                    assert.equal(resZero.base, 0);
                    assert.equal(resZero.value, 0);
                    assert.equal(resZero.restriction, "none");
                    assert.equal(resZero.label, "0");
                });

                it("normalizes object availability inputs idempotently", () => {
                    const mapper = game.sr5marketplace.api.systemDataMapper;
                    const inputObj = { base: 10, value: 10, restriction: "restricted", label: "10R" };
                    const output = mapper.parseAvailability(inputObj);
                    assert.equal(output.base, 10);
                    assert.equal(output.value, 10);
                    assert.equal(output.restriction, "restricted");
                    assert.equal(output.label, "10R");
                });
            });

            describe("Active Effect Normalization", () => {
                it("normalizes legacy active effects into SR5 0.38+ system.targets and system.changes", () => {
                    const mapper = game.sr5marketplace.api.systemDataMapper;

                    const legacyEffect = {
                        name: "Smartlink Bonus",
                        system: {
                            applyTo: "actor"
                        },
                        changes: [
                            { key: "system.attributes.agility.value", mode: 2, value: 2 }
                        ]
                    };

                    const normalized = mapper.normalizeActiveEffect(legacyEffect);

                    assert.isOk(normalized.system, "Normalized effect should have system object");
                    assert.isArray(normalized.system.targets, "system.targets should be an array");
                    assert.equal(normalized.system.targets.length, 1, "Should have 1 target");
                    assert.equal(normalized.system.targets[0].applyTo, "actor", "Target applyTo should be actor");

                    assert.isArray(normalized.system.changes, "system.changes should be an array");
                    assert.equal(normalized.system.changes.length, 1, "Should have 1 change");
                    assert.equal(normalized.system.changes[0].key, "system.attributes.agility.value");
                    assert.equal(normalized.system.changes[0].type, "add");
                    assert.equal(normalized.system.changes[0].value, "2");
                    assert.equal(normalized.system.changes[0].target, normalized.system.targets[0].id);

                    // Ensure legacy properties are deleted
                    assert.isUndefined(normalized.changes, "Legacy top-level changes should be cleaned up");
                    assert.isUndefined(normalized.system.applyTo, "Legacy system.applyTo should be cleaned up");
                });
            });

            describe("Item and Vehicle DataModel Mapping", () => {
                it("maps item build data using DataModel schemas for technology cost, availability, and embedded items", () => {
                    const mapper = game.sr5marketplace.api.systemDataMapper;

                    const rawItem = {
                        name: "Custom Ares Alpha",
                        type: "weapon",
                        system: {
                            technology: {
                                cost: { base: 2650, value: 2650 },
                                availability: { base: 11, value: 11, restriction: "forbidden", label: "11F" }
                            }
                        }
                    };

                    const totals = {
                        totalCost: 3200,
                        combinedAvailability: "12F",
                        totalEssence: 0
                    };

                    const mockMod = {
                        name: "Laser Sight",
                        type: "modification",
                        system: { equipped: false }
                    };

                    const mapped = mapper.mapItemData(rawItem, totals, {
                        embeddedMods: [mockMod]
                    });

                    // Cost mapping
                    assert.equal(mapped.system.technology.cost.value, 3200);
                    assert.equal(mapped.system.technology.cost.base, 3200);

                    // Availability mapping: must be proper object, not raw string
                    assert.isObject(mapped.system.technology.availability, "availability should be mapped as schema object");
                    assert.equal(mapped.system.technology.availability.value, 12);
                    assert.equal(mapped.system.technology.availability.restriction, "forbidden");
                    assert.equal(mapped.system.technology.availability.label, "12F");

                    // Embedded items in flags
                    assert.isOk(mapped.flags?.shadowrun5e?.embeddedItems, "Embedded items should be populated in shadowrun5e flag");
                    assert.equal(mapped.flags.shadowrun5e.embeddedItems.length, 1);
                    assert.equal(mapped.flags.shadowrun5e.embeddedItems[0].name, "Laser Sight");
                    assert.isTrue(mapped.flags.shadowrun5e.embeddedItems[0].system.equipped, "Embedded mod should be equipped");
                });

                it("maps vehicle build data using Actor DataModel schema for cost and installed mods", () => {
                    const mapper = game.sr5marketplace.api.systemDataMapper;

                    const rawVehicle = {
                        name: "Custom Rover 2068",
                        type: "vehicle",
                        system: {
                            cost: 45000,
                            availability: "8"
                        },
                        items: []
                    };

                    const totals = {
                        totalCost: 52000,
                        combinedAvailability: "10R"
                    };

                    const mockVehicleMod = {
                        name: "Armor Upgrade",
                        type: "modification",
                        system: {}
                    };

                    const mapped = mapper.mapVehicleData(rawVehicle, totals, {
                        embeddedItems: [mockVehicleMod]
                    });

                    assert.equal(mapped.system.cost, 52000);
                    assert.equal(mapped.system.availability, "10R");
                    assert.equal(mapped.items.length, 1);
                    assert.equal(mapped.items[0].name, "Armor Upgrade");
                    assert.isTrue(mapped.items[0].system.equipped);
                });
            });

            describe("Marketplace Item Indexing on Creation", () => {
                it("immediately indexes newly created items so they appear in getItems()", async () => {
                    const itemDataService = game.sr5marketplace.api.itemData;
                    const testItemData = {
                        name: `Quench Indexed Item ${foundry.utils.randomID()}`,
                        type: "equipment",
                        system: {
                            technology: {
                                cost: { base: 750, value: 750 },
                                availability: { base: 4, value: 4, restriction: "none", label: "4" },
                                quantity: 1
                            }
                        }
                    };

                    // Add to index
                    itemDataService.addOrUpdateItemToIndex(testItemData);

                    const allItems = itemDataService.getItems();
                    const found = allItems.find(i => i.name === testItemData.name);
                    assert.isOk(found, "Newly added item should immediately be found in getItems()");
                    assert.equal(found.name, testItemData.name);
                });
            });
        },
        { displayName: "SR5 Marketplace: System DataMapper API" }
    );
}
