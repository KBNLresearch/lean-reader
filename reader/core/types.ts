export type RangedTextNode = {
    textNode: Node;
    parentStartCharIndex: number;
};

export type DocumentTextNodesChunk = {
    rangedTextNodes: RangedTextNode[];
    utteranceStr: string;
};

export type WordPositionInfo = {
  rangedTextNodeIndex : number
  documentTextNodeChunkIndex : number
  wordCharPos : number
}

export type ReadAloudHighlight = {
  characters : string
  rect : { top: number, left: number, width: number, height: number}
}