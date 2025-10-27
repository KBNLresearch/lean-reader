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
import { WebSpeechReadAloudNavigator, type ReadiumSpeechPlaybackEvent } from './readium-speech';

function hideLoadingMessage() {
  document.querySelectorAll("#loading-message").forEach((el) => (el as HTMLElement).style.display = "none");
}

const navigator = new WebSpeechReadAloudNavigator()
const playButton = document.getElementById("play-readaloud")!;

const VOICE_URI_KEY = "voiceURI";
async function initVoices() {
  try {
    const voices = (await navigator.getVoices()).filter(v => v.language.startsWith("nl"))
    const voiceSelect = document.getElementById("voice-select")!;
    voices.forEach((voice, idx) => {
      const opt = document.createElement("option");
      opt.setAttribute("value", `${idx}`);
      if (voice.voiceURI === localStorage.getItem(VOICE_URI_KEY)) {
        opt.setAttribute("selected", "selected");
      }
      opt.innerHTML = `${voice.name} - ${voice.language}`
      voiceSelect.appendChild(opt);
    })
    if (voices.length > 0) {
      const storedVoice = voices.find((v) => v.voiceURI === localStorage.getItem(VOICE_URI_KEY));
      if (storedVoice) {
        navigator.setVoice(storedVoice);
      } else {
        navigator.setVoice(voices[0])
      }
      voiceSelect.addEventListener("change", (ev) => {
        const voice = voices[parseInt((ev.target as HTMLOptionElement).value)];
        navigator.setVoice(voice)
        localStorage.setItem(VOICE_URI_KEY, voice.voiceURI)
      })
      if (voices.length === 1) {
        voiceSelect.setAttribute("disabled", "disabled");
      }
      playButton.addEventListener("click", onPlayButtonClicked)
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

function onPlayButtonClicked() {
  if (navigator.getState() === "playing") {
      navigator.pause()
  } else {
      navigator.play()
  }
}

function handleWebSpeechNavigatorEvent({ type, detail } : ReadiumSpeechPlaybackEvent) {
  console.log(`WebSpeechNavigatorEvent state: ${navigator.getState()}`, `Event type: ${type}`, "details:", detail)
  switch (navigator.getState()) {
    case "playing":
      playButton.removeAttribute("disabled");
      playButton.innerHTML = "⏸︎"
      break;
    case "loading":
      playButton.setAttribute("disabled", "disabled");
      playButton.innerHTML = "⏵︎"
      break;
    case "ready":
    case "idle":
    case "paused":
    default:
      playButton.removeAttribute("disabled");
      playButton.innerHTML = "⏵︎"
  }
}

navigator.on("start",handleWebSpeechNavigatorEvent);
navigator.on("end", handleWebSpeechNavigatorEvent);
navigator.on("pause", handleWebSpeechNavigatorEvent);
navigator.on("resume", handleWebSpeechNavigatorEvent);
navigator.on("ready", handleWebSpeechNavigatorEvent);
navigator.on("boundary", handleWebSpeechNavigatorEvent);
navigator.on("mark", handleWebSpeechNavigatorEvent);
navigator.on("voiceschanged", handleWebSpeechNavigatorEvent);
navigator.on("stop", handleWebSpeechNavigatorEvent);


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