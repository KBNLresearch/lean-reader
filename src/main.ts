import { type FrameClickEvent, type BasicTextSelection } from '@readium/navigator-html-injectables';
import './css/style.css'
// import Peripherals from './peripherals';
// import { BasicTextSelection, FrameClickEvent } from "@readium/navigator-html-injectables";
// import { BasicTextSelection, FrameClickEvent } from "@readium/navigator-html-injectables";
import { EpubNavigator, FrameManager, FXLFrameManager, type EpubNavigatorListeners } from "@readium/navigator";
// import { Locator, Manifest, Publication } from "@readium/shared";
import type { Fetcher, Locator } from "@readium/shared";
import { HttpFetcher, Manifest, Publication } from "@readium/shared";
import { Link } from "@readium/shared";

function unLinkCurrentLocation(bookId: string) {
  document.querySelectorAll(`a[href*="${bookId}"]`).forEach((currentLink) => {
    const replacementSpan = document.createElement("span");
    replacementSpan.innerHTML = currentLink.innerHTML;
    currentLink.replaceWith(replacementSpan);
  });
}


function hideLoadingMessage() {
  document.querySelectorAll("#loading-message").forEach((el) => (el as HTMLElement).style.display = "none");
}


const debug = document.getElementById("debug")!;
const container = document.getElementById("container")!;


async function init(bookId: string) {
  unLinkCurrentLocation(bookId);

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
          nav._cframes.forEach((frameManager: FrameManager | FXLFrameManager | undefined) => {
          });
        },
        positionChanged: function (locator: Locator): void {
          hideLoadingMessage();
          console.log("positionChanged locator=", locator)
        },
        tap: function (e: FrameClickEvent): boolean {
          console.log("tap e=", e )
          return false;
        },
        click: function (e: FrameClickEvent): boolean {
          console.log("click e=", e)
          return false;
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