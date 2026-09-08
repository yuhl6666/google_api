import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 指定した要素の内容を画像化し、A4サイズのPDFに複数ページへ分割して出力する。
// 日本語フォントをjsPDFへ埋め込む代わりに、DOMを画像化することで文字化けを避けている。
export async function exportElementToPdf(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`PDF出力対象の要素が見つかりません: ${elementId}`);

  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidthMm = pageWidth;
  const pxPerMm = canvas.width / imgWidthMm;
  const pageHeightPx = pageHeight * pxPerMm;

  let renderedHeightPx = 0;
  let pageIndex = 0;

  while (renderedHeightPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, renderedHeightPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    const imgData = pageCanvas.toDataURL('image/png');
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidthMm, (sliceHeightPx * imgWidthMm) / canvas.width);

    renderedHeightPx += sliceHeightPx;
    pageIndex += 1;
  }

  pdf.save(fileName);
}
