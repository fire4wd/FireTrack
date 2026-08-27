import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { saveOrShareFile } from './fileDownloader';

/**
 * Capture element as image data URL with fallback mechanisms
 */
async function captureElementImage(element: HTMLElement, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<string> {
  const minTargetWidth = orientation === 'landscape' ? 1120 : 800;
  const targetWidth = Math.max(element.scrollWidth, element.offsetWidth, minTargetWidth);
  const targetHeight = Math.max(element.scrollHeight, element.offsetHeight, 300);

  // First attempt: html-to-image (modern, high-fidelity SVG foreignObject)
  try {
    const dataUrl = await toPng(element, {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipAutoScale: false,
      width: targetWidth,
      height: targetHeight,
      style: {
        width: `${targetWidth}px`,
        maxWidth: 'none',
        left: '0px',
        top: '0px',
        position: 'static',
        transform: 'none',
        display: 'block',
        visibility: 'visible',
      },
      filter: (node: HTMLElement) => {
        if (node.classList && (node.classList.contains('print:hidden') || node.classList.contains('no-print'))) {
          return false;
        }
        return true;
      }
    });
    if (dataUrl && dataUrl.length > 200) {
      return dataUrl;
    }
  } catch (err) {
    console.warn('html-to-image toPng failed, trying html2canvas fallback:', err);
  }

  // Fallback attempt: html2canvas
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: targetWidth,
      height: targetHeight,
      windowWidth: Math.max(targetWidth, 1200),
      onclone: (_clonedDoc, clonedEl) => {
        _clonedDoc.documentElement.classList.add('pdf-export-mode');
        _clonedDoc.body.classList.add('pdf-export-mode');
        clonedEl.classList.add('pdf-export-mode');
        clonedEl.style.position = 'static';
        clonedEl.style.left = '0px';
        clonedEl.style.top = '0px';
        clonedEl.style.transform = 'none';
        clonedEl.style.width = `${targetWidth}px`;
        clonedEl.style.maxWidth = 'none';
        clonedEl.style.display = 'block';
        clonedEl.style.visibility = 'visible';
        clonedEl.style.backgroundColor = '#ffffff';
        clonedEl.style.color = '#0f172a';
      },
      ignoreElements: (el) => {
        return el.classList?.contains('print:hidden') || el.classList?.contains('no-print');
      }
    });
    return canvas.toDataURL('image/png', 0.98);
  } catch (canvasErr) {
    console.error('html2canvas also failed:', canvasErr);
    throw new Error('Impossibile effettuare il rendering visivo del report per la generazione del PDF.');
  }
}

/**
 * Load image to obtain HTMLImageElement with natural dimensions
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Impossibile caricare i dati immagine del report: ' + e));
    img.src = src;
  });
}

/**
 * Render a section's image into jsPDF using canvas slicing for crisp multi-page output
 */
function addSectionPagesToPdf(
  pdf: jsPDF,
  img: HTMLImageElement,
  orientation: 'portrait' | 'landscape',
  isVeryFirstPageOfDoc: boolean,
  singlePage: boolean = false
): void {
  // A4 dimensions in mm:
  // Portrait: 210 x 297 mm
  // Landscape: 297 x 210 mm
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const margin = 7; // 7mm margin

  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const sourceWidth = img.width;
  const sourceHeight = img.height;

  // Pixels per mm based on usable width
  const pxPerMm = sourceWidth / usableWidth;

  if (singlePage) {
    // Exactly fit in 1 page (scaled proportionally to fit within usableHeight if needed)
    const naturalHeightMm = sourceHeight / pxPerMm;
    const renderHeightMm = Math.min(usableHeight, naturalHeightMm);
    
    if (!isVeryFirstPageOfDoc) {
      pdf.addPage('a4', orientation);
    }
    pdf.addImage(img, 'PNG', margin, margin, usableWidth, renderHeightMm);
    return;
  }

  const sliceHeightPx = usableHeight * pxPerMm;

  let currentY = 0;
  let pageIndexInThisSection = 0;

  while (currentY < sourceHeight) {
    // Avoid creating a tiny trailing empty slice (e.g. less than 25px at the end)
    if (currentY >= sourceHeight - 25 && pageIndexInThisSection > 0) {
      break;
    }

    const currentSliceHeight = Math.min(sliceHeightPx, sourceHeight - currentY);

    // Create slice canvas
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = sourceWidth;
    sliceCanvas.height = currentSliceHeight;

    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sourceWidth, currentSliceHeight);
      ctx.drawImage(
        img,
        0,
        currentY,
        sourceWidth,
        currentSliceHeight,
        0,
        0,
        sourceWidth,
        currentSliceHeight
      );
    }

    const sliceData = sliceCanvas.toDataURL('image/png', 0.98);
    const sliceHeightMm = currentSliceHeight / pxPerMm;

    if (isVeryFirstPageOfDoc && pageIndexInThisSection === 0) {
      pdf.addImage(sliceData, 'PNG', margin, margin, usableWidth, sliceHeightMm);
    } else {
      pdf.addPage('a4', orientation);
      pdf.addImage(sliceData, 'PNG', margin, margin, usableWidth, sliceHeightMm);
    }

    currentY += currentSliceHeight;
    pageIndexInThisSection++;
  }
}

/**
 * Exports a DOM element directly to a downloadable or shareable A4 PDF document.
 * Supports multi-section documents with mixed orientations (e.g. Page 1 Portrait, Page 2+ Landscape).
 * Fully compatible with Android (Capacitor native app & mobile browsers), iOS, and Desktop.
 */
export async function exportElementToPdf(
  elementId: string,
  fileName: string = 'report.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} non trovato nel DOM.`);
  }

  const safeFilename = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // Enable white PDF export theme on root DOM and wait a frame for styles to paint
  document.documentElement.classList.add('pdf-export-mode');
  document.body.classList.add('pdf-export-mode');
  element.classList.add('pdf-export-mode');

  try {
    // Small delay to allow the browser layout engine to paint .pdf-export-mode styles
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Check if the container has dedicated child sections with specified orientations
    const sectionNodes = element.querySelectorAll<HTMLElement>('[data-pdf-section="true"]');
    const sections: HTMLElement[] = sectionNodes.length > 0 ? Array.from(sectionNodes) : [element];

    const elementOrientation = (element.getAttribute('data-pdf-orientation') as 'portrait' | 'landscape') || null;
    const firstSectionOrientation = (sections[0].getAttribute('data-pdf-orientation') as 'portrait' | 'landscape') || null;
    const firstOrientation = firstSectionOrientation || elementOrientation || 'landscape';

    const pdf = new jsPDF({
      orientation: firstOrientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < sections.length; i++) {
      const sectionEl = sections[i];
      const orientation = 
        (sectionEl.getAttribute('data-pdf-orientation') as 'portrait' | 'landscape') ||
        elementOrientation ||
        'landscape';
      const singlePage = sectionEl.getAttribute('data-pdf-single-page') === 'true';

      const imgData = await captureElementImage(sectionEl, orientation);
      const img = await loadImage(imgData);

      const isFirst = i === 0;
      addSectionPagesToPdf(pdf, img, orientation, isFirst, singlePage);
    }

    // Output PDF as Blob
    const pdfBlob = pdf.output('blob');

    // Universal Save/Share for Android / iOS / Desktop
    await saveOrShareFile({
      filename: safeFilename,
      blob: pdfBlob,
      mimeType: 'application/pdf',
      dialogTitle: `Salva o Condividi ${safeFilename}`,
    });
  } catch (error) {
    console.error('Errore durante la generazione ed esportazione PDF:', error);
    throw error;
  } finally {
    // Restore UI back to standard application theme
    document.documentElement.classList.remove('pdf-export-mode');
    document.body.classList.remove('pdf-export-mode');
    element.classList.remove('pdf-export-mode');
  }
}
