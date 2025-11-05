import { createSlice } from "@reduxjs/toolkit";
import type { DocumentTextNodesChunk, WordPositionInfo } from "./types";

type ReadaloudNavigationState = {
    documentTextNodes : DocumentTextNodesChunk[]
    lastKnownWordPosition : WordPositionInfo
    publicationIsLoading : boolean
}

const initialState : ReadaloudNavigationState = {
    publicationIsLoading: true,
    documentTextNodes: [],
    lastKnownWordPosition: {
        rangedTextNodeIndex: -1,
        documentTextNodeChunkIndex: -1,
        wordCharPos: -1
    }
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
        }
    }
});

export const {
    setLastKnownWordPosition,
    setDocumentTextNodes,
    setPublicationIsLoading
} = readaloudNavigationSlice.actions;
export default readaloudNavigationSlice.reducer;