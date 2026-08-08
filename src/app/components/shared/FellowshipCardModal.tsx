import { useState, useEffect } from "react";
import { X, Printer, ChevronLeft, ChevronRight, Edit3, Check, Award, Download, Mail, Smartphone, Send, Loader2 } from "lucide-react";
import type { Organization, Event } from "../../../types/database";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY } from "../../../lib/constants";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface VisitorCardItem {
  id?: string;
  visitorName: string;
  visitorClub: string;
  email?: string;
  phone?: string;
  eventTitle?: string;
  eventDate?: string;
  isMember?: boolean;
}

interface FellowshipCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitors: VisitorCardItem[];
  organization: Organization | null;
  event?: Event | null;
}

export function FellowshipCardModal({
  isOpen,
  onClose,
  visitors,
  organization,
  event,
}: FellowshipCardModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Editable Card Data
  const [hostClubName, setHostClubName] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorClub, setVisitorClub] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTopic, setEventTopic] = useState("");
  
  const [presidentName, setPresidentName] = useState("");
  const [presidentTitle, setPresidentTitle] = useState("Impact President");
  const [presidentSigUrl, setPresidentSigUrl] = useState<string | null>(null);

  const [secretaryName, setSecretaryName] = useState("");
  const [secretaryTitle, setSecretaryTitle] = useState("Impact Secretary");
  const [secretarySigUrl, setSecretarySigUrl] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<"email" | "whatsapp" | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  async function handleSaveLeadershipToSettings() {
    if (!organization) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          president_name: presidentName.trim() || null,
          president_title: presidentTitle.trim() || "Impact President",
          secretary_name: secretaryName.trim() || null,
          secretary_title: secretaryTitle.trim() || "Impact Secretary",
        })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("President & Secretary details saved permanently to Settings!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function checkIsRotarian(item?: VisitorCardItem, clubNameState?: string): boolean {
    if (!item) return false;
    if (item.isMember === false) return false;
    const club = (clubNameState || item.visitorClub || "").toLowerCase().trim();
    if (!club || club === "guest" || club === "visitor" || club.includes("non-rotarian") || club.includes("guest") || club.includes("visitor")) {
      return false;
    }
    return true;
  }

  // Initialize values whenever active visitor or modal opens
  useEffect(() => {
    if (!isOpen) return;

    const hostName = organization?.name || "Rotary Club of Mengo";
    setHostClubName(hostName);

    setPresidentName(organization?.president_name || "Prince Ataho");
    setPresidentTitle(organization?.president_title || "Impact President");
    setPresidentSigUrl(organization?.president_signature_url || null);

    setSecretaryName(organization?.secretary_name || "Emmanuel Ddembe");
    setSecretaryTitle(organization?.secretary_title || "Impact Secretary");
    setSecretarySigUrl(organization?.secretary_signature_url || null);

    // Event Date & Topic default
    const formattedDate = event?.date
      ? new Date(event.date).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

    const topic = (event as any)?.topic || event?.fellowship_report?.guest_speaker_topic || event?.title || "Regular Fellowship Meeting";
    setEventDate(formattedDate);
    setEventTopic(topic);

    if (visitors && visitors.length > 0) {
      const current = visitors[currentIndex] || visitors[0];
      setVisitorName(current.visitorName || "");
      const isGuest = current.isMember === false || (current.visitorClub && (current.visitorClub.toLowerCase().includes("guest") || current.visitorClub.toLowerCase().includes("visitor")));
      setVisitorClub(current.visitorClub || (isGuest ? "Guest" : "Visiting Club"));
    } else {
      setVisitorName("Florence Tinkamanyire");
      setVisitorClub("Guest");
    }
  }, [isOpen, currentIndex, visitors, organization, event]);

  if (!isOpen) return null;

  const currentVisitor = visitors[currentIndex] || { visitorName, visitorClub };

  const handleNext = () => {
    if (currentIndex < visitors.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  async function handleSendCardsViaEmail(sendAll: boolean = false) {
    if (!organization) return;
    setSendingChannel("email");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Authentication session expired.");

      const listToSend = sendAll && visitors.length > 0 ? visitors : [{ visitorName, visitorClub, email: (currentVisitor as any).email }];
      const logoUrl = organization.logo_url || "/assets/rotary_gold_logo.png";
      let sentCount = 0;
      let failCount = 0;
      let lastError = "";

      for (let i = 0; i < listToSend.length; i++) {
        const item = listToSend[i];
        const recipientEmail = item.email || (listToSend.length === 1 ? prompt(`Enter email address for ${item.visitorName}:`) : null);
        if (!recipientEmail || !recipientEmail.includes("@")) {
          failCount++;
          lastError = `No valid recipient email address provided for ${item.visitorName}.`;
          continue;
        }

        // Synchronize DOM state to current visitor so captured PDF matches this specific visitor
        if (sendAll && visitors.length > 0) {
          setCurrentIndex(i);
          setVisitorName(item.visitorName || "");
          setVisitorClub(item.visitorClub || "Visiting Club");
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        const itemIsRotarian = checkIsRotarian(item, item.visitorClub);

        const cardTitleText = itemIsRotarian ? "FELLOWSHIP CARD" : "GUEST VISITATION CARD";
        const salutationText = itemIsRotarian
          ? `To the Secretary, ${item.visitorClub || "Visiting Club"}`
          : "To Our Esteemed Guest";
        const bodyPhraseText = itemIsRotarian
          ? "sharing fellowship with"
          : "hosting our guest";

        const htmlContent = `
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 2px solid #0067C8; border-radius: 16px; padding: 30px; font-family: sans-serif; text-align: center; color: #1e293b;">
            <div style="margin-bottom: 15px;">
              <img src="${logoUrl}" width="60" alt="Rotary Logo" style="vertical-align: middle;" />
              <h2 style="font-family: serif; color: #0067C8; font-size: 24px; margin: 10px 0 5px 0;">${hostClubName}</h2>
            </div>
            <h1 style="font-family: serif; color: #17458F; font-size: 28px; margin: 0 0 15px 0;">${cardTitleText}</h1>
            <p style="font-weight: bold; font-size: 16px; color: #0f172a; margin-bottom: 15px;">${salutationText}</p>
            <p style="font-size: 15px; color: #475569; line-height: 1.6;">
              The President and members of the <strong>${hostClubName}</strong> had the pleasure of ${bodyPhraseText}
            </p>
            <div style="font-family: serif; font-style: italic; font-size: 26px; font-weight: bold; color: #D9531F; margin: 20px 0; border-bottom: 2px solid #e2e8f0; display: inline-block; padding-bottom: 5px;">
              ${item.visitorName}
            </div>
            <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 30px;">
              on <strong>${eventDate}</strong>. The topic of the day was <strong>${eventTopic}</strong>.
            </p>
            <table style="width: 100%; border-top: 1px solid #cbd5e1; pt: 15px;">
              <tr>
                <td style="width: 50%; text-align: center; vertical-align: bottom;">
                  ${presidentSigUrl ? `<img src="${presidentSigUrl}" height="40" alt="Signature" /><br/>` : ''}
                  <div style="border-bottom: 1px solid #475569; width: 80%; margin: 5px auto;"></div>
                  <strong>${presidentName}</strong><br/>
                  <span style="font-size: 12px; color: #64748b;">${presidentTitle}</span>
                </td>
                <td style="width: 50%; text-align: center; vertical-align: bottom;">
                  ${secretarySigUrl ? `<img src="${secretarySigUrl}" height="40" alt="Signature" /><br/>` : ''}
                  <div style="border-bottom: 1px solid #475569; width: 80%; margin: 5px auto;"></div>
                  <strong>${secretaryName}</strong><br/>
                  <span style="font-size: 12px; color: #64748b;">${secretaryTitle}</span>
                </td>
              </tr>
            </table>
          </div>
        `;

        // Generate exact visual PDF attachment
        const pdfBase64 = await generateFellowshipCardPdfBase64();

        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            orgId: organization.id,
            toEmail: recipientEmail,
            toName: item.visitorName,
            subject: `Fellowship Card - ${hostClubName}`,
            htmlContent,
            ...(pdfBase64 ? { attachment: [{ name: `Fellowship_Card_${item.visitorName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: pdfBase64 }] } : {})
          })
        });

        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.success) {
          sentCount++;
        } else {
          failCount++;
          lastError = resData.error || resData.message || "Failed to send email";
        }
      }

      if (sentCount > 0) {
        toast.success(`Successfully emailed ${sentCount} Fellowship Card(s)!`);
      } else {
        toast.error(lastError || "Failed to email Fellowship Cards. Please check sender email configuration in Settings.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send Fellowship Cards via email.");
    } finally {
      setSendingChannel(null);
    }
  }

  async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  function generateFallbackJsPdfBase64(): string {
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const width = pdf.internal.pageSize.getWidth();
      
      pdf.setDrawColor(0, 103, 200);
      pdf.setLineWidth(1);
      pdf.rect(10, 10, width - 20, 277);
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(0, 103, 200);
      pdf.text(hostClubName.toUpperCase(), width / 2, 35, { align: "center" });

      const isRotarian = checkIsRotarian(currentVisitor, visitorClub);
      const cardTitleText = isRotarian ? "FELLOWSHIP CARD" : "GUEST VISITATION CARD";
      const salutationText = isRotarian
        ? `To the Secretary, ${visitorClub || "Visiting Club"}`
        : "To Our Esteemed Guest";
      const bodyPhraseText = isRotarian
        ? "sharing fellowship with"
        : "hosting our guest";

      pdf.setFontSize(24);
      pdf.setTextColor(23, 69, 143);
      pdf.text(cardTitleText, width / 2, 52, { align: "center" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(14);
      pdf.setTextColor(15, 23, 42);
      pdf.text(salutationText, width / 2, 70, { align: "center" });

      pdf.setFontSize(12);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`The President and members of the ${hostClubName} had the pleasure`, width / 2, 88, { align: "center" });
      pdf.text(`of ${bodyPhraseText}`, width / 2, 96, { align: "center" });

      pdf.setFont("times", "bolditalic");
      pdf.setFontSize(24);
      pdf.setTextColor(217, 83, 31);
      pdf.text(visitorName, width / 2, 118, { align: "center" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`on ${eventDate}. The topic of the day was ${eventTopic}`, width / 2, 138, { align: "center" });

      // Dual Signatures
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(presidentName, 55, 210, { align: "center" });
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      pdf.text(presidentTitle, 55, 216, { align: "center" });

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(secretaryName, width - 55, 210, { align: "center" });
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      pdf.text(secretaryTitle, width - 55, 216, { align: "center" });

      const dataUri = pdf.output("datauristring");
      return dataUri.split(",")[1] || "";
    } catch (e) {
      console.error("Failed to generate fallback jsPDF:", e);
      return "";
    }
  }

  async function generateFellowshipCardPdfBase64(): Promise<string | null> {
    try {
      const cardElement = document.getElementById("fellowship-card-canvas-target");
      if (!cardElement) return generateFallbackJsPdfBase64();

      const canvas = await html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: async (clonedDoc) => {
          const clonedCard = clonedDoc.getElementById("fellowship-card-canvas-target");
          if (!clonedCard) return;
          const imgs = Array.from(clonedCard.getElementsByTagName("img"));
          for (const img of imgs) {
            img.crossOrigin = "anonymous";
            if (img.src && !img.src.startsWith("data:")) {
              try {
                const b64 = await fetchImageAsBase64(img.src);
                if (b64 && b64.startsWith("data:")) {
                  img.src = b64;
                }
              } catch (e) {
                console.warn("Could not inline image into canvas:", img.src, e);
              }
            }
          }
        }
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const printWidth = pdfWidth - (margin * 2);
      const printHeight = (canvas.height * printWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", margin, margin, printWidth, printHeight);

      const dataUri = pdf.output("datauristring");
      const b64Result = dataUri.split(",")[1] || null;
      return b64Result || generateFallbackJsPdfBase64();
    } catch (err) {
      console.error("Failed to capture exact card HTML to PDF, using fallback:", err);
      return generateFallbackJsPdfBase64();
    }
  }

  async function handleSendCardsViaWhatsApp(sendAll: boolean = false) {
    if (!organization) return;
    setSendingChannel("whatsapp");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Authentication session expired.");

      const listToSend = sendAll && visitors.length > 0 ? visitors : [{ visitorName, visitorClub, phone: (currentVisitor as any).phone }];
      const GATEWAY_BASE_URL = "http://ugpay.tech:3000";
      const webhookUrl = `${GATEWAY_BASE_URL}/send-whatsapp/${organization.id}`;
      let sentCount = 0;
      let lastError = "";

      for (let i = 0; i < listToSend.length; i++) {
        const item = listToSend[i];
        let phone = item.phone || (listToSend.length === 1 ? prompt(`Enter WhatsApp phone number for ${item.visitorName}:`) : null);
        if (!phone || phone.trim().length < 8) continue;

        // Synchronize DOM state to current visitor so captured PDF matches this specific visitor
        if (sendAll && visitors.length > 0) {
          setCurrentIndex(i);
          setVisitorName(item.visitorName || "");
          setVisitorClub(item.visitorClub || "Visiting Club");
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        const messageText = `*FELLOWSHIP CARD*\n*${hostClubName.toUpperCase()}*\n\nTo the Secretary, ${item.visitorClub || "Visiting Club"}\n\nThe President and members of *${hostClubName}* had the pleasure of sharing fellowship with *${item.visitorName}* on *${eventDate}*.\n\n*Topic of the day:* ${eventTopic}\n\n*Signed:*\n✍️ ${presidentName} (${presidentTitle})\n✍️ ${secretaryName} (${secretaryTitle})`;

        // Generate exact visual PDF document
        const pdfBase64 = await generateFellowshipCardPdfBase64();

        const res = await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            webhookUrl,
            phone,
            message: messageText,
            ...(pdfBase64 ? { pdfBase64, fileName: `Fellowship_Card_${item.visitorName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` } : {})
          })
        });

        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.success) {
          sentCount++;
        } else {
          lastError = resData.error || resData.message || "Failed to send WhatsApp message";
        }
      }

      if (sentCount > 0) {
        toast.success(`Successfully sent ${sentCount} Fellowship Card(s) via WhatsApp!`);
      } else {
        toast.error(lastError || "Could not send WhatsApp message. Please check WhatsApp connection in Settings.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send Fellowship Cards via WhatsApp.");
    } finally {
      setSendingChannel(null);
    }
  }

  const handlePrintCards = (printAll: boolean = false) => {
    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to print Fellowship Cards.");
      return;
    }

    const cardsToPrint = printAll && visitors.length > 0 ? visitors : [{ visitorName, visitorClub }];
    const logoUrl = organization?.logo_url || "/assets/rotary_gold_logo.png";

    const cardsHtml = cardsToPrint
      .map(
        (v) => {
          const isRotarian = checkIsRotarian(v, v.visitorClub);
          const titleText = isRotarian ? "FELLOWSHIP CARD" : "GUEST VISITATION CARD";
          const addresseeText = isRotarian ? `To the Secretary, ${v.visitorClub || visitorClub || "Visiting Club"}` : "To Our Esteemed Guest";
          const bodyPhraseText = isRotarian ? "sharing fellowship with" : "hosting our guest";

          return `
      <div class="card-page">
        <div class="card-container">
          <!-- Rotary Watermark -->
          <div class="watermark"></div>

          <!-- TOP SECTION -->
          <div class="top-section">
            <div class="logo-row">
              <span class="club-title">${hostClubName}</span>
              <img src="${logoUrl}" alt="Rotary Logo" class="rotary-wheel" />
            </div>
            <h1 class="card-title">${titleText}</h1>
          </div>

          <!-- CENTER SECTION -->
          <div class="center-section">
            <div class="addressee">${addresseeText}</div>
            <div class="body-text">
              The President and members of the ${hostClubName} had the pleasure of ${bodyPhraseText}
            </div>
            <div class="visitor-name">
              ${v.visitorName || visitorName}
            </div>
            <div class="event-details">
              on <strong>${eventDate}</strong>. The topic of the day was <strong>${eventTopic}</strong>
            </div>
          </div>

          <!-- SIGNATURES FOOTER -->
          <div class="signatures-row">
            <!-- Left Signature -->
            <div class="sig-block">
              <div class="sig-image-container">
                ${
                  presidentSigUrl
                    ? `<img src="${presidentSigUrl}" class="sig-img" alt="President Signature" />`
                    : `<div class="sig-placeholder"></div>`
                }
              </div>
              <div class="sig-line"></div>
              <div class="sig-name">${presidentName}</div>
              <div class="sig-role">${presidentTitle}</div>
            </div>

            <!-- Right Signature -->
            <div class="sig-block">
              <div class="sig-image-container">
                ${
                  secretarySigUrl
                    ? `<img src="${secretarySigUrl}" class="sig-img" alt="Secretary Signature" />`
                    : `<div class="sig-placeholder"></div>`
                }
              </div>
              <div class="sig-line"></div>
              <div class="sig-name">${secretaryName}</div>
              <div class="sig-role">${secretaryTitle}</div>
            </div>
          </div>
        </div>
      </div>
    `;
        }
      )
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fellowship Cards - ${hostClubName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Playfair+Display:ital,wght@1,600;1,700;1,800&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

            @page {
              size: A4 portrait;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              background: #ffffff;
              font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
              color: #1e293b;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .card-page {
              width: 210mm;
              height: 297mm;
              box-sizing: border-box;
              display: flex;
              align-items: flex-start;
              justify-content: center;
              margin: 0 auto;
              padding: 10mm 10mm;
              page-break-after: always;
              page-break-inside: avoid;
              break-inside: avoid;
              background: #ffffff;
              overflow: hidden;
            }

            @media print {
              body { background: #ffffff; }
              .card-page { margin: 0 auto; box-shadow: none; border: none; }
            }

            .card-container {
              position: relative;
              width: 100%;
              height: 135mm;
              box-sizing: border-box;
              background: #ffffff;
              border: 2px solid #cbd5e1;
              border-radius: 12px;
              padding: 16px 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              overflow: hidden;
            }

            /* Watermark */
            .watermark {
              position: absolute !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              width: 420px;
              height: 420px;
              background-image: url('${logoUrl}');
              background-repeat: no-repeat;
              background-position: center;
              background-size: contain;
              opacity: 0.05;
              pointer-events: none;
              z-index: 1;
            }

            .card-container > *:not(.watermark) {
              position: relative;
              z-index: 2;
            }

            /* Header */
            .header {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              margin-top: 0;
            }

            .top-section {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
              margin-top: 0;
            }

            .center-section {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 16px;
              max-width: 580px;
              margin: 0 auto;
            }

            .logo-row {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
            }

            .club-title {
              font-family: 'Cinzel', serif, sans-serif;
              font-size: 32px;
              font-weight: 800;
              color: #0067C8;
              letter-spacing: -0.5px;
            }

            .rotary-wheel {
              width: 62px;
              height: 62px;
              object-fit: contain;
            }

            /* Document Title */
            .card-title {
              font-family: 'Cinzel', serif;
              font-size: 34px;
              font-weight: 700;
              color: #17458F;
              margin: 4px 0 0 0;
              letter-spacing: 0.5px;
            }

            /* Addressee */
            .addressee {
              font-size: 17px;
              font-weight: 800;
              color: #0f172a;
              margin-bottom: 12px;
            }

            /* Body Text */
            .body-text {
              font-size: 16px;
              font-weight: 500;
              color: #334155;
              line-height: 1.5;
              max-width: 540px;
              margin: 0 auto;
            }

            /* Visitor Name */
            .visitor-name {
              font-family: 'Playfair Display', Georgia, serif;
              font-size: 28px;
              font-weight: 700;
              font-style: italic;
              color: #D9531F;
              padding: 6px 25px 8px 25px;
              border-bottom: 2px solid #cbd5e1;
              display: inline-block;
              margin: 10px 0;
            }

            /* Event Details */
            .event-details {
              font-size: 15px;
              line-height: 1.6;
              color: #1e293b;
              max-width: 580px;
              margin: 6px auto 12px auto;
            }

            .event-details strong {
              color: #0f172a;
              font-weight: 800;
            }

            /* Signatures */
            .signatures-row {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding: 0 15px;
              margin-top: 10px;
              margin-bottom: 0;
            }

            .sig-block {
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 210px;
            }

            .sig-image-container {
              height: 48px;
              display: flex;
              align-items: flex-end;
              justify-content: center;
              margin-bottom: -4px;
            }

            .sig-img {
              max-height: 46px;
              max-width: 180px;
              object-fit: contain;
            }

            .sig-placeholder {
              height: 32px;
            }

            .sig-line {
              width: 100%;
              border-bottom: 1.5px solid #475569;
              margin-bottom: 6px;
            }

            .sig-name {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              margin-bottom: 2px;
            }

            .sig-role {
              font-size: 13px;
              font-weight: 600;
              color: #475569;
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/75 backdrop-blur-md p-2 sm:p-6 overflow-y-auto py-6 sm:py-10">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-200 max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#17458F] shrink-0">
                <Award size={18} />
              </div>
              <div>
                <h2 className="font-extrabold text-xs sm:text-sm text-[#001D4A] uppercase tracking-wider">
                  Official Fellowship Card
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[210px] sm:max-w-none">
                  {visitors.length > 1
                    ? `Visitor ${currentIndex + 1} of ${visitors.length}: ${currentVisitor.visitorName}`
                    : `Issued for ${visitorName}`}
                </p>
              </div>
            </div>

            {/* Close Mobile Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer sm:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isEditing
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
              <span>{isEditing ? "Done" : "Customize"}</span>
            </button>

            {/* WhatsApp Send Action */}
            <button
              onClick={() => handleSendCardsViaWhatsApp(visitors.length > 1)}
              disabled={!!sendingChannel}
              className="px-2.5 sm:px-3.5 py-1.5 bg-[#25D366] hover:bg-[#1ebd59] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Send Fellowship Card via WhatsApp"
            >
              {sendingChannel === "whatsapp" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Smartphone size={14} />
              )}
              <span>{visitors.length > 1 ? `WhatsApp (${visitors.length})` : "WhatsApp"}</span>
            </button>

            {/* Email Send Action */}
            <button
              onClick={() => handleSendCardsViaEmail(visitors.length > 1)}
              disabled={!!sendingChannel}
              className="px-2.5 sm:px-3.5 py-1.5 bg-[#0067C8] hover:bg-[#0052a3] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Send Fellowship Card via Email"
            >
              {sendingChannel === "email" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              <span>{visitors.length > 1 ? `Email (${visitors.length})` : "Email"}</span>
            </button>

            {visitors.length > 1 && (
              <button
                onClick={() => handlePrintCards(true)}
                className="px-2.5 sm:px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Print all cards in batch"
              >
                <Printer size={14} />
                <span>Print All ({visitors.length})</span>
              </button>
            )}

            <button
              onClick={() => handlePrintCards(false)}
              className="px-3 sm:px-4 py-1.5 bg-[#17458F] hover:bg-[#0f2e60] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            {/* Desktop Close Button */}
            <button
              onClick={onClose}
              className="hidden sm:block p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 flex flex-col items-center">

          {/* Quick Edit Panel */}
          {isEditing && (
            <div className="w-full max-w-2xl bg-white border border-amber-200 rounded-2xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Edit3 size={14} /> Customize Card Fields
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Visitor Full Name</label>
                  <input
                    type="text"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Visitor's Home Club</label>
                  <input
                    type="text"
                    value={visitorClub}
                    onChange={(e) => setVisitorClub(e.target.value)}
                    placeholder="e.g. RC Ntinda"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Meeting Date</label>
                  <input
                    type="text"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Fellowship Topic</label>
                  <input
                    type="text"
                    value={eventTopic}
                    onChange={(e) => setEventTopic(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">President Name & Title</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={presidentName}
                      onChange={(e) => setPresidentName(e.target.value)}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                    />
                    <input
                      type="text"
                      value={presidentTitle}
                      onChange={(e) => setPresidentTitle(e.target.value)}
                      placeholder="Title"
                      className="w-32 px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Secretary Name & Title</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={secretaryName}
                      onChange={(e) => setSecretaryName(e.target.value)}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                    />
                    <input
                      type="text"
                      value={secretaryTitle}
                      onChange={(e) => setSecretaryTitle(e.target.value)}
                      placeholder="Title"
                      className="w-32 px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-[#17458F]/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-amber-200 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveLeadershipToSettings}
                  disabled={savingSettings}
                  className="px-3.5 py-1.5 bg-[#17458F] hover:bg-[#0f2e60] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Save Leadership as Permanent Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Navigation for Batch mode */}
          {visitors.length > 1 && (
            <div className="flex items-center justify-between w-full max-w-xl mb-4 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft size={16} /> Previous Visitor
              </button>

              <span className="text-xs font-bold text-slate-700 font-mono">
                {currentIndex + 1} / {visitors.length}
              </span>

              <button
                onClick={handleNext}
                disabled={currentIndex === visitors.length - 1}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1"
              >
                Next Visitor <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Live Card Preview */}
          <div id="fellowship-card-canvas-target" className="w-full max-w-xl min-h-[660px] sm:min-h-[760px] bg-white rounded-xl shadow-2xl border border-slate-200 p-6 sm:p-10 relative flex flex-col justify-between items-center text-center my-2 shrink-0 transition-all">
            
            {/* Watermark Background */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.04] bg-center bg-no-repeat bg-contain"
              style={{
                backgroundImage: `url(${organization?.logo_url || "/assets/rotary_gold_logo.png"})`,
                margin: "40px",
              }}
            />

            {/* Top Logo & Host Club Header */}
            <div className="w-full flex flex-col items-center justify-center gap-2 pt-2 relative z-10">
              <div className="flex items-center justify-center gap-4">
                <span className="font-extrabold text-2xl sm:text-3xl text-[#0067C8] tracking-tight uppercase" style={{ fontFamily: "Cinzel, serif" }}>
                  {hostClubName}
                </span>
                <img
                  src={organization?.logo_url || "/assets/rotary_gold_logo.png"}
                  alt="Rotary Wheel"
                  crossOrigin="anonymous"
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                />
              </div>
            </div>

            {/* Document Title & Addressee */}
            {(() => {
              const isRotarian = checkIsRotarian(currentVisitor, visitorClub);
              const titleText = isRotarian ? "Fellowship Card" : "Guest Visitation Card";
              const addresseeText = isRotarian ? `To the Secretary, ${visitorClub || "Visiting Club"}` : "To Our Esteemed Guest";
              const bodyPhraseText = isRotarian ? "sharing fellowship with" : "hosting our guest";

              return (
                <>
                  <div className="relative z-10 my-2">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#17458F] tracking-wide" style={{ fontFamily: "Cinzel, serif" }}>
                      {titleText}
                    </h1>
                  </div>

                  <div className="relative z-10 text-base sm:text-lg font-extrabold text-slate-900 my-1">
                    {addresseeText}
                  </div>

                  <div className="relative z-10 text-xs sm:text-sm font-medium text-slate-600 max-w-md leading-relaxed my-1">
                    The President and members of the {hostClubName} had the pleasure of {bodyPhraseText}
                  </div>
                </>
              );
            })()}

            {/* Visitor Name */}
            <div className="relative z-10 my-3">
              <span
                className="text-2xl sm:text-3xl font-bold italic text-[#D9531F] px-6 py-1 border-b-2 border-slate-300 inline-block"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {visitorName}
              </span>
            </div>

            {/* Event Date & Topic */}
            <div className="relative z-10 text-xs sm:text-sm text-slate-800 leading-relaxed max-w-lg my-2">
              on <strong className="font-extrabold text-slate-900">{eventDate}</strong>. The topic of the day was{" "}
              <strong className="font-extrabold text-slate-900">{eventTopic}</strong>
            </div>

            {/* Dual Signatures */}
            <div className="w-full flex justify-between items-end px-4 sm:px-8 mt-6 relative z-10">
              {/* President Signature */}
              <div className="flex flex-col items-center w-36 sm:w-44">
                <div className="h-12 flex items-end justify-center mb-1">
                  {presidentSigUrl ? (
                    <img src={presidentSigUrl} alt="President Signature" crossOrigin="anonymous" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <div className="h-8" />
                  )}
                </div>
                <div className="w-full border-b border-slate-600 mb-1" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">{presidentName}</span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600">{presidentTitle}</span>
              </div>

              {/* Secretary Signature */}
              <div className="flex flex-col items-center w-36 sm:w-44">
                <div className="h-12 flex items-end justify-center mb-1">
                  {secretarySigUrl ? (
                    <img src={secretarySigUrl} alt="Secretary Signature" crossOrigin="anonymous" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <div className="h-8" />
                  )}
                </div>
                <div className="w-full border-b border-slate-600 mb-1" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">{secretaryName}</span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600">{secretaryTitle}</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
