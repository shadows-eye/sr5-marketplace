/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.itemBuilder
 */

export function registerItemBuilderBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.itemBuilder",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("ItemBuilder API Container", () => {
                it("is accessible via game.sr5marketplace.api.itemBuilder", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.itemBuilder, "game.sr5marketplace.api.itemBuilder should exist");
                });

                it("exposes expected ItemBuilder methods", () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    const expectedMethods = [
                        "setBaseItem",
                        "getBaseItem",
                        "open",
                        "clear",
                        "close"
                    ];

                    for (const method of expectedMethods) {
                        assert.isFunction(api[method], `Method ${method} should be a function`);
                    }
                });
            });

            describe("ItemBuilder State and Clearing", () => {
                it("clears builder state and retrieves null base item when empty", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    await api.clear();
                    const baseItem = await api.getBaseItem();
                    assert.isNull(baseItem, "Base item should be null after clearing state");
                });

                it("handles invalid setBaseItem parameters gracefully", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    assert.doesNotThrow(async () => {
                        await api.setBaseItem(null);
                    }, "Calling setBaseItem(null) should handle empty input safely");
                });

                it("loads pre-existing modifications into weapon mount slots when selecting a weapon", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    const weapon = game.items.get("PF0RUvbWtvEQvZb9");
                    if (!weapon) return;

                    await api.setBaseItem(weapon.uuid);
                    const state = await game.sr5marketplace.api.factory.getBuilderState();

                    assert.isOk(state.baseItem, "Base item should be set");
                    assert.equal(state.baseItem.uuid, weapon.uuid, "Base item UUID should match weapon");

                    // Should have slots populated
                    const changes = state.changes || {};
                    const slotKeys = Object.keys(changes);
                    assert.isTrue(slotKeys.length > 0, "Changes should have pre-existing modifications loaded into slots");

                    // Zweibein (under) -> bottomLeft, Lasermarkierer (top) -> topLeft, Verlängerter Lauf (barrel) -> topRight
                    assert.isOk(changes.topLeft, "Top mount modification should be assigned to topLeft");
                    assert.isOk(changes.bottomLeft, "Under mount modification should be assigned to bottomLeft");
                    assert.isOk(changes.topRight, "Barrel mount modification should be assigned to topRight");

                    assert.equal(changes.topLeft.system?.mount_point, "top");
                    assert.equal(changes.bottomLeft.system?.mount_point, "under");
                    assert.equal(changes.topRight.system?.mount_point, "barrel");

                    await api.clear();
                });

                it("loads pre-existing embedded modifications on armor into bottom slots", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    const armor = game.items.get("OP7VfXAqnCY4HDQ4");
                    if (!armor) return;

                    await api.setBaseItem(armor.uuid);
                    const state = await game.sr5marketplace.api.factory.getBuilderState();

                    assert.isOk(state.baseItem, "Base item should be set");
                    const changes = state.changes || {};
                    const slottedMods = Object.values(changes);

                    // Ares Armored Coldsuit has 3 embedded mods: Custom Fit, Insulation, Restrictive
                    assert.isTrue(slottedMods.length >= 3, "Armor embedded modifications should be slotted into builder");
                    const modNames = slottedMods.map(m => m.name);
                    assert.isTrue(modNames.includes("Custom Fit"), "Custom Fit should be loaded into a slot");
                    assert.isTrue(modNames.includes("Insulation"), "Insulation should be loaded into a slot");
                    assert.isTrue(modNames.includes("Restrictive"), "Restrictive should be loaded into a slot");

                    await api.clear();
                });

                it("loads pre-existing modifications on vehicles into builder slots", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    const vehicle = game.actors.get("7saMW5F5Sg0C55gv");
                    if (!vehicle) return;

                    await api.setBaseItem(vehicle.uuid);
                    const state = await game.sr5marketplace.api.factory.getBuilderState();

                    assert.isOk(state.baseItem, "Base item should be set for vehicle");
                    const changes = state.changes || {};
                    const slottedMods = Object.values(changes);

                    // AGC Resilient has 7 modifications
                    assert.isTrue(slottedMods.length >= 5, "Vehicle modifications should be loaded into builder slots");

                    await api.clear();
                });
            });
        },
        { displayName: "SR5 Marketplace: Item Builder API" }
    );
}
