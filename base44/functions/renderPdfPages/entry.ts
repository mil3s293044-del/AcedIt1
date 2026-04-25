import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Fetches a PDF from a URL and returns:
// 1. Its raw bytes as a base64 data URL (for browser-native rendering)
// 2. Extracted plain text (for question detection only)
// 3. Page count

async function extractPdfText(uint8Array) {
    const pdfjsLib = await import("npm:pdfjs-dist@4.9.155/legacy/build/pdf.mjs");
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    const numPages = pdfDoc.numPages;
    let fullText = "";
    for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        fullText += content.items.map(i => i.str).join(" ") + "\n---PAGE BREAK---\n";
    }
    return { text: fullText.trim(), numPages };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { pdf_url } = await req.json();
        if (!pdf_url) return Response.json({ error: "pdf_url required" }, { status: 400 });

        const res = await fetch(pdf_url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/pdf,*/*",
                "Referer": "https://www.vcaa.vic.edu.au/"
            },
            redirect: "follow"
        });

        if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);

        const ct = res.headers.get("content-type") || "";
        const buffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        // Check it's actually a PDF
        const isPdf = ct.includes("pdf") || (uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46);
        if (!isPdf) throw new Error("URL did not return a PDF file — it may be blocked or redirected to a login page.");

        // Convert to base64 for browser rendering
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        const base64Pdf = btoa(binary);
        const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

        const { text, numPages } = await extractPdfText(uint8);

        return Response.json({
            success: true,
            pdf_data_url: pdfDataUrl,
            pdf_url,
            page_count: numPages,
            extracted_text: text
        });

    } catch (error) {
        console.error("renderPdfPages error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});