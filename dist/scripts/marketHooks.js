//#region scripts/services/IndexService.mjs
var e = class {
	async buildIndex() {
		let e = document.createElement("div");
		e.id = "sr5-marketplace-progress-container", Object.assign(e.style, {
			position: "fixed",
			top: "80px",
			left: "50%",
			transform: "translateX(-50%)",
			width: "90vw",
			maxWidth: "1200px",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			color: "white",
			padding: "10px",
			borderRadius: "5px",
			border: "1px solid #ff6400",
			boxShadow: "0 0 10px #000",
			zIndex: "10001",
			textAlign: "center"
		}), document.body.appendChild(e);
		let t = game.packs.filter((e) => e.metadata.type === "Item"), n = [...game.items.contents.filter((e) => !e.name.includes("#[CF_tempEntity]"))], r = 0;
		for (let i of t) {
			let a = await i.getDocuments();
			n.push(...a.filter((e) => !e.name.includes("#[CF_tempEntity]"))), r++;
			let o = Math.round(r / t.length * 100);
			e.innerHTML = `<span>Indexing: ${i.metadata.label} (${r}/${t.length})</span><progress value="${o}" max="100" style="width: 100%;"></progress>`;
		}
		let i = n.map((e) => {
			let t = e.toObject();
			return t.uuid = e.uuid, t;
		});
		return e.remove(), ui.notifications.info(game.i18n.localize("SR5Marketplace.Marketplace.Notifications.IndexComplete")), console.log(`SR5 Marketplace | Indexed ${i.length} items for the session.`), i;
	}
}, t = (e, t) => t.split(".").reduce((e, t) => e && e[t], e), n = class {
	static ITEM_CATEGORIES = {
		weapon: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Weapons",
			items: [],
			subcategories: {
				range: {
					label: "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons",
					items: [],
					subsubcategories: {
						taser: {
							label: "SR5.Weapon.Range.Category.Taser",
							items: []
						},
						holdOutPistol: {
							label: "SR5.Weapon.Range.Category.HoldOutPistol",
							items: []
						},
						lightPistol: {
							label: "SR5.Weapon.Range.Category.LightPistol",
							items: []
						},
						heavyPistol: {
							label: "SR5.Weapon.Range.Category.HeavyPistol",
							items: []
						},
						machinePistol: {
							label: "SR5.Weapon.Range.Category.MachinePistol",
							items: []
						},
						smg: {
							label: "SR5.Weapon.Range.Category.SMG",
							items: []
						},
						assaultRifle: {
							label: "SR5.Weapon.Range.Category.AssaultRifle",
							items: []
						},
						shotgun: {
							label: "SR5.Weapon.Range.Category.ShotgunSlug",
							items: []
						},
						sniperRifle: {
							label: "SR5.Weapon.Range.Category.SniperRifle",
							items: []
						},
						sportingRifle: {
							label: "SR5.Weapon.Range.Category.SportingRifle",
							items: []
						},
						lightMachinegun: {
							label: "SR5.Weapon.Range.Category.LightMachinegun",
							items: []
						},
						mediumHeavyMachinegun: {
							label: "SR5.Weapon.Range.Category.MediumHeavyMachinegun",
							items: []
						},
						assaultCannon: {
							label: "SR5.Weapon.Range.Category.AssaultCannon",
							items: []
						},
						grenadeLauncher: {
							label: "SR5.Weapon.Range.Category.GrenadeLauncher",
							items: []
						},
						missileLauncher: {
							label: "SR5.Weapon.Range.Category.MissileLauncher",
							items: []
						},
						bow: {
							label: "SR5.Weapon.Range.Category.Bow",
							items: []
						},
						crossbow: {
							label: "SR5.Weapon.Range.Category.LightCrossbow",
							items: []
						},
						harpoonGun: {
							label: "SR5.Weapon.Range.Category.HarpoonGun",
							items: []
						},
						flamethrower: {
							label: "SR5.Weapon.Range.Category.Flamethrower",
							items: []
						}
					}
				},
				melee: {
					label: "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons",
					items: [],
					subsubcategories: {
						blades: {
							label: "SR5.Skill.Blades",
							items: []
						},
						clubs: {
							label: "SR5.Skill.Clubs",
							items: []
						},
						exotic: {
							label: "SR5.Skill.ExoticMelee",
							items: []
						},
						unarmed: {
							label: "SR5.Skill.UnarmedCombat",
							items: []
						}
					}
				},
				thrown: {
					label: "SR5.Weapon.Category.Thrown",
					items: [],
					subsubcategories: {
						throwing_weapons: {
							label: "SR5.Skill.ThrowingWeapons",
							items: []
						},
						grenade: {
							label: "SR5.ItemTypes.Ammo",
							items: []
						}
					}
				}
			}
		},
		modification: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Modifications",
			items: [],
			subcategories: {
				weapon: {
					label: "SR5Marketplace.Marketplace.ItemTypes.WeaponMods",
					items: []
				},
				armor: {
					label: "SR5Marketplace.Marketplace.ItemTypes.ArmorMods",
					items: []
				},
				vehicle: {
					label: "SR5Marketplace.Marketplace.ItemTypes.VehicleMods",
					items: []
				},
				drone: {
					label: "SR5.Vehicle.Drone",
					items: []
				}
			}
		},
		spell: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Spells",
			items: [],
			subcategories: {
				combat: {
					label: "SR5.Spell.CatCombat",
					items: []
				},
				detection: {
					label: "SR5.Spell.CatDetection",
					items: []
				},
				health: {
					label: "SR5.Spell.CatHealth",
					items: []
				},
				illusion: {
					label: "SR5.Spell.CatIllusion",
					items: []
				},
				manipulation: {
					label: "SR5.Spell.CatManipulation",
					items: []
				}
			}
		},
		armor: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Armor",
			items: [],
			subcategories: {
				armor: {
					label: "Armor",
					items: []
				},
				cloaks: {
					label: "Cloaks",
					items: []
				},
				clothing: {
					label: "Clothing",
					items: []
				},
				"high-fashion-armor-clothing": {
					label: "High Fashion",
					items: []
				},
				"specialty-armor": {
					label: "Specialty Armor",
					items: []
				}
			}
		},
		cyberware: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Cyberware",
			items: []
		},
		bioware: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Bioware",
			items: []
		},
		device: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Devices",
			items: [],
			subcategories: {
				commlink: {
					label: "SR5.DeviceCatCommlink",
					items: []
				},
				cyberdeck: {
					label: "SR5.DeviceCatCyberdeck",
					items: []
				},
				rcc: {
					label: "SR5.DeviceCatRCC",
					items: []
				},
				living_persona: {
					label: "SR5.LivingPersona",
					items: []
				}
			}
		},
		equipment: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Equipment",
			items: []
		},
		metamagic: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Metamagic",
			items: []
		},
		adept_power: {
			label: "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers",
			items: []
		},
		echo: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Echo",
			items: []
		},
		quality: {
			label: "SR5Marketplace.Marketplace.ItemTypes.Qualitys",
			items: []
		},
		complex_form: {
			label: "SR5Marketplace.Marketplace.ItemTypes.ComplexForms",
			items: []
		}
	};
	static ITEM_TYPE_ICONS = {
		armor: "modules/sr5-marketplace/assets/icons/types/armor.webp",
		device: "modules/sr5-marketplace/assets/icons/types/commlink.webp",
		cyberware: "modules/sr5-marketplace/assets/icons/types/cyberware.webp",
		bioware: "modules/sr5-marketplace/assets/icons/types/bioware.webp",
		equipment: "modules/sr5-marketplace/assets/icons/types/equipment.webp",
		spell: "modules/sr5-marketplace/assets/icons/types/spell.webp",
		modification: "modules/sr5-marketplace/assets/icons/types/modification.webp",
		weapon: {
			lightPistol: "modules/sr5-marketplace/assets/icons/weapons/light_pistol.webp",
			taser: "modules/sr5-marketplace/assets/icons/weapons/taser.webp",
			heavyPistol: "modules/sr5-marketplace/assets/icons/weapons/heavy_pistol.webp",
			machinePistol: "modules/sr5-marketplace/assets/icons/weapons/machine_pistol.webp",
			smg: "modules/sr5-marketplace/assets/icons/weapons/smg.webp",
			assaultRifle: "modules/sr5-marketplace/assets/icons/weapons/stormgun.webp",
			shotgun: "modules/sr5-marketplace/assets/icons/weapons/shotgun.webp",
			sniperRifle: "modules/sr5-marketplace/assets/icons/weapons/sniper_rifle.webp",
			bow: "modules/sr5-marketplace/assets/icons/weapons/bow.webp",
			blades: "modules/sr5-marketplace/assets/icons/weapons/melee_blade.webp",
			clubs: "modules/sr5-marketplace/assets/icons/weapons/melee_club.webp",
			thrown: "modules/sr5-marketplace/assets/icons/weapons/thrown.webp",
			default: "modules/sr5-marketplace/assets/icons/weapons/default.webp"
		},
		default: "modules/sr5-marketplace/assets/icons/types/equipment.webp"
	};
	constructor() {
		this.items = [], this.isIndexed = !1;
	}
	async initialize() {
		if (this.isIndexed) {
			console.log("SR5 Marketplace | Items already indexed for this session.");
			return;
		}
		this.items = await new e().buildIndex(), this.isIndexed = !0;
	}
	getItems() {
		return this.isIndexed ? this.items : (console.warn("SR5 Marketplace | Item index has not been built yet. Returning empty array."), []);
	}
	getRepresentativeImage(e) {
		let n = this.constructor.ITEM_TYPE_ICONS;
		if (!e) return n.default;
		let r = e.type, i = n[r];
		if (typeof i == "string") return i;
		if (typeof i == "object") {
			let a = null;
			if (r === "weapon") {
				let n = e.system?.category;
				a = n === "range" ? t(e, "system.range.ranges.category") : n === "melee" ? e.system?.type : n;
			}
			return i[a] || i.default || n.default;
		}
		return n.default;
	}
	_categorizeItems(e) {
		let n = foundry.utils.deepClone(this.constructor.ITEM_CATEGORIES);
		for (let r of e) {
			let e = r.type, i = n[e];
			if (i && (i.items.push(r), i.subcategories)) {
				let n = t(r, "system.category") || t(r, "system.type");
				if ((e === "modification" || e === "armor") && (n = t(r, "system.type")), n && i.subcategories[n]) {
					let a = i.subcategories[n];
					if (a.items.push(r), a.subsubcategories) {
						let i = null;
						e === "weapon" && n === "range" && (i = t(r, "system.range.ranges.category"), i?.toLowerCase().includes("crossbow") && (i = "crossbow")), e === "weapon" && n === "melee" && (i = t(r, "system.type")), e === "weapon" && n === "thrown" && (i = r.name.toLowerCase().includes("grenade") ? "grenade" : "throwing_weapons"), i && a.subsubcategories[i] && a.subsubcategories[i].items.push(r);
					}
				}
			}
		}
		return n;
	}
	_createEnrichedCategory(e, t) {
		let n = {
			label: e?.label || t,
			items: e?.items || []
		};
		return e?.subcategories && (n.subcategories = e.subcategories), e?.subsubcategories && (n.subsubcategories = e.subsubcategories), n;
	}
	_transformToAllItems(e, n) {
		return {
			filteredItems: {
				label: "SR5Marketplace.Marketplace.ItemTypes.AllItems",
				items: n
			},
			rangedWeapons: this._createEnrichedCategory(t(e, "weapon.subcategories.range"), "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons"),
			meleeWeapons: this._createEnrichedCategory(t(e, "weapon.subcategories.melee"), "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons"),
			armor: this._createEnrichedCategory(e.armor, "SR5Marketplace.Marketplace.ItemTypes.Armor"),
			cyberware: this._createEnrichedCategory(e.cyberware, "SR5Marketplace.Marketplace.ItemTypes.Cyberware"),
			bioware: this._createEnrichedCategory(e.bioware, "SR5Marketplace.Marketplace.ItemTypes.Bioware"),
			devices: this._createEnrichedCategory(e.device, "SR5Marketplace.Marketplace.ItemTypes.Devices"),
			equipment: this._createEnrichedCategory(e.equipment, "SR5Marketplace.Marketplace.ItemTypes.Equipment"),
			spells: this._createEnrichedCategory(e.spell, "SR5Marketplace.Marketplace.ItemTypes.Spells"),
			metamagic: this._createEnrichedCategory(e.metamagic, "SR5Marketplace.Marketplace.ItemTypes.Metamagic"),
			adeptPower: this._createEnrichedCategory(e.adept_power, "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers"),
			echo: this._createEnrichedCategory(e.echo, "SR5Marketplace.Marketplace.ItemTypes.Echo"),
			qualitys: this._createEnrichedCategory(e.quality, "SR5Marketplace.Marketplace.ItemTypes.Qualitys"),
			complex_form: this._createEnrichedCategory(e.complex_form, "SR5Marketplace.Marketplace.ItemTypes.complex_form"),
			weaponMods: this._createEnrichedCategory(t(e, "modification.subcategories.weapon"), "SR5Marketplace.Marketplace.ItemTypes.WeaponMods"),
			armorMods: this._createEnrichedCategory(t(e, "modification.subcategories.armor"), "SR5Marketplace.Marketplace.ItemTypes.ArmorMods"),
			vehicleMods: this._createEnrichedCategory(t(e, "modification.subcategories.vehicle"), "SR5Marketplace.Marketplace.ItemTypes.VehicleMods")
		};
	}
	_transformToBaseItems(e, t) {
		let n = this._transformToAllItems(e, t);
		return delete n.weaponMods, delete n.armorMods, delete n.vehicleMods, n.filteredItems.items = t, n;
	}
	_transformToModifications(e, n) {
		return {
			allModifications: this._createEnrichedCategory(e.modification, "SR5Marketplace.Marketplace.ItemTypes.AllMods"),
			weaponMods: this._createEnrichedCategory(t(e, "modification.subcategories.weapon"), "SR5Marketplace.Marketplace.ItemTypes.WeaponMods"),
			armorMods: this._createEnrichedCategory(t(e, "modification.subcategories.armor"), "SR5Marketplace.Marketplace.ItemTypes.ArmorMods"),
			vehicleMods: this._createEnrichedCategory(t(e, "modification.subcategories.vehicle"), "SR5Marketplace.Marketplace.ItemTypes.VehicleMods")
		};
	}
	async getShopItems(e) {
		let t = await fromUuid(e);
		if (!t?.system?.shop?.inventory) return this._transformToAllItems({}, []);
		let n = this.getItems(), r = new Set(Object.values(t.system.shop.inventory).map((e) => e.itemUuid)), i = n.filter((e) => r.has(e.uuid)), a = this._categorizeItems(i);
		return this._transformToAllItems(a, i);
	}
	get itemsByType() {
		let e = this.getItems(), t = [
			"call_in_action",
			"critter_power",
			"host",
			"sprite_power",
			"contact"
		], n = e.filter((e) => !t.includes(e.type)), r = this._categorizeItems(n);
		return this._transformToAllItems(r, n);
	}
	get baseItemsByType() {
		let e = this.getItems(), t = [
			"modification",
			"call_in_action",
			"critter_power",
			"host",
			"sprite_power",
			"contact"
		], n = e.filter((e) => !t.includes(e.type)), r = this._categorizeItems(n);
		return this._transformToBaseItems(r, n);
	}
	get modificationsByType() {
		let e = this.getItems().filter((e) => e.type === "modification"), t = this._categorizeItems(e);
		return this._transformToModifications(t, e);
	}
}, r = class {
	static #e = {
		general: {
			title: "SR5Marketplace.Marketplace.Modifiers.General.title",
			items: [
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeFriendly",
					label: "Friendly",
					value: 2
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeNeutral",
					label: "Neutral",
					value: 0
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeMistrustful",
					label: "Mistrustful",
					value: -1
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeBiased",
					label: "Biased",
					value: -2
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeAverse",
					label: "Averse",
					value: -3
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeHostile",
					label: "Hostile",
					value: -4
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.resultAdvantageous",
					label: "Advantageous",
					value: 1
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.resultInsignificant",
					label: "Insignificant",
					value: 0
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.resultAnnoying",
					label: "Annoying",
					value: -1
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.resultDangerous",
					label: "Dangerous",
					value: -3
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.General.resultCatastrophic",
					label: "Catastrophic",
					value: -4
				}
			]
		},
		negotiation: {
			title: "SR5Marketplace.Marketplace.Modifiers.Negotiation.title",
			items: [{
				description: "SR5Marketplace.Marketplace.Modifiers.Negotiation.notEnoughInfo",
				label: "Insufficient Info",
				value: -2
			}, {
				description: "SR5Marketplace.Marketplace.Modifiers.Negotiation.hasLeverage",
				label: "Leverage",
				value: 2
			}]
		},
		etiquette: {
			title: "SR5Marketplace.Marketplace.Modifiers.Etiquette.title",
			items: [{
				description: "SR5Marketplace.Marketplace.Modifiers.Etiquette.improperlyDressed",
				label: "Improperly Dressed",
				value: -2
			}, {
				description: "SR5Marketplace.Marketplace.Modifiers.Etiquette.obviouslyNervous",
				label: "Nervous",
				value: -2
			}]
		},
		intimidation: {
			title: "SR5Marketplace.Marketplace.Modifiers.Intimidation.title",
			items: [
				{
					description: "SR5Marketplace.Marketplace.Modifiers.Intimidation.physicallyImposing",
					label: "Physically Imposing",
					value: 2
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.Intimidation.outnumbered",
					label: "Outnumbered",
					value: -2
				},
				{
					description: "SR5Marketplace.Marketplace.Modifiers.Intimidation.hasWeapon",
					label: "Has Weapon/Magic",
					value: 2
				}
			]
		},
		con: {
			title: "SR5Marketplace.Marketplace.Modifiers.Con.title",
			items: [{
				description: "SR5Marketplace.Marketplace.Modifiers.Con.plausibleEvidence",
				label: "Plausible Evidence",
				value: 2
			}, {
				description: "SR5Marketplace.Marketplace.Modifiers.Con.targetDistracted",
				label: "Target Distracted",
				value: 1
			}]
		}
	};
	static #t = {
		attitude: [
			"Friendly",
			"Neutral",
			"Mistrustful",
			"Biased",
			"Averse",
			"Hostile"
		],
		result: [
			"Advantageous",
			"Insignificant",
			"Annoying",
			"Dangerous",
			"Catastrophic"
		]
	};
	static getModifiersForTest({ skill: e }) {
		let t = this.#e, n = [t.general];
		return e && t[e] && n.push(t[e]), n;
	}
	static calculateNewModifierList(e, t) {
		let n = [...e ?? []], { label: r } = t, i = n.findIndex((e) => e.label === r);
		if (i > -1) n.splice(i, 1);
		else {
			let e = Object.keys(this.#t).find((e) => this.#t[e].includes(r)), i = n;
			if (e) {
				let t = this.#t[e];
				i = n.filter((e) => !t.includes(e.label));
			}
			return i.push(t), i;
		}
		return n;
	}
}, i = class {
	static processDice(e) {
		let t = e?.diceResults || [], n = e?.values?.glitches?.value || 0;
		if (!Array.isArray(t) || t.length === 0) return [];
		let r = n > t.length / 2;
		return t.map((e) => {
			let t = "MarketAppDialog-die-result";
			return t = r && e.result === 1 ? " glitch" : e.success ? " success" : " failure", {
				cssClass: t,
				text: e.result
			};
		});
	}
}, a = "sr5-marketplace", o = "sr5-marketplace.shop", s = "modules/sr5-marketplace/templates/apps/marketplace-settings/marketplace-settings.html", c = "basket", l = "appTestState", u = "selectedActorUuid", d = class {
	static get(e, t = {}) {
		let n = `SR5Marketplace.${e}`;
		return game.i18n.format(n, t);
	}
}, f = class {
	static getBaseDeliveryTime(e) {
		return e <= 100 ? {
			value: 6,
			unit: d.get("Time.Hours")
		} : e <= 1e3 ? {
			value: 1,
			unit: d.get("Time.Day")
		} : e <= 1e4 ? {
			value: 2,
			unit: d.get("Time.Days")
		} : e <= 1e5 ? {
			value: 1,
			unit: d.get("Time.Week")
		} : {
			value: 1,
			unit: d.get("Time.Month")
		};
	}
	static calculateFinalDeliveryTime(e, t) {
		return {
			value: e.value * t,
			unit: e.unit
		};
	}
}, p = class {
	static async readState(e) {
		e ||= await game.user.id;
		let t = game.users.get(e);
		return t && t.getFlag("sr5-marketplace", "appTestState") || {};
	}
	static async createTest(e, t) {
		let n = foundry.utils.randomID();
		t ||= await game.user.id;
		let r = game.settings.get("sr5-marketplace", "availabilityTestRule"), i = { [n]: {
			id: n,
			testType: r,
			status: "initial",
			...e,
			result: null,
			rolls: null,
			resistResult: null,
			rollCount: 0,
			resolved: !1,
			skill: "negotiation",
			attribute: "charisma",
			appliedModifiers: []
		} }, o = game.users.get(t);
		return o && (console.log(`Saving new test state to flag for user ${o.name}:`, i), await o.setFlag(a, l, i)), n;
	}
	static async updateTest(e, t, n) {
		n ||= await game.user.id;
		let r = game.users.get(n);
		if (!r) return;
		let i = await this.readState(n);
		i[e] && (foundry.utils.mergeObject(i[e], t), await r.setFlag(a, l, i));
	}
	static async deleteState(e) {
		e ||= await game.user.id;
		let t = game.users.get(e);
		if (t) return console.log(`Clearing all test state flags for user ${t.name}.`), t.unsetFlag(a, l);
	}
	static async readBasket(e) {
		e ||= game.user.id;
		let t = game.users.get(e);
		return t && t.getFlag("sr5-marketplace", "basket") || {};
	}
};
//#endregion
//#region scripts/lib/availabilityParser.mjs
function m(e) {
	let t = String(e ?? "").trim().match(/^(\d+)\s*([A-Za-z]*)$/);
	return {
		rating: t ? Number(t[1]) : 0,
		tag: t && t[2] ? t[2].toUpperCase() : ""
	};
}
//#endregion
//#region scripts/apps/documents/dialog/AppDialogBuilder.mjs
var h = class {
	constructor() {
		this.testState = null;
	}
	static async getActor(e) {
		return e ? await fromUuid(e) : null;
	}
	static async getItem(e) {
		return e ? await fromUuid(e) : null;
	}
	async buildTestDialogContext(e, t = null) {
		if (this.testState = e, !this.testState) return null;
		switch (this.testState.status) {
			case "initial": return this.#e();
			case "result": return this.#t();
			case "extended-inprogress": return this.#n();
			case "resolved": return await this.#r(t);
			default: return console.error(`Unknown test status: "${this.testState.status}"`), null;
		}
	}
	async #e() {
		let { actorUuid: e, skill: t, attribute: n, connectionUuid: i, availabilityStr: a, appliedModifiers: o } = this.testState, s = await this.constructor.getActor(e);
		if (!s) return null;
		let c = [], l = 0, u = 0, d = s.system.skills.active[t];
		if (d) {
			let e = game.i18n.localize(CONFIG.SR5.activeSkills[t]);
			c.push({
				label: e,
				value: d.value
			}), l += d.value;
		}
		let f = s.system.attributes[n];
		if (f) {
			let e = game.i18n.localize(`FIELDS.attributes.${n}.label`);
			c.push({
				label: e,
				value: f.value
			}), l += f.value;
		}
		if (Array.isArray(o) && o.forEach((e) => {
			c.push({
				label: e.label,
				value: e.value
			}), l += e.value;
		}), i) {
			let e = await this.constructor.getItem(i);
			e && (u = e.system.connection, c.push({
				label: game.i18n.localize("SR5.Connection"),
				value: e.system.connection
			}), l += e.system.connection, c.push({
				label: game.i18n.localize("SR5.Loyalty"),
				value: e.system.loyalty
			}), l += e.system.loyalty);
		}
		return {
			actor: s,
			availabilityStr: a,
			modifierGroups: r.getModifiersForTest({ skill: t }),
			dicePoolBreakdown: c,
			totalDicePool: l,
			connectionUsed: u
		};
	}
	#t() {
		let e = this.testState.result, t = this.testState.rolls?.[0]?.terms[0]?.results || [], n = e.values.glitches.value, r = t.length, a = {
			diceResults: t,
			values: { glitches: { value: n } }
		};
		return {
			renderedDice: i.processDice(a),
			hits: e.values.hits.value,
			glitches: n,
			isGlitch: r > 0 ? n > r / 2 : !1
		};
	}
	#n() {
		let e = this.testState.result, t = this.testState.rolls, n = {
			diceResults: (t?.[t.length - 1])?.terms[0]?.results || [],
			values: { glitches: { value: e.values.glitches.value } }
		}, r = i.processDice(n);
		return {
			cumulativeHits: e.values.extendedHits.value,
			threshold: e.threshold.value,
			currentPool: e.pool.value,
			renderedDice: r
		};
	}
	async #r(e) {
		switch (this.testState.testType) {
			case "opposed": return this.#i();
			case "simple": return this.#a();
			case "extended": return await this.#o(e);
			default: return console.error(`Unknown test type "${this.testState.testType}" in buildResolvedDialogContext.`), null;
		}
	}
	#i() {
		let e = this.testState.result, t = this.testState.resistResult;
		return {
			isAvailable: !t.success,
			initialRoll: {
				netHits: e.values.netHits.value,
				renderedDice: i.processDice(e)
			},
			resistRoll: {
				hits: t.values.hits.value,
				renderedDice: i.processDice(t)
			}
		};
	}
	#a() {
		let e = this.testState.result || {}, t = m(this.testState.availabilityStr).rating;
		return {
			isAvailable: e.success ?? !1,
			initialRoll: {
				netHits: e.values?.netHits?.value ?? 0,
				renderedDice: i.processDice(e),
				threshold: t
			}
		};
	}
	async #o(e) {
		let t = this.testState.result, n = this.testState.rolls, r = t.values.extendedHits.value >= t.threshold.value, a = Math.max(0, t.values.extendedHits.value - t.threshold.value), o = e;
		(!o || Object.keys(o).length === 0) && (console.log("AppDialogBuilder | Basket not provided or empty, fetching from flag as a fallback."), o = await p.readBasket());
		let s = o.totalCost || 0, c = f.getBaseDeliveryTime(s), l = f.calculateFinalDeliveryTime(c, this.testState.rollCount), u = game.i18n.localize(c.unit), d = {
			diceResults: (n?.[n.length - 1])?.terms[0]?.results || [],
			values: { glitches: { value: t.values.glitches.value } }
		};
		return {
			isAvailable: r,
			initialRoll: {
				netHits: a,
				renderedDice: i.processDice(d),
				threshold: t.threshold.value,
				cumulativeHits: t.values.extendedHits.value
			},
			totalRolls: this.testState.rollCount,
			deliveryTime: l,
			connectionUsed: this.testState.connectionUsed,
			localizedTimeUnit: u
		};
	}
}, g = class {
	constructor() {}
	_getDefaultBasketState() {
		return {
			basketUUID: foundry.utils.randomID(),
			creationTime: (/* @__PURE__ */ new Date()).toISOString(),
			createdForActor: null,
			selectedContactUuid: null,
			shopActorUuid: null,
			totalCost: 0,
			totalAvailability: "0",
			totalKarma: 0,
			totalEssenceCost: 0,
			shoppingCartItems: [],
			orderReviewItems: []
		};
	}
	async getBasket(e = null) {
		let t = e ? game.users.get(e) : game.user;
		if (!t) return this._getDefaultBasketState();
		let n = await t.getFlag("sr5-marketplace", "basket") || {};
		return foundry.utils.mergeObject(this._getDefaultBasketState(), n);
	}
	async saveBasket(e, t = null) {
		let n = t ? game.users.get(t) : game.user;
		if (n) return n.setFlag(a, c, e);
	}
	async addToBasket(e, t, n = null) {
		if (!e || !t) {
			ui.notifications.error("Cannot add item to cart without a purchasing actor.");
			return;
		}
		let r = await this.getBasket(n);
		r.createdForActor = t;
		let i = await fromUuid(e);
		if (!i) return ui.notifications.warn(`Item with UUID ${e} not found.`);
		let a = (game.settings.get("sr5-marketplace", "itemTypeBehaviors") || {})[i.type] || "single", o = r.shoppingCartItems.find((e) => e.itemUuid === i.uuid);
		if (a === "unique") {
			if (o) return ui.notifications.warn(`'${i.name}' is a unique item and is already in your cart.`);
			let e = await fromUuid(r.createdForActor);
			if (e && e.items.some((e) => e.name === i.name && e.type === i.type)) return ui.notifications.warn(`Your character, ${e.name}, already possesses the unique item: '${i.name}'.`);
		}
		if (a === "stack" && o) o.buyQuantity += 1;
		else {
			let e = {
				basketItemUuid: "basket." + foundry.utils.randomID(),
				itemUuid: i.uuid,
				buyQuantity: 1,
				name: i.name,
				img: i.img,
				cost: i.system.technology?.cost || 0,
				karma: i.system.karma || 0,
				availability: i.system.technology?.availability || "0",
				essence: i.system.essence || 0,
				itemQuantity: a === "stack" ? 10 : i.system.quantity || 1,
				rating: i.system.technology?.rating || 1,
				selectedRating: i.system.technology?.rating || 1
			};
			r.shoppingCartItems.push(e);
		}
		let s = this._recalculateTotals(r);
		await this.saveBasket(s);
	}
	async removeFromBasket(e) {
		if (!e) return;
		let t = await this.getBasket(), n = t.shoppingCartItems.length;
		if (t.shoppingCartItems = t.shoppingCartItems.filter((t) => t.basketItemUuid !== e), t.shoppingCartItems.length < n) {
			let e = this._recalculateTotals(t);
			await this.saveBasket(e), ui.notifications.info("Item removed from basket.");
		}
	}
	async updateItemQuantity(e, t, n) {
		if (!e || !n) return;
		let r = await this.getBasket(), i = game.settings.get("sr5-marketplace", "itemTypeBehaviors") || {}, a = r.shoppingCartItems.find((t) => t.basketItemUuid === e);
		if (!a) return;
		let o = await fromUuid(a.itemUuid);
		if (!o) return;
		switch (i[o.type] || "single") {
			case "stack":
				if (a.buyQuantity += n, a.buyQuantity <= 0) {
					await this.removeFromBasket(e);
					return;
				}
				break;
			case "single": if (n > 0) {
				await this.addToBasket(a.itemUuid, t);
				return;
			} else {
				await this.removeFromBasket(e, t);
				return;
			}
			case "unique": return;
		}
		let s = this._recalculateTotals(r);
		await this.saveBasket(s);
	}
	_recalculateTotals(e) {
		let t = e.shoppingCartItems || [];
		e.totalCost = t.reduce((e, t) => e + (t.cost || 0) * (t.buyQuantity || 0), 0), e.totalKarma = t.reduce((e, t) => e + (t.karma || 0) * (t.buyQuantity || 0), 0), e.totalEssenceCost = t.reduce((e, t) => e + (t.essence || 0) * (t.buyQuantity || 0), 0);
		let n = t.flatMap((e) => Array(e.buyQuantity || 1).fill(e.availability));
		return e.totalAvailability = this._combineAvailabilities(n), e;
	}
	_combineAvailabilities(e) {
		let t = {
			F: 3,
			V: 3,
			R: 2,
			E: 2,
			"": 1
		}, n = 0, r = "";
		for (let i of e) {
			let e = String(i).match(/^(\d+)?([A-Z])?$/i);
			if (!e) continue;
			let a = parseInt(e[1] || "0", 10), o = (e[2] || "").toUpperCase();
			n += a, (t[o] || 0) > (t[r] || 0) && (r = o);
		}
		return `${n}${r}`;
	}
	async setSelectedContact(e) {
		let t = await this.getBasket();
		t.selectedContactUuid = e, await this.saveBasket(t);
	}
	async setShopActor(e) {
		let t = await this.getBasket();
		t.shopActorUuid = e, await this.saveBasket(t);
	}
}, { ApplicationV2: _, HandlebarsApplicationMixin: v } = foundry.applications.api, y = class extends v(_) {
	constructor(e, t = {}) {
		super(t), this.itemUuid = e, this.basketService = new g(), this.purchasingActor = null;
	}
	static get DEFAULT_OPTIONS() {
		return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
			id: "ItemPreviewApp",
			classes: [
				"app",
				"window-app",
				"sr5",
				"sheet",
				"item",
				"ItemPreviewApp",
				"themed",
				"theme-light"
			],
			position: {
				width: 735,
				height: 484,
				top: 266,
				left: 157
			},
			actions: {
				copyUuid: this.#t,
				addToCart: this.#e,
				addToItemBuilder: this.#n
			}
		});
	}
	static PARTS = { main: { template: "modules/sr5-marketplace/templates/documents/items/itemPreviewApp/item-preview.html" } };
	async _prepareContext(e) {
		let t = await fromUuid(this.itemUuid);
		if (!t) return ui.notifications.error(`Could not find item with UUID: ${this.itemUuid}`), this.close(), {};
		let n = t.toObject(!1);
		n.uuid = t.uuid;
		let r = game.user.getFlag("sr5-marketplace", "selectedActorUuid");
		return this.purchasingActor = r ? await fromUuid(r) : game.user.character || null, {
			item: n,
			purchasingActor: this.purchasingActor
		};
	}
	static async #e(e, t) {
		if (!this.purchasingActor) {
			ui.notifications.warn("Please select a character to purchase items.", { localize: !0 });
			return;
		}
		let n = t.dataset.itemId;
		await g.addToBasket(n, this.purchasingActor.uuid), this.close();
	}
	static #t(e, t) {
		let n = t.dataset.uuid;
		n && navigator.clipboard.writeText(n).then(() => {
			ui.notifications.info("Item UUID copied to clipboard.");
		});
	}
	static async #n(e, t) {
		let n = t.dataset.itemId;
		n && (await game.sr5marketplace.setBuilderBaseItem(n), this.close());
	}
}, b = class {
	static async _validateAndGetBasket(e, { resetInvalid: t = !1 } = {}) {
		let n = game.users.get(e);
		if (!n) return null;
		let r = n.getFlag(a, c);
		if (!r || !Array.isArray(r.shoppingCartItems) || !Array.isArray(r.orderReviewItems)) return console.warn(`Marketplace | Invalid or missing basket flag for user ${n.name}.`), t && (await n.unsetFlag(a, c), console.log(`Marketplace | Reset invalid basket flag for user ${n.name}.`)), null;
		let i = new g();
		return foundry.utils.mergeObject(i._getDefaultBasketState(), r);
	}
	static getPendingRequestCount() {
		return game.user.isGM ? game.users.reduce((e, t) => e + (t.getFlag("sr5-marketplace", "basket")?.orderReviewItems?.length || 0), 0) : 0;
	}
	static async getAllPendingRequests() {
		if (!game.user.isGM) return [];
		let e = [];
		for (let t of game.users) {
			let n = t.getFlag(a, c);
			if (n?.orderReviewItems?.length > 0) for (let r of n.orderReviewItems) {
				let n = r.createdForActor ? await fromUuid(r.createdForActor) : null;
				e.push({
					user: t.toJSON(),
					basket: r,
					actor: n ? {
						name: n.name,
						nuyen: n.system.nuyen,
						karma: n.system.karma.value
					} : null
				});
			}
		}
		return e;
	}
	static async submitForReview(e) {
		let t = game.users.get(e);
		if (!t) return;
		let n = new g(), r = await n.getBasket(e);
		if (!r.shoppingCartItems || r.shoppingCartItems.length === 0) return ui.notifications.warn("Your shopping cart is empty.");
		let i = {
			basketUUID: r.basketUUID,
			creationTime: r.creationTime,
			createdForActor: r.createdForActor,
			selectedContactId: r.selectedContactId,
			reviewRequest: !0,
			basketItems: r.shoppingCartItems,
			totalCost: r.totalCost,
			totalAvailability: r.totalAvailability,
			totalKarma: r.totalKarma,
			totalEssenceCost: r.totalEssenceCost
		};
		r.orderReviewItems.push(i), r.shoppingCartItems = [], r.createdForActor = null, r.selectedContactId = null, this._recalculateTotals(r), await n.saveBasket(r, e), ui.notifications.info("Your purchase request has been submitted to the GM for review."), game.socket.emit("module.sr5-marketplace", {
			type: "new_request",
			senderId: t.id,
			basketUUID: i.basketUUID
		});
	}
	static async updatePendingItem(e, t, n, r, i) {
		if (!game.users.get(e)) return;
		let a = new g(), o = await a.getBasket(e);
		if (!o?.orderReviewItems) return;
		let s = o.orderReviewItems.find((e) => e.basketUUID === t);
		if (!s) return;
		let c = s.basketItems.find((e) => e.basketItemUuid === n);
		c && (foundry.utils.setProperty(c, r, i), this._recalculateTotals(s), await a.saveBasket(o, e));
	}
	static async rejectItemFromRequest(e, t, n) {
		let r = await this._validateAndGetBasket(e);
		if (!r) return;
		let i = r.orderReviewItems.find((e) => e.basketUUID === t);
		if (!i) return;
		let a = i.basketItems.length;
		i.basketItems = i.basketItems.filter((e) => e.basketItemUuid !== n), i.basketItems.length < a && (this._recalculateTotals(i), await new g().saveBasket(r, e), ui.notifications.info("Item rejected and removed from the request."));
	}
	static async rejectBasket(e, t) {
		let n = await this._validateAndGetBasket(e, { resetInvalid: !0 });
		if (!n?.orderReviewItems) return;
		let r = n.orderReviewItems.length;
		n.orderReviewItems = n.orderReviewItems.filter((e) => e.basketUUID !== t), n.orderReviewItems.length < r && (await new g().saveBasket(n, e), ui.notifications.warn(`Purchase request for user ${game.users.get(e)?.name} has been rejected.`), game.socket.emit("module.sr5-marketplace", {
			type: "request_resolved",
			userId: e
		}));
	}
	static async approveBasket(e, t) {
		let n = new g(), r = await game.user.id, i = await n.getBasket(r);
		if (!i) return;
		let a = i.orderReviewItems.findIndex((e) => e.basketUUID === t);
		if (a === -1) return;
		let o = i.orderReviewItems[a];
		await this.directPurchase(o) && (i.orderReviewItems.splice(a, 1), await n.saveBasket(i, e), ui.notifications.info(`Purchase approved for user ${game.users.get(e)?.name}.`), game.socket.emit("module.sr5-marketplace", {
			type: "request_resolved",
			userId: e
		}));
	}
	static async directPurchase(e) {
		if (!e || !e.basketItems) return !1;
		let t = await fromUuid(e.createdForActor);
		if (!t) return ui.notifications.error("Could not find the actor associated with this purchase."), !1;
		this._recalculateTotals(e);
		let n = t.system.nuyen, r = t.system.karma.value;
		if (n < e.totalCost) return ui.notifications.warn(`${t.name} cannot afford this purchase. Needs ${e.totalCost} ¥.`), !1;
		if (r < e.totalKarma) return ui.notifications.warn(`${t.name} does not have enough Karma. Needs ${e.totalKarma} K.`), !1;
		await t.update({
			"system.nuyen": n - e.totalCost,
			"system.karma.value": r - e.totalKarma
		}), ui.notifications.info(`Deducted ${e.totalCost} ¥ and ${e.totalKarma} Karma from ${t.name}.`);
		let i = [];
		for (let t of e.basketItems) {
			let e = await fromUuid(t.itemUuid);
			if (e) {
				let n = e.toObject();
				n.system.quantity = t.buyQuantity * (n.system.quantity || 1), "technology" in n.system && (n.system.technology.rating = t.selectedRating, n.system.technology.cost = t.cost), i.push(n);
			}
		}
		return console.log("Marketplace | Attempting to create the following items on actor:", t.name, i), i.length > 0 && (await t.createEmbeddedDocuments("Item", i), ui.notifications.info(`Added ${i.length} new item(s) to ${t.name}'s inventory.`)), !0;
	}
	static _recalculateTotals(e) {
		let t = e.basketItems || e.shoppingCartItems || [];
		return e.totalCost = t.reduce((e, t) => e + (t.cost || 0) * (t.buyQuantity || 0), 0), e.totalKarma = t.reduce((e, t) => e + (t.karma || 0) * (t.buyQuantity || 0), 0), e.totalEssenceCost = t.reduce((e, t) => e + (t.essence || 0) * (t.buyQuantity || 0), 0), e.totalAvailability = new g()._combineAvailabilities(t.flatMap((e) => Array(e.buyQuantity || 1).fill(e.availability))), e;
	}
}, x = class {
	constructor(e) {
		this.appElement = e, this.activeFilters = [], this._onSearch = this._onSearch.bind(this), this._onTagRemoveClick = this._onTagRemoveClick.bind(this);
	}
	initialize({ searchBox: e, itemsGrid: t, nameSelector: n, tagsContainer: r = null }) {
		this.searchBox = this.appElement.querySelector(e), this.itemsGrid = this.appElement.querySelector(t), this.nameSelector = n, this.tagsContainer = r ? this.appElement.querySelector(r) : null, this.searchBox && this.searchBox.addEventListener("keyup", this._onSearch), this.tagsContainer && this.tagsContainer.addEventListener("click", this._onTagRemoveClick), this.applyFilters();
	}
	_onSearch(e) {
		let t = this.searchBox.value.trim().toLowerCase();
		e.key === "Enter" && this.tagsContainer && (e.preventDefault(), t && !this.activeFilters.includes(t) && this.activeFilters.push(t), this.searchBox.value = ""), this.applyFilters();
	}
	_onTagRemoveClick(e) {
		let t = e.target.closest(".remove-tag");
		if (t) {
			let e = t.parentElement.dataset.filter;
			this.activeFilters = this.activeFilters.filter((t) => t !== e), this.applyFilters();
		}
	}
	clearAllFilters() {
		this.activeFilters = [], this.searchBox && (this.searchBox.value = ""), this.applyFilters();
	}
	applyFilters() {
		if (!this.itemsGrid || !this.searchBox) return;
		let e = this.searchBox.value.trim().toLowerCase();
		this.tagsContainer && (this.tagsContainer.innerHTML = this.activeFilters.map((e) => `
                <div class="filter-tag" data-filter="${e}">
                    <span>${e}</span>
                    <span class="remove-tag" title="Remove Filter">&times;</span>
                </div>
            `).join(""));
		let t = this.itemsGrid.querySelectorAll(".item-card, .marketplace-item");
		for (let n of t) {
			let t = n.querySelector(this.nameSelector);
			if (t) {
				let r = t.textContent.toLowerCase(), i = this.activeFilters.every((e) => r.includes(e)), a = e ? r.includes(e) : !0;
				n.classList.toggle("hidden", !(i && a));
			}
		}
	}
}, { ApplicationV2: S, HandlebarsApplicationMixin: C } = foundry.applications.api, w = a, T = "selectedActorUuid", E = class e extends C(S) {
	constructor(t = {}) {
		let n = e._getThemeFromSetting();
		t.classes = [
			...t.classes || [],
			"sr5-marketplace",
			"sr5-market",
			"themed",
			n
		], super(t), this.testType = null, this.activeDialogId = null, this.activeTestState = this.activeDialogId ? testStates[this.activeDialogId] : null, this.skill = null, this.attribute = null, this.modifier = null, this.availabilityStr = null, this.itemData = game.sr5marketplace.api.itemData, this.basketService = new g(), this.tabGroups = { main: "shop" }, this.purchasingActor = null, this.searchService = null, this.shopActorUuid = t.shopActorUuid ?? null, this.selectedSource = this.shopActorUuid ?? "global", this.selectedKey = null;
		let r = this.itemData.itemsByType ?? {}, i = null;
		if (r.rangedWeapons && r.rangedWeapons.items.length > 0) i = "rangedWeapons";
		else {
			let e = Object.entries(r).find(([, e]) => e.items.length > 0);
			e && (i = e[0]);
		}
		this.selectedKey = i;
	}
	static get DEFAULT_OPTIONS() {
		return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
			id: "inGameMarketplace",
			position: {
				width: 910,
				height: 800,
				top: 50,
				left: 120
			},
			window: {
				title: "SR5.PurchaseScreen",
				resizable: !0
			},
			actions: {
				changeTab: this.#t,
				toggleActorList: this.#n,
				selectActor: this.#r,
				clearActor: this.#i,
				openDocumentLink: this.#a,
				addToCart: this.#o,
				removeFromCart: this.#s,
				increaseQuantity: this.#c,
				decreaseQuantity: this.#c,
				sendRequest: this.#l,
				cancelRequest: this.#u,
				approveAll: this.#d,
				rejectAll: this.#d,
				approveItem: this.#f,
				rejectItem: this.#f,
				applyModifier: this.#_,
				changeTestParameter: this._onChangeTestParameter,
				updateRating: this.#p,
				updatePendingItem: this.#m,
				runResistTest: this.#v,
				continueExtendedTest: this.#b,
				runAvailabilityTest: this.#y,
				showAvailabilityDialog: this.#g,
				selectContact: this.#h
			}
		});
	}
	async #e() {
		return this.selectedSource === "global" ? this.itemData.itemsByType : this.itemData.getShopItems(this.selectedSource);
	}
	_onRender(e, t) {
		if (super._onRender(e, t), this.tabGroups.main === "shop") {
			this.searchService = new x(this.element), this.searchService.initialize({
				searchBox: "#search-box",
				itemsGrid: "#marketplace-items",
				tagsContainer: "#filter-tags-container",
				nameSelector: ".marketplace_h4"
			});
			let e = this.element.querySelector("#item-type-selector");
			e && e.addEventListener("change", this.onChangeCategory.bind(this));
			let t = this.element.querySelector("#marketplace-source-toggle");
			t && t.addEventListener("change", this.onSourceChange.bind(this));
		} else this.searchService = null;
		if (this.tabGroups.main === "shoppingCart") {
			let e = this.element.querySelectorAll("select[data-action=\"changeTestParameter\"]");
			for (let t of e) t.addEventListener("change", (e) => {
				this._onChangeTestParameter(e, t);
			});
		}
	}
	async onSourceChange(e) {
		this.selectedSource = e.currentTarget.checked ? this.shopActorUuid : "global", await this.render();
	}
	static PARTS = { main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" } };
	async _prepareContext(e = {}) {
		let t = await game.user.id, n = game.user.getFlag(w, T), r = n ? await fromUuid(n) : null;
		r ||= game.user.character || canvas.tokens.controlled[0]?.actor || null, this.purchasingActor = r;
		let i = null;
		this.purchasingActor && (i = {
			uuid: this.purchasingActor.uuid,
			name: this.purchasingActor.name,
			img: this.purchasingActor.img,
			nuyen: this.purchasingActor.system.nuyen,
			karma: this.purchasingActor.system.karma.value
		});
		let a = game.actors.filter((e) => e.isOwner).map((e) => ({
			uuid: e.uuid,
			name: e.name,
			img: e.img
		})), o = this.itemData.itemsByType;
		console.log(o);
		let s = await this.basketService.getBasket();
		console.log(s);
		let c = s.shoppingCartItems.length, l = await p.readState(t);
		console.log(l), this.activeDialogId = Object.values(l).find((e) => !e.resolved)?.id || null, console.log(this.activeDialogId);
		let u = this.activeDialogId ? l[this.activeDialogId] : null;
		u && (this.testType = u.testType, this.availabilityStr = s.totalAvailability, this.skill = u.skill, this.attribute = u.attribute, this.modifiers = u.modifiers, this.activeTestState = u);
		let d = [{
			id: "shop",
			label: game.i18n.localize("SR5Marketplace.Marketplace.Tab.Shop"),
			icon: "fa-store",
			cssClass: this.tabGroups.main === "shop" ? "active" : ""
		}];
		game.user.isGM && d.push({
			id: "orderReview",
			label: game.i18n.localize("SR5Marketplace.Marketplace.Tab.OrderReview"),
			icon: "fa-list-check",
			cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
			count: b.getPendingRequestCount()
		}), c > 0 && d.push({
			id: "shoppingCart",
			label: "",
			icon: "fa-shopping-cart",
			cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "",
			count: c,
			tooltip: game.i18n.localize("SR5Marketplace.Marketplace.ShoppingBasket")
		}), this.tabGroups.main === "shoppingCart" && c === 0 && (this.tabGroups.main = "shop");
		let f, m = {
			basket: s,
			isGM: game.user.isGM,
			purchasingActor: i,
			activeTestState: u
		}, g = foundry.applications.handlebars.renderTemplate;
		switch (this.tabGroups.main) {
			case "shoppingCart":
				if (this.purchasingActor) {
					let e = canvas.tokens.controlled[0];
					m.contacts = (e && e.actor.id === this.purchasingActor.id ? e.actor : this.purchasingActor).items.filter((e) => e.type === "contact").map((e) => {
						let t = e.toObject(!1);
						return t.uuid = e.uuid, t.isSelected = e.uuid === s.selectedContactUuid, t;
					});
				}
				if (u) {
					let e = await new h().buildTestDialogContext(u, s);
					e && foundry.utils.mergeObject(m.activeTestState, e);
				}
				console.log("LOG: Final context object passed to shoppingCart.html:", m), f = await g("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", m);
				break;
			case "orderReview":
				m.pendingRequests = await b.getAllPendingRequests(), f = await g("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html", m);
				break;
			default:
				this.tabGroups.main = "shop";
				let e = await this.#e();
				if (!this.selectedKey || !e[this.selectedKey] || e[this.selectedKey].items.length === 0) {
					let t = Object.entries(e).find(([, e]) => e.items.length > 0);
					this.selectedKey = t ? t[0] : null;
				}
				m.shopActorUuid = this.shopActorUuid, m.isShopView = this.selectedSource !== "global", this.shopActorUuid && (m.shopName = (await fromUuid(this.shopActorUuid))?.name ?? "Shop"), m.itemsByType = e, m.selectedKey = this.selectedKey, m.selectedItems = this.selectedKey && e[this.selectedKey]?.items || [], f = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html", m);
				break;
		}
		return {
			tabs: d,
			tabContent: f,
			actor: i,
			ownedActors: a
		};
	}
	static _getThemeFromSetting() {
		let e = game.settings.get("core", "uiConfig")?.colorScheme.applications;
		return console.log(e), e === "dark" ? "theme-dark" : "theme-light";
	}
	static #t(e, t) {
		let n = t.dataset.tab;
		this.tabGroups.main !== n && (this.tabGroups.main = n, this.render());
	}
	static #n(e, t) {
		t.closest(".marketplace-user-actor")?.classList.toggle("expanded");
	}
	static async #r(e, t) {
		await game.user.setFlag(w, T, t.dataset.actorUuid), t.closest(".marketplace-user-actor")?.classList.remove("expanded"), this.render();
	}
	static async #i(e, t) {
		e.stopPropagation(), await game.user.unsetFlag(w, T), this.render();
	}
	static async #a(e, t) {
		let n = t.dataset.uuid;
		if (!n) return;
		let r = await fromUuid(n);
		r && (r.isOwner ? r.sheet.render(!0) : new y(r.uuid).render(!0));
	}
	static async #o(e, t) {
		if (!this.purchasingActor) {
			ui.notifications.warn("SR5Marketplace.Marketplace.selectActorTooltip", { localize: !0 });
			return;
		}
		await this.basketService.addToBasket(t.dataset.itemId, this.purchasingActor.uuid), this.tabGroups.main = "shoppingCart", this.render();
	}
	static async #s(e, t) {
		let n = t.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid;
		await this.basketService.removeFromBasket(n), (await this.basketService.getBasket()).shoppingCartItems.length === 0 && (console.log("LOG: Basket is now empty, clearing any active test state flag."), await p.deleteState(), this.activeTestState = null, this.activeDialogId = null), this.render();
	}
	static async #c(e, t) {
		let n = t.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid, r = t.dataset.action === "increaseQuantity" ? 1 : -1;
		await this.basketService.updateItemQuantity(n, this.purchasingActor.uuid, r), this.render();
	}
	static async #l(e, t) {
		if (game.settings.get("sr5-marketplace", "approvalWorkflow")) await b.submitForReview(game.user.id);
		else {
			let e = await this.basketService.getBasket(), t = await fromUuid(e.createdForActor);
			t && (await b.directPurchase(t, e), await this.basketService.clearBasket());
		}
		this.render();
	}
	static async #u(e, t) {
		await this.basketService.clearBasket(), this.render();
	}
	static async #d(e, t) {
		let n = t.closest(".pending-request-block"), r = n.dataset.userId, i = n.dataset.basketUuid;
		t.dataset.action === "approveAll" ? await b.approveBasket(r, i) : await b.rejectBasket(r, i), this.render();
	}
	static async #f(e, t) {
		if (t.dataset.action === "rejectItem") {
			let e = t.closest(".pending-request-block"), n = t.closest(".item-row");
			await b.rejectItemFromRequest(e.dataset.userId, e.dataset.basketUuid, n.dataset.basketItemId), this.render();
		} else ui.notifications.info("Items are approved by default. Use 'Reject' to remove an item from the request.");
	}
	async onChangeCategory(e) {
		this.selectedKey = e.currentTarget.value, this.searchService?.clearAllFilters(), await this.render();
	}
	static async #p(e, t) {
		let n = t.dataset.basketItemUuid, r = parseInt(t.value, 10);
		await this.basketService.updateItemProperty(n, "selectedRating", r), this.render();
	}
	static async #m(e, t) {
		let n = t.closest(".pending-request-block"), r = t.closest(".item-row"), i = t.dataset.property, a = t.type === "number" ? Number(t.value) : t.value;
		await b.updatePendingItem(n.dataset.userId, n.dataset.basketUuid, r.dataset.basketItemId, i, a), this.render();
	}
	static async #h(e, t) {
		let n = t.dataset.contactUuid, r = (await this.basketService.getBasket()).selectedContactUuid === n ? null : n;
		if (await this.basketService.setSelectedContact(r), this.activeTestState) {
			console.log("LOG: Active test found, updating contact and actor information...");
			let e = this.purchasingActor.uuid;
			if (r) {
				let t = await fromUuid(r);
				t?.system?.linkedActor && (e = t.system.linkedActor);
			}
			let t = {
				connectionUuid: r,
				actorUuid: e
			};
			await p.updateTest(this.activeTestState.id, t);
		}
		this.render();
	}
	static async #g(e, t) {
		console.log("%c--- Action: Show Availability Dialog ---", "color: green; font-weight: bold;");
		let n = await game.user.id, r = await this.basketService.getBasket(n);
		if (r.shoppingCartItems.length === 0) return ui.notifications.warn("Your shopping cart is empty.");
		this.availabilityStr = r.totalAvailabilityRating;
		let i = this.purchasingActor.uuid;
		if (r.selectedContactUuid) {
			let e = await fromUuid(r.selectedContactUuid);
			e?.system?.linkedActor && (console.log(e.system.linkedActor), i = e.system.linkedActor, console.log(`LOG: Prioritizing linked actor from contact: ${i}`));
		}
		let a = {
			actorUuid: i,
			itemUuids: r.shoppingCartItems.map((e) => e.itemUuid),
			connectionUuid: r.selectedContactUuid,
			availabilityStr: r.totalAvailability
		};
		this.activeDialogId = await p.createTest(a), console.log(`LOG: Created new test state with ID: ${this.activeDialogId}`), this.render();
	}
	static async #_(e, t) {
		if (!this.activeTestState) return;
		let n = {
			label: t.dataset.label,
			value: parseInt(t.dataset.value, 10)
		}, i = this.activeTestState.appliedModifiers ?? [], a = r.calculateNewModifierList(i, n);
		this.activeTestState.modifiers = a, await p.updateTest(this.activeTestState.id, { appliedModifiers: a }), this.render();
	}
	async _onChangeTestParameter(e, t) {
		if (!this.activeTestState) return;
		let n = t.name, r = t.value;
		this.activeTestState[n] = r, console.log(this.activeTestState), await p.updateTest(this.activeTestState.id, { [n]: r }), this.render(!1);
	}
	static async #v(e, t) {
		if (!this.activeTestState || this.activeTestState.status !== "result") return;
		console.log("%c--- Action: Roll Item Resistance ---", "color: blue; font-weight: bold;");
		let n = this.activeTestState.result, r = {
			type: this.activeTestState.type,
			categories: []
		}, i = foundry.utils.mergeObject(n, r), a = this.activeTestState.availabilityStr, o = n.values.netHits.value, s = game.shadowrun5e.tests.AvailabilityTest.parseAvailability(a), c = Math.max(s.rating, 1), l = {
			against: i,
			action: { categories: ["social"] },
			pool: {
				base: 0,
				mod: [{
					name: game.i18n.localize("SR5.Labels.Availability"),
					value: c
				}]
			},
			threshold: {
				base: o,
				mod: []
			}
		}, u = {
			showDialog: !1,
			showMessage: !1
		};
		try {
			let e = new game.shadowrun5e.tests.AvailabilityResist(l, {}, u);
			await e.execute();
			let t = {
				diceResults: e.rolls?.[0]?.terms[0]?.results || [],
				values: e.data.values,
				success: e.success
			};
			console.log("--- Marketplace | Availability Resist Result to be Saved ---", t), await p.updateTest(this.activeTestState.id, {
				resistResult: t,
				status: "resolved"
			}), this.render();
		} catch (e) {
			console.error("Marketplace | AvailabilityResistTest failed to run:", e);
		}
	}
	static async #y(e, t) {
		if (!this.activeTestState) return;
		let n = this.activeTestState.actorUuid;
		if (this.activeTestState.connectionUuid) {
			let e = await fromUuid(this.activeTestState.connectionUuid);
			e?.system?.linkedActor && (n = e.system.linkedActor);
		}
		let r = await fromUuid(n);
		if (!r) return;
		let i = { action: {
			skill: this.activeTestState.skill,
			attribute: this.activeTestState.attribute,
			modifiers: this.activeTestState.modifiers,
			itemUuids: this.activeTestState.itemUuids,
			connectionUuid: this.activeTestState.connectionUuid,
			availabilityStr: this.activeTestState.availabilityStr,
			dialogId: this.activeDialogId
		} }, a = {
			showDialog: !1,
			showMessage: !1
		};
		try {
			let e = new game.shadowrun5e.tests.AvailabilityTest(i, { actor: r }, a);
			await e.execute();
			let t = game.settings.get("sr5-marketplace", "availabilityTestRule"), n;
			n = t === "extended" ? e.success ? "resolved" : "extended-inprogress" : t === "opposed" ? "result" : "resolved";
			let o = e.data, s = e.data.action.dialogId, c = game.user.id;
			s ? await p.updateTest(s, {
				result: o,
				rolls: e.rolls,
				status: n,
				type: "AvailabilityTest",
				rollCount: 1,
				connectionUsed: this.activeTestState.connectionUsed
			}, c) : console.log("Marketplace | Could not find dialogId in test result to update the flag."), this.render();
		} catch (e) {
			console.log("Marketplace | AvailabilityTest failed to run:", e);
		}
	}
	static async #b(e, t) {
		if (!(!this.activeTestState || this.activeTestState.status !== "extended-inprogress")) {
			console.log("%c--- Action: Continue Extended Test ---", "color: orange; font-weight: bold;");
			try {
				let e = await fromUuid(this.activeTestState.actorUuid);
				if (!e) return;
				let t = (this.activeTestState.rollCount || 0) + 1, n = {
					label: "Extended Test",
					value: (t - 1) * -1
				}, r = [...this.activeTestState.appliedModifiers || [], n], i = { action: {
					skill: this.activeTestState.skill,
					attribute: this.activeTestState.attribute,
					modifiers: r,
					connectionUuid: this.activeTestState.connectionUuid,
					availabilityStr: this.activeTestState.availabilityStr,
					dialogId: this.activeDialogId
				} }, a = new game.shadowrun5e.tests.AvailabilityTest(i, { actor: e }, {
					showDialog: !1,
					showMessage: !1
				});
				await a.execute();
				let o = this.activeTestState.result.values.extendedHits.value;
				a.data.values.extendedHits.value += o, a.data.values.extendedHits.mod.push({
					name: "Previous Hits",
					value: o
				});
				let s = "extended-inprogress";
				(a.data.values.extendedHits.value >= a.data.threshold.value || a.pool.value <= 0) && (s = "resolved"), await p.updateTest(this.activeTestState.id, {
					result: a.data,
					rolls: a.rolls,
					status: s,
					rollCount: t,
					appliedModifiers: r
				}), this.render();
			} catch (e) {
				console.error("Marketplace | Failed to continue extended test:", e);
			}
		}
	}
}, { ApplicationV2: ee, HandlebarsApplicationMixin: D } = foundry.applications.api, O = class extends D(ee) {
	constructor(e = {}) {
		e.classes = [
			...e.classes || [],
			"sr5-marketplace",
			"sr5-marketplace-settings-app"
		], super(e);
	}
	static PARTS = { main: {
		id: "body",
		template: s
	} };
	static get DEFAULT_OPTIONS() {
		return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
			id: "sr5-marketplace-settings",
			position: {
				width: 800,
				height: 650,
				top: 100,
				left: 150
			},
			window: {
				title: "SR5Marketplace.Marketplace.Settings.WindowTitle",
				resizable: !0
			}
		});
	}
	async _prepareContext(e) {
		let t = game.sr5marketplace.api.itemData.getItems(), n = [...new Set(t.map((e) => e.type))].sort(), r = game.settings.get("sr5-marketplace", "itemTypeBehaviors"), i = n.map((e) => ({
			key: e,
			label: e.charAt(0).toUpperCase() + e.slice(1).replace(/_/g, " "),
			behavior: r[e] || "single"
		})), a = {
			single: [],
			stack: [],
			unique: []
		};
		for (let e of i) a[e.behavior] && a[e.behavior].push(e);
		return {
			typeSettings: i,
			categorizedTypes: a
		};
	}
	_onRender(e, t) {
		this.element.removeEventListener("click", this._onClick), this.element.addEventListener("click", this._onClick);
	}
	_onClick = async (e) => {
		let t = e.target.closest(".item-type-card[data-target-behavior]");
		if (!t) return;
		e.preventDefault();
		let n = t.dataset.type, r = t.dataset.targetBehavior, i = game.settings.get("sr5-marketplace", "itemTypeBehaviors");
		i[n] !== r && (i[n] = r, await game.settings.set("sr5-marketplace", "itemTypeBehaviors", i), this.render(!1));
	};
	async _handleFormSubmission(e, t, n) {
		e.preventDefault();
		let r = n.object;
		await game.settings.set("sr5-marketplace", "itemTypeBehaviors", r), ui.notifications.info(game.i18n.localize("SR5Marketplace.Marketplace.Notifications.BehaviorsSaved")), this.close();
	}
}, k = class {
	static async create(e) {
		let t = await fromUuid(e), n = t ? `${t.name} Effect` : "New Effect";
		return {
			_id: foundry.utils.randomID(),
			name: n,
			img: "icons/svg/aura.svg",
			type: "base",
			system: {
				applyTo: null,
				selection_tests: [],
				selection_categories: [],
				selection_skills: [],
				selection_attributes: [],
				selection_limits: []
			},
			changes: { 0: {
				key: null,
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: ""
			} },
			disabled: !1,
			duration: {
				startTime: null,
				combat: null
			},
			description: "",
			origin: null,
			tint: "#ffffff",
			transfer: !0,
			statuses: [],
			sourceUuid: e,
			isEdit: !1,
			targetType: null
		};
	}
}, A = a, j = "itemBuilderState", M = class {
	static _getDefaultState() {
		return {
			title: null,
			baseItem: null,
			modifications: [],
			changes: {},
			itemTypeImage: null,
			draftEffect: null,
			isDerivedValueSelectorVisible: !1,
			isEditingBaseItem: !1,
			baseItemOverrides: {}
		};
	}
	static async getState() {
		let e = game.user.getFlag(A, j);
		return foundry.utils.mergeObject(this._getDefaultState(), e || {});
	}
	static async updateState(e) {
		let t = await this.getState(), n = foundry.utils.mergeObject(t, e);
		await game.user.setFlag(A, j, n);
	}
	static async setBaseItem(e) {
		let t = await this.getState();
		if ((e?.uuid || null) !== (t.baseItem?.uuid || null) && (await game.user.unsetFlag(A, j), e)) {
			let t = this._getDefaultState();
			t.baseItem = e, t.itemTypeImage = game.sr5marketplace.api.itemData.getRepresentativeImage(e), t.title = `${e.type.charAt(0).toUpperCase() + e.type.slice(1)}: ${e.name}`, await game.user.setFlag(A, j, t);
		}
	}
	static async addModification(e) {
		let t = await this.getState();
		t.modifications.push(e), await this.updateState({ modifications: t.modifications });
	}
	static async addChange(e, t) {
		let n = await this.getState();
		n.changes[e] = t, await game.user.setFlag(A, j, n);
	}
	static async removeChange(e) {
		let t = `flags.${A}.${j}.changes.-=${e}`;
		await game.user.update({ [t]: null });
	}
	static async startEffectCreation(e) {
		let t = await this.getState();
		return t.draftEffect = await k.create(e), await game.user.setFlag(A, j, t), t;
	}
	static async updateDraftEffect(e) {
		let t = await this.getState();
		return t.draftEffect ? (t.draftEffect = foundry.utils.mergeObject(t.draftEffect, e), await game.user.setFlag(A, j, t), t) : t;
	}
	static async updateDraftAndState(e = {}, t = {}) {
		let n = await this.getState();
		if (!n.draftEffect) return n;
		n.draftEffect = foundry.utils.mergeObject(n.draftEffect, e);
		let r = foundry.utils.mergeObject(n, t);
		return await game.user.setFlag(A, j, r), r;
	}
	static async saveDraftEffect() {
		let e = await this.getState();
		if (!e.draftEffect) return e;
		let t = foundry.utils.deepClone(e), n = t.draftEffect;
		t.modifications ||= [], delete n.wasCustom;
		let r = t.modifications.findIndex((e) => e._id === n._id);
		return r > -1 ? t.modifications[r] = n : t.modifications.push(n), t.draftEffect = null, await game.user.setFlag(A, j, t), t;
	}
	static async cancelEffectCreation() {
		let e = await this.getState();
		if (!e.draftEffect) return e;
		let t = foundry.utils.deepClone(e);
		return e.draftEffect.wasCustom && (delete e.draftEffect.wasCustom, t.modifications.push(e.draftEffect)), t.draftEffect = null, await game.user.setFlag(A, j, t), t;
	}
	static async deleteEffect(e) {
		let t = await this.getState();
		return t.modifications && (t.modifications = t.modifications.filter((t) => t._id !== e), await game.user.setFlag(A, j, t)), t;
	}
	static async startEffectEdit(e, t) {
		let n = await this.getState(), r = foundry.utils.deepClone(n), i = null, a = r.modifications?.findIndex((e) => e._id === t);
		if (a > -1) i = r.modifications.splice(a, 1)[0], i.wasCustom = !0;
		else {
			let n = (r.baseItem?.uuid === e ? r.baseItem : Object.values(r.changes).find((t) => t.uuid === e))?.effects?.find((e) => e._id === t);
			n && (i = foundry.utils.deepClone(n), i.originalId = n._id, i._id = foundry.utils.randomID());
		}
		if (i) {
			let t = i;
			if (t.sourceUuid = e, t.isEdit = !0, !t.targetType) {
				if (t.system?.applyTo) t.targetType = t.system.applyTo;
				else if (t.changes?.[0]?.key) {
					let e = t.changes[0].key, n = SystemDataMapperService.getMappableKeys();
					Object.values(n.actors).some((t) => Object.values(t).some((t) => t.some((t) => t.path === e))) && (t.targetType = "actor");
				}
			}
			return r.draftEffect = t, await game.user.setFlag(A, j, r), r;
		}
		return n;
	}
	static async toggleDerivedValueSelector() {
		let e = await this.getState(), t = { isDerivedValueSelectorVisible: !e.isDerivedValueSelectorVisible };
		return await this.updateState(t), foundry.utils.mergeObject(e, t);
	}
	static async clearState() {
		await game.user.unsetFlag(A, j);
	}
	static async getEffectFromItemUuid(e) {
		return fromUuid(e).effects;
	}
	static async toggleBaseItemEdit() {
		let e = await this.getState(), t = !e.isEditingBaseItem;
		return await this.updateState({ isEditingBaseItem: t }), foundry.utils.mergeObject(e, { isEditingBaseItem: t });
	}
	static async updateBaseItemOverrides(e) {
		let t = await this.getState();
		if (!t.baseItem) return t;
		let n = foundry.utils.expandObject(e), r = foundry.utils.deepClone(t);
		return r.baseItemOverrides = foundry.utils.mergeObject(r.baseItemOverrides, n), await this.updateState({ baseItemOverrides: r.baseItemOverrides }), r;
	}
}, N = class e {
	static #e = new Set([
		"inventories",
		"npc",
		"values",
		"category_visibility",
		"description",
		"importFlags",
		"visibilityChecks",
		"physical_track",
		"stun_track",
		"matrix_track",
		"track"
	]);
	static #t(e) {
		return e.replace(/_/g, " ").replace(/\b\w/g, (e) => e.toUpperCase());
	}
	static #n(e) {
		let t = {
			skills: "SR5.ActiveSkills",
			matrix: "SR5.Labels.ActorSheet.Matrix",
			limits: "SR5.Limit",
			attributes: "SR5.Attributes",
			initiative: "SR5.Initiative",
			modifiers: "SR5.Modifiers"
		}[e];
		if (t) {
			let e = game.i18n.localize(t);
			if (e !== t) return e;
		}
		let n = `SR5.${e.charAt(0).toUpperCase() + e.slice(1)}`, r = game.i18n.localize(n);
		return r === n ? this.#t(e) : r;
	}
	static _walkObject(e, t, n, r = {}) {
		for (let i in e) {
			if (i.startsWith("_") || i === "flags") continue;
			let a = t ? `${t}.${i}` : i, o = e[i], s = r[i] || this.#t(i);
			typeof o == "object" && o ? "value" in o ? n.push({
				label: s,
				path: `${a}.value`
			}) : Array.isArray(o) || this._walkObject(o, a, n, r) : o !== null && n.push({
				label: s,
				path: a
			});
		}
	}
	static getMappableKeys() {
		let t = game.sr5marketplace.api.system;
		if (!t?.documentTypes) return {
			actors: {},
			items: {},
			rolls: {},
			modifiers: {}
		};
		let n = {};
		for (let e in t.documentTypes.Actor) if (!(e === "base" || e.includes("sr5-marketplace"))) try {
			let r = new CONFIG.Actor.documentClass({
				name: "temp-mapper",
				type: e
			}, { temporary: !0 });
			if (!r?.system) continue;
			let i = {};
			for (let e in r.system) {
				if (this.#e.has(e)) continue;
				let n = r.system[e];
				if (typeof n != "object" || !n) continue;
				let a = this.#n(e), o = t.getLocalizationMapForKey(e), s = [];
				if (this._walkObject(n, `system.${e}`, s, o), s.length > 0) {
					if (e === "skills" && (s = s.filter((e) => e.path.includes(".active.") || e.path.includes(".knowledge.") || e.path.includes(".language."))), e === "armor" && r.system.armor.mod !== void 0) {
						let e = "system.armor.mod";
						s.some((t) => t.path === e) || s.push({
							label: game.i18n.localize("SR5.Armor.FIELDS.armor.mod.label"),
							path: e
						});
					}
					s.length > 0 && (i[a] = s);
				}
			}
			let a = game.i18n.localize("SR5.ConditionMonitor") || "Condition Monitor", o = [];
			r.system.physical_track && o.push({
				label: game.i18n.localize("SR5.DmgTypePhysical"),
				path: "system.physical_track.value"
			}), r.system.stun_track && o.push({
				label: game.i18n.localize("SR5.DmgTypeStun"),
				path: "system.stun_track.value"
			}), r.system.matrix_track && o.push({
				label: game.i18n.localize("SR5.DmgTypeMatrix"),
				path: "system.matrix_track.value"
			}), o.length > 0 && (i[a] = o), Object.keys(i).length > 0 && (n[e] = i);
		} catch (t) {
			console.warn(`Could not map Actor type "${e}".`, t);
		}
		let r = {};
		for (let n in t.documentTypes.Item) if (!(n === "base" || n.includes("sr5-marketplace"))) try {
			let t = new CONFIG.Item.documentClass({
				name: "temp-mapper",
				type: n
			}, { temporary: !0 });
			if (!t?.system) continue;
			let i = [];
			e._walkObject(t.system, "system", i, {}), i.length > 0 && (r[n] = i);
		} catch (e) {
			console.warn(`Could not map Item type "${n}".`, e);
		}
		let i = {};
		try {
			let t = game.shadowrun5e.tests.SuccessTest;
			if (t) {
				let n = new t({});
				if (n.data) {
					let t = [];
					e._walkObject(n.data, "data", t, {}), t.length > 0 && (i[game.i18n.localize("SR5.Test")] = t);
				}
			}
		} catch (e) {
			console.error("SystemDataMapperService | Failed to dynamically map Roll keys.", e);
		}
		return {
			actors: n,
			items: r,
			rolls: i,
			modifiers: { [game.i18n.localize("SR5.Modifiers")]: [{
				label: game.i18n.localize("SR5.SituationalModifier"),
				path: "system.modifiers"
			}] }
		};
	}
}, P = class extends h {
	constructor() {
		super();
	}
	async buildEffectsContext(e) {
		let t = {
			isCreating: !!e.draftEffect,
			draftEffect: e.draftEffect,
			effectGroups: this._getEffectGroups(e),
			isDerivedValueSelectorVisible: e.isDerivedValueSelectorVisible
		};
		if (t.isCreating) {
			let n = N.getMappableKeys(), r = t.draftEffect.changes[0].key, i = t.draftEffect.system?.applyTo;
			t.isActorMode = i === "actor" || i === "targeted_actor", t.isTestMode = i === "test_all" || i === "test_item", t.isModifierMode = i === "modifier";
			let a = n.actors.character || {};
			t.actorKeyGroups = this.#e(a, r), t.rollKeyGroups = this.#e(n.rolls, r), t.modifierKeyGroups = this.#e(n.modifiers, r);
			let o = e.baseItem?.type;
			if (o && n.items[o]) {
				let i = { [`${e.baseItem.name} Keys`]: n.items[o] };
				t.itemKeyGroups = this.#e(i, r);
			}
			t.selection_test_options = this._getTestOptions(), t.selection_category_options = this._getCategoryOptions(), t.selection_skill_options = this._getSkillOptions(), t.selection_attribute_options = this._getAttributeOptions(), t.selection_limit_options = this._getLimitOptions(), t.effectApplyToOptions = game.sr5marketplace.api.system.effectApplyTo_l, t.changeModes = Object.entries(CONST.ACTIVE_EFFECT_MODES).map(([e, t]) => ({
				value: t,
				label: `EFFECT.MODE_${e}`
			}));
		}
		if (t.isDerivedValueSelectorVisible && e.baseItem) {
			let n = this.#t(e.baseItem);
			n.length > 0 && (t.derivedValueKeyGroups = [{
				groupName: `${game.i18n.localize("SR5Marketplace.BaseItem") || "Base Item"} ${game.i18n.localize("SR5Marketplace.Properties") || "Properties"}`,
				groupData: n
			}]);
		}
		return console.log("Marketplace Builder | Effects Tab Context:", t), t;
	}
	#e(e, t) {
		let n = [], r = Object.keys(e).sort((e, t) => e.localeCompare(t));
		for (let i of r) {
			let r = e[i], a = r.length, o = 1, s = 1;
			a > 30 ? (o = 5, s = 1) : a > 15 ? (o = 4, s = 2) : a > 8 && (o = 3, s = 1);
			let c = r.some((e) => e.path === t), l = o > 1 ? 2 : 1;
			n.push({
				groupName: i,
				groupData: r,
				isExpanded: c,
				gridSpan: o,
				gridRowSpan: s,
				contentColumns: l
			});
		}
		return n;
	}
	_getEffectGroups(e) {
		if (!e?.baseItem) return [];
		let t = [], n = [e.baseItem, ...Object.values(e.changes)], r = e.modifications || [], i = game.i18n.localize("SR5Marketplace.BaseItem") || "Base Item", a = game.i18n.localize("SR5Marketplace.Slot") || "Slot";
		for (let o of n) {
			if (!o?.uuid) continue;
			let n = [], s = o.effects || [], c = r.filter((e) => e.sourceUuid === o.uuid);
			for (let e of s) c.some((t) => t.originalId === e._id) || n.push(e);
			n.push(...c), t.push({
				groupName: o === e.baseItem ? `${i}: ${o.name}` : `${a} (${Object.keys(e.changes).find((t) => e.changes[t] === o)}): ${o.name}`,
				sourceUuid: o.uuid,
				effects: n
			});
		}
		return t;
	}
	_getTestOptions() {
		return (game.sr5marketplace.api.system.tests || []).map((e) => ({
			value: e.id,
			label: e.value
		}));
	}
	_getCategoryOptions() {
		let e = game.sr5marketplace.api.system.actionCategories_l || {};
		return Object.entries(e).map(([e, t]) => ({
			value: e,
			label: t
		}));
	}
	_getSkillOptions() {
		let e = game.sr5marketplace.api.system.activeSkills_l || {};
		return Object.entries(e).map(([e, t]) => ({
			value: e,
			label: t
		}));
	}
	_getAttributeOptions() {
		let e = game.sr5marketplace.api.system.attributes_l || {};
		return Object.entries(e).map(([e, t]) => ({
			value: e,
			label: t
		}));
	}
	_getLimitOptions() {
		let e = game.sr5marketplace.api.system.limits_l || {};
		return Object.entries(e).map(([e, t]) => ({
			value: e,
			label: t
		}));
	}
	#t(e) {
		if (!e?.system) return [];
		let t = [], n = game.sr5marketplace.api.system;
		for (let n of [
			{
				path: "system.technology.rating",
				labelKey: "SR5.Rating"
			},
			{
				path: "system.technology.cost",
				labelKey: "SR5.Cost"
			},
			{
				path: "system.armor.value",
				labelKey: "SR5.Armor"
			},
			{
				path: "system.damage.value",
				labelKey: "SR5.DamageValueAbbr"
			},
			{
				path: "system.accuracy.value",
				labelKey: "SR5.AccuracyAbbr"
			},
			{
				path: "system.ap.value",
				labelKey: "SR5.APAbbr"
			},
			{
				path: "system.essence",
				labelKey: "SR5.Essence"
			},
			{
				path: "system.capacity.value",
				labelKey: "SR5.Capacity"
			},
			{
				path: "system.range.rc.value",
				labelKey: "SR5.RecoilComp"
			},
			{
				path: "system.melee.reach",
				labelKey: "SR5.Reach"
			}
		]) typeof foundry.utils.getProperty(e, n.path) == "number" && t.push({
			label: game.i18n.localize(n.labelKey) || n.path,
			path: n.path
		});
		if (e.system.attributes) {
			let r = n.matrixAttributes_l || {};
			for (let n in e.system.attributes) {
				let i = `system.attributes.${n}.value`;
				typeof foundry.utils.getProperty(e, i) == "number" && t.push({
					label: r[n] || n.capitalize(),
					path: i
				});
			}
		}
		return t;
	}
}, { ApplicationV2: F, HandlebarsApplicationMixin: te } = foundry.applications.api, I = class e extends te(F) {
	constructor(t = {}) {
		let n = e._getThemeFromSetting();
		t.classes = [
			...t.classes || [],
			"sr5-marketplace",
			"itemBuilder",
			"themed",
			n
		], super(t), this.itemData = game.sr5marketplace.api.itemData, console.log(this.itemData), this.purchasingActor = null, this.itemSearchService = null, this.modSearchService = null, this.tabGroups = { main: "builder" }, this.selectedKey = Object.keys(this.itemData.itemsByType ?? {}).find((e) => this.itemData.itemsByType[e].items.length > 0) || null;
		let r = this.itemData.itemsByType ?? {}, i = null;
		if (r.rangedWeapons && r.rangedWeapons.items.length > 0) i = "rangedWeapons";
		else {
			let e = Object.entries(r).find(([, e]) => e.items.length > 0);
			e && (i = e[0]);
		}
		this.selectedKey = i, this.hoverTimeout = null, this.tooltipApp = null, this.draggedModData = null, this.draggedItemType = null;
	}
	static get DEFAULT_OPTIONS() {
		return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
			id: "itemBuilder",
			position: {
				width: 1600,
				height: 860
			},
			window: {
				title: "Item Builder",
				resizable: !0
			},
			dragDrop: [{
				dragSelector: ".mod-selector-section .item-card[draggable='true']",
				dropSelector: ".builder-area .mod-slot[data-slot-id]"
			}, {
				dragSelector: ".item-selector-section .item-card[draggable='true']",
				dropSelector: ".bottom-slots .mod-slot[data-slot-id]"
			}],
			actions: {
				changeTab: this.#e,
				clickItemName: this.#t,
				buildItem: this.#o,
				clearBuild: this.#s,
				toggleBaseItemEdit: this.#i,
				selectBaseItemImage: this.#a,
				selectBaseItem: this.#n,
				removeChange: this.#r,
				createEffect: this.#c,
				editEffect: this.#m,
				deleteEffect: this.#h,
				updateDraftField: this.#l,
				selectDraftKey: this.#u,
				saveDraftEffect: this.#f,
				cancelDraftEffect: this.#p,
				toggleDerivedValueSelector: this.#v,
				selectDerivedValue: this.#y,
				setEffectTargetType: this.#d,
				toggleMultiSelectDropdown: this.#g,
				updateMultiSelect: this.#_
			}
		});
	}
	static PARTS = { main: { template: "modules/sr5-marketplace/templates/apps/itemBuilder/item-builder.html" } };
	_onDragStart(e) {
		this.#S(e), this.element.classList.add("dragging-mod");
		let t = e.currentTarget, n = {
			uuid: t.dataset.itemUuid,
			mountPoint: t.dataset.mountPoint
		};
		this.draggedModData = { mountPoint: n.mountPoint }, e.dataTransfer.setData("text/plain", JSON.stringify(n));
		let r = game.settings.get("sr5-marketplace", "itemBuilder.ignoreMountRestrictions"), i = this.element.querySelectorAll(".mod-slot[data-slot-id]");
		if (t.closest(".mod-selector-section")) {
			this.draggedItemType = "mod", this.draggedModData = { mountPoint: n.mountPoint || "none" };
			let e = this.draggedModData.mountPoint;
			i.forEach((t) => {
				let n = t.dataset.mountPoint;
				if (t.closest(".bottom-slots")) {
					t.classList.add("initial-invalid");
					return;
				}
				if (r) {
					t.classList.add("initial-override");
					return;
				}
				!n || n === e ? t.classList.add("initial-valid") : t.classList.add("initial-invalid");
			});
		} else t.closest(".item-selector-section") && (this.draggedItemType = "item", this.draggedModData = null, i.forEach((e) => {
			e.closest(".bottom-slots") ? e.classList.add("initial-valid") : e.classList.add("initial-invalid");
		}));
	}
	_onDragEnter(e) {
		let t = e.currentTarget;
		t.classList.contains("initial-override") ? t.classList.add("override-drop") : t.classList.contains("initial-valid") ? t.classList.add("valid-drop") : t.classList.contains("initial-invalid") && t.classList.add("invalid-drop");
	}
	_onDragLeave(e) {
		e.currentTarget.classList.remove("valid-drop", "invalid-drop", "override-drop");
	}
	_onDragEnd(e) {
		this.draggedModData = null, this.draggedItemType = null, this.element.classList.remove("dragging-mod"), this.element.querySelectorAll(".mod-slot[data-slot-id]").forEach((e) => {
			e.classList.remove("valid-drop", "invalid-drop", "override-drop", "initial-valid", "initial-invalid", "initial-override");
		});
	}
	async _onDrop(e) {
		let t = JSON.parse(e.dataTransfer.getData("text/plain")), n = e.currentTarget, r = game.settings.get("sr5-marketplace", "itemBuilder.ignoreMountRestrictions"), i = n.dataset.slotId, a = n.dataset.mountPoint, o = t.mountPoint || "none";
		if (r || !a || a === o) {
			let e = await fromUuid(t.uuid);
			if (!e) return;
			let r = {
				uuid: e.uuid,
				name: e.name,
				img: e.img,
				type: e.type,
				system: e.system,
				effects: e.effects.map((e) => e.toObject(!1))
			};
			switch (this.draggedItemType) {
				case "mod": {
					let e = game.settings.get("sr5-marketplace", "itemBuilder.ignoreMountRestrictions"), t = n.dataset.mountPoint, a = this.draggedModData?.mountPoint || "none";
					e || !t || t === a ? (await M.addChange(i, r), this.render()) : ui.notifications.warn("This modification cannot be placed in that slot.");
					break;
				}
				case "item":
					n.closest(".bottom-slots") ? (await M.addChange(i, r), this.render()) : ui.notifications.error("Items can only be placed in the bottom slots.");
					break;
				default:
					console.warn("Marketplace Builder | Unknown drag type ended.");
					break;
			}
		}
	}
	_onRender(e, t) {
		if (super._onRender(e, t), this.#w.forEach((e) => e.bind(this.element)), this.tabGroups.main === "builder") {
			this.itemSearchService = new x(this.element), this.itemSearchService.initialize({
				searchBox: "input[name=\"itemSearch\"]",
				itemsGrid: ".item-selector-section .item-content-grid",
				nameSelector: ".item-name"
			}), this.modSearchService = new x(this.element), this.modSearchService.initialize({
				searchBox: "input[name=\"modSearch\"]",
				itemsGrid: ".mod-selector-section .item-content-grid",
				nameSelector: ".item-name"
			});
			let e = this.element.querySelector("#item-type-selector");
			e && e.addEventListener("change", this.onChangeCategory.bind(this)), this.element.querySelectorAll("[data-hover-delay]").forEach((e) => {
				e.addEventListener("mouseenter", this.#x.bind(this)), e.addEventListener("mouseleave", this.#S.bind(this));
			});
		} else this.itemSearchService = null, this.modSearchService = null;
	}
	async _prepareContext(e) {
		let t = e.builderData ?? await M.getState(), n = game.user.getFlag("sr5-marketplace", "selectedActorUuid");
		this.purchasingActor = n ? await fromUuid(n) : game.user.character || null;
		let r = null, i = foundry.applications.handlebars.renderTemplate, a = {
			purchasingActor: this.purchasingActor,
			hasBaseItem: !!t.baseItem,
			builderData: t
		};
		switch (this.tabGroups.main) {
			case "effects":
				this.tabGroups.main = "effects";
				let e = await new P().buildEffectsContext(t);
				foundry.utils.mergeObject(a, e), r = await i("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Effects.html", a);
				break;
			default:
				this.tabGroups.main = "builder";
				let n = null;
				t.baseItem && (n = foundry.utils.deepClone(t.baseItem), foundry.utils.mergeObject(n, t.baseItemOverrides)), a.displayItem = n, a.isEditingBaseItem = t.isEditingBaseItem;
				let o = this.itemData.baseItemsByType ?? {}, s = (this.itemData.modificationsByType ?? {}).allModifications?.items || [];
				if (a.itemsByType = o, (!this.selectedKey || !o[this.selectedKey]) && (this.selectedKey = Object.keys(o).find((e) => o[e].items.length > 0) || null), a.selectedKey = this.selectedKey, a.selectedItems = this.selectedKey && o[this.selectedKey]?.items || [], t.baseItem) {
					let e = t.baseItem.type;
					a.isWeapon = [
						"rangedWeapon",
						"meleeWeapon",
						"weapon"
					].includes(e);
					let n = [
						"rangedWeapon",
						"meleeWeapon",
						"weapon"
					], r = [], i = [], o = [
						"weapon",
						"armor",
						"vehicle",
						"drone"
					];
					for (let t of s) {
						let a = t.system?.type;
						o.includes(a) ? (a === "weapon" && n.includes(e) || a === "armor" && e === "armor") && r.push(t) : i.push(t);
					}
					r.sort((e, t) => (e.system?.mount_point || "").localeCompare(t.system?.mount_point || "")), a.categorizedMods = {
						specific: {
							label: `${e.includes("weapon") ? "Weapon" : "Armor"} Modifications`,
							items: r
						},
						general: {
							label: "General Modifications",
							items: i
						}
					};
				} else a.mods = s;
				r = await i("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Builder.html", a), console.log("Marketplace Builder | Builder Tab Context:", a);
				break;
		}
		let o = {
			title: t.title || "Select a Base Item",
			itemTypeImage: t.itemTypeImage || "icons/svg/item-bag.svg"
		};
		return {
			tabContent: r,
			purchasingActor: this.purchasingActor,
			builder: o,
			activeTab: this.tabGroups.main
		};
	}
	static _getThemeFromSetting() {
		return game.settings.get("core", "uiConfig")?.colorScheme.applications === "dark" ? "theme-dark" : "theme-light";
	}
	async onChangeCategory(e) {
		this.selectedKey = e.currentTarget.value, this.itemSearchService?.clearAllFilters(), await this.render();
	}
	static #e(e, t) {
		let n = t.dataset.tab;
		this.tabGroups.main !== n && (this.tabGroups.main = n, this.render());
	}
	static #t(e, t) {
		let n = t.dataset.itemUuid;
		n && new y(n).render(!0);
	}
	static async #n(e, t) {
		let n = t.dataset.itemUuid;
		if (!n) return;
		let r = await fromUuid(n);
		if (!r) return ui.notifications.warn("Could not find the selected item.");
		let i = {
			uuid: r.uuid,
			name: r.name,
			img: r.img,
			type: r.type,
			system: r.system,
			technology: r.technology,
			effects: r.effects?.map((e) => e.toObject(!1)) ?? []
		};
		await M.setBaseItem(i);
		let a = r.getFlag("sr5-marketplace", "linkedItems");
		if (a && Array.isArray(a) && a.length > 0) for (let e of a) {
			let { slotId: t, uuid: n } = e;
			if (!t || !n) continue;
			let r = await fromUuid(n);
			if (r) {
				let e = {
					uuid: r.uuid,
					name: r.name,
					img: r.img,
					type: r.type,
					system: r.system,
					effects: r.effects?.map((e) => e.toObject(!1)) ?? []
				};
				await M.addChange(t, e);
			} else console.warn(`Marketplace Builder | Could not find linked item with UUID: ${n}`);
		}
		this.render();
	}
	static async #r(e, t) {
		let n = t.closest(".mod-slot")?.dataset.slotId;
		n && (await M.removeChange(n), this.render());
	}
	static async #i(e, t) {
		if ((await M.getState()).isEditingBaseItem) {
			let e = this.element.querySelector(".item-stats-display");
			if (e) {
				let t = e.querySelectorAll("input[name], textarea[name]"), n = {};
				t.forEach((e) => {
					n[e.name] = e.value;
				}), await M.updateBaseItemOverrides(n);
			}
		}
		let n = await M.toggleBaseItemEdit();
		this.render(!1, { builderData: n });
	}
	static #a(e, t) {
		new foundry.applications.apps.FilePicker.implementation({
			type: "image",
			current: t.src,
			callback: (e) => {
				M.updateBaseItemOverrides({ img: e }).then(async () => {
					let e = await M.getState();
					this.render(!1, { builderData: e });
				});
			}
		}).browse();
	}
	static async #o(e, t) {
		let n = await M.getState();
		if (!n.baseItem) {
			ui.notifications.warn("Please select a base item before building.");
			return;
		}
		let r = foundry.utils.deepClone(n.baseItem);
		foundry.utils.mergeObject(r, n.baseItemOverrides);
		let i = r.name, a = [...r.effects];
		n.modifications && n.modifications.length > 0 && a.push(...foundry.utils.deepClone(n.modifications));
		let o = [], s = [], c = [];
		for (let [e, t] of Object.entries(n.changes)) t.effects && t.effects.length > 0 && a.push(...foundry.utils.deepClone(t.effects)), t.type === "modification" || t.type === "ammo" ? s.push(`<li>${t.name}</li>`) : (o.push({
			uuid: t.uuid,
			slotId: e
		}), c.push(`<b>@UUID[${t.uuid}]</b>`));
		r.effects = a, s.length > 0 && (r.name = `${i} (Modified)`);
		let l = r.system.description?.value || "";
		s.length > 0 && (l += `<hr><p><b>Embedded Modifications:</b><ul>${s.join("")}</ul></p>`), c.length > 0 && (l += `<hr><p><b>Linked Items: </b>${c.join(" ")}</p>`), r.system.description.value = l, r.flags ||= {}, r.flags["sr5-marketplace"] = {
			...r.flags["sr5-marketplace"],
			linkedItems: o
		}, console.log("Marketplace Builder | Payload for new item (log only):", r);
	}
	static async #s(e, t) {
		await M.clearState(), this.tabGroups.main = "builder", this.render();
	}
	static async #c(t, n) {
		let r = n.dataset.sourceUuid;
		r && e.#b(this, "#onCreateEffect", () => M.startEffectCreation(r));
	}
	static async #l(t, n) {
		let { name: r, value: i } = n;
		r && (r.endsWith(".mode") && (i = Number(i)), e.#b(this, "#onUpdateDraftField", () => {
			let e = foundry.utils.expandObject({ [r]: i });
			return M.updateDraftEffect(e);
		}));
	}
	static async #u(t, n) {
		let r = n.dataset.path;
		e.#b(this, "#onSelectDraftKey", () => {
			let e = foundry.utils.expandObject({ "changes.0.key": r });
			return M.updateDraftEffect(e);
		});
	}
	static async #d(t, n) {
		let r = n.dataset.targetType;
		e.#b(this, "#onSetEffectTargetType", () => {
			let e = { system: { applyTo: r } };
			return M.updateDraftEffect(e);
		});
	}
	static async #f(t, n) {
		let r = n.closest("form");
		r && e.#b(this, "#onSaveDraftEffect", async () => {
			let e = new foundry.applications.ux.FormDataExtended(r).object;
			return await M.updateDraftEffect(e), M.saveDraftEffect();
		});
	}
	static async #p(t, n) {
		e.#b(this, "#onCancelDraftEffect", () => M.cancelEffectCreation());
	}
	static async #m(t, n) {
		let { sourceUuid: r, effectId: i } = n.dataset;
		e.#b(this, "#onEditEffect", () => M.startEffectEdit(r, i));
	}
	static async #h(t, n) {
		let { effectId: r } = n.dataset;
		await Dialog.confirm({
			title: game.i18n.localize("SR5.DeleteConfirmation"),
			content: `<p>${game.i18n.localize("SR5.SureToDelete")} <b>${game.i18n.localize("SR5.Modification")}</b>?</p>`
		}) && e.#b(this, "#onDeleteEffect", () => M.deleteEffect(r));
	}
	static #g(e, t) {
		e.stopPropagation();
		let n = t.closest(".multi-select-container");
		if (!n) return;
		this.activeDropdown && this.activeDropdown !== n && (this.activeDropdown.querySelector(".dropdown-content")?.classList.remove("show"), this.activeDropdown.querySelector(".tags-input")?.classList.remove("active"));
		let r = n.querySelector(".dropdown-content"), i = n.querySelector(".tags-input"), a = r.classList.toggle("show");
		i.classList.toggle("active", a), this.activeDropdown = a ? n : null, a && (n.querySelector(".multi-select__input").focus(), window.addEventListener("click", (e) => {
			this.activeDropdown &&= (this.activeDropdown.querySelector(".dropdown-content")?.classList.remove("show"), this.activeDropdown.querySelector(".tags-input")?.classList.remove("active"), null);
		}, { once: !0 }));
	}
	static async #_(t, n) {
		let { name: r } = n.closest(".multi-select-container").dataset, { value: i, mode: a } = n.dataset;
		!r || !i || !a || e.#b(this, "#onUpdateMultiSelect", (e) => {
			let t = e.draftEffect;
			if (!t) return e;
			let o = foundry.utils.getProperty(t, r) || [];
			if (Array.isArray(o) || (o = []), a === "add") {
				if (!o.some((e) => e.id === i)) {
					let e = n.textContent.trim();
					o.push({
						id: i,
						value: e
					});
				}
			} else a === "remove" && (o = o.filter((e) => e.id !== i));
			let s = foundry.utils.expandObject({ [r]: o });
			return M.updateDraftEffect(s);
		});
	}
	static async #v(t, n) {
		e.#b(this, "#onToggleDerivedValueSelector", () => M.toggleDerivedValueSelector());
	}
	static async #y(t, n) {
		let r = n.dataset.path;
		r && e.#b(this, "#onSelectDerivedValue", () => {
			let e = { changes: { 0: { value: `@${r}` } } };
			return M.updateDraftAndState(e, { isDerivedValueSelectorVisible: !1 });
		});
	}
	static async #b(e, t, n) {
		let r = e.element.querySelector(".effect-creator-steps"), i = r ? r.scrollTop : 0, a = await M.getState();
		console.log(`Marketplace Builder | draftEffect BEFORE ${t}:`, foundry.utils.deepClone(a.draftEffect));
		let o = await n(a);
		console.log(`Marketplace Builder | State AFTER ${t}:`, foundry.utils.deepClone(o)), await e.render(!1, { builderData: o });
		let s = e.element.querySelector(".effect-creator-steps");
		s && (s.scrollTop = i);
	}
	#x(e) {
		let t = e.currentTarget, n = t.dataset.itemUuid;
		if (!n) return;
		let r = parseInt(t.dataset.hoverDelay) || 500;
		this.hoverTimeout = setTimeout(() => {
			let e = t.getBoundingClientRect();
			this.tooltipApp = new y(n, {
				window: { frame: !0 },
				classes: ["item-preview-tooltip"],
				position: {
					top: e.top,
					left: e.left,
					width: 500,
					height: 320
				}
			}), this.tooltipApp.render(!0);
		}, r);
	}
	#S(e) {
		clearTimeout(this.hoverTimeout), this.tooltipApp &&= (this.tooltipApp.close(), null);
	}
	#C() {
		return this.options.dragDrop.map((e) => (e.callbacks = {
			dragstart: this._onDragStart.bind(this),
			dragenter: this._onDragEnter.bind(this),
			dragleave: this._onDragLeave.bind(this),
			dragend: this._onDragEnd.bind(this),
			drop: this._onDrop.bind(this)
		}, new foundry.applications.ux.DragDrop.implementation(e)));
	}
	#w = this.#C();
}, L = (e) => {
	let { HandlebarsApplicationMixin: t } = foundry.applications.api;
	return class extends t(e) {
		static DEFAULT_OPTIONS = {
			form: {
				handler: this.prototype._processFormData,
				submitOnChange: !0,
				closeOnSubmit: !1
			},
			window: { resizable: !0 }
		};
		_processFormData(e, t, n) {
			let r = n.object;
			return this.document.update(r), r;
		}
		async _prepareContext(e) {
			let t = await super._prepareContext(e);
			return t.actor = this.document, t.system = this.document.system, t.flags = this.document.flags, t.isOwner = this.document.isOwner, t.isEditable = this.isEditable, t.limited = this.document.limited, t;
		}
	};
};
//#endregion
//#region scripts/services/enricher.mjs
async function R(e, t = {}) {
	return t.relativeTo && (t.secrets &&= t.relativeTo.isOwner, t.relativeTo.getRollData instanceof Function && (t.rollData = t.relativeTo.getRollData())), foundry.applications.ux.TextEditor.implementation.enrichHTML(e, t);
}
//#endregion
//#region tests/SR5_Tests.mjs
async function z(e, t, ...n) {
	if (!e) throw Error("No actor");
	let r = e[t];
	if (typeof r == "function") return await r.apply(e, n);
	if (r !== void 0) return r;
	let i = Object.getPrototypeOf(e);
	for (; i && i !== Object.prototype;) {
		let r = Object.getOwnPropertyDescriptor(i, t);
		if (r) {
			if (typeof r.value == "function") return await r.value.apply(e, n);
			if (typeof r.get == "function") return r.get.call(e);
		}
		i = Object.getPrototypeOf(i);
	}
	if (typeof e?.constructor?.[t] == "function") return await e.constructor[t](e, ...n);
	throw Error(`SR5 member "${t}" not found`);
}
var B = async (e) => typeof e == "string" ? await fromUuid(e) : e;
function V(e) {
	return ChatMessage.getSpeaker({ actor: e });
}
async function H(e, t, n) {
	return ChatMessage.create({
		speaker: V(e),
		content: `<h3>${t}</h3><ul>${n.map((e) => `<li>${e}</li>`).join("")}</ul>`
	});
}
async function U(e, t) {
	let n = await z(e, "getPool", t).catch(() => 0);
	return n && typeof n == "object" && (n = n.value ?? n.total ?? n.pool ?? 0), Number.isFinite(n) ? Math.max(0, n) : 0;
}
async function W(e, t) {
	let n = await z(e, "getSkill", t).catch(() => null);
	return Number(n?.value ?? n?.rating ?? n ?? 0);
}
function G(e) {
	let t = foundry.utils.getProperty(e, "system.skills.active") || {}, n = Object.entries(t).filter(([e, t]) => ["Acting", "Influence"].includes(String(t?.group ?? ""))).map(([e]) => e);
	for (let e of [
		"con",
		"etiquette",
		"leadership",
		"negotiation",
		"intimidation",
		"instruction",
		"impersonation",
		"disguise"
	]) t[e] && !n.includes(e) && n.push(e);
	return n;
}
function K(e, t) {
	let n = e?.dice?.[0]?.results ?? [], r = n.filter((e) => (e?.result ?? 0) >= 5).length, i = n.filter((e) => (e?.result ?? 0) === 1).length, a = i > t / 2;
	return {
		hits: r,
		ones: i,
		glitch: a,
		critGlitch: a && r === 0
	};
}
async function q(e) {
	let t = new Roll(`${Math.max(0, e)}d6`);
	return typeof t.evaluate == "function" ? await t.evaluate() : typeof t.evaluateSync == "function" && t.evaluateSync(), {
		roll: t,
		...K(t, e)
	};
}
async function J(e, { postToChat: t = !0 } = {}) {
	let n = await B(e), r = G(n), i = [];
	for (let e of r) {
		let t = await U(n, e), { roll: r, hits: o, glitch: s, critGlitch: c } = await q(t);
		i.push(`<b>${e}</b>: ${o} hits (pool ${t})` + (s ? c ? " — <span style='color:red'>CRIT GLITCH</span>" : " — <i>glitch</i>" : "")), console.debug(`[${a}] simpleAll`, {
			actor: n.name,
			key: e,
			pool: t,
			roll: r,
			hits: o,
			glitch: s,
			critGlitch: c
		});
	}
	return t && await H(n, "Social Skills — Simple Tests", i), i;
}
async function Y(e, t, { postToChat: n = !0 } = {}) {
	let r = await B(e), i = await B(t), o = G(r), s = [];
	for (let e of o) {
		let t = await U(r, e), n = await U(i, e), o = await q(t), c = await q(n), l = o.hits - c.hits;
		s.push(`<b>${e}</b>: ${r.name} ${o.hits} vs ${i.name} ${c.hits} → <b>${l >= 0 ? "+" : ""}${l}</b>`), console.debug(`[${a}] opposedAll`, {
			key: e,
			a: o,
			d: c,
			net: l
		});
	}
	return n && await H(r, `Opposed Social — ${r.name} vs ${i.name}`, s), s;
}
async function X(e, t = [], { capByLeaderRating: n = !0, postToChat: r = !0 } = {}) {
	let i = await B(e), o = await Promise.all(t.map(B)), s = G(i), c = [];
	for (let e of s) {
		let t = await U(i, e), r = await W(i, e), s = 0;
		for (let t of o) {
			let n = await q(await U(t, e));
			s += n.hits, console.debug(`[${a}] teamwork helper`, {
				helper: t.name,
				key: e,
				hits: n.hits
			});
		}
		let l = t + (n ? Math.min(s, Math.max(0, r)) : s), u = await q(l);
		c.push(`<b>${e}</b>: base ${t} + assist ${s}` + (n ? ` (cap ${r})` : "") + ` → roll ${l} = <b>${u.hits}</b> hits`), console.debug(`[${a}] teamwork leader`, {
			key: e,
			leaderPoolBase: t,
			assistHits: s,
			leaderPool: l
		});
	}
	return r && await H(i, `Teamwork Social — Leader: ${i.name}`, c), c;
}
globalThis.sr5Marketplace ??= {}, globalThis.sr5Marketplace.tests = {
	simpleAll: J,
	opposedAll: Y,
	teamworkAll: X
};
//#endregion
//#region sheets/ShopActorSheet.mjs
var { ActorSheet: ne } = foundry.applications.sheets, re = class e extends L(ne) {
	static MODES = {
		PLAY: "play",
		EDIT: "edit"
	};
	_isEditingBiography = !1;
	_mode = e.MODES.PLAY;
	get isPlayMode() {
		return this._mode === this.constructor.MODES.PLAY;
	}
	get isEditMode() {
		return this._mode === this.constructor.MODES.EDIT;
	}
	static DEFAULT_OPTIONS = {
		classes: [
			"sr5",
			"shop",
			"sr5-marketplace-shop"
		],
		position: {
			left: 103.5,
			top: 18,
			width: 1080,
			height: 900
		},
		actions: {
			...super.DEFAULT_OPTIONS.actions,
			toggleMode: this.#o,
			editImage: this.#s,
			openDocumentLink: this.#r,
			addItem: this.#a,
			removeItem: this.#i,
			removeOwner: this.#e,
			removeConnection: this.#t,
			removeEmployee: this.#n,
			runSimpleSocial: this.#c,
			runOpposedSocial: this.#l,
			runTeamworkSocial: this.#u,
			rollAvailability: this.#d
		}
	};
	static PARTS = {
		header: {
			template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-header.html",
			classes: ["marketplace-header"]
		},
		attributes: { template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-attributes.html" },
		tabs: {
			template: "templates/generic/tab-navigation.hbs",
			classes: ["marketplace-tabs"]
		},
		actorShop: { template: "modules/sr5-marketplace/templates/documents/actor/actorShop.html" },
		biography: { template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-biography.html" }
	};
	static TABS = { primary: {
		tabs: [{
			id: "actorShop",
			label: "Shop Details"
		}, {
			id: "biography",
			label: "Biography"
		}],
		initial: "actorShop"
	} };
	async _prepareContext(e) {
		let t = await super._prepareContext(e);
		return t.isPlayMode = this.isPlayMode, t.isEditMode = this.isEditMode, t.actor = this.document, t.system = this.document.system, t.flags = this.document.flags, t.isOwner = this.document.isOwner, t.isEditable = this.isEditable, t.isGM = game.user.isGM, t.systemFields = this.document.system.schema.fields, t.system.attributes && (t.system.attributes.physicalAttributes = {
			body: t.system.attributes.body,
			agility: t.system.attributes.agility,
			reaction: t.system.attributes.reaction,
			strength: t.system.attributes.strength
		}, t.system.attributes.mentalAttributes = {
			willpower: t.system.attributes.willpower,
			logic: t.system.attributes.logic,
			intuition: t.system.attributes.intuition,
			charisma: t.system.attributes.charisma
		}, t.system.attributes.specialAttributes = {
			magic: t.system.attributes.magic,
			resonance: t.system.attributes.resonance,
			essence: t.system.attributes.essence,
			edge: t.system.attributes.edge,
			initiation: t.system.attributes.initiation,
			submersion: t.system.attributes.submersion
		}), t;
	}
	async _preparePartContext(e, t) {
		switch (t.tab = t.tabs[e], t.isEditMode = this._mode === "edit", e) {
			case "actorShop":
				t.owner = await this.document.getOwner(), t.connection = await this.document.getConnection(), t.employees = await this.document.getEmployees();
				let e = (e) => e ? e.charAt(0).toUpperCase() + e.slice(1) : "";
				t.shopEmployees = this.document.system.shop?.employees?.join("\n") || "", t.modifierTypes = {
					discount: game.i18n.localize("SR5Marketplace.Marketplace.Shop.Discount"),
					fee: game.i18n.localize("SR5Marketplace.Marketplace.Shop.Fee")
				};
				let n = this.document.system.skills, r = ["Acting", "Influence"], i = ["intimidation", "instruction"];
				t.activeSkills = Object.entries(n.active).filter(([e, t]) => r.includes(t.group) || i.includes(e)).map(([e, t]) => {
					let n = CONFIG.SR5Marketplace.activeSkills[e];
					return {
						id: e,
						name: game.i18n.localize(n) || e,
						value: t.value
					};
				}), t.knowledgeSkillGroups = Object.entries(n.knowledge).map(([t, n]) => ({
					key: t,
					label: game.i18n.localize(`SR5Marketplace.KnowledgeSkill${e(t)}`),
					skills: Object.entries(n.value).map(([e, t]) => ({
						id: e,
						name: t.name,
						value: t.value
					}))
				})), t.languageSkills = Object.entries(n.language.value).map(([e, t]) => ({
					id: e,
					name: t.name,
					value: t.value
				}));
				let a = this.document.system.shop.inventory, o = {};
				for (let [e, t] of Object.entries(a)) {
					let n = await fromUuid(t.itemUuid);
					n && (o[e] = {
						...t,
						img: n.img,
						name: n.name,
						rating: n.system.rating || 0,
						itemPrice: n.system.cost || 0
					});
				}
				t.inventory = o;
				break;
			case "biography":
				t.biographyHTML = await R(this.document.system.description.value, {
					async: !0,
					relativeTo: this.document
				});
				break;
		}
		return t;
	}
	_processFormData(e, t, n) {
		let r = n.object;
		return r.system?.shop?.employees && (r.system.shop.employees = r.system.shop.employees.split("\n").map((e) => e.trim()).filter((e) => e)), this.document.update(r), r;
	}
	static async #e(e, t) {
		this.isEditMode && await this.document.removeOwner();
	}
	static async #t(e, t) {
		this.isEditMode && (await this.document.removeConnection(), this.render());
	}
	static async #n(e, t) {
		if (!this.isEditMode) return;
		let n = t.dataset.uuid;
		n && await this.document.removeEmployee(n);
	}
	static async #r(e, t) {
		let n = t.dataset.uuid;
		if (!n) return;
		let r = await fromUuid(n);
		r?.sheet && r.sheet.render(!0);
	}
	static async #i(e, t) {
		if (!this.isEditMode) return;
		let n = t.dataset.inventoryEntryId;
		if (!n) return;
		let r = this.document.shop.inventory[n], i = (await fromUuid(r.itemUuid))?.name ?? "this item";
		await foundry.applications.api.DialogV2.wait({
			window: { title: `Remove ${i}` },
			content: `<p>Are you sure you want to remove <strong>${i}</strong> from the inventory?</p>`,
			buttons: [{
				label: "Remove",
				action: "remove",
				icon: "fa-solid fa-trash"
			}, {
				label: "Cancel",
				action: "cancel",
				icon: "fa-solid fa-times"
			}],
			default: "cancel"
		}) === "remove" && (await this.document.removeItemFromInventory(n), console.log(`Item entry ${n} removed. Current inventory:`, this.document.shop.inventory), this.render());
	}
	static #a(e, t) {
		this.isEditMode && ui.notifications.info("Please drag and drop an item from the sidebar or a compendium into the inventory list.");
	}
	static async #o(e, t) {
		if (!this.isEditable) {
			ui.notifications.warn("You do not have permission to edit this sheet.");
			return;
		}
		this._mode = this.isPlayMode ? this.constructor.MODES.EDIT : this.constructor.MODES.PLAY, this.render();
	}
	static #s(e, t) {
		let n = foundry.applications.apps.FilePicker.implementation;
		return new n({
			type: "image",
			current: this.document.img,
			callback: (e) => {
				this.document.update({ img: e });
			},
			top: this.position.top + 40,
			left: this.position.left + 10
		}).browse();
	}
	static async #c(e, t) {
		await J(this.document, { postToChat: !0 });
	}
	static async #l(e, t) {
		let n = t?.dataset?.defenderUuid;
		if (!n) {
			let e = Array.from(game.user.targets ?? [])[0]?.actor, t = canvas.tokens.controlled.find((e) => e.actor?.id !== this.document.id)?.actor, r = e ?? t;
			if (!r) return ui.notifications.warn("Select/target an opposing actor or set data-defender-uuid.");
			n = r.uuid;
		}
		await Y(this.document, n, { postToChat: !0 });
	}
	static async #u(e, t) {
		let n = [], r = t?.dataset?.helpers;
		if (r) n = r.split(",").map((e) => e.trim()).filter(Boolean);
		else if (n = canvas.tokens.controlled.map((e) => e.actor?.uuid).filter((e) => e && e !== this.document.uuid), !n.length) return ui.notifications.warn("Control helper tokens or provide data-helpers on the button.");
		await X(this.document, n, {
			capByLeaderRating: !0,
			postToChat: !0
		});
	}
	static async #d(e, t) {
		let n = t.dataset.availability;
		if (!n) return;
		let r = this.document, i = { availabilityStr: n };
		try {
			await new game.shadowrun5e.tests.AvailabilityTest(i, { actor: r }).execute();
		} catch (e) {
			console.error("Marketplace | AvailabilityTest failed:", e);
		}
	}
	_configureRenderOptions(e) {
		super._configureRenderOptions(e), this.element && (this.element.classList.toggle("play-mode", this._mode === "play"), this.element.classList.toggle("edit-mode", this._mode === "edit"));
	}
	_onSwitchTab(e, t, n) {
		console.log(`Tab switched. Active tab is now: ${n}`), super._onSwitchTab(e, t, n), console.log("Forcing a re-render."), this.render();
	}
	async _onDrop(e) {
		e.preventDefault();
		let t = e.target.closest(".drop-target");
		if (!t || !this.isEditMode) return;
		let n;
		try {
			n = JSON.parse(e.dataTransfer.getData("text/plain"));
		} catch {
			return;
		}
		switch (t.dataset.dropZone) {
			case "inventory": {
				if (n.type !== "Item") return;
				let e = await Item.fromDropData(n);
				if (!e) return;
				if (e.type === "contact") {
					ui.notifications.warn("Contacts cannot be added to inventory. Drop on the 'Connection' field instead.");
					return;
				}
				return this.document.addItemToInventory(e);
			}
			case "connection": {
				if (n.type !== "Item") return;
				let e = await Item.fromDropData(n);
				if (!e) return;
				if (e.type !== "contact") {
					ui.notifications.warn("Only Items of type 'Contact' can be dropped on the Connection field.");
					return;
				}
				let r = t.dataset.targetField;
				return this.document.update({ [r]: n.uuid });
			}
			case "owner":
			case "employees": {
				if (n.type !== "Actor") return;
				let e = t.dataset.targetField;
				return e === "system.shop.employees" ? this.document.addEmployee(n.uuid) : this.document.update({ [e]: n.uuid });
			}
		}
	}
};
//#endregion
//#region models/actor/shopActor.mjs
function ie() {
	let e = CONFIG.Actor.documentClass, t = CONFIG.Actor.dataModels.character;
	class n extends t {
		static get LOCALIZATION_PREFIXES() {
			return super.LOCALIZATION_PREFIXES.concat("SR5", "SR5.Marketplace.Shop");
		}
		static defineSchema() {
			let e = super.defineSchema();
			foundry.data.fields;
			let t = new foundry.data.fields.SchemaField({
				itemUuid: new foundry.data.fields.StringField({
					required: !0,
					blank: !1,
					label: "Item UUID"
				}),
				qty: new foundry.data.fields.NumberField({
					required: !0,
					integer: !0,
					min: 0,
					initial: 1,
					label: "Quantity"
				}),
				sellPrice: new foundry.data.fields.SchemaField({
					value: new foundry.data.fields.NumberField({
						required: !0,
						min: 0,
						initial: 0,
						label: "Sell Price"
					}),
					base: new foundry.data.fields.NumberField({
						required: !0,
						min: 0,
						initial: 0,
						label: "Unmodified Sell Price"
					})
				}),
				buyPrice: new foundry.data.fields.SchemaField({
					value: new foundry.data.fields.NumberField({
						required: !0,
						min: 0,
						initial: 0,
						label: "Buy Price"
					}),
					base: new foundry.data.fields.NumberField({
						required: !0,
						min: 0,
						initial: 0,
						label: "Unmodified Buy Price"
					})
				}),
				availability: new foundry.data.fields.SchemaField({
					value: new foundry.data.fields.StringField({
						required: !0,
						blank: !1,
						initial: "",
						label: "Availability"
					}),
					base: new foundry.data.fields.StringField({
						required: !0,
						blank: !1,
						initial: "",
						label: "Unmodified Availability"
					})
				}),
				buyTime: new foundry.data.fields.SchemaField({
					value: new foundry.data.fields.NumberField({
						required: !0,
						integer: !0,
						min: 0,
						initial: 24,
						label: "Buy Time"
					}),
					unit: new foundry.data.fields.StringField({
						required: !0,
						choices: [
							"hours",
							"days",
							"weeks",
							"months"
						],
						initial: "hours"
					})
				}),
				comments: new foundry.data.fields.HTMLField({ label: "Comments" })
			}), n = () => ({
				owner: new foundry.data.fields.StringField({
					initial: "",
					label: "Owner "
				}),
				employees: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField({
					initial: "",
					label: "Employees"
				})),
				connection: new foundry.data.fields.StringField({
					initial: "",
					label: "Connection"
				}),
				modifierValue: new foundry.data.fields.SchemaField({
					value: new foundry.data.fields.NumberField({ initial: 0 }),
					base: new foundry.data.fields.NumberField({ initial: 0 })
				}),
				modifierType: new foundry.data.fields.StringField({
					initial: "discount",
					choices: ["discount", "fee"],
					label: "Modifier Type",
					hint: "does a discount or fee apply"
				}),
				shopRadius: new foundry.data.fields.SchemaField({
					value: new foundry.data.fields.NumberField({
						initial: 1,
						min: 1,
						label: "Shop Radius",
						hint: "Used to detect if you buy from this Actor"
					}),
					base: new foundry.data.fields.NumberField({
						initial: 1,
						min: 1
					})
				}),
				tokenInRadius: new foundry.data.fields.ObjectField({
					initial: {},
					label: "Token in Radius"
				}),
				inventory: new foundry.data.fields.ObjectField({
					validate: (e) => {
						for (let n of Object.values(e)) try {
							t.clean(n, {});
						} catch (e) {
							return console.error("Shop Inventory Validation Failed on Item:", n, e), !1;
						}
						return !0;
					},
					initial: {},
					label: "Inventory"
				})
			});
			return {
				...e,
				shop: new foundry.data.fields.SchemaField(n())
			};
		}
	}
	CONFIG.Actor.dataModels["sr5-marketplace.shop"] = n;
	class r extends e {
		get shop() {
			return this.system.shop;
		}
		_onUpdate(e, t, n) {
			super._onUpdate(e, t, n), foundry.utils.hasProperty(e, "system.shop.shopRadius") && this._updateTokensInRadius();
		}
		async getOwner() {
			return this.shop.owner ? fromUuid(this.shop.owner) : null;
		}
		async updateOwner(e) {
			return this.update({ "system.shop.owner": e });
		}
		async removeOwner() {
			return this.update({ "system.shop.owner": "" });
		}
		async getEmployees() {
			if (!this.shop.employees?.length) return [];
			let e = this.shop.employees.filter((e) => e);
			if (e.length === 0) return [];
			let t = e.map((e) => fromUuid(e));
			return (await Promise.all(t)).filter((e) => e);
		}
		async addEmployee(e) {
			let t = this.shop.employees;
			if (!t.includes(e)) return this.update({ "system.shop.employees": [...t, e] });
		}
		async removeEmployee(e) {
			let t = this.shop.employees.filter((t) => t !== e);
			return this.update({ "system.shop.employees": t });
		}
		async getConnection() {
			return this.shop.connection ? fromUuid(this.shop.connection) : null;
		}
		async updateConnection(e) {
			return this.update({ "system.shop.connection": e });
		}
		async removeConnection() {
			return this.update({ "system.shop.connection": "" });
		}
		async updateModifier({ value: e, type: t } = {}) {
			let n = {};
			return e !== void 0 && (n["system.shop.modifierValue.base"] = e), t !== void 0 && (n["system.shop.modifierType"] = t), this.update(n);
		}
		async updateShopRadius(e) {
			return this.update({ "system.shop.shopRadius.base": e });
		}
		async getTokensInRadius() {
			if (!this.shop.tokenInRadius) return [];
			let e = Object.values(this.shop.tokenInRadius).map((e) => e.uuid);
			return fromUuid.multi(e);
		}
		async _updateTokensInRadius() {
			if (!canvas.ready || !this.token) return;
			let e = this.token, t = this.system.shop.shopRadius.value, n = {}, r = canvas.tokens.placeables.filter((t) => t.id !== e.id);
			for (let i of r) canvas.grid.measureDistance(e, i) <= t && (n[i.id] = {
				uuid: i.uuid,
				x: i.x,
				y: i.y
			});
			await this.update({ "system.shop.tokenInRadius": n }), console.log(`Found ${Object.keys(n).length} tokens within the shop's radius.`);
		}
		findInventoryItem(e) {
			return Object.entries(this.shop.inventory).find(([t, n]) => n.itemUuid === e);
		}
		async addItemToInventory(e, t = {}) {
			if (!e?.uuid) throw Error("Item data must include a UUID.");
			if (this.findInventoryItem(e.uuid)) return ui.notifications.warn("This item is already in the shop's inventory.");
			let n = foundry.utils.randomID(), r = {
				itemUuid: e.uuid,
				qty: t.qty ?? 1,
				sellPrice: {
					value: t.sellPrice ?? 0,
					base: t.sellPrice ?? 0
				},
				buyPrice: {
					value: t.buyPrice ?? 0,
					base: t.buyPrice ?? 0
				},
				availability: {
					value: t.availability ?? "1R",
					base: t.availability ?? "1R"
				},
				buyTime: t.buyTime ?? {
					value: 24,
					unit: "hours"
				},
				comments: ""
			};
			return this.update({ [`system.shop.inventory.${n}`]: r });
		}
		async updateInventoryItem(e, t) {
			let n = {};
			for (let [r, i] of Object.entries(t)) n[`system.shop.inventory.${e}.${r}`] = i;
			return this.update(n);
		}
		async removeItemFromInventory(e) {
			let t = { [`system.shop.inventory.-=${e}`]: null };
			return console.log("Attempting to apply update:", t), this.update(t);
		}
	}
	return CONFIG.Actor.documentClass = r, {
		ShopActor: r,
		ShopActorData: n
	};
}
//#endregion
//#region scripts/services/actorItemServices.mjs
var ae = class extends n {
	constructor(e = null) {
		super(), this.actor = e, this.flagItemsArray = [], this.baseItemsArray = [];
	}
	async initWithFlag(e) {
		try {
			let t = await this.getOrderDataFromFlag(e);
			if (!t) throw Error(`No flag data found for flag ID ${e}`);
			this.flagItemsArray = t.items || [];
			let n = this.flagItemsArray.map(async (e) => {
				try {
					let t = e.uuid || `Item.${e._id}`, n = await fromUuid(t);
					return n || console.warn(`Base item not found for UUID: ${t}`), n;
				} catch (t) {
					return console.error("Error retrieving base item for flag item:", e, t), null;
				}
			});
			this.baseItemsArray = (await Promise.all(n)).filter((e) => e !== null), this.baseItemsArray.length === 0 ? console.warn("No base items could be loaded from UUIDs.") : console.log("Base items loaded:", this.baseItemsArray);
		} catch (t) {
			console.error(`Error processing flag data for flag ID ${e}:`, t);
		}
	}
	async createItemsWithInjectedData() {
		if (!this.flagItemsArray || !this.baseItemsArray) {
			console.error("Flag items or base items are not loaded.");
			return;
		}
		let e = [], t = [
			"quality",
			"adept_power",
			"spell",
			"complex_form"
		];
		return this.flagItemsArray.forEach((n) => {
			let r = this.baseItemsArray.find((e) => e._id === n._id || e.uuid === n.uuid);
			if (r) {
				let i = JSON.parse(JSON.stringify(r));
				i.system.technology.cost = n.system.technology.cost || r.system.technology.cost, i.system.technology.rating = n.system.technology.rating || n.selectedRating || r.system.technology.rating, i.system.technology.availability = n.system.technology.availability || n.calculatedAvailability || r.system.technology.availability, i.system.technology.essence = n.system.technology.essence || n.calculatedEssence || r.system.technology.essence, t.includes(i.type) && (i.flags?.["sr5-marketplace"]?.karma ? i.flags["sr5-marketplace"].karma = i.flags["sr5-marketplace"].karma : (i.flags = i.flags || {}, i.flags["sr5-marketplace"] = i.flags["sr5-marketplace"] || {}, i.flags["sr5-marketplace"].karma = n.karma || 0)), i.effects = (r.effects || []).map((e, t) => {
					let i = { ...e };
					return n.effects && n.effects[t] && (n.effects[t], i.origin = e.origin, i.duration.startTime = e.duration?.startTime || null, i.duration.endTime = e.duration?.endTime || null, i.disabled = e.disabled || !1, i.name = e.name || "", i.changes = (e.changes || []).map((e) => ({
						key: e.key || "",
						mode: e.mode || 0,
						value: e.value || n.selectedRating || r.system.technology.rating || 0,
						priority: e.priority || null
					})), i.transfer = e.transfer || !1, i.img = e.img || "", i.type = e.type || "", i.sort = e.sort || 0), i;
				}), e.push(i);
			} else console.warn(`No matching base item found for flag item with ID: ${n._id}`);
		}), e;
	}
	logItems() {
		console.log("Flag Items:", this.flagItemsArray), console.log("Base Items:", this.baseItemsArray);
	}
	async createItemsOnActor(e, t, n) {
		if (!e) {
			console.error("No valid actor provided.");
			return;
		}
		let r = [], i = [];
		for (let a = 0; a < t.length; a++) {
			let o = t[a], s = n.items[a];
			try {
				let [t] = await e.createEmbeddedDocuments("Item", [o]);
				console.log(`Created item: ${t.name} on actor: ${e.name}`), i.push([t.uuid]);
				let n = t.getFlag("sr5-marketplace", "karma") || 0, a = e.items.filter((e) => e.name === t.name).sort((e, t) => t._stats.modifiedTime - e._stats.modifiedTime)[0];
				a || console.warn(`Could not find the recently created item on actor: ${e.name} for item ${t.name}`), r.push({
					baseId: s._id,
					creationItemId: a.uuid,
					name: t.name,
					calculatedCost: t.system.technology.cost,
					selectedRating: t.system.technology.rating,
					calculatedAvailability: t.system.technology.availability,
					calculatedEssence: t.system.technology.essence,
					calculatedKarma: n
				});
			} catch (e) {
				console.error(`Error creating item: ${o.name}`, e);
			}
		}
		return console.log(e, r), r;
	}
	async increaseSkill(e, t) {
		!e || !t || (console.log(`Attempting to increase skill '${t}' for actor: ${e.name}`), await this.updateSkillValue(e, t, 1), console.log(`Successfully increased skill '${t}'`), setTimeout(() => {
			Hooks.on("renderActorSheet", async (t, n) => {
				t.document.id === e.id && (console.log(`Re-render detected for actor: ${e.name}. Injecting karma adjust buttons for all skills.`), this.injectKarmaAdjustButtonsForAllSkills(n, e));
			});
		}, 100));
	}
	async decreaseSkill(e, t) {
		!e || !t || (console.log(`Attempting to decrease skill '${t}' for actor: ${e.name}`), await this.updateSkillValue(e, t, -1), console.log(`Successfully decreased skill '${t}'`), setTimeout(() => {
			Hooks.on("renderActorSheet", async (t, n) => {
				t.document.id === e.id && (console.log(`Re-render detected for actor: ${e.name}. Injecting karma adjust buttons for all skills.`), this.injectKarmaAdjustButtonsForAllSkills(n, e));
			});
		}, 100));
	}
	async updateSkillValue(e, t, n) {
		let r = (t) => e.system.karma.value >= t, i = async (t) => {
			let n = e.system.karma.value;
			await e.update({ "system.karma.value": n + t });
		}, a, o, s, c = game.i18n.localize(t), l = n > 0;
		if (e.system.skills.active?.[t]) {
			if (a = e.system.skills.active[t].base, o = a + n, s = Math.abs(n) * 4, l && !r(s) || o < 0) return;
			await e.update({ [`system.skills.active.${t}.base`]: o }), await i(l ? -s : s);
		}
		for (let [c, u] of Object.entries(e.system.skills.knowledge)) if (u.value?.[t]) {
			if (a = u.value[t].base, o = a + n, s = Math.abs(n) * 2, l && !r(s) || o < 0) return;
			await e.update({ [`system.skills.knowledge.${c}.value.${t}.base`]: o }), await i(l ? -s : s);
		}
		if (e.system.skills.language.value?.[t]) {
			if (a = e.system.skills.language.value[t].base, o = a + n, s = Math.abs(n) * 2, l && !r(s) || o < 0) return;
			await e.update({ [`system.skills.language.value.${t}.base`]: o }), await i(l ? -s : s);
		}
		let u = {
			skillKey: t,
			skillLabel: c,
			oldValue: a,
			newValue: o,
			karmaSpent: s,
			gain: l
		};
		await this.logSkillChangeHistory(e, u), e.sheet && (e.sheet.render(!0, { focus: !0 }), setTimeout(() => {
			this.injectKarmaAdjustButtonsForAllSkills(e.sheet.element, e);
		}, 100));
	}
	injectKarmaAdjustButtonsForAllSkills(e, t) {
		console.log(`Injecting karma adjust buttons for all skills on actor sheet for actor: ${t.name}`), e.find(".list-item[data-item-type=\"skill\"]").each((e, n) => {
			let r = $(n), i = r.find(".item-right"), a = i.find(".item-text.rtg");
			a.next(".karma-adjust-buttons").length > 0 || ($("\n                <div class=\"karma-adjust-buttons\" style=\"display: inline-block; margin-left: -20px;\">\n                    <plus class=\"karma-plus-button\"><i class=\"fas fa-plus\"></i></plus>\n                    <minus class=\"karma-minus-button\"><i class=\"fas fa-minus\"></i></minus>\n                </div>\n            ").insertAfter(a), i.find(".karma-plus-button").on("click", async (e) => {
				e.preventDefault(), console.log(`Increase button clicked for skill: ${r.data("item-id")}`);
				let n = r.data("item-id");
				await this.increaseSkill(t, n);
			}), i.find(".karma-minus-button").on("click", async (e) => {
				e.preventDefault(), console.log(`Decrease button clicked for skill: ${r.data("item-id")}`);
				let n = r.data("item-id");
				await this.decreaseSkill(t, n);
			}));
		}), console.log("Injected karma adjust buttons for all skills on the actor sheet.");
	}
	async logSkillChangeHistory(e, t) {
		if (!e || !t) return;
		let { skillKey: n, skillLabel: r, oldValue: i, newValue: a, karmaSpent: o, gain: s } = t, c = e.getFlag("sr5-marketplace", "history") || [];
		Array.isArray(c) || (console.warn("History flag is not an array. Converting..."), c = Array.isArray(c) ? c : Object.values(c));
		let { flagTimestamp: l } = await getFormattedTimestamp(), u = {
			actorFlagId: e.id,
			items: null,
			karma: o,
			gain: s,
			surgicalDamage: 0,
			timestamp: l,
			skillChange: {
				skillKey: n,
				skillLabel: r,
				oldValue: i,
				newValue: a,
				karmaSpent: o
			}
		};
		c.push(u), await e.setFlag("sr5-marketplace", "history", c), console.log(`Logged history for skillKey '${n}' for actor: ${e.name} - OldValue: ${i}, NewValue: ${a}`), await logActorHistory(e);
	}
}, oe = class {
	static applyTheme(e, t) {
		let n = document.querySelector(e);
		if (!n || !t) {
			console.warn("ThemeService | Source or target element not found.", {
				sourceSelector: e,
				targetElement: t
			});
			return;
		}
		n.classList.contains("theme-dark") ? (t.classList.remove("theme-light"), t.classList.add("theme-dark")) : n.classList.contains("theme-light") && (t.classList.remove("theme-dark"), t.classList.add("theme-light"));
	}
};
new ae(), new n(), new g(), new b(), new e(), new M(), new f(), new i(), new oe(), new N();
//#endregion
//#region scripts/API/marketplaceAPI.mjs
var se = class {
	constructor() {}
	init() {}
	async addItem(e, t, n = {}) {
		if (!e || !t) return;
		let { userId: r = null } = n;
		await this.basketService.addToBasket(e, t, r);
	}
	async open(e = {}) {
		let { actorUuid: t, itemUuid: n } = e;
		t && await game.user.setFlag(a, u, t), n && t && await this.addItemToBasket(n, t);
		let r = foundry.applications.instances.get("inGameMarketplace");
		r ||= new E(), r.render(!0);
	}
	async close() {
		let e = foundry.applications.instances.get("inGameMarketplace");
		e && await e.close();
	}
	async setActor(e) {
		if (!e) return;
		await game.user.setFlag(a, u, e);
		let t = foundry.applications.instances.get("inGameMarketplace");
		t && t.render();
	}
	async clearActor() {
		await game.user.unsetFlag(a, u);
		let e = foundry.applications.instances.get("inGameMarketplace");
		e && e.render();
	}
	async getBasket() {
		return (await new g().getBasket()).shoppingCartItems || [];
	}
	async remove(e) {
		if (!e) return;
		await new g().removeFromBasket(e);
		let t = foundry.applications.instances.get("inGameMarketplace");
		t && t.render();
	}
}, ce = class {
	constructor() {}
	init() {}
	async setBaseItem(e) {
		if (!e) return;
		let t = await fromUuid(e);
		if (!t) return ui.notifications.warn("Could not find the selected item.");
		let n = {
			uuid: t.uuid,
			name: t.name,
			img: t.img,
			type: t.type,
			system: t.system,
			technology: t.technology,
			effects: t.effects?.map((e) => e.toObject(!1)) ?? []
		};
		await M.setBaseItem(n);
		let r = foundry.applications.instances.get("itemBuilder");
		r ? r.render(!0) : new I().render(!0);
	}
	async getBaseItem() {
		return (await M.getState()).baseItem;
	}
	async open() {
		let e = foundry.applications.instances.get("itemBuilder");
		e ||= new I(), e.render(!0);
	}
	async clear() {
		await M.clearState();
		let e = foundry.applications.instances.get("itemBuilder");
		e && e.render();
	}
	async close(e = {}) {
		let { clearState: t = !1 } = e;
		t && await this.clearBuilderState();
		let n = foundry.applications.instances.get("itemBuilder");
		n && await n.close();
	}
}, Z = class {
	static Marketplace = se;
	static ItemBuilder = ce;
	constructor() {}
	init() {
		console.log("SR5 Marketplace | MarketplaceAPI Initialized.");
	}
}, le = class {
	constructor() {
		this.tests = [], this.ActionFlow = null, this.documentTypes = null, this.config = null, this.compendiums_l = {}, this.itemTypes_l = {}, this.attributes_l = {}, this.limits_l = {}, this.specialTypes_l = {}, this.damageTypes_l = {}, this.biofeedbackOptions_l = {}, this.weaponRangeCategories_l = {}, this.elementTypes_l = {}, this.spellCategories_l = {}, this.spellTypes_l = {}, this.spellRanges_l = {}, this.combatSpellTypes_l = {}, this.detectionSpellTypes_l = {}, this.illusionSpellTypes_l = {}, this.illusionSpellSenses_l = {}, this.attributeRolls_l = {}, this.matrixTargets_l = {}, this.gridCategories_l = {}, this.durations_l = {}, this.weaponCategories_l = {}, this.weaponCliptypes_l = {}, this.weaponRanges_l = {}, this.qualityTypes_l = {}, this.adeptPower_l = {}, this.deviceCategories_l = {}, this.cyberwareGrades_l = {}, this.knowledgeSkillCategories_l = {}, this.activeSkills_l = {}, this.actionTypes_l = {}, this.actionCategories_l = {}, this.matrixAttributes_l = {}, this.initiativeCategories_l = {}, this.modificationTypes_l = {}, this.mountPoints_l = {}, this.modificationCategories_l = {}, this.lifestyleTypes_l = {}, this.actorModifiers_l = {}, this.modifierTypes_l = {}, this.programTypes_l = {}, this.spiritTypes_l = {}, this.critterPower_l = {}, this.spriteTypes_l = {}, this.spritePower_l = {}, this.vehicle_l = {}, this.ic_l = {}, this.character_l = {}, this.rangeWeaponModeLabel_l = {}, this.wirelessModes_l = {}, this.effectApplyTo_l = {};
	}
	async init() {
		if (game.system.id !== "shadowrun5e") {
			ui.notifications.error("SR5 Marketplace requires the Shadowrun 5e system to be active.");
			return;
		}
		this.config = CONFIG.SR5, this.ActionFlow = game.shadowrun5e?.ActionFlow, this.documentTypes = game.system.documentTypes;
		let e = game.shadowrun5e?.tests;
		if (e && (this.tests = Object.values(e).map((e) => ({
			id: e.name,
			value: game.i18n.localize(e.label)
		}))), !this.config) {
			console.error("SR5 Marketplace | CONFIG.SR5 was not found. Cannot initialize system API.");
			return;
		}
		for (let e in this.config) if (Object.hasOwnProperty.call(this.config, e)) {
			let t = `${e}_l`;
			Object.hasOwnProperty.call(this, t) && (this[t] = this._localizeObject(this.config[e]));
		}
	}
	_localizeObject(e) {
		if (typeof e == "string") return game.i18n.localize(e) || e;
		if (Array.isArray(e)) return e.map((e) => this._localizeObject(e));
		if (typeof e == "object" && e) {
			let t = {};
			for (let [n, r] of Object.entries(e)) t[n] = this._localizeObject(r);
			return t;
		}
		return e;
	}
	getLocalizationMapForKey(e) {
		switch (e) {
			case "skills": return this.activeSkills_l;
			case "matrix": return this.matrixAttributes_l;
			case "modifiers": return this.modifierTypes_l;
			case "physical_track":
			case "stun_track":
			case "wounds": return this.actorModifiers_l;
			default: return this[`${e}_l`] || {};
		}
	}
}, ue = () => {
	Handlebars.registerHelper("hasItemType", function(e, t) {
		let n = game.sr5marketplace.api.itemData;
		return n.itemsByType[e] && n.itemsByType[e].length > 0 ? (console.log(`Type found: ${e}`), t.fn(this)) : (console.log(`Type not found: ${e}`), t.inverse(this));
	}), Handlebars.registerHelper("capitalize", function(e) {
		return typeof e != "string" || !e ? "" : e.charAt(0).toUpperCase() + e.slice(1);
	}), Handlebars.registerHelper("hasKeys", function(e, t) {
		return e && Object.keys(e).length > 0 ? t.fn(this) : t.inverse(this);
	}), Handlebars.registerHelper("for", function(e, t, n) {
		let r = "";
		for (let i = e; i < t; i += 1) r += n.fn(i);
		return r;
	}), Handlebars.registerHelper("getTechnologyCost", function(e) {
		return e?.system?.technology?.cost || 0;
	}), Handlebars.registerHelper("getKarma", function(e) {
		return e?.system?.karma || e?.flags?.sr5 - marketplace?.karma || 0;
	}), Handlebars.registerHelper("getAvailability", function(e) {
		return e?.system?.technology?.availability || "Unknown";
	}), Handlebars.registerHelper("getEssence", function(e) {
		return e?.system?.essence || 0;
	}), Handlebars.registerHelper("getField", function(e, t) {
		return e?.system?.[t] || "";
	}), Handlebars.registerHelper("range", function(e, t, n) {
		let r = "";
		for (let i = e; i <= t; i++) r += n.fn(i);
		return r;
	}), Handlebars.registerHelper("hasprop", function(e, t, n) {
		return e.hasOwnProperty(t) ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("ifin", function(e, t, n) {
		return t.includes(e) ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("ifgt", function(e, t, n) {
		return e > t ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("iflt", function(e, t, n) {
		return e < t ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("iflte", function(e, t, n) {
		return e <= t ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("ifne", function(e, t, n) {
		return e === t ? n.inverse(this) : n.fn(this);
	}), Handlebars.registerHelper("ife", function(e, t, n) {
		return e === t ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("ift", function(e, t) {
		if (e) return t;
	}), Handlebars.registerHelper("sum", function(e, t) {
		return e + t;
	}), Handlebars.registerHelper("range", function(e, t, n) {
		let r = "";
		for (let i = e; i < t; i++) r += n.fn(i);
		return r;
	}), Handlebars.registerHelper("ifeq", function(e, t, n) {
		return e === t ? n.fn(this) : n.inverse(this);
	}), Handlebars.registerHelper("toLowerCase", function(e) {
		return e ? e.toLowerCase() : "";
	}), Handlebars.registerHelper("eq", function(e, t) {
		return e === t;
	}), Handlebars.registerHelper("neq", function(e, t) {
		return e !== t;
	}), Handlebars.registerHelper("capitalizeFirst", function(e) {
		return typeof e != "string" || !e ? "" : e.charAt(0).toUpperCase() + e.slice(1);
	}), Handlebars.registerHelper("jsonParse", function(e) {
		try {
			return JSON.parse(e);
		} catch {
			return console.error("Failed to parse JSON string in Handlebars:", e), {};
		}
	}), Handlebars.registerHelper("isModifierActive", function(e, t) {
		return Array.isArray(t) ? t.some((t) => t.label === e) : !1;
	}), Handlebars.registerHelper("loc", function(e, t) {
		return game.i18n.format(e, t.hash);
	}), Handlebars.registerHelper("invert", (e) => {
		if (typeof e != "object" || !e) return {};
		let t = {};
		for (let n in e) Object.hasOwn(e, n) && (t[e[n]] = n);
		return t;
	}), Handlebars.registerHelper("isIdIn", function(e, t) {
		return Array.isArray(e) ? e.some((e) => e.id === t) : !1;
	});
}, Q = () => {
	console.log("SR5 Marketplace | Registering templates and helpers..."), ue(), foundry.applications.handlebars.loadTemplates([
		"modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html",
		"modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html",
		"modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/marketplaceUserActor.html",
		"modules/sr5-marketplace/templates/documents/items/libraryItem.html",
		"modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html",
		"modules/sr5-marketplace/templates/apps/marketplace-settings/marketplace-settings.html",
		"modules/sr5-marketplace/templates/apps/marketplace-settings/partials/settings-card.html",
		"modules/sr5-marketplace/templates/documents/actor/partials/shop-header.html",
		"modules/sr5-marketplace/templates/documents/actor/partials/shop-skills.html",
		"modules/sr5-marketplace/templates/documents/actor/partials/shop-inventory.html",
		"modules/sr5-marketplace/templates/documents/items/itemPreviewApp/item-preview.html",
		"modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/AvailabilityDialog.html",
		"modules/sr5-marketplace/templates/apps/itemBuilder/partials/Builder.html",
		"modules/sr5-marketplace/templates/apps/itemBuilder/partials/ItemDetails.html",
		"modules/sr5-marketplace/templates/apps/itemBuilder/partials/multi-select.html"
	]);
}, de = () => {
	console.log("SR5 Marketplace | Initializing settings..."), game.settings.register("sr5-marketplace", "resetItemLoad", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ResetItemLoad.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ResetItemLoad.hint"),
		scope: "world",
		config: !1,
		type: Boolean,
		default: !1,
		restricted: !0,
		onChange: (e) => {
			console.log(`Reset Item Load setting changed: ${e}`), window.location.reload();
		}
	}), game.settings.register("sr5-marketplace", "approvalWorkflow", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ApprovalWorkflow.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ApprovalWorkflow.hint"),
		scope: "world",
		config: !0,
		type: Boolean,
		default: !0,
		restricted: !0
	}), game.settings.register("sr5-marketplace", "karmaCostForSpell", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaSpell.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaSpell.hint"),
		scope: "world",
		config: !0,
		type: Number,
		default: 5,
		restricted: !0
	}), game.settings.register("sr5-marketplace", "karmaCostForComplexForm", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaComplexForm.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaComplexForm.hint"),
		scope: "world",
		config: !0,
		type: Number,
		default: 5,
		restricted: !0
	}), game.settings.register("sr5-marketplace", "itemTypeBehaviors", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ItemTypeBehaviors.name"),
		scope: "world",
		config: !1,
		type: Object,
		default: {}
	}), game.settings.register("sr5-marketplace", "openSettingsMenu", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.Menu.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.Menu.hint"),
		scope: "world",
		config: !0,
		restricted: !0,
		type: Object,
		default: {
			armor: "single",
			ammo: "stack",
			action: "unique",
			adept_power: "unique",
			complex_form: "unique",
			critter_power: "unique",
			cyberware: "unique",
			echo: "unique",
			modification: "stack",
			quality: "unique",
			spell: "unique",
			sprite_power: "unique"
		}
	}), game.settings.register("sr5-marketplace", "availabilityTestRule", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.hint"),
		scope: "world",
		config: !0,
		restricted: !0,
		type: String,
		choices: {
			opposed: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.choices.opposed"),
			simple: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.choices.simple"),
			extended: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.choices.extended")
		},
		default: "opposed"
	}), game.settings.register("sr5-marketplace", "itemBuilder.ignoreMountRestrictions", {
		name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.mountRestrictions.name"),
		hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.mountRestrictions.hint"),
		scope: "world",
		config: !0,
		restricted: !0,
		type: Boolean,
		default: !1
	}), game.settings.register("sr5-marketplace", "itemBuilder.enableForGM", {
		name: "SR5Marketplace.Marketplace.Settings.ItemBuilder.enableForGM.name",
		hint: "SR5Marketplace.Marketplace.Settings.ItemBuilder.enableForGM.hint",
		scope: "world",
		config: !0,
		restricted: !0,
		type: Boolean,
		default: !0,
		onChange: () => {
			ui.controls && ui.controls.render(!0);
		}
	});
};
Hooks.on("renderSettingsConfig", (e, t, n) => {
	let r = t.querySelector("[name=\"sr5-marketplace.openSettingsMenu\"]");
	if (!r) return;
	let i = r.closest(".form-group");
	if (!i) return;
	let a = i.querySelector(".form-fields");
	if (!a) return;
	r.style.display = "none";
	let o = "sr5-marketplace-settings-button";
	if (!a.querySelector(`.${o}`)) {
		let e = document.createElement("button");
		e.type = "button", e.classList.add(o), e.innerHTML = `<i class="fas fa-cogs"></i> ${game.i18n.localize("SR5Marketplace.Marketplace.Settings.Menu.buttonLabel")}`, e.addEventListener("click", () => {
			new O().render(!0);
		}), a.appendChild(e);
	}
	let s = i.parentElement.querySelector(".behavior-summary");
	s && s.remove();
	let c = game.sr5marketplace.api.itemData.getItems(), l = [...new Set(c.map((e) => e.type))].sort(), u = game.settings.get("sr5-marketplace", "itemTypeBehaviors");
	if (l.length > 0) {
		let e = document.createElement("div");
		e.classList.add("behavior-summary");
		for (let t of l) {
			if (["base"].includes(t)) continue;
			let n = u[t] || "single", r = document.createElement("span");
			switch (r.classList.add("behavior-tag", n), r.textContent = t, n) {
				case "unique":
					r.title = game.i18n.localize("SR5Marketplace.Marketplace.Settings.CategoryUnique");
					break;
				case "stack":
					r.title = game.i18n.localize("SR5Marketplace.Marketplace.Settings.StackingItems");
					break;
				case "single":
					r.title = game.i18n.localize("SR5Marketplace.Marketplace.Settings.SingleItems");
					break;
			}
			e.appendChild(r);
		}
		i.after(e);
	}
}), Hooks.once("init", () => {
	console.log("SR5 Marketplace | Initializing module..."), Q(), de(), ie(), foundry.documents.collections.Actors.registerSheet("sr5-marketplace", re, {
		types: [o],
		makeDefault: !0,
		label: "SR5Marketplace.Marketplace.Shop.SheetName"
	}), game.sr5marketplace = new Z(), game.sr5marketplace.api = {
		system: new le(),
		itemData: new n(),
		marketplace: new Z.Marketplace(),
		itemBuilder: new Z.ItemBuilder()
	};
}), Hooks.on("ready", async () => {
	console.log("SR5 Marketplace | Module is ready!"), await game.sr5marketplace.init(), await game.sr5marketplace.api.system.init(), await game.sr5marketplace.api.itemData.initialize(), await game.sr5marketplace.api.marketplace.init(), await game.sr5marketplace.api.itemBuilder.init(), game.user.isGM && (game.socket.on("module.sr5-marketplace", () => {
		setTimeout(() => {
			ui.controls && ui.controls.render(!0);
		}, 250);
	}), setTimeout(() => {
		ui.controls && ui.controls.render(!0);
	}, 1e3)), (await import("./tests-BZYd-mUe.js")).registerTests();
}), Hooks.on("updateUser", (e, t) => {
	game.user.isGM && foundry.utils.hasProperty(t, "flags.sr5-marketplace.basket") && setTimeout(() => {
		ui.controls && ui.controls.render(!0);
	}, 250);
}), Hooks.on("getSceneControlButtons", (e) => {
	let t = e.tokens;
	t && (t.tools["sr5-marketplace"] || (t.tools["sr5-marketplace"] = {
		name: "sr5-marketplace",
		title: game.i18n.localize("SR5Marketplace.PurchaseScreen"),
		icon: "fas fa-shopping-cart",
		visible: !0,
		toggle: !0,
		active: !!foundry.applications.instances.get("inGameMarketplace"),
		onChange: (e) => {
			let t = foundry.applications.instances.get("inGameMarketplace");
			e ? t || new E().render(!0) : t && t.close();
		}
	}));
}), Hooks.on("getSceneControlButtons", (e) => {
	let t = e.tokens;
	if (!t) return;
	let n = game.user.isGM, r = game.settings.get("sr5-marketplace", "itemBuilder.enableForGM"), i = n && r;
	t.tools.itemBuilder = {
		name: "itemBuilder",
		title: "Open Item Builder",
		icon: "fas fa-wrench",
		visible: i,
		toggle: !0,
		active: !!foundry.applications.instances.get("itemBuilder"),
		onChange: (e) => {
			let t = foundry.applications.instances.get("itemBuilder");
			e ? t || new I().render(!0) : t && t.close();
		}
	};
}), Hooks.on("canvasReady", () => {
	canvas.marketplaceListenerAttached || (canvas.app.view.addEventListener("dblclick", (e) => {
		if (game.activeTool !== "select") return;
		let t = canvas.tokens.hover;
		t?.actor?.type === "sr5-marketplace.shop" && (e.preventDefault(), e.stopPropagation(), console.log(`Marketplace | Intercepted double-click on Shop Actor: ${t.name}`), new E({ shopActorUuid: t.actor.uuid }).render(!0));
	}), canvas.marketplaceListenerAttached = !0, console.log("Marketplace | Double-click listener for shops is now active."));
}), Hooks.once("ready", () => {
	game.sr5marketplace = game.sr5marketplace || {}, game.sr5marketplace.debug = { mapAllSystemKeys: () => {
		console.log("--- 🚀 Running Full System Key Mapper ---");
		try {
			console.log("--- All Mappable Actor Keys ---");
			let e = SystemDataMapperService.getAllMappableActorKeys();
			console.log(e), console.log("--- All Mappable Item Keys ---");
			let t = SystemDataMapperService.getAllMappableItemKeys();
			console.log(t), console.log("--- ✅ Mapping Complete ---");
		} catch (e) {
			console.error("❌ Failed to run the SystemDataMapperService.", e);
		}
	} };
});
//#endregion
