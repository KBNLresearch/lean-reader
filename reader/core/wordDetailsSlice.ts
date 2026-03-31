import { createSlice } from "@reduxjs/toolkit";
import blauw from "../assets/img/blauw.jpg";
import bomen from "../assets/img/bomen.webp";
import doek from "../assets/img/doek.avif";
import huis from "../assets/img/huis.jpg";
import kapot from "../assets/img/kapot.webp";
import lachen from "../assets/img/lachen.webp"
import langzaam from "../assets/img/langzaam.jpg";
import lucht from "../assets/img/lucht.avif";
import moe from "../assets/img/moe.jpg";
import nat from "../assets/img/nat.jpg";
import regent from "../assets/img/regent.jpg";
import rondjeRijden from "../assets/img/rondje-rijden.jpg";
import sterk from "../assets/img/sterk.jpg";
import trappers from "../assets/img/trappers.jpg";
import trots from "../assets/img/trots.jpg";
import tweedehands from "../assets/img/tweedehands.png";
import voeten from "../assets/img/voeten.avif";
import vogels from "../assets/img/vogels.webp";
import wind from "../assets/img/wind.jpg";
import zon from "../assets/img/zon.jpg";


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
        "lachen": { translation: "laughing", imageSrc: lachen },
        "doek": { translation: "blanket", imageSrc: doek },
        "moe": { translation: "tired", imageSrc: moe  },
        "nat": { translation: "wet", imageSrc: nat },
        "regent": { translation: "raining", imageSrc: regent },
        "huis": { translation: "home", imageSrc: huis },
        "kapot": { translation: "broken", imageSrc: kapot },
        "tweedehands": { translation: "second hand", imageSrc: tweedehands },
        "blauwe": { translation: "blue", imageSrc: blauw },
        "blij": { translation: "happy", imageSrc:  ""},
        "wind": { translation: "wind", imageSrc: wind },
        "rondje rijden": { translation: "go for a ride", imageSrc: rondjeRijden },
        "zon": { translation: "sun", imageSrc: zon },
        "trappers": { translation: "pedals", imageSrc: trappers },
        "langzaam": { translation: "slowly", imageSrc: langzaam },
        "lucht": { translation: "sky", imageSrc: lucht },
        "vogels": { translation: "birds", imageSrc: vogels },
        "bomen": { translation: "trees", imageSrc: bomen },
        "trots": { translation: "proud", imageSrc: trots },
        "eenden": { translation: "ducks", imageSrc: ""  },
        "sterk": { translation: "strong", imageSrc: sterk },
        "voeten": { translation: "feet", imageSrc: voeten }
    },
    collectedWords: [
        {word: "sterk", collapsed: false},
        {word: "lachen", collapsed: true}
    ]
}

export const wordtDetailsSlice = createSlice({
    name: "wordtDetails",
    initialState,
    reducers: {

    }
});

export const {
} = wordtDetailsSlice.actions;
export default wordtDetailsSlice.reducer;