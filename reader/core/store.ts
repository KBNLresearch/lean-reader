import { configureStore  } from "@reduxjs/toolkit";
import readaloudNavigationReducer from "./readaloudNavigationSlice";

export const store = configureStore({
    reducer: {
        readaloudNavigation: readaloudNavigationReducer
    },
    middleware: (getDefaultMiddleWare) => getDefaultMiddleWare({serializableCheck: false})
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store