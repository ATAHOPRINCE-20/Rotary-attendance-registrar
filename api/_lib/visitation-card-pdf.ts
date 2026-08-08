import { jsPDF } from 'jspdf';

export interface VisitationCardPdfData {
  hostClubName: string;
  visitorName: string;
  isMember: boolean;
  visitorClub?: string | null;
  eventTitle: string;
  eventDate: string;
  eventTopic?: string | null;
  presidentName?: string | null;
  presidentTitle?: string | null;
  secretaryName?: string | null;
  secretaryTitle?: string | null;
}

export function generateVisitationCardPdfBase64(data: VisitationCardPdfData): string {
  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const width = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const cardWidth = width - (margin * 2);

    // ── Outer Border & Card Box ────────────────────────────────────────────────
    pdf.setDrawColor(0, 103, 200); // Rotary Blue (#0067C8)
    pdf.setLineWidth(1.2);
    pdf.rect(margin, margin, cardWidth, 260);

    pdf.setDrawColor(217, 83, 31); // Rotary Accent Gold/Orange (#D9531F)
    pdf.setLineWidth(0.4);
    pdf.rect(margin + 2, margin + 2, cardWidth - 4, 256);

    // ── Header: Host Club Name ───────────────────────────────────────────────
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(0, 103, 200);
    const hostTitle = (data.hostClubName || 'ROTARY CLUB').toUpperCase();
    pdf.text(hostTitle, width / 2, 38, { align: 'center' });

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Service Above Self', width / 2, 44, { align: 'center' });

    // Divider
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 15, 49, width - margin - 15, 49);

    // ── Document Title & Salutation ──────────────────────────────────────────
    if (data.isMember) {
      // Visiting Rotarian / Rotaractor Variant
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.setTextColor(23, 69, 143); // Navy (#17458F)
      pdf.text('FELLOWSHIP CARD', width / 2, 64, { align: 'center' });

      const visitingClubText = data.visitorClub && data.visitorClub.trim() !== ''
        ? data.visitorClub.trim()
        : 'Visiting Club';

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`To the Secretary, ${visitingClubText}`, width / 2, 80, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`The President and members of the ${data.hostClubName} had the pleasure`, width / 2, 98, { align: 'center' });
      pdf.text('of sharing fellowship with', width / 2, 105, { align: 'center' });
    } else {
      // Guest / Visitor Variant
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.setTextColor(23, 69, 143);
      pdf.text('GUEST VISITATION CARD', width / 2, 64, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(15, 23, 42);
      pdf.text('To Our Esteemed Guest', width / 2, 80, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`The President and members of the ${data.hostClubName} had the pleasure`, width / 2, 98, { align: 'center' });
      pdf.text('of hosting our guest', width / 2, 105, { align: 'center' });
    }

    // ── Visitor Name Block ───────────────────────────────────────────────────
    pdf.setFont('times', 'bolditalic');
    pdf.setFontSize(26);
    pdf.setTextColor(217, 83, 31); // Rotary Orange (#D9531F)
    pdf.text(data.visitorName || 'Valued Visitor', width / 2, 126, { align: 'center' });

    // Underline below visitor name
    const textWidth = pdf.getTextWidth(data.visitorName || 'Valued Visitor');
    const underlineStart = (width / 2) - (textWidth / 2) - 5;
    const underlineEnd = (width / 2) + (textWidth / 2) + 5;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.8);
    pdf.line(underlineStart, 130, underlineEnd, 130);

    // ── Event & Date Details ─────────────────────────────────────────────────
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`on ${data.eventDate}.`, width / 2, 146, { align: 'center' });

    const topicStr = data.eventTopic || data.eventTitle;
    if (topicStr) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(23, 69, 143);
      pdf.text(`Topic of the Day:`, width / 2, 156, { align: 'center' });

      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      
      // Wrap long topic text if needed
      const splitTopic = pdf.splitTextToSize(`"${topicStr}"`, cardWidth - 30);
      pdf.text(splitTopic, width / 2, 164, { align: 'center' });
    }

    // ── Signatures Footer Section ─────────────────────────────────────────────
    const sigY = 222;

    // Left Signature - President
    const presName = data.presidentName || 'Impact President';
    const presTitle = data.presidentTitle || 'Club President';
    pdf.setDrawColor(71, 85, 105);
    pdf.setLineWidth(0.5);
    pdf.line(35, sigY, 95, sigY);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(presName, 65, sigY + 6, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(presTitle, 65, sigY + 11, { align: 'center' });

    // Right Signature - Secretary
    const secName = data.secretaryName || 'Impact Secretary';
    const secTitle = data.secretaryTitle || 'Club Secretary';
    pdf.setDrawColor(71, 85, 105);
    pdf.setLineWidth(0.5);
    pdf.line(width - 95, sigY, width - 35, sigY);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(secName, width - 65, sigY + 6, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(secTitle, width - 65, sigY + 11, { align: 'center' });

    // ── Footer Copyright / Branding ──────────────────────────────────────────
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${data.hostClubName} • Fellowship Register`, width / 2, 266, { align: 'center' });

    const dataUri = pdf.output('datauristring');
    return dataUri.split(',')[1] || '';
  } catch (err) {
    console.error('Failed to generate Visitation Card PDF Base64:', err);
    return '';
  }
}
