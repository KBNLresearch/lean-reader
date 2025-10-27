import './css/style.css'

import { type FrameClickEvent, type BasicTextSelection } from '@readium/navigator-html-injectables';
// import Peripherals from './peripherals';
// import { BasicTextSelection, FrameClickEvent } from "@readium/navigator-html-injectables";
// import { BasicTextSelection, FrameClickEvent } from "@readium/navigator-html-injectables";
import { EpubNavigator, type EpubNavigatorListeners } from "@readium/navigator";
// import { Locator, Manifest, Publication } from "@readium/shared";
import type { Fetcher, Locator } from "@readium/shared";
import { HttpFetcher, Manifest, Publication } from "@readium/shared";
import { Link } from "@readium/shared";
import { gatherAndPrepareTextNodes } from './helpers/visibleElementHelpers';
import { WebSpeechReadAloudNavigator } from './readium-speech';

function hideLoadingMessage() {
  document.querySelectorAll("#loading-message").forEach((el) => (el as HTMLElement).style.display = "none");
}

const navigator = new WebSpeechReadAloudNavigator()

async function initVoices() {
  try {
    const voices = (await navigator.getVoices()).filter(v => v.language.startsWith("nl"))
    const voiceSelect = document.getElementById("voice-select")!;
    const playButton = document.getElementById("play-readaloud")!;
    voices.forEach((voice, idx) => {
      const opt = document.createElement("option");
      opt.setAttribute("value", `${idx}`);
      opt.innerHTML = `${voice.name} - ${voice.language}`
      voiceSelect.appendChild(opt);
    })
    
    if (voices.length > 0) {
      navigator.setVoice(voices[0])
      voiceSelect.addEventListener("change", (ev) => {
        navigator.setVoice(voices[parseInt((ev.target as HTMLOptionElement).value)])
      })
      if (voices.length === 1) {
        voiceSelect.setAttribute("disabled", "disabled");
      }
      playButton.addEventListener("click", () => {
        navigator.play()
      })
    } else {
      voiceSelect.style.display = "none";
      playButton.style.display = "none"
    }

  } catch (error) {
    console.error("Error initializing voices:", error);
  }
}
initVoices()


const debug = document.getElementById("debug")!;
const container = document.getElementById("container")!;

navigator.on("start", ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("end",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("pause",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("resume",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("ready",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("boundary",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("mark",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("voiceschanged",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });
navigator.on("stop",  ({ type, detail }) => { console.log(type, detail); console.log(navigator.getState()) });


async function init(bookId: string) {
  const publicationURL = `${import.meta.env.VITE_MANIFEST_SRC}/${bookId}/manifest.json`;
  const manifestLink = new Link({ href: "manifest.json" });
  const fetcher: Fetcher = new HttpFetcher(undefined, publicationURL);
  const fetched = fetcher.get(manifestLink);
  const selfLink = (await fetched.link()).toURL(publicationURL)!;
  debug.innerHTML = publicationURL;


  await fetched.readAsJSON()
    .then(async (response: unknown) => {
      const manifest = Manifest.deserialize(response as string)!;
      manifest.setSelfLink(selfLink);
      const publication = new Publication({ manifest: manifest, fetcher: fetcher });

      const listeners : EpubNavigatorListeners = {
        frameLoaded: function (wnd: Window): void {
          const documentTextNodes = gatherAndPrepareTextNodes(wnd);
            navigator.loadContent(documentTextNodes.map((dtn, idx) => ({
                id: `${idx}`,
                text: dtn.utteranceStr
            })));
        },
        positionChanged: function (locator: Locator): void {
          hideLoadingMessage();
          console.log("positionChanged locator=", locator)
        },
        tap: function (e: FrameClickEvent): boolean {
          console.log("tap e=", e )
          return true;
        },
        click: function (e: FrameClickEvent): boolean {
          console.log("click e=", e)
          return true;
        },
        zoom: function (scale: number): void {
          console.log("zoom scale=", scale)
        },
        miscPointer: function (amount: number): void {
          console.log("miscPointer amount=", amount)
        },
        scroll: function (delta: number): void {
          console.log("scroll delta=", delta)
        },
        customEvent: function (key: string, data: unknown): void {
          console.log("customEvent key=", key, "data=", data)
        },
        handleLocator: function (locator: Locator): boolean {
          console.log("handleLocator locator=", locator);
          return false;
        },
        textSelected: function (selection: BasicTextSelection): void {
          console.log("textSelected selection=", selection)
        }
      };
      const nav = new EpubNavigator(container, publication, listeners);
      await nav.load();

    })
    // .catch((error) => {
    //   console.error("Error loading manifest", error);
    //   alert(`Failed loading manifest ${selfLink}`);
    // });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search.replace("?", ""));
  const bookId = `${params.get("boek")}`;
  if (bookId) {
    init(bookId);
  } else {
    console.error("Er mist een boek ID");
  }
});