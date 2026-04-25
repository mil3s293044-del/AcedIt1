import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// VCAA subject page slugs (URL path on vcaa.vic.edu.au)
const SUBJECT_PAGE_SLUGS = {
    "English": "english",
    "English Language": "english-language",
    "Literature": "literature",
    "EAL/D": "english-additional-language-eal",
    "Mathematical Methods": "mathematical-methods",
    "Specialist Mathematics": "specialist-mathematics",
    "Further Mathematics": "further-mathematics",
    "Physics": "physics",
    "Chemistry": "chemistry",
    "Biology": "biology",
    "Psychology": "psychology",
    "Legal Studies": "legal-studies",
    "Business Management": "business-management",
    "Economics": "economics",
    "Accounting": "accounting",
    "History: Revolutions": "revolutions",
    "Health and Human Development": "health-and-human-development",
    "Physical Education": "physical-education",
    "Geography": "geography",
    "Sociology": "sociology",
    "Software Development": "software-development",
    "Music Performance": "music-repertoire-performance",
};

const BASE_VCAA = "https://www.vcaa.vic.edu.au";
const EXAMS_PAGE_BASE = `${BASE_VCAA}/assessment/vce/examination-specifications-past-examinations-and-examination-reports`;

// Fetch the VCAA subject exam page and extract PDF links for a given year
async function scrapeVCAApageForLinks(subject, year, examNumber, type) {
    const pageSlug = SUBJECT_PAGE_SLUGS[subject];
    if (!pageSlug) throw new Error(`Unknown subject: ${subject}`);

    const pageUrl = `${EXAMS_PAGE_BASE}/${pageSlug}`;

    const res = await fetch(pageUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,*/*",
        }
    });

    if (!res.ok) throw new Error(`Could not load VCAA page: ${pageUrl} (status ${res.status})`);

    const html = await res.text();

    // Extract all PDF/DOCX links from the page (preserve originals too)
    const linkRegex = /href="([^"]+\.(pdf|docx|PDF|DOCX))"/gi;
    const allLinksOriginal = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        if (href.startsWith("//")) href = "https:" + href;
        else if (href.startsWith("/")) href = BASE_VCAA + href;
        else if (!href.startsWith("http")) href = BASE_VCAA + "/" + href;
        allLinksOriginal.push(href);
    }
    const allLinks = allLinksOriginal.map(l => l.toLowerCase());

    const yearStr = year.toString();

    const n = examNumber ? examNumber.toString() : null;

    // Determine what keywords to look for, in order of specificity
    let keywords = [];
    if (type === "report") {
        keywords = n ? [
            [yearStr, "report", `exam${n}`],
            [yearStr, `${n}-report`],
            [yearStr, `report`],
            [yearStr, "er.docx"],
            [yearStr, "er.pdf"],
        ] : [
            [yearStr, "report"],
            [yearStr, "er.docx"],
            [yearStr, "er.pdf"],
        ];
    } else {
        // For exam PDFs — be specific about exam number to avoid matching wrong one
        keywords = n ? [
            [yearStr, `exam${n}-w`],
            [yearStr, `exam${n}.pdf`],
            [yearStr, `mm${n}-w`],   // Maths Methods shortcode
            [yearStr, `${yearStr}mm${n}`],
            // Generic: year + exam number indicator in filename
            [yearStr, n + "-w.pdf"],
            [yearStr, `-w.pdf`, n],
            // Last resort: just year + written exam
            [yearStr, `-w.pdf`],
        ] : [
            [yearStr, `-w.pdf`],
            [yearStr, `.pdf`],
        ];
    }

    // Find best matching link — return original-case URL
    for (const kwSet of keywords) {
        const validKw = kwSet.filter(Boolean);
        const idx = allLinks.findIndex(link => validKw.every(kw => link.includes(kw)));
        if (idx !== -1) return allLinksOriginal[idx];
    }

    // Fallback: return all year-matching PDF links
    const yearIndices = allLinks.map((l, i) => l.includes(yearStr) && l.includes(".pdf") ? i : -1).filter(i => i !== -1);
    return yearIndices.length > 0 ? { candidates: yearIndices.map(i => allLinksOriginal[i]) } : null;
}



// Fetch a PDF/DOCX and extract plain text
async function fetchAndExtractText(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/pdf,*/*",
            "Referer": BASE_VCAA + "/"
        },
        redirect: "follow"
    });

    if (!res.ok) throw new Error(`Failed to fetch file: ${url} (status ${res.status})`);

    const ct = res.headers.get("content-type") || "";
    const isPDF = ct.includes("pdf") || ct.includes("octet-stream") || url.toLowerCase().endsWith(".pdf");
    const isDOCX = ct.includes("wordprocessingml") || ct.includes("msword") || url.toLowerCase().endsWith(".docx");

    if (!isPDF && !isDOCX) {
        throw new Error(`URL did not return a PDF or DOCX (content-type: ${ct})`);
    }

    const buffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    if (isDOCX) {
        // For DOCX: write to /tmp and use mammoth to extract text
        const tmpPath = `/tmp/doc_${Date.now()}.docx`;
        await Deno.writeFile(tmpPath, uint8);
        const mammoth = await import("npm:mammoth@1.8.0");
        const result = await mammoth.extractRawText({ path: tmpPath });
        await Deno.remove(tmpPath).catch(() => {});
        const text = result.value?.trim();
        if (!text || text.length < 100) throw new Error("Could not extract text from DOCX — file may be empty or protected.");
        return text;
    }

    // PDF text extraction using pdfjs-dist (pure JS, no native deps)
    const pdfjsLib = await import("npm:pdfjs-dist@4.9.155/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({ data: uint8 });
    const pdfDoc = await loadingTask.promise;
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
    }
    const text = fullText.trim();
    if (!text || text.length < 100) throw new Error("Could not extract text from PDF — the file may be scanned/image-based.");
    return text;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { subject, year, examNumber, type } = await req.json();

        if (!subject || !year) {
            return Response.json({ error: "Missing subject or year" }, { status: 400 });
        }

        // Step 1: Scrape the VCAA page to find the actual PDF link
        let pdfUrl = null;
        let candidates = [];

        const scraped = await scrapeVCAApageForLinks(subject, year, examNumber, type || "exam");

        if (scraped && typeof scraped === "string") {
            pdfUrl = scraped;
        } else if (scraped && scraped.candidates) {
            candidates = scraped.candidates;
            // Pick the most likely candidate based on exam number
            const n = examNumber ? examNumber.toString() : "1";
            if (type === "report") {
                pdfUrl = candidates.find(c => c.includes("report") || c.includes("er.pdf")) || candidates[0];
            } else {
                pdfUrl = candidates.find(c => c.includes(`exam${n}`) || c.includes(`${n}-w`) || c.includes(`${year}${n.toUpperCase()}`)) || candidates.find(c => c.includes("-w.pdf")) || candidates[0];
            }
        }

        if (!pdfUrl) {
            return Response.json({
                error: "not_found",
                message: `Could not find the ${type === "report" ? "examiner's report" : "exam"} for ${subject} ${year}${examNumber ? ` Exam ${examNumber}` : ""}. It may not be available yet or the URL structure may have changed.`
            }, { status: 404 });
        }

        // Step 2: Fetch and extract text from the PDF/DOCX
        const extractedText = await fetchAndExtractText(pdfUrl);

        return Response.json({
            success: true,
            url: pdfUrl,
            extracted_text: extractedText
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});