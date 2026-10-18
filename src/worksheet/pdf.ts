/* PDF download of a rendered WorksheetView. The paper is rasterised once and cut into A4 pages at the same
   places printing would break: never inside a row, question or heading, and before every new-page section. */

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 14;
const MARGIN_BOTTOM_MM = 16;
const RENDER_SCALE = 2;

/** Elements that must stay whole on one page, and elements that start a page. */
const UNBREAKABLE = "header, h2, tr, li, aside, [data-avoid-break], footer";
const PAGE_START = "[data-new-page]";

interface Span { readonly top: number; readonly bottom: number; readonly forceBreak: boolean }

/** Page cut positions (in CSS px from the paper's top) for a page body of `pageHeight` px. */
export function pageCuts(spans: readonly Span[], contentTop: number, contentBottom: number, pageHeight: number): number[] {
  const cuts = [contentTop];
  for (const span of [...spans].sort((a, b) => a.top - b.top)) {
    const start = cuts.at(-1)!;
    if (span.forceBreak && span.top > start + 1) cuts.push(span.top);
    else if (span.bottom - cuts.at(-1)! > pageHeight && span.top > cuts.at(-1)!) cuts.push(span.top);
  }
  while (contentBottom - cuts.at(-1)! > pageHeight) cuts.push(cuts.at(-1)! + pageHeight);
  cuts.push(contentBottom);
  return cuts;
}

export async function downloadWorksheetPdf(paper: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts.ready;
  const paperBox = paper.getBoundingClientRect();
  const pxPerMm = paperBox.width / PAGE_WIDTH_MM;
  const style = getComputedStyle(paper);
  const contentTop = parseFloat(style.paddingTop);
  const contentBottom = paperBox.height - parseFloat(style.paddingBottom);
  const spanOf = (element: Element, forceBreak: boolean): Span => {
    const box = element.getBoundingClientRect();
    return { top: box.top - paperBox.top, bottom: box.bottom - paperBox.top, forceBreak };
  };
  const spans = [
    ...Array.from(paper.querySelectorAll(UNBREAKABLE), (element) => spanOf(element, false)),
    ...Array.from(paper.querySelectorAll(PAGE_START), (element) => spanOf(element, true)),
  ];
  const pageHeight = (PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * pxPerMm;
  const cuts = pageCuts(spans, contentTop, contentBottom, pageHeight);

  const canvas = await html2canvas(paper, {
    scale: RENDER_SCALE, backgroundColor: "#ffffff", useCORS: true,
    // The dashed page separator is a screen hint only; hide it without changing layout.
    onclone: (clone) => clone.querySelectorAll<HTMLElement>(PAGE_START).forEach((element) => { element.style.borderTopColor = "transparent"; }),
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const top = cuts[index]! * RENDER_SCALE;
    const height = Math.max(1, (cuts[index + 1]! - cuts[index]!) * RENDER_SCALE);
    slice.height = height;
    const context = slice.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, height);
    context.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
    if (index > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, MARGIN_TOP_MM, PAGE_WIDTH_MM, height / RENDER_SCALE / pxPerMm);
  }
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
