import './css/style.css';
import './css/highlighting.css';
import playIcon from './icons/play.svg';
import pauseIcon from './icons/pause.svg';

import { type FrameClickEvent, type BasicTextSelection } from '@readium/navigator-html-injectables';
import { EpubNavigator, type EpubNavigatorListeners } from "@readium/navigator";
import type { Fetcher, Locator } from "@readium/shared";
import { HttpFetcher, Manifest, Publication } from "@readium/shared";
import { Link } from "@readium/shared";
import { gatherAndPrepareTextNodes, getFirstVisibleWordCharPos, getWordCharPosAtXY, isTextNodeVisible } from './core/textNodeHelper';
import { type ReadAloudHighlight, type WordPositionInfo } from "./core/types";
import { WebSpeechReadAloudNavigator, type ReadiumSpeechPlaybackEvent, type ReadiumSpeechVoice } from './readium-speech';
import { detectPlatformFeatures } from './readium-speech/utils/patches';
import { createPoorMansConsole } from "./util/poorMansConsole";
import { store } from './core/store';
import { setDocumentTextNodes, setHighlights, setLastKnownWordPosition, setPublicationIsLoading, setSelection } from './core/readaloudNavigationSlice';

const { isAndroid } = detectPlatformFeatures()
const pmc = createPoorMansConsole(document.getElementById("debug")!);
const container = document.getElementById("container")!;

function renderHtmlElements() {
  const { publicationIsLoading, highlights, lastKnownWordPosition } = store.getState().readaloudNavigation;
  document.querySelectorAll("#loading-message").forEach((el) => (el as HTMLElement).style.display = publicationIsLoading ? "block" : "none");
  document.querySelectorAll(".word-highlight").forEach((el) => el.remove())
  highlights.forEach(({ rect, characters }) => {
     const hlDiv = document.createElement("div");
     hlDiv.innerHTML = characters;
     hlDiv.className = "word-highlight";
     hlDiv.style.top = `${rect.top}px`;
     hlDiv.style.left = `${rect.left}px`;
     hlDiv.style.width = `${rect.width}px`;
     hlDiv.style.height = `${rect.height}px`;
     container.appendChild(hlDiv);
   });
   pmc.debug("rendered", highlights, lastKnownWordPosition);
}

store.subscribe(renderHtmlElements);

const navigator = new WebSpeechReadAloudNavigator()
const playButton = document.getElementById("play-readaloud")!;
const rateSlowerButton = document.getElementById("rate-slower")!;
const rateFasterButton = document.getElementById("rate-faster")!;
const rateNormalButton = document.getElementById("rate-percentage")!;
const VOICE_URI_KEY = "voiceURI";
let voicesInitialized = false;
const voiceSelect = document.getElementById("voice-select")!;

async function initVoices() {
  if (voicesInitialized) {
    return;
  }
  voicesInitialized = true;
  try {
    const unfilteredVoices = await navigator.getVoices();
    pmc.warn("CHECK VOICES ", unfilteredVoices)
    const dutchVoices = (unfilteredVoices).filter(v => v.language.startsWith("nl-NL"))
    const voices = dutchVoices.length === 0 ? unfilteredVoices : dutchVoices;
    if (voices.length > 0) {
      voices.forEach((voice, idx) => {
        const opt = document.createElement("option");
        opt.setAttribute("value", `${idx}`);
        if (voice.voiceURI === localStorage.getItem(VOICE_URI_KEY)) {
          opt.setAttribute("selected", "selected");
        }
        opt.innerHTML = `${voice.name
            .replace("Microsoft ", "")
            .replace(/\s.*$/, "")
        }`
        pmc.log(voice)
        voiceSelect.appendChild(opt);
      })
      const storedVoice = voices.find((v) => v.voiceURI === localStorage.getItem(VOICE_URI_KEY));
      if (storedVoice) {
        navigator.setVoice(storedVoice);
      } else {
        navigator.setVoice(voices[0])
      }
      voiceSelect.addEventListener("change", (ev) => {
        changeVoiceTo(voices[parseInt((ev.target as HTMLOptionElement).value)]);
      })

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


function initializePreferenceButtons(nav : EpubNavigator) {
  document.querySelectorAll("[name='paginate']")?.forEach((el) => el.addEventListener("change", (ev) => {
    const scrollWasSelected = (ev.target as HTMLInputElement).value === "no";
    const editor = nav.preferencesEditor;
    if (scrollWasSelected !== editor.scroll.effectiveValue) {
      editor.scroll.toggle();
      nav.submitPreferences(editor.preferences);
    }
  }));
}


function findClickedOnWordPosition({x, y} : {x: number, y : number}): WordPositionInfo {
  const { documentTextNodes } = store.getState().readaloudNavigation;
  for (let dtnIdx = 0; dtnIdx < documentTextNodes.length; dtnIdx++) {
    const dtn = documentTextNodes[dtnIdx];
    for (let rtnIdx = 0; rtnIdx < dtn.rangedTextNodes.length; rtnIdx++) {
      const rtn = dtn.rangedTextNodes[rtnIdx];
      const wordCharPos = getWordCharPosAtXY(x, y, rtn.textNode);
      if (wordCharPos > -1) {
        return {rangedTextNodeIndex: rtnIdx, documentTextNodeChunkIndex: dtnIdx, wordCharPos: wordCharPos}
      }
    }
  }
  return {rangedTextNodeIndex: -1, documentTextNodeChunkIndex: -1, wordCharPos: -1};
}


function jumpToWord({ rangedTextNodeIndex, documentTextNodeChunkIndex, wordCharPos} : WordPositionInfo, shouldPause = false) {
  pmc.debug(`jumping to word at: dtn=${documentTextNodeChunkIndex}, rtn=${rangedTextNodeIndex}, wrd=${wordCharPos}`);
  if (documentTextNodeChunkIndex < 0) { 
    return
  } else if (rangedTextNodeIndex < 0 || wordCharPos < 0) {
    navigator.jumpTo(documentTextNodeChunkIndex);
    return
  }
  const { documentTextNodes } = store.getState().readaloudNavigation;
  const dtn = documentTextNodes[documentTextNodeChunkIndex];
  const rtn = dtn.rangedTextNodes[rangedTextNodeIndex];
  const utChIdx = rtn.parentStartCharIndex + wordCharPos
  const utteranceStrAfter = dtn.utteranceStr.substring(utChIdx, dtn.utteranceStr.length - 1); 

  store.dispatch(setLastKnownWordPosition({documentTextNodeChunkIndex: documentTextNodeChunkIndex, rangedTextNodeIndex: rangedTextNodeIndex, wordCharPos: wordCharPos}));

  navigator.stop()
  navigator.loadContent(documentTextNodes.map((dtn, idx) => ({
    id: `${idx}`,
    text: idx === documentTextNodeChunkIndex ?  " ".repeat(utChIdx) + utteranceStrAfter : dtn.utteranceStr
  })));
  if (!shouldPause) {
    navigator.jumpTo(documentTextNodeChunkIndex);
  }
}


function onPublicationClicked({x, y} : {x: number, y : number}) {
  pmc.debug(`Frame clicked at ${x}/${y}`);
  reloadDocumentTextNodes();
  const result = findClickedOnWordPosition({x, y});
  jumpToWord(result);
}


function reloadDocumentTextNodes() {
  const { documentTextNodes } = store.getState().readaloudNavigation
  navigator.loadContent([]);
  navigator.loadContent(documentTextNodes.map((dtn, idx) => ({
      id: `${idx}`,
      text: dtn.utteranceStr
  })));
}


function changeVoiceTo(voice: ReadiumSpeechVoice) {
  const shouldResume = navigator.getState() === "playing";
  navigator.stop();
  navigator.setVoice(voice);
  localStorage.setItem(VOICE_URI_KEY, voice.voiceURI)
  if (shouldResume) {
    const { lastKnownWordPosition, selection } = store.getState().readaloudNavigation
    if (selection) {
      navigator.play();
    } else {
      jumpToWord(lastKnownWordPosition);
    }
  }
}


function adjustPlaybackRate(newRate : number) {
  if (newRate > 0.0 && newRate <= 2.0) {
    navigator.setRate(newRate);
    rateNormalButton.innerHTML = `${Math.floor(navigator.getPlaybackRate() * 100)}%`;
    const shouldResume = navigator.getState() === "playing";
    navigator.stop();
    if (shouldResume) {
      const { lastKnownWordPosition, selection } = store.getState().readaloudNavigation
      if (selection) {
        navigator.play();
      } else {
        jumpToWord(lastKnownWordPosition);
      }
    }
  }
}

function onPlayButtonClicked() {
  const { lastKnownWordPosition, selection } = store.getState().readaloudNavigation
  pmc.debug(`Play button clicked with navigator state: ${navigator.getState()}`);
  if (navigator.getState() === "playing") {
    if (isAndroid) {
      navigator.stop();
    } else {
      navigator.pause();
    }
    playButton.querySelector("img")?.setAttribute("src", playIcon)
  } else if (navigator.getState() === "paused") {
    navigator.play()
  } else if (lastKnownWordPosition.documentTextNodeChunkIndex > -1) {
    if (selection) {
      navigator.play();
    } else {
      jumpToWord(lastKnownWordPosition);
    }
  }
}


function handleWebSpeechNavigatorEvent({ type, detail } : ReadiumSpeechPlaybackEvent) {
  pmc.debug(`WebSpeechNavigatorEvent state: ${navigator.getState()}`, `Event type: ${type}`, "details:", detail)
  switch (navigator.getState()) {
    case "playing":
      playButton.removeAttribute("disabled");
      playButton.querySelector("img")?.setAttribute("src", pauseIcon)
      break;
    case "loading":
      playButton.setAttribute("disabled", "disabled");
      playButton.querySelector("img")?.setAttribute("src", playIcon)
      store.dispatch(setHighlights([]))
      break;
    case "ready":
    case "idle":
      playButton.removeAttribute("disabled");
      playButton.querySelector("img")?.setAttribute("src", playIcon)
      break
    case "paused":
    default:
      playButton.querySelector("img")?.setAttribute("src", playIcon)
  }

  if (type === "end") {
    store.dispatch(setHighlights([]))
  }

  if (type === "boundary" && navigator.getState() === "playing") {
    const { documentTextNodes } = store.getState().readaloudNavigation
    const { charIndex, charLength, name } = detail;
    if (name !== "word") { return; }
    const utIdx = parseInt(navigator.getCurrentContent()!.id!);
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
      let newWordRects : ReadAloudHighlight[] = []
      for (let rtnIdx = firstTextNodeIndex; rtnIdx <= lastTextNodeIndex; rtnIdx++) {
          const rtn = documentTextNodes[utIdx].rangedTextNodes[rtnIdx];
          const chBegin = charIndex - rtn.parentStartCharIndex;
          const chEnd = charIndex - rtn.parentStartCharIndex + charLength;
          const rangeBegin = chBegin < 0 ? 0 : chBegin >  (rtn.textNode.textContent || "").length ?  (rtn.textNode.textContent || "").length : chBegin;
          const rangeEnd = chEnd > (rtn.textNode.textContent || "").length ? (rtn.textNode.textContent || "").length : chEnd
          const range = new Range()
          range.setStart(rtn.textNode, rangeBegin);
          range.setEnd(rtn.textNode, rangeEnd);
          for (let i = 0; i < range.getClientRects().length; i++) {
            const domRect = range.getClientRects().item(i)!
            newWordRects.push({
              characters: range.cloneContents().textContent,
              rect: domRect
            });
          }
      }
      store.dispatch(setHighlights(newWordRects))
      store.dispatch(setLastKnownWordPosition({
        wordCharPos: (charIndex + charLength) - documentTextNodes[utIdx].rangedTextNodes[firstTextNodeIndex].parentStartCharIndex,
        rangedTextNodeIndex: firstTextNodeIndex,
        documentTextNodeChunkIndex: utIdx
      }));
    }
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

function handleIframeClick(e : PointerEvent) {
  onPublicationClicked({x:  e.x, y: e.y + container.clientTop});
}

function handleIframeRelease(e : MouseEvent|TouchEvent) {
  const selectedText = e.view?.getSelection()?.toString() ?? "";
  if (selectedText.length === 0) {
    store.dispatch(setSelection(undefined));
  } else {
    store.dispatch(setSelection(selectedText));
  }
}


async function init(bookId: string) {
  const publicationURL = `${import.meta.env.VITE_MANIFEST_SRC}/${bookId}/manifest.json`;
  const manifestLink = new Link({ href: "manifest.json" });
  const fetcher: Fetcher = new HttpFetcher(undefined, publicationURL);
  const fetched = fetcher.get(manifestLink);
  const selfLink = (await fetched.link()).toURL(publicationURL)!;

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
          store.dispatch(setHighlights([]))
          console.log(publication.readingOrder.items.length)
          pmc.info("positionChanged locator=", locator)
          const shouldResume = navigator.getState() === "playing";
          navigator.stop();
          const visibleFrames = [...document.querySelectorAll("iframe")].filter((fr) => fr.style.visibility !== "hidden");
          if (visibleFrames.length > 0) {
            store.dispatch(setPublicationIsLoading(false));
            const fr = visibleFrames[0];
            fr.contentWindow?.removeEventListener("click", handleIframeClick);
            fr.contentWindow?.addEventListener("click", handleIframeClick)
            fr.contentWindow?.removeEventListener("mouseup", handleIframeRelease)
            fr.contentWindow?.addEventListener("mouseup", handleIframeRelease)
            fr.contentWindow?.removeEventListener("touchend", handleIframeRelease)
            fr.contentWindow?.addEventListener("touchend", handleIframeRelease)

            const navWnd = (fr as HTMLIFrameElement).contentWindow;

            const newDocumentTextNodes = gatherAndPrepareTextNodes(navWnd!);
            store.dispatch(setDocumentTextNodes(newDocumentTextNodes));
            reloadDocumentTextNodes()
            const utteranceIndices = newDocumentTextNodes.map((dtn, idx) => {
                if (dtn.rangedTextNodes.find((rt) => isTextNodeVisible(navWnd!, rt.textNode))) {
                    return idx;
                }
                return -1;
            }).filter((idx) => idx > -1);

            if (utteranceIndices.length > 0) {
              const rtnIdx = newDocumentTextNodes[utteranceIndices[0]].rangedTextNodes.findIndex((rt) => isTextNodeVisible(navWnd!, rt.textNode));
              const wordCharPos = getFirstVisibleWordCharPos(navWnd!, newDocumentTextNodes[utteranceIndices[0]].rangedTextNodes[rtnIdx].textNode);
              jumpToWord({
                documentTextNodeChunkIndex: utteranceIndices[0],
                rangedTextNodeIndex: rtnIdx,
                wordCharPos: wordCharPos
              }, !shouldResume)
            } else {
              store.dispatch(setLastKnownWordPosition({documentTextNodeChunkIndex: 0, wordCharPos: 0, rangedTextNodeIndex: 0}));
            }
          } else {
            store.dispatch(setPublicationIsLoading(true));
          }
        
          if (nav.preferencesEditor.scroll.effectiveValue) {
            if (nav.canGoForward && nav.isScrollEnd) {
              document.getElementById("next-page")!.style.visibility = "visible";
            } else {
              document.getElementById("next-page")!.style.visibility = "hidden";
            }
            if (nav.canGoBackward && nav.isScrollStart) {
              document.getElementById("previous-page")!.style.visibility = "visible";
            } else {
              document.getElementById("previous-page")!.style.visibility = "hidden";
            }
          } else {
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
            pmc.info("handleLocator locator=", locator);
          return false;
        },
        textSelected: function (selection: BasicTextSelection): void {
            pmc.log("textSelected selection=", selection);
            navigator.stop();
            navigator.loadContent([{id: "selection",  text: selection.text}]);
            navigator.play();
        }
      };
      const nav = new EpubNavigator(container, publication, listeners);
      await nav.load();
      document.getElementById("next-page")?.addEventListener("click", () => {
        nav.goForward(true, (done) => {
          if (!done) {
            document.getElementById("next-page")!.style.visibility = 'hidden';
            store.dispatch(setPublicationIsLoading(false));
          }
        });
        store.dispatch(setPublicationIsLoading(true));
      });
      document.getElementById("previous-page")?.addEventListener("click", () => {
        nav.goBackward(true, (done) => {
          if (!done) {
            document.getElementById("previous-page")!.style.visibility = 'hidden';
            store.dispatch(setPublicationIsLoading(false));
          }
        });
        store.dispatch(setPublicationIsLoading(true));
      })

      initializePreferenceButtons(nav);

    }).catch((error) => {
      pmc.error("Error loading manifest", error);
      alert(`Failed loading manifest ${selfLink}`);
    });

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

window.addEventListener("beforeunload", () => navigator.stop());
