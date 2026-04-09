import { createSlice } from "@reduxjs/toolkit";
import blauw from "../assets/img/blauw.png";
import bomen from "../assets/img/bomen.png";
import doek from "../assets/img/doek.png";
import eenden from "../assets/img/eend.png";
import huis from "../assets/img/huis.png";
import kapot from "../assets/img/kapot.png";
import lachen from "../assets/img/lachen.jpg"
import langzaam from "../assets/img/langzaam.png";
import lucht from "../assets/img/lucht.png";
import moe from "../assets/img/moe.png";
import nat from "../assets/img/nat.png";
import regent from "../assets/img/regent.png";
import rondjeRijden from "../assets/img/rondje-rijden.png";
import sterk from "../assets/img/sterk.png";
import trappers from "../assets/img/trappers.png";
import trots from "../assets/img/trots.png";
import tweedehands from "../assets/img/tweedehands.png";
import voeten from "../assets/img/voeten.png";
import vogels from "../assets/img/vogels.png";
import wind from "../assets/img/wind.png";
import zon from "../assets/img/zon.png";
import { UNICODE_WORD_REGEX } from "./textNodeHelper";


export type WordDetail = {
    translation:  string,
    imageSrc: string
}

export type CollectedWord = {
    collapsed : boolean
    word : string
}

type WordtDetailsState = {
    collectedWords : CollectedWord[]
    dictionary : {[key : string]: WordDetail}
}

const initialState : WordtDetailsState = {
    dictionary : {
        "lacht": { translation: "laughing", imageSrc: lachen },
        "blij": { translation: "happy", imageSrc: lachen },
        "doek": { translation: "blanket", imageSrc: doek },
        "moe": { translation: "tired", imageSrc: moe  },
        "nat": { translation: "wet", imageSrc: nat },
        "regent": { translation: "raining", imageSrc: regent },
        "huis": { translation: "home", imageSrc: huis },
        "kapot": { translation: "broken", imageSrc: kapot },
        "tweedehands": { translation: "second hand", imageSrc: tweedehands },
        "blauwe": { translation: "blue", imageSrc: blauw },
        "wind": { translation: "wind", imageSrc: wind },
        "rondje rijden": { translation: "go for a ride", imageSrc: rondjeRijden },
        "zon": { translation: "sun", imageSrc: zon },
        "trappers": { translation: "pedals", imageSrc: trappers },
        "langzaam": { translation: "slowly", imageSrc: langzaam },
        "lucht": { translation: "sky", imageSrc: lucht },
        "vogels": { translation: "birds", imageSrc: vogels },
        "bomen": { translation: "trees", imageSrc: bomen },
        "trots": { translation: "proud", imageSrc: trots },
        "eenden": { translation: "ducks", imageSrc: eenden  },
        "sterk": { translation: "strong", imageSrc: sterk },
        "voeten": { translation: "feet", imageSrc: voeten }
    },
    collectedWords: [
    ]
}

export const wordtDetailsSlice = createSlice({
    name: "wordtDetails",
    initialState,
    reducers: {
        toggleWordCollapse(state, { payload }) {
            state.collectedWords = state.collectedWords.map((cw) => ({
                ...cw,
                collapsed: payload === cw.word ? !cw.collapsed : cw.collapsed
            }))
        },
        checkDictionary(state, {payload} : {payload : string}) {
            const matches = payload.toLowerCase().matchAll(UNICODE_WORD_REGEX);
            const words : string[] = [];
            for (const m of matches) {
                words.push(m[0]);
                if (m[0] in state.dictionary && state.collectedWords.map(({word}) => word).indexOf(m[0]) < 0) {
                    state.collectedWords.push({word: m[0], collapsed: false})
                }
            }
            state.collectedWords = state.collectedWords.map((cw) => ({
                ...cw,
                collapsed: words.indexOf(cw.word) < 0
            }))
        }
    }
});

export const {
    toggleWordCollapse,
    checkDictionary
} = wordtDetailsSlice.actions;
export default wordtDetailsSlice.reducer;