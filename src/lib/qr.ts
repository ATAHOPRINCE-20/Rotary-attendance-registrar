export function downloadQR(svgId: string, filename: string) {
  const svg = document.getElementById(svgId)?.querySelector('svg') || document.getElementById(svgId);
  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    console.error("QR Code SVG not found");
    return;
  }

  // Create a canvas and draw the SVG on it
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    // Make canvas slightly larger to accommodate a white background border
    const padding = 20;
    canvas.width = img.width + padding * 2;
    canvas.height = img.height + padding * 2;
    
    // Fill with white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the QR code
    ctx.drawImage(img, padding, padding);
    
    // Trigger download
    const pngFile = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.download = `${filename}.png`;
    downloadLink.href = pngFile;
    downloadLink.click();
  };
  
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}
