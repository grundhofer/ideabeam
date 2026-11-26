// download.ts: hands a text to the browser as a file to save. The file is made here, in the tab, from what the app
// already holds (a Blob behind an address of this page alone): no second request, no address a phone has to open
// again, and nothing of it is kept once it is handed over.

/** Saves a text under a file name: the browser's own download, or its question where to put the file. */
export function saveText(fileName: string, text: string, type = "text/markdown;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari on iOS reads the address after the click returns: it goes a moment later
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
