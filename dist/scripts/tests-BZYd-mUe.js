//#region scripts/services/dialogList.mjs
var e = class {
	_list;
	constructor(e = []) {
		this._list = Array.isArray(e) ? e : [];
	}
	addPart(e, t) {
		this._list.push({
			name: e,
			value: t
		});
	}
	clear() {
		this._list.length = 0;
	}
}, t = class t extends game.shadowrun5e.tests.SuccessTest {
	constructor(e, t, n) {
		super(e, t, n), this.contactItem = null;
	}
	_prepareData(e, t) {
		return e = super._prepareData(e, t), e.action = e.action || game.shadowrun5e.data.createData("action_roll"), e.opposed = e.action.opposed, e.action.categories = ["social"], e.action.modifiers = e.action.modifiers || 0, e.availabilityStr = e.action.availabilityStr || "", e.selectedSkill = e.action.skill || "negotiation", e.selectedAttribute = e.action.attribute || "charisma", e.dialogId = e.action.dialogId, e.connectionUuid = e.action.connectionUuid, e;
	}
	async populateDocuments() {
		await super.populateDocuments(), this.data.connectionUuid && (this.contactItem = await fromUuid(this.data.connectionUuid));
	}
	prepareBaseValues() {
		if (super.prepareBaseValues(), !this.actor) return;
		let t = game.settings.get("sr5-marketplace", "availabilityTestRule"), n = this.data.selectedSkill, r = this.data.selectedAttribute, i = this.actor.system.skills.active[n], a = this.actor.system.attributes[r], o = this.data.action.modifiers || [], s = this.constructor.parseAvailability(this.data.availabilityStr);
		if (!i || !a) {
			console.error(`Marketplace | Actor is missing required skill ('${n}') or attribute ('${r}').`);
			return;
		}
		let c = new e(this.data.pool.mod);
		c.clear();
		let l = game.i18n.localize(CONFIG.SR5.activeSkills[n]), u = game.i18n.localize(`FIELDS.attributes.${r}.label`);
		switch (this.data.limit.base = this.actor.system.limits.social.value, t) {
			case "simple":
			case "extended":
				console.log(`Marketplace | Configuring for ${t.charAt(0).toUpperCase() + t.slice(1)} Test Rule`), this.data.threshold.base = s.rating, this.data.opposed = void 0, this.data.extended = t === "extended", c.addPart(l, i.value), c.addPart(u, a.value), o.forEach((e) => c.addPart(e.label, e.value)), this.contactItem && (c.addPart(game.i18n.localize("SR5.Connection"), this.contactItem.system.connection), c.addPart(game.i18n.localize("SR5.Loyalty"), this.contactItem.system.loyalty));
				break;
			default:
				console.log("Marketplace | Configuring for Opposed Test Rule (Core)"), this.data.threshold.base = 0, this.data.extended = !1, c.addPart(l, i.value), c.addPart(u, a.value), o.forEach((e) => c.addPart(e.label, e.value)), this.contactItem && c.addPart(game.i18n.localize("SR5.Connection"), this.contactItem.system.connection);
				break;
		}
		this.data.pool.base = 0;
	}
	get success() {
		return game.settings.get("sr5-marketplace", "availabilityTestRule") === "extended" ? this.extendedHits().value >= this.threshold.value : super.success;
	}
	get failure() {
		return game.settings.get("sr5-marketplace", "availabilityTestRule") === "extended" ? this.pool.value <= 0 && !this.success : super.failure;
	}
	calculateNetHits() {
		let e = game.settings.get("sr5-marketplace", "availabilityTestRule"), n;
		n = e === "extended" ? this.extendedHits() : this.hits;
		let r = this.hasThreshold ? Math.max(n.value - this.threshold.value, 0) : n.value, i = game.shadowrun5e.data.createData("value_field", {
			label: "SR5.NetHits",
			base: r
		});
		return i.value = t.calcTotal(i, { min: 0 }), i;
	}
	static calcTotal(e, t = {}) {
		if (e.override) {
			let n = e.override.value;
			return t.min !== void 0 && (n = Math.max(n, t.min)), t.max !== void 0 && (n = Math.min(n, t.max)), n;
		}
		let n = e.base || 0;
		return Array.isArray(e.mod) && (n += e.mod.reduce((e, t) => e + (t.value || 0), 0)), n += e.temp || 0, t.min !== void 0 && (n = Math.max(n, t.min)), t.max !== void 0 && (n = Math.min(n, t.max)), Math.ceil(n);
	}
	async afterTestComplete() {
		console.debug(`SR5 Marketplace | Test ${this.constructor.name} completed. Custom afterTestComplete is preventing automatic extension.`), this.success ? await this.processSuccess() : await this.processFailure(), this.autoExecuteFollowupTest && await this.executeFollowUpTest();
	}
	get _dialogTemplate() {
		return "modules/sr5-marketplace/templates/documents/tests/availabilitySimple-test-dialog.html";
	}
	static get label() {
		return "SR5Marketplace.Marketplace.Tests.AvailabilityTest";
	}
	static parseAvailability(e) {
		let t = String(e ?? "").trim().match(/^(\d+)\s*([A-Za-z]*)$/);
		return {
			rating: t ? Number(t[1]) : 0,
			tag: t && t[2] ? t[2].toUpperCase() : ""
		};
	}
	static async run(e, t = {}, n = {}) {
		let r = typeof e == "string" ? await fromUuid(e) : e;
		if (!r) throw Error("AvailabilityTest: actor not found");
		let i = {}, a = {
			...n,
			availability: t.availabilityStr
		};
		n.isAppCall ? (i.action = {
			skill: t.skill,
			attribute: t.attribute,
			modifiers: t.modifiers,
			categories: ["social"]
		}, a.showDialog = !1, a.showMessage = !1) : (a.showDialog = !0, a.showMessage = !0);
		let o = new this(i, { actor: r }, a);
		return await o.execute(), o;
	}
	static async runForApp(e, t = {}) {
		let n = await fromUuid(e);
		if (!n) return console.error("AvailabilityTest.runForApp | Actor not found."), null;
		let r = {
			test: "AvailabilityTest",
			skill: t.skill || "negotiation",
			attribute: t.attribute || "charisma",
			modifiers: t.modifiers || [],
			limit: { attribute: "social" },
			availabilityStr: t.availabilityStr || "",
			opposed: { test: "AvailabilityResist" },
			categories: ["social"]
		}, i = new this({ action: r }, { actor: n }, {
			showDialog: !1,
			showMessage: !1
		});
		return i ? (await i.execute(), i.result.toJSON()) : null;
	}
}, n = class extends game.shadowrun5e.tests.OpposedTest {
	constructor(e, t, n) {
		super(e, t, n);
	}
	static prepareData(e, t) {
		super.prepareData(e, t);
		let n = againstData.availabilityStr || "", r = AvailabilityTest.parseAvailability(n);
		console.log(r);
		let i = againstData.values.netHits.value, a = r.rating;
		return {
			against: againstData,
			previousMessageId,
			pool: game.shadowrun5e.data.createData("value_field", { base: a }),
			limit: game.shadowrun5e.data.createData("value_field", { base: 0 }),
			threshold: game.shadowrun5e.data.createData("value_field", { base: i }),
			action: game.shadowrun5e.data.createData("action_roll"),
			values: {},
			title: `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`
		};
	}
	get title() {
		return `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`;
	}
	get _dialogTemplate() {
		return "modules/sr5-marketplace/templates/documents/tests/availabilityResist-test-dialog.html";
	}
	static get label() {
		return "SR5.Marketplace.Tests.AvailabilityTest";
	}
}, r = class extends Error {};
function i(e, t = ["activeTests"]) {
	if (console.debug("SR5 Marketplace | Registering test", e), game.shadowrun5e.tests[e.name]) throw new r(`Test ${e.name} already exists`);
	game.shadowrun5e.tests[e.name] = e;
	for (let n of t) {
		if (game.shadowrun5e[n][e.name]) throw new r(`Test ${e.name} already exists as ${n}`);
		game.shadowrun5e[n][e.name] = e;
	}
}
function a() {
	console.debug("SR5 Marketplace | Registering tests");
	try {
		i(t), i(n);
	} catch (e) {
		ui.notifications.error("SR5 Marketplace | Module failed to register test implementation with Shadowrun5e system. This makes the module incompatible until it is updated."), console.error("SR5 Marketplace | Module failed to register test implementation with Shadowrun5e system.", e);
	}
}
//#endregion
export { a as registerTests };
