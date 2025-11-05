
type SmallConsole = {
    debug: (...args: any[]) => void
    info: (...args: any[]) => void
    log: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
}
let pmcInstance : SmallConsole|null = null;

export function createPoorMansConsole(debug: HTMLElement):  SmallConsole {
    if (pmcInstance) { return pmcInstance; }

    function logToStupidPreBlock(color: string, ...args: any[]) {
        const dv = document.createElement("div");
        dv.style.color = color;
        dv.innerHTML = args.map((arg: any) => {
            if (typeof arg === "string") {
                return arg;
            }
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return arg;
            }
        }).join(", ")
        debug.appendChild(dv);
        debug.scrollTo(0, debug.scrollHeight)
    }

    let toggledDebug = false;
    debug.addEventListener("click", () => {
        if (toggledDebug) {
            debug.style.height = "";
            toggledDebug = false
        } else {
            debug.style.height = "45%";
            toggledDebug = true
        }
    });

    pmcInstance = {
        debug: (...args: any[]) => { console.debug(...args); logToStupidPreBlock("gray", ...args) },
        log: (...args: any[]) => { console.log(...args); logToStupidPreBlock("black", ...args) },
        info: (...args: any[]) => { console.log(...args); logToStupidPreBlock("black", ...args) },
        warn: (...args: any[]) => { console.warn(...args); logToStupidPreBlock("darkorange", ...args) },
        error: (...args: any[]) => { console.error(...args); logToStupidPreBlock("red", ...args) },
    }
    return pmcInstance;
}