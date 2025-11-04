export const UNICODE_WORD_REGEX = /[\p{Letter}\p{Number}]+/ug

export function isTextNodeVisible(wnd : Window, textNode : Node): boolean {
    const range = new Range();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.textContent!.length)
    const rect = range.getBoundingClientRect();
    const viewport = {
        width: wnd.innerWidth || wnd.document.documentElement.clientWidth,
        height: wnd.innerHeight || wnd.document.documentElement.clientHeight
    };
    if (rect.bottom < 0 || rect.right < 0 ||
        rect.top > viewport.height || rect.left > viewport.width) {
        return false;
    }
    return true;
}

export function getElementsWithOwnText(wnd : Window|null, currentElement? : Element, gathered? : HTMLElement[]): HTMLElement[] {
    currentElement = currentElement ?? wnd!.document.documentElement;
    gathered = gathered ?? [];

    for (let idx = 0; idx < currentElement.childNodes.length; idx++) {
        if (currentElement.childNodes[idx].nodeName.toLocaleLowerCase() === "head") { continue; }
        if (currentElement.childNodes[idx].nodeType === Node.TEXT_NODE && currentElement.childNodes[idx].textContent!.trim().length > 0) {
            if (gathered.indexOf(currentElement as HTMLElement) < 0) {
                gathered.push(currentElement as HTMLElement);
            }
        } else if (currentElement.childNodes[idx].nodeType === Node.ELEMENT_NODE) {
            getElementsWithOwnText(wnd, currentElement.childNodes[idx] as Element, gathered);
        }
    }
    return gathered
}


function gatherTextNodes(currentElement : HTMLElement, gathered? : Node[] ): Node[] {
    gathered = gathered ?? []

    for (let idx = 0; idx < currentElement.childNodes.length; idx++) {
        if (currentElement.childNodes[idx].nodeType === Node.TEXT_NODE) {
            gathered.push(currentElement.childNodes[idx])
        } else if (currentElement.childNodes[idx].nodeType === Node.ELEMENT_NODE) {
            gatherTextNodes(currentElement.childNodes[idx] as HTMLElement, gathered);
        }
    }
    return gathered;
}


export type RangedTextNode = {
    textNode: Node
    parentStartCharIndex: number
}

export type DocumentTextNodesChunk = {
    rangedTextNodes: RangedTextNode[]
    utteranceStr: string
}

export const deepCloneDocumentTextNodeChunks = (documentTextNodeChunks : DocumentTextNodesChunk[] ) => documentTextNodeChunks.map((dtn) => ({
    utteranceStr: dtn.utteranceStr,
    rangedTextNodes: dtn.rangedTextNodes.map((rtn) => ({
        textNode: rtn.textNode,
        parentStartCharIndex: rtn.parentStartCharIndex
    }))
}));



const injectTrailingSpace = (inStr : string) => inStr.replace(/([^\s])$/, "$1 ")

export function gatherAndPrepareTextNodes(wnd : Window): DocumentTextNodesChunk[] {
    const elems = getElementsWithOwnText(wnd);
    // first purge out the elements that are already accounted for because they are a child
    // of one of the elements in the original list
    const elemsWithChildren = elems.filter((el) => el.childElementCount > 0);
    const purgedElems = elems.filter((el) => elemsWithChildren.indexOf(el.parentElement as HTMLElement) < 0)

    // For each of these root-elements distill all their text-nodes as one utterance:
    // utterance is a DocumentTextNodesChunk (often a <p> block or a an <h..> element)
    return purgedElems
        .map((el) => gatherTextNodes(el))
        .map((chnk) => ({
            rangedTextNodes: chnk.reduce(
                (aggr, cur) => {
                    const parentStartCharIndex = aggr.length > 0 ? (
                                aggr[aggr.length - 1].parentStartCharIndex +
                                injectTrailingSpace(aggr[aggr.length - 1].textNode.textContent!).length
                            ) : 0;
                    return aggr.concat({
                        textNode: cur,
                        parentStartCharIndex: parentStartCharIndex
                    });
                }, [] as RangedTextNode[]
            ),
            utteranceStr: chnk.reduce((aggr, cur) => {
                return aggr + injectTrailingSpace(cur.textContent!)
            }, "")
        }))
        .filter((chnk) => chnk.utteranceStr.trim().length > 0)
}


export function getWordCharPosAtXY(x : number, y : number, textNode : Node) : number {
    if (!textNode.textContent || textNode.textContent.length === 0) { return -1; }

    const matches = textNode.textContent.matchAll(UNICODE_WORD_REGEX);
    let wordPositions = [0]
    for (const m of matches) {
        wordPositions.push(m.index)
    }
    wordPositions.push(textNode.textContent.length - 1)

    for (let wIdx = 0; wIdx < wordPositions.length - 1; wIdx++) {
        const range = new Range()
        const startPos = wordPositions[wIdx];
        const endPos =  wordPositions[wIdx + 1] 
        range.setStart(textNode, startPos);
        range.setEnd(textNode, endPos);
        range.getClientRects()
        for (let i = 0; i < range.getClientRects().length; i++) {
            const rect = range.getClientRects().item(i);
            if (rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height ) {
                return startPos;
            }
        }
    }
    return -1;
}