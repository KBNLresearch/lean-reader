import { createSlice } from "@reduxjs/toolkit";
import type { DocumentTextNodesChunk, WordPositionInfo, ReadAloudHighlight } from "./types";

type ReadaloudNavigationState = {
    documentTextNodes : DocumentTextNodesChunk[]
    lastKnownWordPosition : WordPositionInfo
    publicationIsLoading : boolean
    highlights : ReadAloudHighlight[]
}

const initialState : ReadaloudNavigationState = {
    publicationIsLoading: true,
    documentTextNodes: [],
    lastKnownWordPosition: {
        rangedTextNodeIndex: -1,
        documentTextNodeChunkIndex: -1,
        wordCharPos: -1
    },
    highlights: []
}

export const readaloudNavigationSlice = createSlice({
    name: "readaloudNavigation",
    initialState,
    reducers: {
        setLastKnownWordPosition(state, { payload }) {
            state.lastKnownWordPosition = payload;
        },
        setDocumentTextNodes(state, { payload }) {
            state.documentTextNodes = payload;
        },
        setPublicationIsLoading(state, { payload }) {
            state.publicationIsLoading = payload;
        },
        setHightlights(state, { payload }) {
            state.highlights = payload
        }
    }
});

export const {
    setLastKnownWordPosition,
    setDocumentTextNodes,
    setPublicationIsLoading,
    setHightlights
} = readaloudNavigationSlice.actions;
export default readaloudNavigationSlice.reducer;