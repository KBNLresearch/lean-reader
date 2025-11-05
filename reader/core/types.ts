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