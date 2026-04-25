import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import mammoth from 'npm:mammoth@1.8.0';
import JSZip from 'npm:jszip@3.10.1';
import { Buffer } from 'node:buffer';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url, file_extension } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        // Fetch the file
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            return Response.json({ error: 'Failed to fetch file' }, { status: 400 });
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Use explicitly passed extension, or fall back to URL-based detection
        const fileExtension = file_extension || file_url.split('.').pop()?.toLowerCase().split('?')[0];

        let extractedText = '';

        if (fileExtension === 'docx') {
            // mammoth requires a Node.js Buffer — convert from ArrayBuffer
            const nodeBuffer = Buffer.from(arrayBuffer);
            const result = await mammoth.extractRawText({ buffer: nodeBuffer });
            extractedText = result.value;
        } else if (fileExtension === 'pptx') {
            // Extract text from PPTX
            const zip = await JSZip.loadAsync(buffer);
            const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
            
            const slideTexts = [];
            for (const slidePath of slideFiles.sort()) {
                const slideXml = await zip.files[slidePath].async('text');
                // Extract text between <a:t> tags (text content in PowerPoint)
                const textMatches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
                const slideText = textMatches.map(match => match.replace(/<\/?a:t>/g, '')).join(' ');
                if (slideText.trim()) {
                    slideTexts.push(slideText.trim());
                }
            }
            extractedText = slideTexts.join('\n\n');
        } else if (fileExtension === 'doc') {
            // DOC files are not directly supported by mammoth, return error
            return Response.json({ 
                error: 'DOC files are not supported. Please convert to DOCX or PDF first.' 
            }, { status: 400 });
        } else if (fileExtension === 'ppt') {
            // Old PPT files need conversion
            return Response.json({ 
                error: 'PPT files are not supported. Please convert to PPTX or PDF first.' 
            }, { status: 400 });
        } else if (fileExtension === 'txt') {
            // Plain text
            extractedText = new TextDecoder().decode(buffer);
        } else if (fileExtension === 'pdf') {
            // PDFs should be handled by the LLM directly with file_urls
            return Response.json({ 
                error: 'PDF files should be processed directly by the AI' 
            }, { status: 400 });
        } else {
            return Response.json({ error: 'Unsupported file type' }, { status: 400 });
        }

        return Response.json({ text: extractedText });

    } catch (error) {
        console.error('Error extracting document text:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});