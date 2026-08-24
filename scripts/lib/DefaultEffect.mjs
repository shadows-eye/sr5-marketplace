/**
 * A factory class to create a default, plain JavaScript object that mimics
 * the data structure of a Shadowrun 5e ActiveEffect (0.37.0+ / Foundry v14).
 */
export class DefaultEffect {
    /**
     * Creates a new, default effect data object.
     * @param {string} sourceUuid - The UUID of the item that will own this effect.
     * @returns {Promise<object>} A promise that resolves to the default effect data.
     */
    static async create(sourceUuid) {
        const sourceItem = await fromUuid(sourceUuid);
        const effectName = sourceItem ? `${sourceItem.name} Effect` : "New Effect";
        const defaultTargetId = foundry.utils.randomID();

        return {
            _id: foundry.utils.randomID(),
            name: effectName,
            img: "icons/svg/aura.svg",
            type: "base",
            system: {
                appliedByTest: false,
                onlyForEquipped: false,
                onlyForWireless: false,
                expiryAction: "default",
                targets: [
                    {
                        id: defaultTargetId,
                        name: "Target",
                        applyTo: "actor",
                        conditions: [],
                        onlyForItemTest: false
                    }
                ],
                changes: [
                    {
                        key: "",
                        type: "add",
                        value: "",
                        priority: null,
                        target: defaultTargetId
                    }
                ]
            },
            disabled: false,
            duration: { startTime: null, combat: null },
            description: "",
            origin: null,
            tint: "#ffffff",
            transfer: true,
            statuses: [],
            sourceUuid: sourceUuid,
            isEdit: false,
            targetType: "actor"
        };
    }
}