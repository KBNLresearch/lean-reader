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
import { detectPlatformFeatures } from './readium-speech/utils/patches';

const debug = document.getElementById("debug")!;

const pmc = {
  debug: (...args : any[]) => { console.debug(args); debug.innerHTML += `<div style="color: gray">${args}</div>`; debug.scrollTo(0, debug.scrollHeight) },
  log: (...args : any[]) => { console.log(args); debug.innerHTML += `<div style="color: black">${args}</div>`; debug.scrollTo(0, debug.scrollHeight) },
  warn: (...args : any[]) => { console.warn(args); debug.innerHTML += `<div style="color: dark-yellow">${args}</div>`; debug.scrollTo(0, debug.scrollHeight) },
  error: (...args : any[]) => { console.error(args); debug.innerHTML += `<div style="color: red">${args}</div>`; debug.scrollTo(0, debug.scrollHeight) },
};

let toggledDebug = false;
debug.addEventListener("click", () => {
  if (toggledDebug) {
    debug.style.height = "";
    debug.style.overflow = "hidden";
    toggledDebug = false
  } else {
    debug.style.height = "45%";
    debug.style.overflow = "auto";
    toggledDebug = true
  }
})

const { isAndroid, isFirefox } = detectPlatformFeatures()

function hideLoadingMessage() {
  document.querySelectorAll("#loading-message").forEach((el) => (el as HTMLElement).style.display = "none");
}

const navigator = new WebSpeechReadAloudNavigator()
const playButton = document.getElementById("play-readaloud")!;
const rateSlowerButton = document.getElementById("rate-slower")!;
const rateFasterButton = document.getElementById("rate-faster")!;
const rateNormalButton = document.getElementById("rate-percentage")!;
const VOICE_URI_KEY = "voiceURI";
let utteranceIndex = -1;
let voicesInitialized = false;
const voiceSelect = document.getElementById("voice-select")!;

async function initVoices() {
  if (voicesInitialized) {
    return;
  }
  voicesInitialized = true;
  try {
    const unfilteredVoices = await navigator.getVoices();
    const dutchVoices = (unfilteredVoices).filter(v => v.language.startsWith("nl"))
    const voices = dutchVoices.length === 0 ? unfilteredVoices : dutchVoices;
    if (voices.length > 0) {
      voices.forEach((voice, idx) => {
        const opt = document.createElement("option");
        opt.setAttribute("value", `${idx}`);
        if (voice.voiceURI === localStorage.getItem(VOICE_URI_KEY)) {
          opt.setAttribute("selected", "selected");
        }
        opt.innerHTML = `${voice.name} - ${voice.language}`
        voiceSelect.appendChild(opt);
      })
      const storedVoice = voices.find((v) => v.voiceURI === localStorage.getItem(VOICE_URI_KEY));
      if (storedVoice) {
        navigator.setVoice(storedVoice);
      } else {
        navigator.setVoice(voices[0])
      }
      // FIXME: extract function
      voiceSelect.addEventListener("change", (ev) => {
        const voice = voices[parseInt((ev.target as HTMLOptionElement).value)];
        navigator.stop()
        const contentQueue = navigator.getContentQueue();
        navigator.setVoice(voice);
        navigator.loadContent(contentQueue || []);
        localStorage.setItem(VOICE_URI_KEY, voice.voiceURI)
      })
//      navigator.setRate(2.0)

      document.getElementById("voices-are-pending")?.remove();
      if (voices.length === 1) {
        voiceSelect.setAttribute("disabled", "disabled");
      } else {
        voiceSelect.removeAttribute("disabled");
      }
      playButton.addEventListener("click", onPlayButtonClicked);
      rateFasterButton.addEventListener("click", () => adjustPlaybackRate(navigator.getPlaybackRate() + 0.25));
      rateSlowerButton.addEventListener("click", () => adjustPlaybackRate(navigator.getPlaybackRate() - 0.25));
      rateNormalButton.addEventListener("click", () => adjustPlaybackRate(1.0));
      document.querySelectorAll(".readaloud-control").forEach((el) => { (el as HTMLElement).style.display = "inline-block"; })
    } else {
      document.getElementById("no-voices-found")!.style.display = "inline";
      document.querySelectorAll(".readaloud-control").forEach((el) => { (el as HTMLElement).style.display = "none"; })
    }

  } catch (error) {
    pmc.error("Error initializing voices:", error);
      document.getElementById("no-voices-found")!.style.display = "inline";
      document.querySelectorAll(".readaloud-control").forEach((el) => { (el as HTMLElement).style.display = "none"; })
    }
}
navigator.on("ready", initVoices);


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

function onPublicationClicked({x, y} : {x: number, y : number}) {
  pmc.debug(`Frame clicked at ${x}/${y}`);

  documentTextNodes.forEach((dtn) => {
    dtn.rangedTextNodes.forEach((rtn) => {
      const range = new Range()
      range.setStart(rtn.textNode, 0);
      range.setEnd(rtn.textNode, rtn.textNode.textContent!.length - 1);
      range.getClientRects()
      for (let i = 0; i < range.getClientRects().length; i++) {
        const rect = range.getClientRects().item(i);
        if (rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height ) {
          pmc.debug(`UT: ${dtn.utteranceStr}`)
          pmc.log("found: " + rtn.textNode.textContent);
        }
      }
      //pmc.log(rtn.textNode, rtn.textNode.textContent)
    })
  })
}

function reloadContentQueue() {
    navigator.stop()
    const contentQueue = navigator.getContentQueue()
    navigator.loadContent(contentQueue);
}


function adjustPlaybackRate(newRate : number) {
  if (newRate > 0.0 && newRate <= 2.0) {
    navigator.setRate(newRate);
    rateNormalButton.innerHTML = `${Math.floor(navigator.getPlaybackRate() * 100)}%`;
    reloadContentQueue();
    pmc.warn("FIXME: hack pause/resume in by splitting utterances at current boundary")
  }
}

function onPlayButtonClicked() {
  pmc.log(`Play button clicked with navigator state: ${navigator.getState()}`);
  if (navigator.getState() === "playing") {
    if (isAndroid && isFirefox) {
      pmc.warn("FIXME: hack pause/resume in by splitting utterances at current boundary")
    } else {
      navigator.pause();

    }
  } else if (navigator.getState() === "paused") {
    if (isAndroid && isFirefox) {
      pmc.warn("FIXME: android+firefox should not reach this point now")
    } else {
      navigator.play()
    }
  } else if (utteranceIndex > -1) {
    if (isAndroid && isFirefox) {
      pmc.warn("FIXME: figure out android firefox problem here")
    }
    navigator.jumpTo(utteranceIndex);
  }
}


function handleWebSpeechNavigatorEvent({ type, detail } : ReadiumSpeechPlaybackEvent) {
  pmc.log(`WebSpeechNavigatorEvent state: ${navigator.getState()}`, `Event type: ${type}`, "details:", detail)
  switch (navigator.getState()) {
    case "playing":
      playButton.removeAttribute("disabled");
      playButton.querySelector("img")?.setAttribute("src", "../icons/pause.svg")
      break;
    case "loading":
      playButton.setAttribute("disabled", "disabled");
      playButton.querySelector("img")?.setAttribute("src", "../icons/play.svg")
      clearHighlights();
      break;
    case "ready":
    case "idle":
      playButton.removeAttribute("disabled");
      playButton.querySelector("img")?.setAttribute("src", "../icons/play.svg")
      clearHighlights();
      break
    case "paused":
    default:
      playButton.querySelector("img")?.setAttribute("src", "../icons/play.svg")
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

function handleIframeClick(e : any) {
  onPublicationClicked({x:  e.x, y: e.y + container.clientTop});
}

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
          pmc.debug("--frame loaded---", wnd);

        },
        positionChanged: function (locator: Locator): void {
          hideLoadingMessage();
          pmc.debug("positionChanged locator=", locator)
          navigator.stop();
          document.querySelectorAll("iframe").forEach((fr, idx) => {
            if (fr.style.visibility != "hidden") {
              fr.contentWindow?.removeEventListener("click", handleIframeClick);
              fr.contentWindow?.addEventListener("click", handleIframeClick)
              pmc.debug(`iframe being used (${idx}): `, fr);
              const navWnd = (fr as HTMLIFrameElement).contentWindow;

              documentTextNodes = gatherAndPrepareTextNodes(navWnd!);
              navigator.loadContent(documentTextNodes.map((dtn, idx) => ({
                  id: `${idx}`,
                  text: dtn.utteranceStr
              })));
              const utteranceIndices = documentTextNodes.map((dtn, idx) => {
                  if (dtn.rangedTextNodes.find((rt) => isTextNodeVisible(navWnd!, rt.textNode))) {
                      return idx;
                  }
                  return -1;
              }).filter((idx) => idx > -1);

              if (utteranceIndices.length > 0) {
                utteranceIndex = utteranceIndices[0];
              } else {
                utteranceIndex = -1;
              }
            }
          });
          if (nav.canGoForward) {
            document.getElementById("next-page")!.style.visibility = "visible";
          } else {
            document.getElementById("next-page")!.style.visibility = "hidden";
          }
          if (nav.canGoBackward) {
            document.getElementById("previous-page")!.style.visibility = "visible";
          } else {
            document.getElementById("previous-page")!.style.visibility = "hidden";
          }
        },
        tap: function (e: FrameClickEvent): boolean {
          pmc.debug("tap e=", e)
          return true;
        },
        click: function (e: FrameClickEvent): boolean {
          pmc.debug("click e=", e)
          return true;
        },
        zoom: function (scale: number): void {
            pmc.debug("zoom scale=", scale)
        },
        miscPointer: function (amount: number): void {
            pmc.debug("miscPointer amount=", amount)
        },
        scroll: function (delta: number): void {
            pmc.debug("scroll delta=", delta)
        },
        customEvent: function (key: string, data: unknown): void {
            pmc.debug("customEvent key=", key, "data=", data)
        },
        handleLocator: function (locator: Locator): boolean {
            pmc.debug("handleLocator locator=", locator);
          return false;
        },
        textSelected: function (selection: BasicTextSelection): void {
            pmc.debug("textSelected selection=", selection)
        }
      };
      const nav = new EpubNavigator(container, publication, listeners);
      await nav.load();
      document.getElementById("next-page")?.addEventListener("click", () => nav.goForward(true, pmc.debug))
      document.getElementById("previous-page")?.addEventListener("click", () => nav.goBackward(true, pmc.debug))
    })
    // .catch((error) => {
    //   pmc.error("Error loading manifest", error);
    //   alert(`Failed loading manifest ${selfLink}`);
    // });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search.replace("?", ""));
  const bookId = `${params.get("boek")}`;
  if (bookId) {
    init(bookId);
  } else {
    pmc.error("Er mist een boek ID");
  }
});

window.addEventListener("unload", () => navigator.stop())