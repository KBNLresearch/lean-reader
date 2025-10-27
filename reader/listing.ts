import './css/style.css'

type BookEntry = {
    filename : String
    path : String
}

document.addEventListener("DOMContentLoaded", async () => {
    const result = await fetch(`${import.meta.env.VITE_MANIFEST_SRC}/list.json`);
    const list = await result.json();
    const listing = document.getElementById("boek-entry-list")!;

    (list as BookEntry[]).forEach((bookEntry) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        console.log(bookEntry);
        item.appendChild(link);
        link.setAttribute("href", `reader/?boek=${bookEntry.path}`);
        link.innerHTML = bookEntry.filename.replaceAll(".epub", "");
        listing.appendChild(item);
    })
})