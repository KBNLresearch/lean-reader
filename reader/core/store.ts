import { configureStore  } from "@reduxjs/toolkit";
import readaloudNavigationReducer from "./readaloudNavigationSlice";
import wordDetailsReducer from "./wordDetailsSlice";


export const store = configureStore({
    reducer: {
        readaloudNavigation: readaloudNavigationReducer,
        wordDetails: wordDetailsReducer
    },
    middleware: (getDefaultMiddleWare) => getDefaultMiddleWare({serializableCheck: false})
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store