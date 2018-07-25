"use strict";
class Chooser {
    constructor(parent) {
        this.selectOnClick = true;
        this.filterTimeout = 0;
        this.groupByABC = false;
        this.itemTitle = 'Click to select this item';
        if (!Chooser.TEMPLATE)
            Chooser.init();
        let target = DOM.require('chooser', parent);
        let placeholder = DOM.getAttr(target, 'placeholder', 'Filter choices...');
        let title = DOM.getAttr(target, 'title', 'List of choices');
        this.itemTitle = DOM.getAttr(target, 'itemTitle', this.itemTitle);
        this.groupByABC = target.hasAttribute('groupByABC');
        this.dom = Chooser.TEMPLATE.cloneNode(true);
        this.inputFilter = DOM.require('.chSearchBox', this.dom);
        this.inputChoices = DOM.require('.chChoicesBox', this.dom);
        this.inputChoices.title = title;
        this.inputFilter.placeholder = placeholder;
        target.insertAdjacentElement('beforebegin', this.dom);
        target.remove();
    }
    static init() {
        Chooser.TEMPLATE = DOM.require('#chooserTemplate');
        Chooser.TEMPLATE.id = '';
        Chooser.TEMPLATE.classList.remove('hidden');
        Chooser.TEMPLATE.remove();
    }
    add(value, select = false) {
        let item = document.createElement('dd');
        item.innerText = value;
        this.addRaw(item, select);
    }
    addRaw(item, select = false) {
        item.title = this.itemTitle;
        item.tabIndex = -1;
        this.inputChoices.appendChild(item);
        if (select) {
            this.visualSelect(item);
            item.focus();
        }
    }
    clear() {
        this.inputChoices.innerHTML = '';
        this.inputFilter.value = '';
    }
    preselect(value) {
        for (let key in this.inputChoices.children) {
            let item = this.inputChoices.children[key];
            if (value === item.innerText) {
                this.visualSelect(item);
                item.focus();
                break;
            }
        }
    }
    onChange(_) {
    }
    onClick(ev) {
        let target = ev.target;
        if (target && target.tagName.toLowerCase() === 'dd')
            if (this.owns(target))
                this.select(target);
    }
    onClose() {
        window.clearTimeout(this.filterTimeout);
    }
    onInput(ev) {
        let key = ev.key;
        let focused = document.activeElement;
        let parent = focused.parentElement;
        if (!focused)
            return;
        if (!this.owns(focused))
            return;
        if (focused === this.inputFilter) {
            window.clearTimeout(this.filterTimeout);
            this.filterTimeout = window.setTimeout(_ => this.filter(), 500);
            return;
        }
        if (focused !== this.inputFilter)
            if (key.length === 1 || key === 'Backspace')
                return this.inputFilter.focus();
        if (parent === this.inputChoices || parent.hasAttribute('group'))
            if (key === 'Enter')
                return this.select(focused);
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            let dir = (key === 'ArrowLeft') ? -1 : 1;
            let nav = null;
            if (this.groupByABC && parent.hasAttribute('group'))
                nav = DOM.getNextFocusableSibling(focused, dir);
            else if (!this.groupByABC && focused.parentElement === this.inputChoices)
                nav = DOM.getNextFocusableSibling(focused, dir);
            else if (focused === this.domSelected)
                nav = DOM.getNextFocusableSibling(this.domSelected, dir);
            else if (dir === -1)
                nav = DOM.getNextFocusableSibling(focused.firstElementChild, dir);
            else
                nav = DOM.getNextFocusableSibling(focused.lastElementChild, dir);
            if (nav)
                nav.focus();
        }
    }
    onSubmit(ev) {
        ev.preventDefault();
        this.filter();
    }
    filter() {
        window.clearTimeout(this.filterTimeout);
        let filter = this.inputFilter.value.toLowerCase();
        let items = this.inputChoices.children;
        let engine = this.groupByABC
            ? Chooser.filterGroup
            : Chooser.filterItem;
        this.inputChoices.classList.add('hidden');
        for (let i = 0; i < items.length; i++)
            engine(items[i], filter);
        this.inputChoices.classList.remove('hidden');
    }
    static filterItem(item, filter) {
        if (item.innerText.toLowerCase().indexOf(filter) >= 0) {
            item.classList.remove('hidden');
            return 0;
        }
        else {
            item.classList.add('hidden');
            return 1;
        }
    }
    static filterGroup(group, filter) {
        let entries = group.children;
        let count = entries.length - 1;
        let hidden = 0;
        for (let i = 1; i < entries.length; i++)
            hidden += Chooser.filterItem(entries[i], filter);
        if (hidden >= count)
            group.classList.add('hidden');
        else
            group.classList.remove('hidden');
    }
    select(entry) {
        let alreadySelected = (entry === this.domSelected);
        if (this.selectOnClick)
            this.visualSelect(entry);
        if (this.onSelect)
            this.onSelect(entry);
        if (alreadySelected)
            RAG.views.editor.closeDialog();
    }
    visualSelect(entry) {
        this.visualUnselect();
        this.domSelected = entry;
        this.domSelected.tabIndex = 50;
        entry.setAttribute('selected', 'true');
    }
    visualUnselect() {
        if (!this.domSelected)
            return;
        this.domSelected.removeAttribute('selected');
        this.domSelected.tabIndex = -1;
        this.domSelected = undefined;
    }
    owns(target) {
        return this.inputFilter.contains(target) || this.inputChoices.contains(target);
    }
}
class StationChooser extends Chooser {
    constructor(parent) {
        super(parent);
        this.domStations = {};
        this.inputChoices.tabIndex = 0;
        Object.keys(RAG.database.stations).forEach(code => {
            let station = RAG.database.stations[code];
            let letter = station[0];
            let group = this.domStations[letter];
            if (!letter)
                throw new Error('Station database appears to contain an empty name');
            if (!group) {
                let header = document.createElement('dt');
                header.innerText = letter.toUpperCase();
                header.tabIndex = -1;
                group = this.domStations[letter] = document.createElement('dl');
                group.tabIndex = 50;
                group.setAttribute('group', '');
                group.appendChild(header);
                this.inputChoices.appendChild(group);
            }
            let entry = document.createElement('dd');
            entry.dataset['code'] = code;
            entry.innerText = RAG.database.stations[code];
            entry.title = this.itemTitle;
            entry.tabIndex = -1;
            group.appendChild(entry);
        });
    }
    attach(picker, onSelect) {
        let parent = picker.domForm;
        let current = this.dom.parentElement;
        if (!current || current !== parent)
            parent.appendChild(this.dom);
        this.visualUnselect();
        this.onSelect = onSelect.bind(picker);
    }
    preselectCode(code) {
        let entry = this.inputChoices.querySelector(`dd[data-code=${code}]`);
        if (entry) {
            this.visualSelect(entry);
            entry.focus();
        }
    }
}
class StationListItem {
    static init() {
        StationListItem.TEMPLATE = DOM.require('#stationListItemTemplate');
        StationListItem.TEMPLATE.id = '';
        StationListItem.TEMPLATE.classList.remove('hidden');
        StationListItem.TEMPLATE.remove();
    }
    constructor(code) {
        if (!StationListItem.TEMPLATE)
            StationListItem.init();
        this.dom = StationListItem.TEMPLATE.cloneNode(true);
        this.dom.innerText = RAG.database.getStation(code, false);
        this.dom.dataset['code'] = code;
    }
}
class Picker {
    constructor(xmlTag) {
        this.dom = DOM.require(`#${xmlTag}Picker`);
        this.domForm = DOM.require('form', this.dom);
        this.domHeader = DOM.require('header', this.dom);
        this.xmlTag = xmlTag;
        this.domForm.onchange = this.onChange.bind(this);
        this.domForm.oninput = this.onChange.bind(this);
        this.domForm.onclick = this.onClick.bind(this);
        this.domForm.onkeydown = this.onInput.bind(this);
        this.domForm.onsubmit = this.onSubmit.bind(this);
    }
    onSubmit(ev) {
        ev.preventDefault();
        this.onChange(ev);
        RAG.views.editor.closeDialog();
    }
    open(target) {
        this.dom.classList.remove('hidden');
        this.domEditing = target;
        this.layout();
    }
    close() {
        DOM.blurActive(this.dom);
        this.dom.classList.add('hidden');
    }
    layout() {
        if (!this.domEditing)
            return;
        let targetRect = this.domEditing.getBoundingClientRect();
        let fullWidth = this.dom.classList.contains('fullWidth');
        let isModal = this.dom.classList.contains('modal');
        let docW = document.body.clientWidth;
        let docH = document.body.clientHeight;
        let dialogX = (targetRect.left | 0) - 8;
        let dialogY = targetRect.bottom | 0;
        let dialogW = (targetRect.width | 0) + 16;
        if (!fullWidth && !isModal) {
            if (DOM.isMobile) {
                this.dom.style.width = `100%`;
                dialogX = 0;
            }
            else {
                this.dom.style.width = `initial`;
                this.dom.style.minWidth = `${dialogW}px`;
                if (dialogX + this.dom.offsetWidth > docW)
                    dialogX = (targetRect.right | 0) - this.dom.offsetWidth + 8;
            }
        }
        if (isModal) {
            dialogX = DOM.isMobile ? 0 :
                ((docW * 0.1) / 2) | 0;
            dialogY = DOM.isMobile ? 0 :
                ((docH * 0.1) / 2) | 0;
        }
        else if (dialogY < 0)
            dialogY = 0;
        else if (dialogY + this.dom.offsetHeight > docH) {
            dialogY = (targetRect.top | 0) - this.dom.offsetHeight + 1;
            this.domEditing.classList.add('below');
            this.domEditing.classList.remove('above');
            if (dialogY + this.dom.offsetHeight > docH)
                dialogY = docH - this.dom.offsetHeight;
            if (dialogY < 0)
                dialogY = 0;
        }
        else {
            this.domEditing.classList.add('above');
            this.domEditing.classList.remove('below');
        }
        this.dom.style.left = (fullWidth ? 0 : dialogX) + 'px';
        this.dom.style.top = dialogY + 'px';
    }
    hasFocus() {
        return this.dom.contains(document.activeElement);
    }
}
class CoachPicker extends Picker {
    constructor() {
        super('coach');
        this.currentCtx = '';
        this.inputLetter = DOM.require('select', this.dom);
        for (let i = 0; i < 26; i++) {
            let option = document.createElement('option');
            let letter = Phraser.LETTERS[i];
            option.text = option.value = letter;
            this.inputLetter.appendChild(option);
        }
    }
    open(target) {
        super.open(target);
        this.currentCtx = DOM.requireData(target, 'context');
        this.domHeader.innerText =
            `Pick a coach letter for the '${this.currentCtx}' context`;
        this.inputLetter.value = RAG.state.getCoach(this.currentCtx);
        this.inputLetter.focus();
    }
    onChange(_) {
        RAG.state.setCoach(this.currentCtx, this.inputLetter.value);
        RAG.views.editor
            .getElementsByQuery(`[data-type=coach][data-context=${this.currentCtx}]`)
            .forEach(element => element.textContent = this.inputLetter.value);
    }
    onClick(_) { }
    onInput(_) { }
}
class ExcusePicker extends Picker {
    constructor() {
        super('excuse');
        this.domChooser = new Chooser(this.domForm);
        this.domChooser.onSelect = e => this.onSelect(e);
        RAG.database.excuses.forEach(v => this.domChooser.add(v));
    }
    open(target) {
        super.open(target);
        this.domChooser.preselect(RAG.state.excuse);
    }
    close() {
        super.close();
        this.domChooser.onClose();
    }
    onChange(ev) { this.domChooser.onChange(ev); }
    onClick(ev) { this.domChooser.onClick(ev); }
    onInput(ev) { this.domChooser.onInput(ev); }
    onSubmit(ev) { this.domChooser.onSubmit(ev); }
    onSelect(entry) {
        RAG.state.excuse = entry.innerText;
        RAG.views.editor.setElementsText('excuse', RAG.state.excuse);
    }
}
class IntegerPicker extends Picker {
    constructor() {
        super('integer');
        this.inputDigit = DOM.require('input', this.dom);
        this.domLabel = DOM.require('label', this.dom);
        if (DOM.isiOS) {
            this.inputDigit.type = 'tel';
            this.inputDigit.pattern = '[0-9]+';
        }
    }
    open(target) {
        super.open(target);
        this.currentCtx = DOM.requireData(target, 'context');
        this.singular = target.dataset['singular'];
        this.plural = target.dataset['plural'];
        this.words = Parse.boolean(target.dataset['words'] || 'false');
        let value = RAG.state.getInteger(this.currentCtx);
        if (this.singular && value === 1)
            this.domLabel.innerText = this.singular;
        else if (this.plural && value !== 1)
            this.domLabel.innerText = this.plural;
        else
            this.domLabel.innerText = '';
        this.domHeader.innerText = `Pick a number for the '${this.currentCtx}' part`;
        this.inputDigit.value = value.toString();
        this.inputDigit.focus();
    }
    onChange(_) {
        if (!this.currentCtx)
            throw new Error("onChange fired for integer picker without state");
        let int = parseInt(this.inputDigit.value);
        let intStr = (this.words)
            ? Phraser.DIGITS[int] || int.toString()
            : int.toString();
        if (isNaN(int))
            return;
        this.domLabel.innerText = '';
        if (int === 1 && this.singular) {
            intStr += ` ${this.singular}`;
            this.domLabel.innerText = this.singular;
        }
        else if (int !== 1 && this.plural) {
            intStr += ` ${this.plural}`;
            this.domLabel.innerText = this.plural;
        }
        RAG.state.setInteger(this.currentCtx, int);
        RAG.views.editor
            .getElementsByQuery(`[data-type=integer][data-context=${this.currentCtx}]`)
            .forEach(element => element.textContent = intStr);
    }
    onInput(ev) {
        setTimeout(() => this.onChange(ev), 1);
    }
    onClick(_) { }
}
class NamedPicker extends Picker {
    constructor() {
        super('named');
        this.domChooser = new Chooser(this.domForm);
        this.domChooser.onSelect = e => this.onSelect(e);
        RAG.database.named.forEach(v => this.domChooser.add(v));
    }
    open(target) {
        super.open(target);
        this.domChooser.preselect(RAG.state.named);
    }
    close() {
        super.close();
        this.domChooser.onClose();
    }
    onChange(ev) { this.domChooser.onChange(ev); }
    onClick(ev) { this.domChooser.onClick(ev); }
    onInput(ev) { this.domChooser.onInput(ev); }
    onSubmit(ev) { this.domChooser.onSubmit(ev); }
    onSelect(entry) {
        RAG.state.named = entry.innerText;
        RAG.views.editor.setElementsText('named', RAG.state.named);
    }
}
class PhrasesetPicker extends Picker {
    constructor() {
        super('phraseset');
        this.domChooser = new Chooser(this.domForm);
        this.domChooser.onSelect = e => this.onSelect(e);
    }
    open(target) {
        super.open(target);
        let ref = DOM.requireData(target, 'ref');
        let idx = parseInt(DOM.requireData(target, 'idx'));
        let phraseset = RAG.database.getPhraseset(ref);
        if (!phraseset)
            throw new Error(`Phraseset '${ref}' doesn't exist`);
        this.currentRef = ref;
        this.domHeader.innerText = `Pick a phrase for the '${ref}' section`;
        this.domChooser.clear();
        for (let i = 0; i < phraseset.children.length; i++) {
            let phrase = document.createElement('dd');
            DOM.cloneInto(phraseset.children[i], phrase);
            RAG.phraser.process(phrase);
            phrase.innerText = DOM.getCleanedVisibleText(phrase);
            phrase.dataset.idx = i.toString();
            this.domChooser.addRaw(phrase, i === idx);
        }
    }
    close() {
        super.close();
        this.domChooser.onClose();
    }
    onChange(ev) { this.domChooser.onChange(ev); }
    onClick(ev) { this.domChooser.onClick(ev); }
    onInput(ev) { this.domChooser.onInput(ev); }
    onSubmit(ev) { this.domChooser.onSubmit(ev); }
    onSelect(entry) {
        if (!this.currentRef)
            throw new Error("Got select event when currentRef is unset");
        let idx = parseInt(entry.dataset['idx']);
        RAG.state.setPhrasesetIdx(this.currentRef, idx);
        RAG.views.editor.closeDialog();
        RAG.views.editor.refreshPhraseset(this.currentRef);
    }
}
class PlatformPicker extends Picker {
    constructor() {
        super('platform');
        this.inputDigit = DOM.require('input', this.dom);
        this.inputLetter = DOM.require('select', this.dom);
        if (DOM.isiOS) {
            this.inputDigit.type = 'tel';
            this.inputDigit.pattern = '[0-9]+';
        }
    }
    open(target) {
        super.open(target);
        let value = RAG.state.platform;
        this.inputDigit.value = value[0];
        this.inputLetter.value = value[1];
        this.inputDigit.focus();
    }
    onChange(_) {
        if (isNaN(parseInt(this.inputDigit.value)))
            return;
        RAG.state.platform = [this.inputDigit.value, this.inputLetter.value];
        RAG.views.editor.setElementsText('platform', RAG.state.platform.join(''));
    }
    onClick(_) { }
    onInput(_) { }
}
class ServicePicker extends Picker {
    constructor() {
        super('service');
        this.domChooser = new Chooser(this.domForm);
        this.domChooser.onSelect = e => this.onSelect(e);
        RAG.database.services.forEach(v => this.domChooser.add(v));
    }
    open(target) {
        super.open(target);
        this.domChooser.preselect(RAG.state.service);
    }
    close() {
        super.close();
        this.domChooser.onClose();
    }
    onChange(ev) { this.domChooser.onChange(ev); }
    onClick(ev) { this.domChooser.onClick(ev); }
    onInput(ev) { this.domChooser.onInput(ev); }
    onSubmit(ev) { this.domChooser.onSubmit(ev); }
    onSelect(entry) {
        RAG.state.service = entry.innerText;
        RAG.views.editor.setElementsText('service', RAG.state.service);
    }
}
class StationPicker extends Picker {
    constructor(tag = 'station') {
        super(tag);
        this.currentCtx = '';
        if (!StationPicker.chooser)
            StationPicker.chooser = new StationChooser(this.domForm);
        this.onOpen = this.onStationPickerOpen.bind(this);
    }
    open(target) {
        super.open(target);
        this.onOpen(target);
    }
    onStationPickerOpen(target) {
        let chooser = StationPicker.chooser;
        this.currentCtx = DOM.requireData(target, 'context');
        chooser.attach(this, this.onSelectStation);
        chooser.preselectCode(RAG.state.getStation(this.currentCtx));
        chooser.selectOnClick = true;
        this.domHeader.innerText =
            `Pick a station for the '${this.currentCtx}' context`;
    }
    onChange(ev) { StationPicker.chooser.onChange(ev); }
    onClick(ev) { StationPicker.chooser.onClick(ev); }
    onInput(ev) { StationPicker.chooser.onInput(ev); }
    onSubmit(ev) { StationPicker.chooser.onSubmit(ev); }
    onSelectStation(entry) {
        let query = `[data-type=station][data-context=${this.currentCtx}]`;
        let code = entry.dataset['code'];
        let name = RAG.database.getStation(code, true);
        RAG.state.setStation(this.currentCtx, code);
        RAG.views.editor
            .getElementsByQuery(query)
            .forEach(element => element.textContent = name);
    }
}
class StationListPicker extends StationPicker {
    constructor() {
        super("stationlist");
        this.domList = DOM.require('.stationList', this.dom);
        this.btnAdd = DOM.require('.addStation', this.domList);
        this.btnClose = DOM.require('.closePicker', this.domList);
        this.domDel = DOM.require('.delStation', this.domList);
        this.inputList = DOM.require('dl', this.domList);
        this.domEmptyList = DOM.require('p', this.domList);
        this.onOpen = this.onStationListPickerOpen.bind(this);
        new Draggable.Sortable([this.inputList, this.domDel], { draggable: 'dd' })
            .on('drag:stop', ev => setTimeout(() => this.onDragStop(ev), 1))
            .on('mirror:create', this.onDragMirrorCreate.bind(this));
    }
    onStationListPickerOpen(target) {
        StationPicker.chooser.attach(this, this.onAddStation);
        StationPicker.chooser.selectOnClick = false;
        this.currentCtx = DOM.requireData(target, 'context');
        let entries = RAG.state.getStationList(this.currentCtx).slice(0);
        this.domHeader.innerText =
            `Build a station list for the '${this.currentCtx}' context`;
        this.inputList.innerHTML = '';
        entries.forEach(v => this.add(v));
        this.inputList.focus();
    }
    onChange(ev) { super.onChange(ev); }
    onSubmit(ev) { super.onSubmit(ev); }
    onClick(ev) {
        super.onClick(ev);
        if (ev.target === this.btnClose)
            RAG.views.editor.closeDialog();
        if (ev.target === this.btnAdd)
            this.dom.classList.add('addingStation');
    }
    onInput(ev) {
        super.onInput(ev);
        let key = ev.key;
        let focused = document.activeElement;
        if (!focused || !this.inputList.contains(focused))
            return;
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            let dir = (key === 'ArrowLeft') ? -1 : 1;
            let nav = null;
            if (focused.parentElement === this.inputList)
                nav = DOM.getNextFocusableSibling(focused, dir);
            else if (dir === -1)
                nav = DOM.getNextFocusableSibling(focused.firstElementChild, dir);
            else
                nav = DOM.getNextFocusableSibling(focused.lastElementChild, dir);
            if (nav)
                nav.focus();
        }
        if (key === 'Delete' || key === 'Backspace')
            if (focused.parentElement === this.inputList) {
                let next = focused.previousElementSibling
                    || focused.nextElementSibling
                    || this.inputList;
                this.remove(focused);
                next.focus();
            }
    }
    onAddStation(entry) {
        let newEntry = this.add(entry.dataset['code']);
        this.dom.classList.remove('addingStation');
        this.update();
        if (DOM.isMobile)
            newEntry.dom.focus();
        else
            newEntry.dom.scrollIntoView();
    }
    onDragMirrorCreate(ev) {
        if (!ev.data.source || !ev.data.originalSource)
            throw new Error('Draggable: Missing source elements for mirror event');
        ev.data.source.style.width = ev.data.originalSource.clientWidth + 'px';
    }
    onDragStop(ev) {
        if (!ev.data.originalSource)
            return;
        if (ev.data.originalSource.parentElement === this.domDel)
            this.remove(ev.data.originalSource);
        else
            this.update();
    }
    add(code) {
        let newEntry = new StationListItem(code);
        this.inputList.appendChild(newEntry.dom);
        this.domEmptyList.classList.add('hidden');
        newEntry.dom.ondblclick = _ => this.remove(newEntry.dom);
        return newEntry;
    }
    remove(entry) {
        if (!this.domList.contains(entry))
            throw new Error('Attempted to remove entry not on station list builder');
        entry.remove();
        this.update();
        if (this.inputList.children.length === 0)
            this.domEmptyList.classList.remove('hidden');
    }
    update() {
        let children = this.inputList.children;
        if (children.length === 0)
            return;
        let list = [];
        for (let i = 0; i < children.length; i++) {
            let entry = children[i];
            list.push(entry.dataset['code']);
        }
        let textList = Strings.fromStationList(list.slice(0), this.currentCtx);
        let query = `[data-type=stationlist][data-context=${this.currentCtx}]`;
        RAG.state.setStationList(this.currentCtx, list);
        RAG.views.editor
            .getElementsByQuery(query)
            .forEach(element => element.textContent = textList);
    }
}
class TimePicker extends Picker {
    constructor() {
        super('time');
        this.inputTime = DOM.require('input', this.dom);
    }
    open(target) {
        super.open(target);
        this.inputTime.value = RAG.state.time;
        this.inputTime.focus();
    }
    onChange(_) {
        RAG.state.time = this.inputTime.value;
        RAG.views.editor.setElementsText('time', RAG.state.time.toString());
    }
    onClick(_) { }
    onInput(_) { }
}
class ElementProcessors {
    static coach(ctx) {
        let context = DOM.requireAttr(ctx.xmlElement, 'context');
        ctx.newElement.title = `Click to change this coach ('${context}')`;
        ctx.newElement.textContent = RAG.state.getCoach(context);
        ctx.newElement.dataset['context'] = context;
    }
    static excuse(ctx) {
        ctx.newElement.title = `Click to change this excuse`;
        ctx.newElement.textContent = RAG.state.excuse;
    }
    static integer(ctx) {
        let context = DOM.requireAttr(ctx.xmlElement, 'context');
        let singular = ctx.xmlElement.getAttribute('singular');
        let plural = ctx.xmlElement.getAttribute('plural');
        let words = ctx.xmlElement.getAttribute('words');
        let int = RAG.state.getInteger(context);
        let intStr = (words && words.toLowerCase() === 'true')
            ? Phraser.DIGITS[int]
            : int.toString();
        if (int === 1 && singular)
            intStr += ` ${singular}`;
        else if (int !== 1 && plural)
            intStr += ` ${plural}`;
        ctx.newElement.title = `Click to change this number ('${context}')`;
        ctx.newElement.textContent = intStr;
        ctx.newElement.dataset['context'] = context;
        if (singular)
            ctx.newElement.dataset['singular'] = singular;
        if (plural)
            ctx.newElement.dataset['plural'] = plural;
        if (words)
            ctx.newElement.dataset['words'] = words;
    }
    static named(ctx) {
        ctx.newElement.title = "Click to change this train's name";
        ctx.newElement.textContent = RAG.state.named;
    }
    static phrase(ctx) {
        let ref = DOM.requireAttr(ctx.xmlElement, 'ref');
        let phrase = RAG.database.getPhrase(ref);
        ctx.newElement.title = '';
        ctx.newElement.dataset['ref'] = ref;
        if (!phrase) {
            ctx.newElement.textContent = `(UNKNOWN PHRASE: ${ref})`;
            return;
        }
        if (ctx.xmlElement.hasAttribute('chance'))
            this.makeCollapsible(ctx, phrase, ref);
        else
            DOM.cloneInto(phrase, ctx.newElement);
    }
    static phraseset(ctx) {
        let ref = DOM.requireAttr(ctx.xmlElement, 'ref');
        let phraseset = RAG.database.getPhraseset(ref);
        ctx.newElement.dataset['ref'] = ref;
        if (!phraseset) {
            ctx.newElement.textContent = `(UNKNOWN PHRASESET: ${ref})`;
            return;
        }
        let idx = RAG.state.getPhrasesetIdx(ref);
        let phrase = phraseset.children[idx];
        ctx.newElement.dataset['idx'] = idx.toString();
        ctx.newElement.title =
            `Click to change this phrase used in this section ('${ref}')`;
        if (ctx.xmlElement.hasAttribute('chance'))
            this.makeCollapsible(ctx, phrase, ref);
        else
            DOM.cloneInto(phrase, ctx.newElement);
    }
    static platform(ctx) {
        ctx.newElement.title = "Click to change the platform number";
        ctx.newElement.textContent = RAG.state.platform.join('');
    }
    static service(ctx) {
        ctx.newElement.title = "Click to change this train's network";
        ctx.newElement.textContent = RAG.state.service;
    }
    static station(ctx) {
        let context = DOM.requireAttr(ctx.xmlElement, 'context');
        let code = RAG.state.getStation(context);
        ctx.newElement.title = `Click to change this station ('${context}')`;
        ctx.newElement.textContent = RAG.database.getStation(code, true);
        ctx.newElement.dataset['context'] = context;
    }
    static stationlist(ctx) {
        let context = DOM.requireAttr(ctx.xmlElement, 'context');
        let stations = RAG.state.getStationList(context).slice(0);
        let stationList = Strings.fromStationList(stations, context);
        ctx.newElement.title = `Click to change this station list ('${context}')`;
        ctx.newElement.textContent = stationList;
        ctx.newElement.dataset['context'] = context;
    }
    static time(ctx) {
        ctx.newElement.title = "Click to change the time";
        ctx.newElement.textContent = RAG.state.time;
    }
    static unknown(ctx) {
        let name = ctx.xmlElement.nodeName;
        ctx.newElement.textContent = `(UNKNOWN XML ELEMENT: ${name})`;
    }
    static makeCollapsible(ctx, source, ref) {
        let chance = ctx.xmlElement.getAttribute('chance');
        let inner = document.createElement('span');
        let toggle = document.createElement('span');
        let collapsed = RAG.state.getCollapsed(ref, parseInt(chance));
        inner.classList.add('inner');
        toggle.classList.add('toggle');
        DOM.cloneInto(source, inner);
        ctx.newElement.dataset['chance'] = chance;
        Collapsibles.set(ctx.newElement, toggle, collapsed);
        ctx.newElement.appendChild(toggle);
        ctx.newElement.appendChild(inner);
    }
}
class Phraser {
    process(container, level = 0) {
        let pending = container.querySelectorAll(':not(span)');
        if (pending.length === 0)
            return;
        pending.forEach(element => {
            let elementName = element.nodeName.toLowerCase();
            let newElement = document.createElement('span');
            let context = {
                xmlElement: element,
                newElement: newElement
            };
            newElement.dataset['type'] = elementName;
            switch (elementName) {
                case 'coach':
                    ElementProcessors.coach(context);
                    break;
                case 'excuse':
                    ElementProcessors.excuse(context);
                    break;
                case 'integer':
                    ElementProcessors.integer(context);
                    break;
                case 'named':
                    ElementProcessors.named(context);
                    break;
                case 'phrase':
                    ElementProcessors.phrase(context);
                    break;
                case 'phraseset':
                    ElementProcessors.phraseset(context);
                    break;
                case 'platform':
                    ElementProcessors.platform(context);
                    break;
                case 'service':
                    ElementProcessors.service(context);
                    break;
                case 'station':
                    ElementProcessors.station(context);
                    break;
                case 'stationlist':
                    ElementProcessors.stationlist(context);
                    break;
                case 'time':
                    ElementProcessors.time(context);
                    break;
                default:
                    ElementProcessors.unknown(context);
                    break;
            }
            element.parentElement.replaceChild(newElement, element);
        });
        if (level < 20)
            this.process(container, level + 1);
        else
            throw new Error("Too many levels of recursion, when processing phrase.");
    }
}
Phraser.DIGITS = ['zero', 'one', 'two', 'three', 'four',
    'five', 'six', 'seven', 'eight', 'nine', 'ten'];
Phraser.LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
class Editor {
    constructor() {
        this.dom = DOM.require('#editor');
        document.body.onclick = this.onClick.bind(this);
        document.body.onkeydown = this.onInput.bind(this);
        window.onresize = this.onResize.bind(this);
        this.dom.onscroll = this.onScroll.bind(this);
        this.dom.textContent = "Please wait...";
    }
    generate() {
        this.dom.innerHTML = '<phraseset ref="root" />';
        RAG.phraser.process(this.dom);
        let padding = document.createElement('span');
        padding.className = 'bottomPadding';
        this.dom.appendChild(padding);
    }
    refreshPhraseset(ref) {
        this.dom.querySelectorAll(`span[data-type=phraseset][data-ref=${ref}]`)
            .forEach(_ => {
            let element = _;
            let newElement = document.createElement('phraseset');
            let chance = element.dataset['chance'];
            newElement.setAttribute('ref', ref);
            if (chance)
                newElement.setAttribute('chance', chance);
            element.parentElement.replaceChild(newElement, element);
            RAG.phraser.process(newElement.parentElement);
        });
    }
    getElementsByQuery(query) {
        return this.dom.querySelectorAll(`span${query}`);
    }
    getRect() {
        return this.dom.getBoundingClientRect();
    }
    getText() {
        return DOM.getCleanedVisibleText(this.dom);
    }
    setElementsText(type, value) {
        this.getElementsByQuery(`[data-type=${type}]`)
            .forEach(element => element.textContent = value);
    }
    closeDialog() {
        if (this.currentPicker)
            this.currentPicker.close();
        if (this.domEditing) {
            this.domEditing.removeAttribute('editing');
            this.domEditing.classList.remove('above', 'below');
        }
        this.currentPicker = undefined;
        this.domEditing = undefined;
    }
    onClick(ev) {
        let target = ev.target;
        let type = target ? target.dataset['type'] : undefined;
        let picker = type ? RAG.views.getPicker(type) : undefined;
        if (!target)
            return this.closeDialog();
        if (target.classList.contains('inner') && target.parentElement) {
            target = target.parentElement;
            type = target.dataset['type'];
            picker = type ? RAG.views.getPicker(type) : undefined;
        }
        if (!document.body.contains(target))
            return;
        if (this.currentPicker)
            if (this.currentPicker.dom.contains(target))
                return;
        let prevTarget = this.domEditing;
        this.closeDialog();
        if (target === prevTarget)
            return;
        if (target.classList.contains('toggle'))
            this.toggleCollapsiable(target);
        else if (type && picker)
            this.openPicker(target, picker);
    }
    onInput(ev) {
        if (ev.key === 'Escape')
            return this.closeDialog();
    }
    onResize(_) {
        if (this.currentPicker)
            this.currentPicker.layout();
    }
    onScroll(_) {
        if (!this.currentPicker)
            return;
        if (DOM.isMobile)
            if (this.currentPicker.hasFocus())
                DOM.blurActive();
        this.currentPicker.layout();
    }
    toggleCollapsiable(target) {
        let parent = target.parentElement;
        let ref = DOM.requireData(parent, 'ref');
        let type = DOM.requireData(parent, 'type');
        let collapased = parent.hasAttribute('collapsed');
        this.dom.querySelectorAll(`span[data-type=${type}][data-ref=${ref}]`)
            .forEach(_ => {
            let phraseset = _;
            let toggle = phraseset.children[0];
            if (!toggle || !toggle.classList.contains('toggle'))
                return;
            Collapsibles.set(phraseset, toggle, !collapased);
            RAG.state.setCollapsed(ref, !collapased);
        });
    }
    openPicker(target, picker) {
        target.setAttribute('editing', 'true');
        this.currentPicker = picker;
        this.domEditing = target;
        picker.open(target);
    }
}
class Marquee {
    constructor() {
        this.timer = 0;
        this.offset = 0;
        this.dom = DOM.require('#marquee');
        this.domSpan = document.createElement('span');
        this.dom.innerHTML = '';
        this.dom.appendChild(this.domSpan);
    }
    set(msg) {
        window.cancelAnimationFrame(this.timer);
        this.domSpan.textContent = msg;
        this.offset = this.dom.clientWidth;
        let last = 0;
        let limit = -this.domSpan.clientWidth - 100;
        let anim = (time) => {
            let stepPerMs = (DOM.isMobile ? 5 : 7) / (1000 / 60);
            this.offset -= (last == 0)
                ? (DOM.isMobile ? 5 : 7)
                : (time - last) * stepPerMs;
            this.domSpan.style.transform = `translateX(${this.offset}px)`;
            if (this.offset < limit)
                this.domSpan.style.transform = '';
            else {
                last = time;
                this.timer = window.requestAnimationFrame(anim);
            }
        };
        window.requestAnimationFrame(anim);
    }
    stop() {
        window.cancelAnimationFrame(this.timer);
        this.domSpan.style.transform = '';
    }
}
class Settings {
    constructor() {
        this.ready = false;
        this.dom = DOM.require('#settings');
        this.btnReset = DOM.require('#btnResetSettings');
        this.btnSave = DOM.require('#btnSaveSettings');
        this.btnReset.onclick = this.handleReset.bind(this);
        this.btnSave.onclick = this.handleSave.bind(this);
        this.selVoxChoice = DOM.require('#selVoxChoice');
        this.rangeVoxVol = DOM.require('#rangeVoxVol');
        this.rangeVoxPitch = DOM.require('#rangeVoxPitch');
        this.rangeVoxRate = DOM.require('#rangeVoxRate');
        this.btnVoxTest = DOM.require('#btnVoxTest');
        this.btnVoxTest.onclick = ev => {
            ev.preventDefault();
            RAG.speechSynth.cancel();
            this.btnVoxTest.disabled = true;
            window.setTimeout(this.handleVoxTest.bind(this), 200);
        };
    }
    open() {
        document.body.classList.add('settingsVisible');
        if (!this.ready)
            this.init();
        this.selVoxChoice.selectedIndex = RAG.config.voxChoice;
        this.rangeVoxVol.valueAsNumber = RAG.config.voxVolume;
        this.rangeVoxPitch.valueAsNumber = RAG.config.voxPitch;
        this.rangeVoxRate.valueAsNumber = RAG.config.voxRate;
        this.btnSave.focus();
    }
    close() {
        this.cancelReset();
        RAG.speechSynth.cancel();
        document.body.classList.remove('settingsVisible');
        DOM.blurActive(this.dom);
    }
    init() {
        let voices = RAG.speechSynth.getVoices();
        if (voices.length <= 0) {
            this.ready = true;
            return;
        }
        this.selVoxChoice.innerHTML = '';
        for (let i = 0; i < voices.length; i++) {
            let option = document.createElement('option');
            option.textContent = `${voices[i].name} (${voices[i].lang})`;
            this.selVoxChoice.appendChild(option);
        }
        this.ready = true;
    }
    handleReset() {
        if (!this.resetTimeout) {
            this.resetTimeout = setTimeout(this.cancelReset.bind(this), 15000);
            this.btnReset.innerText = 'Are you sure?';
            this.btnReset.title = 'Confirm reset to defaults';
            return;
        }
        RAG.config.reset();
        RAG.speechSynth.cancel();
        this.cancelReset();
        this.open();
        alert('Settings have been reset to their defaults, and deleted from storage.');
    }
    cancelReset() {
        window.clearTimeout(this.resetTimeout);
        this.btnReset.innerText = 'Reset to defaults';
        this.btnReset.title = 'Reset settings to defaults';
        this.resetTimeout = undefined;
    }
    handleSave() {
        RAG.config.voxChoice = this.selVoxChoice.selectedIndex;
        RAG.config.voxVolume = parseInt(this.rangeVoxVol.value);
        RAG.config.voxPitch = parseInt(this.rangeVoxPitch.value);
        RAG.config.voxRate = parseInt(this.rangeVoxRate.value);
        RAG.config.save();
        this.close();
    }
    handleVoxTest() {
        this.btnVoxTest.disabled = false;
        let time = new Date();
        let hour = time.getHours().toString().padStart(2, '0');
        let minute = time.getMinutes().toString().padStart(2, '0');
        let utterance = new SpeechSynthesisUtterance(`This is a test of the Rail Announcement Generator at ${hour}:${minute}.`);
        utterance.volume = this.rangeVoxVol.valueAsNumber;
        utterance.pitch = this.rangeVoxPitch.valueAsNumber;
        utterance.rate = this.rangeVoxRate.valueAsNumber;
        utterance.voice = RAG.speechSynth.getVoices()[this.selVoxChoice.selectedIndex];
        RAG.speechSynth.speak(utterance);
    }
}
class Toolbar {
    constructor() {
        this.dom = DOM.require('#toolbar');
        this.btnPlay = DOM.require('#btnPlay');
        this.btnStop = DOM.require('#btnStop');
        this.btnGenerate = DOM.require('#btnShuffle');
        this.btnSave = DOM.require('#btnSave');
        this.btnRecall = DOM.require('#btnLoad');
        this.btnOption = DOM.require('#btnSettings');
        this.btnStop.onclick = this.handleStop.bind(this);
        this.btnGenerate.onclick = RAG.generate;
        this.btnSave.onclick = this.handleSave.bind(this);
        this.btnRecall.onclick = this.handleLoad.bind(this);
        this.btnOption.onclick = this.handleOption.bind(this);
        this.btnPlay.onclick = ev => {
            ev.preventDefault();
            RAG.speechSynth.cancel();
            this.btnPlay.disabled = true;
            window.setTimeout(this.handlePlay.bind(this), 200);
        };
    }
    handlePlay() {
        let text = RAG.views.editor.getText();
        let parts = text.trim().split(/\.\s/i);
        let voices = RAG.speechSynth.getVoices();
        let voice = RAG.config.voxChoice;
        if (!voices[voice])
            RAG.config.voxChoice = voice = 0;
        RAG.speechSynth.cancel();
        parts.forEach(segment => {
            let utterance = new SpeechSynthesisUtterance(segment);
            utterance.voice = voices[voice];
            utterance.volume = RAG.config.voxVolume;
            utterance.pitch = RAG.config.voxPitch;
            utterance.rate = RAG.config.voxRate;
            RAG.speechSynth.speak(utterance);
        });
        RAG.views.marquee.set(text);
        this.btnPlay.disabled = false;
    }
    handleStop() {
        RAG.speechSynth.cancel();
        RAG.views.marquee.stop();
    }
    handleSave() {
        try {
            let css = "font-size: large; font-weight: bold;";
            let raw = JSON.stringify(RAG.state);
            window.localStorage['state'] = raw;
            console.log("%cCopy and paste this in console to load later:", css);
            console.log("RAG.load('", raw.replace("'", "\\'"), "')");
            console.log("%cRaw JSON state:", css);
            console.log(raw);
            RAG.views.marquee.set("State has been saved to storage, and dumped to console.");
        }
        catch (e) {
            RAG.views.marquee.set(`Sorry, state could not be saved to storage: ${e.message}.`);
        }
    }
    handleLoad() {
        let data = window.localStorage['state'];
        return data
            ? RAG.load(data)
            : RAG.views.marquee.set("Sorry, no state was found in storage.");
    }
    handleOption() {
        RAG.views.settings.open();
    }
}
class Views {
    constructor() {
        this.editor = new Editor();
        this.marquee = new Marquee();
        this.settings = new Settings();
        this.toolbar = new Toolbar();
        this.pickers = {};
        [
            new CoachPicker(),
            new ExcusePicker(),
            new IntegerPicker(),
            new NamedPicker(),
            new PhrasesetPicker(),
            new PlatformPicker(),
            new ServicePicker(),
            new StationPicker(),
            new StationListPicker(),
            new TimePicker()
        ].forEach(picker => this.pickers[picker.xmlTag] = picker);
        if (DOM.isiOS)
            document.body.classList.add('ios');
    }
    getPicker(xmlTag) {
        return this.pickers[xmlTag];
    }
}
class Collapsibles {
    static set(span, toggle, state) {
        if (state)
            span.setAttribute('collapsed', '');
        else
            span.removeAttribute('collapsed');
        toggle.title = state
            ? "Click to open this optional part"
            : "Click to close this optional part";
    }
}
class DOM {
    static get isMobile() {
        return document.body.clientWidth <= 500;
    }
    static get isiOS() {
        return navigator.platform.match(/iPhone|iPod|iPad/gi) !== null;
    }
    static getAttr(element, attr, def) {
        return element.hasAttribute(attr)
            ? element.getAttribute(attr)
            : def;
    }
    static require(query, parent = window.document) {
        let result = parent.querySelector(query);
        if (!result)
            throw new Error(`Required DOM element is missing: '${query}'`);
        return result;
    }
    static requireAttr(element, attr) {
        if (!element.hasAttribute(attr))
            throw new Error(`Required attribute is missing: '${attr}'`);
        return element.getAttribute(attr);
    }
    static requireData(element, key) {
        let value = element.dataset[key];
        if (Strings.isNullOrEmpty(value))
            throw new Error(`Required dataset key is missing or empty: '${key}'`);
        return value;
    }
    static blurActive(parent = document.body) {
        let active = document.activeElement;
        if (active && active.blur && parent.contains(active))
            active.blur();
    }
    static cloneInto(source, target) {
        for (let i = 0; i < source.childNodes.length; i++)
            target.appendChild(source.childNodes[i].cloneNode(true));
    }
    static getVisibleText(element) {
        if (element.nodeType === Node.TEXT_NODE)
            return element.textContent || '';
        else if (element.classList.contains('toggle'))
            return '';
        let style = getComputedStyle(element);
        if (style && style.display === 'none')
            return '';
        let text = '';
        for (let i = 0; i < element.childNodes.length; i++)
            text += DOM.getVisibleText(element.childNodes[i]);
        return text;
    }
    static getCleanedVisibleText(element) {
        return DOM.getVisibleText(element)
            .trim()
            .replace(/[\n\r]/gi, '')
            .replace(/\s{2,}/gi, ' ')
            .replace(/\s([.,])/gi, '$1');
    }
    static getNextFocusableSibling(from, dir) {
        let current = from;
        let parent = from.parentElement;
        if (!parent)
            return null;
        while (true) {
            if (dir < 0)
                current = current.previousElementSibling
                    || parent.lastElementChild;
            else if (dir > 0)
                current = current.nextElementSibling
                    || parent.firstElementChild;
            else
                throw new Error("Direction needs to be -1 or 1");
            if (current === from)
                return null;
            if (!current.classList.contains('hidden') && current.tabIndex)
                return current;
        }
    }
    static preventDefault(ev) {
        ev.preventDefault();
    }
    static swap(obj1, obj2) {
        if (!obj1.parentNode || !obj2.parentNode)
            throw new Error("Parent node required for swapping");
        let temp = document.createElement("div");
        obj1.parentNode.insertBefore(temp, obj1);
        obj2.parentNode.insertBefore(obj1, obj2);
        temp.parentNode.insertBefore(obj2, temp);
        temp.parentNode.removeChild(temp);
    }
}
class Parse {
    static boolean(str) {
        str = str.toLowerCase();
        if (str === 'true' || str === '1')
            return true;
        if (str === 'false' || str === '0')
            return false;
        throw new Error("Given string does not represent a boolean");
    }
}
class Random {
    static int(min = 0, max = 1) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
    static array(arr) {
        return arr[Random.int(0, arr.length)];
    }
    static objectKey(obj) {
        return Random.array(Object.keys(obj));
    }
    static bool(chance = 50) {
        return Random.int(0, 100) < chance;
    }
}
class Strings {
    static isNullOrEmpty(str) {
        return !str || !str.trim();
    }
    static fromStationList(codes, context) {
        let result = '';
        let names = codes.slice(0);
        names.forEach((c, i) => names[i] = RAG.database.getStation(c, true));
        if (names.length === 1)
            result = (context === 'calling')
                ? `${names[0]} only`
                : names[0];
        else {
            let lastStation = names.pop();
            result = names.join(', ');
            result += ` and ${lastStation}`;
        }
        return result;
    }
}
class Config {
    constructor() {
        this.voxChoice = 0;
        this.voxVolume = 1.0;
        this.voxPitch = 1.0;
        this.voxRate = 1.0;
    }
    load() {
        if (!window.localStorage['settings'])
            return;
        try {
            let config = JSON.parse(window.localStorage['settings']);
            Object.assign(this, config);
        }
        catch (e) {
            alert(`Could not load settings: ${e.message}`);
            console.error(e);
        }
    }
    save() {
        try {
            window.localStorage['settings'] = JSON.stringify(this);
        }
        catch (e) {
            alert(`Could not save settings: ${e.message}`);
            console.error(e);
        }
    }
    reset() {
        window.localStorage.removeItem('settings');
        Object.assign(this, new Config());
    }
}
class Database {
    constructor(dataRefs) {
        let iframe = DOM.require(dataRefs.phrasesetEmbed);
        if (!iframe.contentDocument)
            throw new Error("Configured phraseset element is not an iframe embed");
        this.phrasesets = iframe.contentDocument;
        this.excuses = dataRefs.excusesData;
        this.named = dataRefs.namedData;
        this.services = dataRefs.servicesData;
        this.stations = dataRefs.stationsData;
        this.stationsCount = Object.keys(this.stations).length;
        console.log("[Database] Entries loaded:");
        console.log("\tExcuses:", this.excuses.length);
        console.log("\tNamed trains:", this.named.length);
        console.log("\tServices:", this.services.length);
        console.log("\tStations:", this.stationsCount);
    }
    pickExcuse() {
        return Random.array(this.excuses);
    }
    pickNamed() {
        return Random.array(this.named);
    }
    getPhrase(id) {
        let result = this.phrasesets.querySelector('phrase#' + id);
        if (result)
            result = result.cloneNode(true);
        return result;
    }
    getPhraseset(id) {
        return this.phrasesets.querySelector('phraseset#' + id);
    }
    pickService() {
        return Random.array(this.services);
    }
    pickStationCode(exclude) {
        if (exclude)
            for (let i = 0; i < this.stationsCount; i++) {
                let value = Random.objectKey(this.stations);
                if (!exclude.includes(value))
                    return value;
            }
        return Random.objectKey(this.stations);
    }
    getStation(code, filtered = false) {
        let station = this.stations[code];
        if (!station)
            return `UNKNOWN STATION: ${code}`;
        if (filtered)
            station = station.replace(/\(.+\)/i, '').trim();
        return station;
    }
    pickStationCodes(min = 1, max = 16, exclude) {
        if (max - min > Object.keys(this.stations).length)
            throw new Error("Picking too many stations than there are available");
        let result = [];
        let length = Random.int(min, max);
        let tries = 0;
        while (result.length < length) {
            let key = Random.objectKey(this.stations);
            if (tries++ >= this.stationsCount)
                result.push(key);
            else if (exclude && !exclude.includes(key) && !result.includes(key))
                result.push(key);
            else if (!exclude && !result.includes(key))
                result.push(key);
        }
        return result;
    }
}
class RAG {
    static main(dataRefs) {
        window.onerror = error => RAG.panic(error);
        window.onbeforeunload = _ => RAG.speechSynth.cancel();
        RAG.config = new Config();
        RAG.database = new Database(dataRefs);
        RAG.views = new Views();
        RAG.phraser = new Phraser();
        RAG.speechSynth = window.speechSynthesis;
        RAG.config.load();
        RAG.views.marquee.set("Welcome to RAG.");
        RAG.generate();
    }
    static generate() {
        RAG.state = new State();
        RAG.state.genDefaultState();
        RAG.views.editor.generate();
    }
    static load(json) {
        RAG.state = Object.assign(new State(), JSON.parse(json));
        RAG.views.editor.generate();
        RAG.views.marquee.set("State has been loaded from storage.");
    }
    static panic(error = "Unknown error") {
        let msg = '<div id="panicScreen" class="warningScreen">';
        msg += '<h1>"We are sorry to announce that..."</h1>';
        msg += `<p>RAG has crashed because: <code>${error}</code>.</p>`;
        msg += `<p>Please open the console for more information.</p>`;
        msg += '</div>';
        document.body.innerHTML = msg;
    }
}
class State {
    constructor() {
        this._collapsibles = {};
        this._coaches = {};
        this._integers = {};
        this._phrasesets = {};
        this._stations = {};
        this._stationLists = {};
    }
    getCoach(context) {
        if (this._coaches[context] !== undefined)
            return this._coaches[context];
        this._coaches[context] = Random.array(Phraser.LETTERS);
        return this._coaches[context];
    }
    setCoach(context, coach) {
        this._coaches[context] = coach;
    }
    getCollapsed(ref, chance) {
        if (this._collapsibles[ref] !== undefined)
            return this._collapsibles[ref];
        this._collapsibles[ref] = !Random.bool(chance);
        return this._collapsibles[ref];
    }
    setCollapsed(ref, state) {
        this._collapsibles[ref] = state;
    }
    getInteger(context) {
        if (this._integers[context] !== undefined)
            return this._integers[context];
        let min = 0, max = 0;
        switch (context) {
            case "coaches":
                min = 1;
                max = 10;
                break;
            case "delayed":
                min = 5;
                max = 120;
                break;
            case "front_coaches":
                min = 2;
                max = 5;
                break;
            case "rear_coaches":
                min = 2;
                max = 5;
                break;
        }
        this._integers[context] = Random.int(min, max);
        return this._integers[context];
    }
    setInteger(context, value) {
        this._integers[context] = value;
    }
    getPhrasesetIdx(ref) {
        if (this._phrasesets[ref] !== undefined)
            return this._phrasesets[ref];
        let phraseset = RAG.database.getPhraseset(ref);
        if (!phraseset)
            throw new Error("Shouldn't get phraseset idx for one that doesn't exist");
        this._phrasesets[ref] = Random.int(0, phraseset.children.length);
        return this._phrasesets[ref];
    }
    setPhrasesetIdx(ref, idx) {
        this._phrasesets[ref] = idx;
    }
    getStation(context) {
        if (this._stations[context] !== undefined)
            return this._stations[context];
        this._stations[context] = RAG.database.pickStationCode();
        return this._stations[context];
    }
    setStation(context, code) {
        this._stations[context] = code;
    }
    getStationList(context) {
        if (this._stationLists[context] !== undefined)
            return this._stationLists[context];
        else if (context === 'calling_first')
            return this.getStationList('calling');
        let min = 1, max = 16;
        switch (context) {
            case "calling_split":
                min = 2;
                max = 16;
                break;
            case "changes":
                min = 1;
                max = 4;
                break;
            case "not_stopping":
                min = 1;
                max = 8;
                break;
        }
        this._stationLists[context] = RAG.database.pickStationCodes(min, max);
        return this._stationLists[context];
    }
    setStationList(context, value) {
        this._stationLists[context] = value;
        if (context === 'calling_first')
            this._stationLists['calling'] = value;
    }
    get excuse() {
        if (this._excuse)
            return this._excuse;
        this._excuse = RAG.database.pickExcuse();
        return this._excuse;
    }
    set excuse(value) {
        this._excuse = value;
    }
    get platform() {
        if (this._platform)
            return this._platform;
        let platform = ['', ''];
        platform[0] = Random.bool(98)
            ? Random.int(1, 26).toString()
            : '0';
        platform[1] = Random.bool(10)
            ? Random.array('ABC')
            : '';
        this._platform = platform;
        return this._platform;
    }
    set platform(value) {
        this._platform = value;
    }
    get named() {
        if (this._named)
            return this._named;
        this._named = RAG.database.pickNamed();
        return this._named;
    }
    set named(value) {
        this._named = value;
    }
    get service() {
        if (this._service)
            return this._service;
        this._service = RAG.database.pickService();
        return this._service;
    }
    set service(value) {
        this._service = value;
    }
    get time() {
        if (!this._time) {
            let offset = Random.int(0, 59);
            let time = new Date(new Date().getTime() + offset * 60000);
            let hour = time.getHours().toString().padStart(2, '0');
            let minute = time.getMinutes().toString().padStart(2, '0');
            this._time = `${hour}:${minute}`;
        }
        return this._time;
    }
    set time(value) {
        this._time = value;
    }
    genDefaultState() {
        let slCalling = RAG.database.pickStationCodes(1, 16);
        let slCallSplit = RAG.database.pickStationCodes(2, 16, slCalling);
        let allCalling = [...slCalling, ...slCallSplit];
        let slChanges = RAG.database.pickStationCodes(1, 4, allCalling);
        let slNotStopping = RAG.database.pickStationCodes(1, 8, [...allCalling, ...slChanges]);
        let reqCount = Random.int(1, slCalling.length - 1);
        let slRequests = slCalling.slice(0, reqCount);
        this.setStationList('calling', slCalling);
        this.setStationList('calling_split', slCallSplit);
        this.setStationList('changes', slChanges);
        this.setStationList('not_stopping', slNotStopping);
        this.setStationList('request', slRequests);
        let stExcuse = RAG.database.pickStationCode();
        let stDest = slCalling[slCalling.length - 1];
        let stVia = slCalling.length > 1
            ? Random.array(slCalling.slice(0, -1))
            : Random.array(slCallSplit.slice(0, -1));
        let stCalling = slCalling.length > 1
            ? Random.array(slCalling.slice(0, -1))
            : Random.array(slCallSplit.slice(0, -1));
        let stDestSplit = slCallSplit[slCallSplit.length - 1];
        let stViaSplit = Random.array(slCallSplit.slice(0, -1));
        let stSource = RAG.database.pickStationCode([
            ...allCalling, ...slChanges, ...slNotStopping, ...slRequests,
            stCalling, stDest, stVia, stDestSplit, stViaSplit
        ]);
        this.setStation('calling', stCalling);
        this.setStation('destination', stDest);
        this.setStation('destination_split', stDestSplit);
        this.setStation('excuse', stExcuse);
        this.setStation('source', stSource);
        this.setStation('via', stVia);
        this.setStation('via_split', stViaSplit);
        let intCoaches = this.getInteger('coaches');
        if (intCoaches >= 4) {
            let intFrontCoaches = (intCoaches / 2) | 0;
            let intRearCoaches = intCoaches - intFrontCoaches;
            this.setInteger('front_coaches', intFrontCoaches);
            this.setInteger('rear_coaches', intRearCoaches);
        }
        if (intCoaches >= 4) {
            let letters = Phraser.LETTERS.slice(0, intCoaches).split('');
            let randSplice = () => letters.splice(Random.int(0, letters.length), 1)[0];
            this.setCoach('first', randSplice());
            this.setCoach('shop', randSplice());
            this.setCoach('standard1', randSplice());
            this.setCoach('standard2', randSplice());
        }
    }
}
//# sourceMappingURL=rag.js.map