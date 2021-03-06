/** Rail Announcements Generator. By Roy Curtis, MIT license, 2018 */

/** Utility class for resolving a given phrase to vox keys */
class Resolver
{
    /** TreeWalker filter to reduce a walk to just the elements the resolver needs */
    private static nodeFilter(node: Node): number
    {
        let parent     = node.parentElement!;
        let parentType = parent.dataset['type'];

        // If type is missing, parent is a wrapper
        if (!parentType)
        {
            parent     = parent.parentElement!;
            parentType = parent.dataset['type'];
        }

        // Accept text only from phrase and phrasesets
        if (node.nodeType === Node.TEXT_NODE)
        if (parentType !== 'phraseset' && parentType !== 'phrase')
            return NodeFilter.FILTER_SKIP;

        if (node.nodeType === Node.ELEMENT_NODE)
        {
            let element = node as HTMLElement;
            let type    = element.dataset['type'];

            // Reject collapsed elements and their children
            if ( element.hasAttribute('collapsed') )
                return NodeFilter.FILTER_REJECT;

            // Skip typeless (wrapper) elements
            if (!type)
                return NodeFilter.FILTER_SKIP;

            // Skip over phrase and phrasesets (instead, only going for their children)
            if (type === 'phraseset' || type === 'phrase')
                return NodeFilter.FILTER_SKIP;
        }

        return NodeFilter.FILTER_ACCEPT;
    }

    private phrase    : HTMLElement;

    private flattened : Node[];

    private resolved  : VoxKey[];

    public constructor(phrase: HTMLElement)
    {
        this.phrase    = phrase;
        this.flattened = [];
        this.resolved  = [];
    }

    public toVox() : VoxKey[]
    {
        // First, walk through the phrase and "flatten" it into an array of parts. This is
        // so the resolver can look-ahead or look-behind.

        this.flattened = [];
        this.resolved  = [];
        let treeWalker = document.createTreeWalker(
            this.phrase,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            { acceptNode: Resolver.nodeFilter },
            false
        );

        while ( treeWalker.nextNode() )
        if (treeWalker.currentNode.textContent!.trim() !== '')
            this.flattened.push(treeWalker.currentNode);

        // Then, resolve all the phrases' nodes into vox keys

        this.flattened.forEach( (v, i) => this.resolved.push( ...this.resolve(v, i) ) );

        console.log(this.flattened, this.resolved);
        return this.resolved;
    }

    /**
     * Uses the type and value of the given node, to resolve it to vox file IDs.
     *
     * @param node Node to resolve to vox IDs
     * @param idx Index of the node being resolved relative to the phrase array
     * @returns Array of IDs that make up one or more file IDs. Can be empty.
     */
    private resolve(node: Node, idx: number) : VoxKey[]
    {
        if (node.nodeType === Node.TEXT_NODE)
            return this.resolveText(node);

        let element = node as HTMLElement;
        let type    = element.dataset['type'];

        switch (type)
        {
            case 'coach':       return this.resolveCoach(element, idx);
            case 'excuse':      return this.resolveExcuse(idx);
            case 'integer':     return this.resolveInteger(element);
            case 'named':       return this.resolveNamed();
            case 'platform':    return this.resolvePlatform(idx);
            case 'service':     return this.resolveService(element);
            case 'station':     return this.resolveStation(element, idx);
            case 'stationlist': return this.resolveStationList(element, idx);
            case 'time':        return this.resolveTime(element);
            case 'vox':         return this.resolveVox(element);
        }

        return [];
    }

    private getInflection(idx: number) : string
    {
        let next = this.flattened[idx + 1];

        return ( next && next.textContent!.trim().startsWith('.') )
            ? 'end'
            : 'mid';
    }

    private resolveText(node: Node) : VoxKey[]
    {
        let parent = node.parentElement!;
        let type   = parent.dataset['type'];
        let text   = Strings.clean(node.textContent!);
        let set    = [];

        // If text is just a full stop, return silence
        if (text === '.')
            return [0.65];

        // If it begins with a full stop, add silence
        if ( text.startsWith('.') )
            set.push(0.65);

        // If the text doesn't contain any words, skip
        if ( !text.match(/[a-z0-9]/i) )
            return set;

        // If type is missing, parent is a wrapper
        if (!type)
        {
            parent = parent.parentElement!;
            type   = parent.dataset['type'];
        }

        let ref = parent.dataset['ref'];
        let idx = DOM.nodeIndexOf(node);
        let id  = `${type}.${ref}`;

        // Append index of phraseset's choice of phrase
        if (type === 'phraseset')
            id += `.${parent.dataset['idx']}`;

        id += `.${idx}`;
        set.push(id);

        // If text ends with a full stop, add silence
        if ( text.endsWith('.') )
            set.push(0.65);

        return set;
    }

    private resolveCoach(element: HTMLElement, idx: number) : VoxKey[]
    {
        let ctx     = element.dataset['context']!;
        let coach   = RAG.state.getCoach(ctx);
        let inflect = this.getInflection(idx);
        let result  = [0.2, `letter.${coach}.${inflect}`];

        if (inflect === 'mid')
            result.push(0.2);

        return result;
    }

    private resolveExcuse(idx: number) : VoxKey[]
    {
        let excuse  = RAG.state.excuse;
        let key     = Strings.filename(excuse);
        let inflect = this.getInflection(idx);
        let result  = [0.15, `excuse.${key}.${inflect}`];

        if (inflect === 'mid')
            result.push(0.2);

        return result;
    }

    private resolveInteger(element: HTMLElement) : VoxKey[]
    {
        let ctx      = element.dataset['context']!;
        let singular = element.dataset['singular'];
        let plural   = element.dataset['plural'];
        let integer  = RAG.state.getInteger(ctx);
        let parts    = [0.125, `number.${integer}.mid`];

        if      (singular && integer === 1)
            parts.push(0.15, `number.suffix.${singular}.end`);
        else if (plural   && integer !== 1)
            parts.push(0.15, `number.suffix.${plural}.end`);
        else
            parts.push(0.15);

        return parts;
    }

    private resolveNamed() : VoxKey[]
    {
        let named = Strings.filename(RAG.state.named);

        return [0.2, `named.${named}.mid`, 0.2];
    }

    private resolvePlatform(idx: number) : VoxKey[]
    {
        let platform = RAG.state.platform;
        let inflect  = this.getInflection(idx);
        let letter   = (platform[1] === '??') ? 'M' : platform[1];
        let result   = [0.15, `number.${platform[0]}${letter}.${inflect}`];

        if (inflect === 'mid')
            result.push(0.2);

        return result;
    }

    private resolveService(element: HTMLElement) : VoxKey[]
    {
        let ctx     = element.dataset['context']!;
        let service = Strings.filename( RAG.state.getService(ctx) );
        let result  = [];

        // Only add beginning delay if there isn't already one prior
        if (typeof this.resolved.slice(-1)[0] !== 'number')
            result.push(0.15);

        return [...result, `service.${service}.mid`, 0.15];
    }

    private resolveStation(element: HTMLElement, idx: number) : VoxKey[]
    {
        let ctx     = element.dataset['context']!;
        let station = RAG.state.getStation(ctx);
        let voxKey  = RAG.database.getStationVox(station);
        let inflect = this.getInflection(idx);
        let result  = [0.2, `station.${voxKey}.${inflect}`];

        if (inflect === 'mid')
            result.push(0.2);

        return result;
    }

    private resolveStationList(element: HTMLElement, idx: number) : VoxKey[]
    {
        let ctx     = element.dataset['context']!;
        let list    = RAG.state.getStationList(ctx);
        let inflect = this.getInflection(idx);

        let parts : VoxKey[] = [0.2];

        list.forEach( (code, k) =>
        {
            let voxKey = RAG.database.getStationVox(code);

            // Handle middle of list inflection
            if (k !== list.length - 1)
            {
                parts.push(`station.${voxKey}.mid`, 0.25);
                return;
            }

            // Add "and" if list has more than 1 station and this is the end
            if (list.length > 1)
                parts.push('station.parts.and.mid', 0.25);

            // Add "only" if only one station in the calling list
            if (list.length === 1 && ctx === 'calling')
            {
                parts.push(`station.${voxKey}.mid`);
                parts.push(0.2, 'station.parts.only.end');
            }
            else
                parts.push(`station.${voxKey}.${inflect}`);
        });

        return [...parts, 0.2];
    }

    private resolveTime(element: HTMLElement) : VoxKey[]
    {
        let ctx   = element.dataset['context']!;
        let time  = RAG.state.getTime(ctx).split(':');

        let parts : VoxKey[] = [0.2];

        if (time[0] === '00' && time[1] === '00')
            return [...parts, 'number.0000.mid', 0.2];

        // Hours
        parts.push(`number.${time[0]}.begin`);

        if (time[1] === '00')
            parts.push(0.075, 'number.hundred.mid');
        else
            parts.push(0.2, `number.${time[1]}.mid`);

        return [...parts, 0.15];
    }

    private resolveVox(element: HTMLElement) : VoxKey[]
    {
        let text   = element.innerText.trim();
        let result = [];

        if ( text.startsWith('.') )
            result.push(0.65);

        result.push( element.dataset['key']! );

        if ( text.endsWith('.') )
            result.push(0.65);

        return result;
    }
}