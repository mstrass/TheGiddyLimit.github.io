"use strict";

class MakeCards extends BaseComponent {
	static async pInit () {
		MakeCards._ = new MakeCards();
		await MakeCards.utils.pLoadReducedData();
		await MakeCards._.pInit();
	}

	constructor () {
		super();

		this._list = null;

		this._pageFilterItems = new PageFilterItems();
		this._pageFilterBestiary = new PageFilterBestiary();
		this._pageFilterSpells = new PageFilterSpells();

		this._doSaveStateDebounced = MiscUtil.debounce(() => this._pDoSaveState(), 50);
	}

	async pInit () {
		await SearchUiUtil.pDoGlobalInit();
		// Do this asynchronously, to avoid blocking the load
		SearchWidget.pDoGlobalInit();
		await this._pDoLoadState();
		this.render();
	}

	render () {
		this._addHookAll("state", () => this._doSaveStateDebounced());

		this._render_configSection();
		this._render_cardList();
	}

	_render_configSection () {
		const $wrpConfig = $(`#wrp_config`).empty();

		$(`<h5>New Card Defaults</h5>`).appendTo($wrpConfig);
		$(`<div class="flex-v-center bold">
			<div class="col-4 text-center pr-2">Type</div>
			<div class="col-4 text-center p-2">Color</div>
			<div class="col-4 text-center pl-2">Icon</div>
		</div>`).appendTo($wrpConfig);

		const $getColorIconConfigRow = (entityType) => {
			const entityMeta = MakeCards._AVAILABLE_TYPES[entityType];

			const kColor = `color_${entityType}`;
			const kIcon = `icon_${entityType}`;
			const $iptColor = ComponentUiUtil.$getIptColor(this, kColor).addClass("cards-cfg__ipt-color");
			const $dispIcon = $(`<div class="cards__disp-btn-icon"/>`);
			const $btnChooseIcon = $$`<button class="btn btn-xs btn-default cards__btn-choose-icon">${$dispIcon}</button>`
				.click(async () => {
					const icon = await MakeCards._pGetUserIcon(this._state[kIcon]);
					if (icon) this._state[kIcon] = icon;
				});
			const hkIcon = () => $dispIcon.css("background-image", `url('${MakeCards._getIconPath(this._state[kIcon])}')`);
			this._addHookBase(kIcon, hkIcon);
			hkIcon();

			return $$`<div class="flex-v-center stripe-even m-1">
				<div class="col-4 flex-vh-center pr-2">${entityMeta.searchTitle}</div>
				<div class="col-4 flex-vh-center p-2">${$iptColor}</div>
				<div class="col-4 flex-vh-center pl-2">${$btnChooseIcon}</div>
			</div>`;
		};

		Object.keys(MakeCards._AVAILABLE_TYPES).forEach(it => $getColorIconConfigRow(it).appendTo($wrpConfig))
	}

	_render_cardList () {
		const $wrpContainer = $(`#wrp_main`).empty();

		// region Search bar/add button
		const contextIdSearch = ContextUtil.getNextGenericMenuId();
		const _CONTEXT_OPTIONS = this._render_getContextMenuOptions();
		ContextUtil.doInitContextMenu(contextIdSearch, (evt, ele, $invokedOn, $selectedMenu) => {
			const val = Number($selectedMenu.data("ctx-id"));
			_CONTEXT_OPTIONS.filter(Boolean)[val].action(evt, $invokedOn);
		}, _CONTEXT_OPTIONS.map(it => it ? it.name : null));

		const $iptSearch = $(`<input type="search" class="form-control mr-2" placeholder="Search cards...">`);
		const $btnAdd = $(`<button class="btn btn-primary mr-2">Add <span class="glyphicon glyphicon-plus"/></button>`)
			.click(evt => ContextUtil.handleOpenContextMenu(evt, $btnAdd, contextIdSearch));
		const $btnReset = $(`<button class="btn btn-danger mr-2">Reset <span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				if (!confirm("Are you sure?")) return;
				this._list.removeAllItems();
				this._list.update();
				this._doSaveStateDebounced();
			});
		const $btnExport = $(`<button class="btn btn-default">Export JSON <span class="glyphicon glyphicon-download"/></button>`)
			.click(() => {
				const toDownload = this._list.items.map(it => {
					const entityMeta = MakeCards._AVAILABLE_TYPES[it.values.entityType];
					return {
						count: it.values.count,
						color: it.values.color,
						title: it.name,
						icon: it.values.icon,
						icon_back: it.values.icon,
						contents: entityMeta.fnGetContents(it.values.entity),
						tags: entityMeta.fnGetTags(it.values.entity)
					}
				});
				DataUtil.userDownload("rpg-cards", toDownload);
			});
		$$`<div class="w-100 no-shrink flex-v-center mb-3">${$iptSearch}${$btnAdd}${$btnReset}${$btnExport}</div>`.appendTo($wrpContainer);
		// endregion

		// region Mass operations bar
		const getSelCards = () => {
			const out = this._list.visibleItems.filter(it => it.data.$cbSel.prop("checked"));
			if (!out.length) {
				JqueryUtil.doToast({content: "Please select some cards first!", type: "warning"});
				return null;
			}
			return out;
		};

		const contextIdMass = ContextUtil.getNextGenericMenuId();
		const _CONTEXT_OPTIONS_MASS = [
			{
				name: "Set Color",
				action: async () => {
					const sel = getSelCards();
					if (!sel) return;
					const rgb = await InputUiUtil.pGetUserColor({default: MiscUtil.randomColor()});
					if (rgb) sel.forEach(it => it.data.setColor(rgb));
				}
			},
			{
				name: "Set Icon",
				action: async () => {
					const sel = getSelCards();
					if (!sel) return;
					const icon = await MakeCards._pGetUserIcon();
					if (icon) sel.forEach(it => it.data.setIcon(icon));
				}
			},
			{
				name: "Remove",
				action: async () => {
					const sel = getSelCards();
					if (!sel) return;
					sel.forEach(it => this._list.removeItem(it.ix));
					this._list.update();
					this._doSaveStateDebounced();
				}
			}
		];
		ContextUtil.doInitContextMenu(contextIdMass, (evt, ele, $invokedOn, $selectedMenu) => {
			const val = Number($selectedMenu.data("ctx-id"));
			_CONTEXT_OPTIONS_MASS.filter(Boolean)[val].action(evt, $invokedOn);
		}, _CONTEXT_OPTIONS_MASS.map(it => it ? it.name : null));
		const $btnMass = $(`<button class="btn btn-xs btn-default" title="Carry out actions on selected cards">Mass...</button>`)
			.click(evt => ContextUtil.handleOpenContextMenu(evt, $btnMass, contextIdMass));
		$$`<div class="w-100 no-shrink flex-v-center mb-2">${$btnMass}</div>`.appendTo($wrpContainer);
		// endregion

		// region Main content
		// Headers
		const $cbSelAll = $(`<input type="checkbox" title="Select All">`)
			.click(() => {
				const isSel = $cbSelAll.prop("checked");
				this._list.visibleItems.forEach(it => it.data.$cbSel.prop("checked", isSel));
			});
		$$`<div class="w-100 no-shrink flex-v-center bold">
			<div class="col-1 mr-2 flex-vh-center">${$cbSelAll}</div>
			<div class="col-3 mr-2 flex-vh-center">Name</div>
			<div class="col-1-5 mr-2 flex-vh-center">Source</div>
			<div class="col-1-5 mr-2 flex-vh-center">Type</div>
			<div class="col-1-1 mr-2 flex-vh-center">Color</div>
			<div class="col-1-1 mr-2 flex-vh-center">Icon</div>
			<div class="col-1 mr-2 flex-vh-center">Count</div>
			<div class="col-1-1 flex-v-center flex-h-right"/>
		</div>`.appendTo($wrpContainer);

		const $wrpList = $(`<div class="w-100 h-100"/>`);
		$$`<div class="flex-col h-100 w-100 overflow-y-auto mt-2 overflow-x-hidden">${$wrpList}</div>`.appendTo($wrpContainer);

		this._list = new List({$iptSearch, $wrpList, isUseJquery: true});
		this._list.init();
		// endregion
	}

	_render_getContextMenuOptions () {
		return [
			...this._render_getContextMenuOptionsSearch(),
			null,
			...this._render_getContextMenuOptionsFilter(),
			null,
			...this._render_getContextMenuOptionsSublist()
		];
	}

	_render_getContextMenuOptionsSearch () {
		return Object.entries(MakeCards._AVAILABLE_TYPES).map(([entityType, it]) => ({
			name: `Search for ${it.searchTitle}`,
			action: async () => {
				const fromSearch = await it.pFnSearch();
				if (!fromSearch) return;

				const existing = this._list.items.find(it => it.values.page === fromSearch.page && it.values.source === fromSearch.source && it.values.hash === fromSearch.hash);
				if (existing) {
					existing.values.count++;
					existing.data.$iptCount.val(existing.values.count);
					return this._doSaveStateDebounced();
				}

				const listItem = await this._pGetListItem({page: fromSearch.page, source: fromSearch.source, hash: fromSearch.hash, entityType}, true);
				this._list.addItem(listItem);
				this._list.update();
				this._doSaveStateDebounced();
			}
		}));
	}

	_render_getContextMenuOptionsFilter () {
		return Object.entries(MakeCards._AVAILABLE_TYPES).map(([entityType, type]) => ({
			name: `Filter for ${type.searchTitle}`,
			action: async () => {
				let $wrpModalInner;

				const {$modalInner, doClose} = UiUtil.getShowModal({
					fullHeight: true,
					title: `Filter/Search for ${type.searchTitle}`,
					cbClose: () => {
						$wrpModalInner.detach();
					},
					isLarge: true,
					zIndex: 999
				});

				if (type._filterCache) {
					$wrpModalInner = type._filterCache.$wrpModalInner.appendTo($modalInner);
				} else {
					const $ovlLoading = $(`<div class="w-100 h-100 flex-vh-center"><i class="dnd-font text-muted">Loading...</i></div>`).appendTo($modalInner);

					const $cbSelAll = $(`<input type="checkbox">`)
						.click(() => {
							const val = $cbSelAll.prop("checked");
							list.items.forEach(it => it.data.eleCb.checked = false);
							list.visibleItems.forEach(it => it.data.eleCb.checked = val);
						});
					const $iptSearch = $(`<input class="form-control" type="search" placeholder="Search...">`);
					const $btnReset = $(`<button class="btn btn-default">Reset</button>`);
					const $wrpFormTop = $$`<div class="flex input-group btn-group w-100 lst__form-top">${$iptSearch}${$btnReset}</div>`;
					const $wrpFormBottom = $(`<div class="w-100"/>`);
					const $wrpFormHeaders = $(`<div class="sortlabel lst__form-bottom"/>`);
					type.fnGetListHeaders().forEach($ele => $wrpFormHeaders.append($ele));
					const $wrpForm = $$`<div class="flex-col w-100">${$wrpFormTop}${$wrpFormBottom}${$wrpFormHeaders}</div>`;
					const $wrpList = $(`<ul class="list mb-2 h-100"/>`);

					const $btnConfirm = $(`<button class="btn btn-default">Confirm</button>`)
						.click(async () => {
							doClose();
							const checked = list.visibleItems.filter(it => it.data.eleCb.checked);
							const len = checked.length;
							// do this in serial to avoid bombarding the hover cache
							for (let i = 0; i < len; ++i) {
								const filterListItem = checked[i];
								const listItem = await this._pGetListItem({page: type.page, source: filterListItem.values.jsonSource, hash: filterListItem.values.hash, entityType}, true);
								this._list.addItem(listItem);
							}
							this._list.update();
							this._doSaveStateDebounced();
						});

					const list = new List({
						$iptSearch,
						$wrpList,
						fnSort: type.fnSort
					});

					SortUtil.initBtnSortHandlers($wrpFormHeaders, list);

					const allData = await type.pFnLoadAllData();
					const pageFilter = (() => {
						switch (entityType) {
							case "creature": return this._pageFilterBestiary;
							case "item": return this._pageFilterItems;
							case "spell": {
								this._pageFilterSpells.populateHomebrewClassLookup(BrewUtil.homebrew);
								return this._pageFilterSpells;
							}
							default: throw new Error(`Unhandled branch!`);
						}
					})();

					await pageFilter.pInitFilterBox({
						$wrpFormTop,
						$btnReset,
						$wrpMiniPills: $wrpFormBottom
					});

					allData.forEach((it, i) => {
						pageFilter.addToFilters(it);
						const filterListItem = type.fnGetListItem(pageFilter, it, i);
						list.addItem(filterListItem);
					});

					list.init();
					list.update();

					const handleFilterChange = () => {
						const f = pageFilter.filterBox.getValues();
						list.filter(li => {
							const it = allData[li.ix];
							return pageFilter.toDisplay(f, it);
						});
					};

					$(pageFilter.filterBox).on(FilterBox.EVNT_VALCHANGE, handleFilterChange);
					pageFilter.filterBox.render();
					handleFilterChange();

					$ovlLoading.remove();

					$wrpModalInner = $$`<div class="flex-col h-100">
							<div class="flex mb-2">
								<label class="flex-h-center flex-v-bottom col-1 pl-0 no-shrink">${$cbSelAll}</label>
								${$wrpForm}
							</div>
							${$wrpList}
							<div class="flex-vh-center">${$btnConfirm}</div>
						</div>`.appendTo($modalInner);

					type._filterCache = {$wrpModalInner, pageFilter};
				}
			}
		}));
	}

	_render_getContextMenuOptionsSublist () {
		return Object.entries(MakeCards._AVAILABLE_TYPES).map(([entityType, type]) => ({
			name: `Load from ${type.pageTitle}${type.isPageTitleSkipSuffix ? "" : " Page"} Pinned List`,
			action: async () => {
				const storageKey = StorageUtil.getPageKey("sublist", type.page);
				const pinnedList = await StorageUtil.pGet(storageKey);

				if (!(pinnedList && pinnedList.items && pinnedList.items.length)) {
					return JqueryUtil.doToast({content: "Nothing to add! Please visit the page and add/pin some data first.", type: "warning"});
				}

				const listItems = await Promise.all(pinnedList.items.map(it => {
					const [_, source] = it.h.split(HASH_PART_SEP)[0].split(HASH_LIST_SEP);
					return this._pGetListItem({page: type.page, source, hash: it.h, entityType}, true);
				}));

				listItems.forEach(it => this._list.addItem(it));
				this._list.update();
				this._doSaveStateDebounced();
			}
		}))
	}

	_getStateForType (entityType) {
		const kColor = `color_${entityType}`;
		const kIcon = `icon_${entityType}`;
		const color = this._state[kColor];
		const icon = this._state[kIcon];
		return {color, icon};
	}

	async _pGetListItem (cardMeta, isNewCard) {
		const uid = CryptUtil.uid();

		if (isNewCard) {
			const {color, icon} = this._getStateForType(cardMeta.entityType);
			cardMeta.color = cardMeta.color || color;
			cardMeta.icon = cardMeta.icon || icon;
		}
		cardMeta.count = cardMeta.count || 1;

		const loaded = await Renderer.hover.pCacheAndGet(cardMeta.page, cardMeta.source, cardMeta.hash);

		const $cbSel = $(`<input type="checkbox">`);

		const $iptRgb = $(`<input type="color" class="form-control input-xs form-control--minimal">`)
			.val(cardMeta.color)
			.change(() => setColor($iptRgb.val()));
		const setColor = (rgb) => {
			$iptRgb.val(rgb);
			listItem.values.color = rgb;
			this._doSaveStateDebounced();
		};

		const $dispIcon = $(`<div class="cards__disp-btn-icon"/>`)
			.css("background-image", `url('${MakeCards._getIconPath(cardMeta.icon)}')`);
		const $btnIcon = $$`<button class="btn btn-default btn-xs cards__btn-choose-icon">${$dispIcon}</button>`
			.click(async () => {
				const icon = await MakeCards._pGetUserIcon();
				if (icon) setIcon(icon);
			});
		const setIcon = (icon) => {
			listItem.values.icon = icon;
			$dispIcon.css("background-image", `url('${MakeCards._getIconPath(icon)}')`);
			this._doSaveStateDebounced();
		};

		const $iptCount = $(`<input class="form-control form-control--minimal input-xs text-center">`)
			.change(() => {
				const asNum = UiUtil.strToInt($iptCount.val(), 1, {min: 1, fallbackOnNaN: 1});
				listItem.values.count = asNum;
				$iptCount.val(asNum);
				this._doSaveStateDebounced();
			})
			.val(cardMeta.count);

		const $btnCopy =  $(`<button class="btn btn-default btn-xs mr-2" title="Copy JSON (SHIFT to view JSON)"><span class="glyphicon glyphicon-copy"/></button>`)
			.click(async evt => {
				const entityMeta = MakeCards._AVAILABLE_TYPES[listItem.values.entityType];
				const toCopy = {
					count: listItem.values.count,
					color: listItem.values.color,
					title: listItem.name,
					icon: listItem.values.icon,
					icon_back: listItem.values.icon,
					contents: entityMeta.fnGetContents(listItem.values.entity),
					tags: entityMeta.fnGetTags(listItem.values.entity)
				};

				if (evt.shiftKey) {
					const $content = Renderer.hover.$getHoverContent_statsCode(toCopy);

					Renderer.hover.getShowWindow(
						$content,
						Renderer.hover.getWindowPositionFromEvent(evt),
						{
							title: `Card Data \u2014 ${listItem.name}`,
							isPermanent: true,
							isBookContent: true
						}
					);
				} else {
					await MiscUtil.pCopyTextToClipboard(JSON.stringify(toCopy, null, 2));
					JqueryUtil.showCopiedEffect($btnCopy, "Copied JSON!");
				}
			});
		const $btnDelete = $(`<button class="btn btn-danger btn-xs" title="Remove"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				this._list.removeItem(uid);
				this._list.update();
				this._doSaveStateDebounced();
			});

		const $ele = $$`<div class="flex-v-center my-1 w-100 lst--border">
			<label class="col-1 mr-2 flex-vh-center">${$cbSel}</label>
			<div class="col-3 mr-2 flex-v-center">${loaded.name}</div>
			<div class="col-1-5 mr-2 flex-vh-center ${Parser.sourceJsonToColor(loaded.source)}" title="${Parser.sourceJsonToFull(loaded.source)}" ${BrewUtil.sourceJsonToStyle(loaded.source)}>${Parser.sourceJsonToAbv(loaded.source)}</div>
			<div class="col-1-5 mr-2 flex-vh-center">${cardMeta.entityType.toTitleCase()}</div>
			<div class="col-1-1 mr-2 flex-vh-center">${$iptRgb}</div>
			<div class="col-1-1 mr-2 flex-vh-center">${$btnIcon}</div>
			<div class="col-1 mr-2 flex-vh-center">${$iptCount}</div>
			<div class="col-1-1 flex-v-center flex-h-right">${$btnCopy}${$btnDelete}</div>
		</div>`;

		const listItem = new ListItem(
			uid,
			$ele,
			loaded.name,
			{
				page: cardMeta.page,
				hash: cardMeta.hash,
				source: cardMeta.source,
				color: cardMeta.color,
				icon: cardMeta.icon,
				count: cardMeta.count,
				entityType: cardMeta.entityType,

				entity: loaded
			},
			{
				$cbSel,
				$iptCount,
				setColor,
				setIcon
			}
		);
		return listItem;
	}

	// region contents
	static _ct_subtitle (val) { return `subtitle | ${val}`; }
	static _ct_rule () { return `rule`; }
	static _ct_property (title, val) { return `property | ${title} | ${val}`; }
	static _ct_fill (size) { return `fill ${size}`; }
	static _ct_text (val) { return `text | ${val}`; }
	static _ct_section (val) { return `section | ${val}`; }
	static _ct_description (title, val) { return `description | ${title} | ${val}`; }
	static _ct_bullet (val) { return `bullet | ${val}`; }
	static _ct_boxes (count, size = 1.2) { return `boxes | ${count} | ${size}`; }
	static _ct_dndstats (...attrs) { return `dndstats | ${attrs.join(" | ")}`; }

	static _ct_htmlToText (html) {
		return $(`<div>${html}</div>`).text().trim();
	}
	static _ct_renderEntries (entries, depth = 0) {
		if (!entries || !entries.length) return [];

		return entries.map(ent => {
			const rendSub = ent.rendered || RendererCard.get().render(ent, depth);
			return rendSub.split("\n").filter(Boolean);
		}).flat();
	}

	static _getCardContents_creature (mon) {
		const renderer = RendererCard.get();
		const allTraits = Renderer.monster.getOrderedTraits(mon, renderer);

		return [
			this._ct_subtitle(Renderer.monster.getTypeAlignmentPart(mon)),
			this._ct_rule(),
			this._ct_property("Armor class", this._ct_htmlToText(Parser.acToFull(mon.ac))),
			this._ct_property("Hit points", this._ct_htmlToText(Renderer.monster.getRenderedHp(mon.hp))),
			this._ct_property("Speed", this._ct_htmlToText(Parser.getSpeedString(mon))),
			this._ct_rule(),
			this._ct_dndstats(...Parser.ABIL_ABVS.map(it => mon[it])),
			this._ct_rule(),
			mon.save ? this._ct_property("Saving Throws", this._ct_htmlToText(Renderer.monster.getSavesPart(mon))) : null,
			mon.skill ? this._ct_property("Skills", this._ct_htmlToText(Renderer.monster.getSkillsString(Renderer.get(), mon))) : null,
			mon.vulnerable ? this._ct_property("Damage Vulnerabilities", this._ct_htmlToText(Parser.monImmResToFull(mon.vulnerable))) : null,
			mon.resist ? this._ct_property("Damage Resistances", this._ct_htmlToText(Parser.monImmResToFull(mon.resist))) : null,
			mon.immune ? this._ct_property("Damage Immunities", this._ct_htmlToText(Parser.monImmResToFull(mon.immune))) : null,
			mon.conditionImmune ? this._ct_property("Condition Immunities", this._ct_htmlToText(Parser.monCondImmToFull(mon.conditionImmune))) : null,
			this._ct_property("Senses", this._ct_htmlToText(Renderer.monster.getSensesPart(mon))),
			this._ct_property("Languages", this._ct_htmlToText(Renderer.monster.getRenderedLanguages(mon.languages))),
			this._ct_property("Challenge", this._ct_htmlToText(Parser.monCrToFull(mon.cr))),
			this._ct_rule(),
			...(allTraits ? this._ct_renderEntries(allTraits, 2) : []),
			mon.action ? this._ct_section("Actions") : null,
			...(mon.action ? this._ct_renderEntries(mon.action, 2) : []),
			mon.reaction ? this._ct_section("Reactions") : null,
			...(mon.reaction ? this._ct_renderEntries(mon.reaction, 2) : []),
			mon.legendary ? this._ct_section("Legendary Actions") : null,
			mon.legendary ? this._ct_text(this._ct_htmlToText(Renderer.monster.getLegendaryActionIntro(mon))) : null,
			...(mon.legendary ? this._ct_renderEntries(mon.legendary, 2) : [])
		].filter(Boolean)
	}

	static _getCardContents_spell (sp) {
		const higherLevel = sp.entriesHigherLevel ? (() => {
			const ents = sp.entriesHigherLevel.length === 1 && sp.entriesHigherLevel[0].name && sp.entriesHigherLevel[0].name.toLowerCase() === "at higher levels"
				? sp.entriesHigherLevel[0].entries
				: sp.entriesHigherLevel;

			return [
				this._ct_section("At higher levels"),
				...this._ct_renderEntries(ents, 2)
			]
		})() : null;

		return [
			this._ct_subtitle(Parser.spLevelSchoolMetaToFull(sp.level, sp.school, sp.meta, sp.subschools)),
			this._ct_rule(),
			this._ct_property("Casting Time", Parser.spTimeListToFull(sp.time)),
			this._ct_property("Range", Parser.spRangeToFull(sp.range)),
			this._ct_property("Components", Parser.spComponentsToFull(sp.components, sp.level)),
			this._ct_property("Duration", Parser.spDurationToFull(sp.duration)),
			this._ct_rule(),
			...this._ct_renderEntries(sp.entries, 2),
			...(higherLevel || [])
		].filter(Boolean);
	}

	static _getCardContents_item (item) {
		MakeCards.utils.enhanceItemAlt(item);

		const [damage, damageType, propertiesTxt] = Renderer.item.getDamageAndPropertiesText(item);
		const ptValueWeight = [Parser.itemValueToFull(item), Parser.itemWeightToFull(item)].filter(Boolean).join(", ").uppercaseFirst();
		const ptDamageProperties = this._ct_htmlToText([damage, damageType, propertiesTxt].filter(Boolean).join(" "));

		const itemEntries = [];
		if (item._fullEntries || (item.entries && item.entries.length)) {
			itemEntries.push(...(item._fullEntries || item.entries));
		}

		if (item._fullAdditionalEntries || item.additionalEntries) {
			itemEntries.push(...(item._fullAdditionalEntries || item.additionalEntries));
		}

		return [
			this._ct_subtitle(Renderer.item.getTypeRarityAndAttunementText(item)),
			ptValueWeight || ptDamageProperties ? this._ct_rule() : null,
			ptValueWeight ? this._ct_text(ptValueWeight) : null,
			ptDamageProperties ? this._ct_text(ptDamageProperties) : null,
			itemEntries.length ? this._ct_rule() : null,
			...this._ct_renderEntries(itemEntries, 2),
			item.charges ? this._ct_boxes(item.charges) : null
		].filter(Boolean);
	}
	// endregion

	static _getIconPath (iconName) {
		if (class_icon_names.includes(iconName)) {
			return `https://raw.githubusercontent.com/crobi/rpg-cards/master/generator/img/classes/${iconName.split("-")[1]}.png`
		}
		return `https://raw.githubusercontent.com/crobi/rpg-cards/master/generator/img/${iconName}.png`
	}

	static _pGetUserIcon (initialVal) {
		return new Promise(resolve => {
			const $iptStr = $(`<input class="form-control mb-2">`)
				.keydown(async evt => {
					// prevent double-binding the return key if we have autocomplete enabled
					await MiscUtil.pDelay(17); // arbitrary delay to allow dropdown to render (~1000/60, i.e. 1 60 FPS frame)
					if ($modalInner.find(`.typeahead.dropdown-menu`).is(":visible")) return;
					// return key
					if (evt.which === 13) doClose(true);
					evt.stopPropagation();
				});

			if (initialVal) $iptStr.val(initialVal);

			$iptStr.typeahead({
				source: icon_names,
				items: '16',
				fnGetItemPrefix: (iconName) => {
					return `<span class="cards__disp-typeahead-icon mr-2" style="background-image: url('${MakeCards._getIconPath(iconName)}')"/> `;
				}
			});

			const $btnOk = $(`<button class="btn btn-default">Confirm</button>`)
				.click(() => doClose(true));
			const {$modalInner, doClose} = UiUtil.getShowModal({
				title: "Enter Icon",
				noMinHeight: true,
				cbClose: (isDataEntered) => {
					if (!isDataEntered) return resolve(null);
					const raw = $iptStr.val();
					if (!raw.trim()) return resolve(null);
					else return resolve(raw);
				}
			});
			$iptStr.appendTo($modalInner);
			$$`<div class="flex-vh-center">${$btnOk}</div>`.appendTo($modalInner);
			$iptStr.focus();
			$iptStr.select();
		});
	}

	// region persistence
	async _pDoSaveState () {
		const toSave = this.getSaveableState();
		await StorageUtil.pSetForPage(MakeCards._STORAGE_KEY, toSave);
	}

	async _pDoLoadState () {
		const toLoad = await StorageUtil.pGetForPage(MakeCards._STORAGE_KEY);
		if (toLoad != null) this.setStateFrom(toLoad);
	}

	getSaveableState () {
		return {
			state: this.getBaseSaveableState(),
			listItems: this._list.items.map(it => ({
				page: it.values.page,
				source: it.values.source,
				hash: it.values.hash,
				color: it.values.color,
				icon: it.values.icon,
				count: it.values.count,
				entityType: it.values.entityType
			}))
		};
	}

	setStateFrom (toLoad) {
		this.setBaseSaveableStateFrom(toLoad.state);
		Promise.all(toLoad.listItems.map(async toLoad => this._pGetListItem(toLoad)))
			.then(initialListItems => {
				if (initialListItems.length) {
					initialListItems.sort((a, b) => SortUtil.ascSortLower(a.name, b.name)).forEach(it => this._list.addItem(it));
					this._list.update();
				}
			});
	}
	// endregion

	_getDefaultState () {
		const cpy = MiscUtil.copy(MakeCards._DEFAULT_STATE);
		Object.entries(MakeCards._AVAILABLE_TYPES).forEach(([k, v]) => {
			const kColor = `color_${k}`;
			const kIcon = `icon_${k}`;
			cpy[kColor] = v.colorDefault || MakeCards._DEFAULT_STATE;
			cpy[kIcon] = v.iconDefault || MakeCards._ICON_DEFAULT;
		});
		return cpy;
	}

	static _$getFilterColumnHeaders (btnMeta) {
		return btnMeta.map((it, i) => $(`<button class="col-${it.width} ${i === 0 ? "pl-0" : i === btnMeta.length ? "pr-0" : ""} sort btn btn-default btn-xs" data-sort="${it.sort}" ${it.title ? `title="${it.title}"` : ""}>${it.text} <span class="caret_wrp"></span></button>`));
	}
}
MakeCards._DEFAULT_STATE = {

};
MakeCards._COLOR_DEFAULT = "#333333";
MakeCards._ICON_DEFAULT = "perspective-dice-six-faces-random";
MakeCards._STORAGE_KEY = "cardState";
MakeCards._AVAILABLE_TYPES = {
	creature: {
		searchTitle: "Creature",
		pageTitle: "Bestiary",
		isPageTitleSkipSuffix: true,
		page: UrlUtil.PG_BESTIARY,
		colorDefault: "#008000",
		iconDefault: "imp-laugh",
		pFnSearch: SearchWidget.pGetUserCreatureSearch,
		fnSort: PageFilterBestiary.sortMonsters,
		fnGetContents: MakeCards._getCardContents_creature.bind(MakeCards),
		fnGetTags: (mon) => {
			const types = Parser.monTypeToFullObj(mon.type);
			const cr = mon.cr == null ? "unknown CR" : `CR ${(mon.cr.cr || mon.cr)}`;
			return ["creature", Parser.sourceJsonToAbv(mon.source), types.type, cr, Parser.sizeAbvToFull(mon.size)]
		},
		pFnLoadAllData: async () => {
			const brew = await BrewUtil.pAddBrewData();
			const fromData = await DataUtil.monster.pLoadAll();
			const fromBrew = brew.monster || [];
			return [...fromData, ...fromBrew];
		},
		fnGetListHeaders: () => {
			const btnMeta = [
				{sort: "name", text: "Name", width: "5"},
				{sort: "type", text: "Type", width: "4"},
				{sort: "cr", text: "CR", width: "2"},
				{sort: "source", text: "Source", width: "1"}
			];
			return MakeCards._$getFilterColumnHeaders(btnMeta);
		},
		fnGetListItem: (pageFilter, mon, itI) => {
			Renderer.monster.initParsed(mon);
			pageFilter.addToFilters(mon);

			const eleLi = document.createElement("li");
			eleLi.className = "row px-0";

			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY](mon);
			const source = Parser.sourceJsonToAbv(mon.source);
			const type = mon._pTypes.asText.uppercaseFirst();
			const cr = mon._pCr || "\u2014";

			eleLi.innerHTML = `<div>
				<div class="flex-vh-center col-1 pl-0"><input type="checkbox"></div>
				<div class="col-11 pr-0">
					<div class="col-5 pl-0 bold">${mon.name}</div>
					<div class="col-4">${type}</div>
					<div class="col-2 text-center">${cr}</div>
					<div class="col-1 text-center ${Parser.sourceJsonToColor(mon.source)} pr-0" title="${Parser.sourceJsonToFull(mon.source)}" ${BrewUtil.sourceJsonToStyle(mon.source)}>${source}</div>
				</div>
			</div>`;

			return new ListItem(
				itI,
				eleLi,
				mon.name,
				{
					hash,
					source,
					jsonSource: mon.source,
					type,
					cr
				},
				{
					eleCb: eleLi.firstElementChild.firstElementChild.firstElementChild
				}
			);
		}
	},
	item: {
		searchTitle: "Item",
		pageTitle: "Items",
		page: UrlUtil.PG_ITEMS,
		colorDefault: "#696969",
		iconDefault: "mixed-swords",
		pFnSearch: SearchWidget.pGetUserItemSearch,
		fnGetContents: MakeCards._getCardContents_item.bind(MakeCards),
		fnGetTags: (item) => {
			const [typeListText] = Renderer.item.getHtmlAndTextTypes(item);
			return ["item", Parser.sourceJsonToAbv(item.source), ...typeListText]
		},
		pFnLoadAllData: async () => {
			const brew = await BrewUtil.pAddBrewData();
			const fromData = await Renderer.item.pBuildList({isAddGroups: true, isBlacklistVariants: true});
			const fromBrew = await Renderer.item.getItemsFromHomebrew(brew);
			return [...fromData, ...fromBrew];
		},
		fnGetListHeaders: () => {
			const btnMeta = [
				{sort: "name", text: "Name", width: "5"},
				{sort: "type", text: "Type", width: "6"},
				{sort: "source", text: "Source", width: "1"}
			];
			return MakeCards._$getFilterColumnHeaders(btnMeta);
		},
		fnGetListItem: (pageFilter, item, itI) => {
			if (item.noDisplay) return null;
			Renderer.item.enhanceItem(item);
			pageFilter.addToFilters(item);

			const eleLi = document.createElement("li");
			eleLi.className = "row px-0";

			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item);
			const source = Parser.sourceJsonToAbv(item.source);
			const type = item._typeListText.join(", ");

			eleLi.innerHTML = `<div>
				<div class="flex-vh-center col-1 pl-0"><input type="checkbox"></div>
				<div class="col-11 pr-0">
					<span class="col-5 pl-0 bold">${item.name}</span>
					<span class="col-6">${type}</span>
					<span class="col-1 text-center ${Parser.sourceJsonToColor(item.source)} pr-0" title="${Parser.sourceJsonToFull(item.source)}" ${BrewUtil.sourceJsonToStyle(item.source)}>${source}</span>
				</div>
			</div>`;

			return new ListItem(
				itI,
				eleLi,
				item.name,
				{
					hash,
					source,
					jsonSource: item.source,
					type
				},
				{
					eleCb: eleLi.firstElementChild.firstElementChild.firstElementChild
				}
			);
		}
	},
	spell: {
		searchTitle: "Spell",
		pageTitle: "Spells",
		page: UrlUtil.PG_SPELLS,
		colorDefault: "#4a6898",
		iconDefault: "magic-swirl",
		pFnSearch: SearchWidget.pGetUserSpellSearch,
		fnSort: PageFilterSpells.sortSpells,
		fnGetContents: MakeCards._getCardContents_spell.bind(MakeCards),
		fnGetTags: (spell) => {
			const out = ["spell", Parser.sourceJsonToAbv(spell.source), Parser.spLevelToFullLevelText(spell.level), Parser.spSchoolAbvToFull(spell.school)];
			if (spell.duration.filter(d => d.concentration).length) out.push("concentration");
			return out;
		},
		pFnLoadAllData: async () => {
			const brew = await BrewUtil.pAddBrewData();
			const fromData = await DataUtil.spell.pLoadAll();
			const fromBrew = brew.spell || [];
			return [...fromData, ...fromBrew];
		},
		fnGetListHeaders: () => {
			const btnMeta = [
				{sort: "name", text: "Name", width: "3-5"},
				{sort: "level", text: "Level", width: "2"},
				{sort: "time", text: "Time", width: "2"},
				{sort: "school", text: "School", width: "1"},
				{sort: "concentration", text: "C.", title: "Concentration", width: "0-5"},
				{sort: "range", text: "Range", width: "2"},
				{sort: "source", text: "Source", width: "1"}
			];
			return MakeCards._$getFilterColumnHeaders(btnMeta);
		},
		fnGetListItem: (pageFilter, spell, spI) => {
			const eleLi = document.createElement("li");
			eleLi.className = "row";

			const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS](spell);
			const source = Parser.sourceJsonToAbv(spell.source);
			const levelText = `${Parser.spLevelToFull(spell.level)}${spell.meta && spell.meta.ritual ? " (rit.)" : ""}${spell.meta && spell.meta.technomagic ? " (tec.)" : ""}`;
			const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
			const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
			const concentration = spell._isConc ? "×" : "";
			const range = Parser.spRangeToFull(spell.range);

			eleLi.innerHTML = `<label class="lst--border">
				<div class="flex-vh-center col-1 pl-0"><input type="checkbox"></div>
				<div class="col-11 pr-0">
					<div class="bold col-3-5 pl-0">${spell.name}</div>
					<div class="col-2 text-center">${levelText}</div>
					<div class="col-2 text-center">${time}</div>
					<div class="col-1 school_${spell.school} text-center" title="${Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)}">${school}</div>
					<div class="col-0-5 text-center" title="Concentration">${concentration}</div>
					<div class="col-2 text-right">${range}</div>
					<div class="col-1 pr-0 text-center ${Parser.sourceJsonToColor(spell.source)}" title="${Parser.sourceJsonToFull(spell.source)}" ${BrewUtil.sourceJsonToStyle(spell.source)}>${source}</div>
				</div>
			</label>`;

			return new ListItem(
				spI,
				eleLi,
				spell.name,
				{
					hash,
					source,
					jsonSource: spell.source,
					level: spell.level,
					time,
					school: Parser.spSchoolAbvToFull(spell.school),
					classes: Parser.spClassesToFull(spell.classes, true),
					concentration,
					normalisedTime: spell._normalisedTime,
					normalisedRange: spell._normalisedRange
				},
				{
					eleCb: eleLi.firstElementChild.firstElementChild.firstElementChild
				}
			);
		}
	}
	// TODO add more entities
};
MakeCards._ = null;
window.addEventListener("load", () => MakeCards.pInit());

MakeCards.utils = class {
	static async pLoadReducedData () {
		const data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/makecards.json`);
		data.reducedItemProperty.forEach(p => MakeCards.utils._addItemProperty(p));
		data.reducedItemType.forEach(t => {
			if (t.abbreviation === "SHP") {
				const cpy = MiscUtil.copy(t);
				cpy.abbreviation = "AIR";
				MakeCards.utils._addItemType(cpy);
			}
			MakeCards.utils._addItemType(t);
		});
	}

	// region items
	static _addItemProperty (p) {
		if (MakeCards.utils.itemPropertyMap[p.abbreviation]) return;
		if (p.entries) {
			MakeCards.utils.itemPropertyMap[p.abbreviation] = p.name ? MiscUtil.copy(p) : {
				name: p.entries[0].name.toLowerCase(),
				entries: p.entries
			};
		} else MakeCards.utils.itemPropertyMap[p.abbreviation] = {};
	}

	static _addItemType (t) {
		if (MakeCards.utils.itemTypeMap[t.abbreviation]) return;
		MakeCards.utils.itemTypeMap[t.abbreviation] = t.name ? MiscUtil.copy(t) : {
			name: t.entries[0].name.toLowerCase(),
			entries: t.entries
		};
	}

	static enhanceItemAlt (item) {
		delete item._fullEntries;

		if (item.type && (MakeCards.utils.itemPropertyMap[item.type] || Renderer.item.typeMap[item.type])) {
			Renderer.item._initFullEntries(item);
			(MakeCards.utils.itemTypeMap[item.type] || Renderer.item.typeMap[item.type]).entries.forEach(e => item._fullEntries.push(e));
		}

		if (item.property) {
			item.property.forEach(p => {
				if (MakeCards.utils.itemPropertyMap[p]) {
					if (MakeCards.utils.itemPropertyMap[p].entries) {
						Renderer.item._initFullEntries(item);
						MakeCards.utils.itemPropertyMap[p].entries.forEach(e => item._fullEntries.push(e));
					}
				} else if (Renderer.item.propertyMap[p].entries) {
					Renderer.item._initFullEntries(item);
					Renderer.item.propertyMap[p].entries.forEach(e => item._fullEntries.push(e));
				}
			});
		}

		if (item.type === "LA" || item.type === "MA" || item.type === "HA") {
			if (item.resist) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Resistance to ${item.resist} damage.`);
			}
			if (item.stealth) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("Disadvantage on Stealth (Dexterity) checks.");
			}
			if (item.type === "HA" && item.strength) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Speed reduced by 10 feet if Strength score less than ${item.strength}.`);
			}
		} else if (item.resist) {
			if (item.type === "P") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Resistance to ${item.resist} damage for 1 hour.`);
			}
			if (item.type === "RG") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Resistance to ${item.resist} damage.`);
			}
		}
		if (item.type === "SCF") {
			if (item.scfType === "arcane") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("A sorcerer, warlock, or wizard can use this item as a spellcasting focus.");
			}
			if (item.scfType === "druid") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("A druid can use this item as a spellcasting focus.");
			}
			if (item.scfType === "holy") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("A cleric or paladin can use this item as a spellcasting focus.");
			}
		}
	}
	// endregion
};
MakeCards.utils.itemTypeMap = {};
MakeCards.utils.itemPropertyMap = {};
