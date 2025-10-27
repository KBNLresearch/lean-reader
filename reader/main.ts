import './css/style.css';
import './css/highlighting.css';
import { type FrameClickEvent, type BasicTextSelection } from '@readium/navigator-html-injectables';
// import Peripherals from './peripherals';
// import { BasicTextSelection, FrameClickEvent } from "@readium/navigator-html-injectables";
// import { BasicTextSelection, FrameClickEvent } from "@readium/navigator-html-injectables";
import { EpubNavigator, type EpubNavigatorListeners } from "@readium/navigator";
// import { Locator, Manifest, Publication } from "@readium/shared";
import type { Fetcher, Locator } from "@readium/shared";
import { HttpFetcher, Manifest, Publication } from "@readium/shared";
import { Link } from "@readium/shared";
import { gatherAndPrepareTextNodes, isTextNodeVisible, type DocumentTextNodesChunk } from './helpers/visibleElementHelpers';
import { WebSpeechReadAloudNavigator, type ReadiumSpeechPlaybackEvent } from './readium-speech';

function hideLoadingMessage() {
  document.querySelectorAll("#loading-message").forEach((el) => (el as HTMLElement).style.display = "none");
}

const navigator = new WebSpeechReadAloudNavigator()
const playButton = document.getElementById("play-readaloud")!;
const VOICE_URI_KEY = "voiceURI";
let utteranceIndex = -1;

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
let documentTextNodes : DocumentTextNodesChunk[] = []

function clearHighlights() {
  document.querySelectorAll(".word-highlight").forEach((el) => el.remove())
 
}

function setWordRects(wordRects : DOMRect[]) {
  clearHighlights();
  wordRects.forEach((rect) => {
    const hlDiv = document.createElement("div");
    hlDiv.className = "word-highlight";
    hlDiv.style.top = `${rect.top}px`;
    hlDiv.style.left = `${rect.left}px`;
    hlDiv.style.width = `${rect.right - rect.left}px`;
    hlDiv.style.height = `${rect.bottom - rect.top}px`;
    container.appendChild(hlDiv);
  });
}

function onPlayButtonClicked() {
  console.log(navigator.getState());
  if (navigator.getState() === "playing") {
      navigator.pause()
  } else if (navigator.getState() === "paused") {
    navigator.play()
  } else if (utteranceIndex > -1) {
    navigator.jumpTo(utteranceIndex);
  }
}

function handlePositionChange(utteranceIndices : number[]) {
  navigator.stop();
  if (utteranceIndices.length === 1) {
    utteranceIndex = utteranceIndices[0];
  } else if (utteranceIndices.length > 1) {
    utteranceIndex = utteranceIndices[1];
  } else {
    utteranceIndex = -1;
  }
}

function handleWebSpeechNavigatorEvent({ type, detail } : ReadiumSpeechPlaybackEvent) {
  console.log(`WebSpeechNavigatorEvent state: ${navigator.getState()}`, `Event type: ${type}`, "details:", detail)
  switch (navigator.getState()) {
    case "playing":
      playButton.removeAttribute("disabled");
      playButton.innerHTML = "⏸︎";
      break;
    case "loading":
      playButton.setAttribute("disabled", "disabled");
      playButton.innerHTML = "⏵︎";
      clearHighlights();
      break;
    case "ready":
    case "idle":
      playButton.removeAttribute("disabled");
      playButton.innerHTML = "⏵︎";      
      clearHighlights();
      break
    case "paused":
    default:
      playButton.removeAttribute("disabled");
      playButton.innerHTML = "⏵︎";
  }
  if (type === "boundary" && navigator.getState() === "playing") {
    const { charIndex, charLength, name } = detail;
    if (name !== "word") { return; }
    const utIdx = parseInt(navigator.getCurrentContent()!.id!)
    let firstTextNodeIndex = -1, lastTextNodeIndex = -1;
    for (let idx = 0; idx < (documentTextNodes[utIdx]?.rangedTextNodes || []).length; idx++) {
        const rtn = documentTextNodes[utIdx].rangedTextNodes[idx];
        if (rtn.parentStartCharIndex <= charIndex) {
            firstTextNodeIndex = idx;
            lastTextNodeIndex = idx
        }
        if (firstTextNodeIndex > -1 && rtn.parentStartCharIndex + rtn.textNode.textContent!.length <= charIndex + charLength) {
            lastTextNodeIndex = idx
        }
    }
    if (firstTextNodeIndex > -1) {
        // const sel = wnd.getSelection();
        // sel?.removeAllRanges();
        let newWordRects : DOMRect[] = []
        for (let rtnIdx = firstTextNodeIndex; rtnIdx <= lastTextNodeIndex; rtnIdx++) {
            const rtn = documentTextNodes[utIdx].rangedTextNodes[rtnIdx];
            const chBegin = charIndex - rtn.parentStartCharIndex;
            const chEnd = charIndex - rtn.parentStartCharIndex + charLength;
            const rangeBegin = chBegin < 0 ? 0 : chBegin >  (rtn.textNode.textContent || "").length ?  (rtn.textNode.textContent || "").length : chBegin;
            const rangeEnd = chEnd > (rtn.textNode.textContent || "").length ? (rtn.textNode.textContent || "").length : chEnd
            const range = new Range()
            range.setStart(rtn.textNode, rangeBegin);
            range.setEnd(rtn.textNode, rangeEnd);
            // sel?.addRange(range);
            for (let i = 0; i < range.getClientRects().length; i++) {
                newWordRects.push(range.getClientRects().item(i)!);
            }
        }
        setWordRects(newWordRects)
    }
    // if (navigator.getState() === "playing") {
    //     setUtteranceIndex(utIdx)
    // }
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
          documentTextNodes = gatherAndPrepareTextNodes(wnd);
          navigator.loadContent(documentTextNodes.map((dtn, idx) => ({
              id: `${idx}`,
              text: dtn.utteranceStr
          })));
        },
        positionChanged: function (locator: Locator): void {
          hideLoadingMessage();
          console.log("positionChanged locator=", locator)
          document.querySelectorAll("iframe").forEach((fr) => {
            if (fr.style.visibility != "hidden") {
              const navWnd = (fr as HTMLIFrameElement).contentWindow;
              const utteranceIndices = documentTextNodes.map((dtn, idx) => {
                  if (dtn.rangedTextNodes.find((rt) => isTextNodeVisible(navWnd!, rt.textNode))) {
                      return idx;
                  }
                  return -1;
              }).filter((idx) => idx > -1);
              handlePositionChange(utteranceIndices)
            }
          });
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