const multer = require('multer');
const path = require('path');
const fs = require('fs');
const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convert);
const mammoth = require('mammoth');
const HTMLtoDOCX = require('html-to-docx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Ensure the uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: 'uploads/' });

const express = require('express');
const cors = require('cors');
const { Company } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Route 1: Save Company and Directors data
app.post('/api/companies', async (req, res) => {
    try {
        const { company, directors } = req.body;

        if (!company || !company.companyName || !company.cin) {
            return res.status(400).json({ error: 'Company details are incomplete' });
        }

        const savedCompany = await Company.save({
            ...company,
            directors: directors || []
        });

        res.status(201).json({ success: true, company: savedCompany });
    } catch (error) {
        console.error('Error saving company:', error);
        res.status(500).json({ error: 'Failed to save company data' });
    }
});

// API Route 2: Get all registered companies
app.get('/api/companies', async (req, res) => {
    try {
        const companies = await Company.find({});
        res.status(200).json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
});

// API Route 3: Generate all documents
app.post('/api/generate-all-documents', async (req, res) => {
    try {
        const { companyId, variables, formattedDirectors } = req.body;
        const compileTemplate = (name, vars, dirs) => `Compiled template: ${name}`;
        const documents = {
            notice: compileTemplate('notice', variables, formattedDirectors),
            agenda: compileTemplate('agenda', variables, formattedDirectors),
            acknowledgement: compileTemplate('acknowledgement', variables, formattedDirectors),
            attendance: compileTemplate('attendance', variables, formattedDirectors),
            resolution: compileTemplate('resolution', variables, formattedDirectors),
            minutes: compileTemplate('minutes', variables, formattedDirectors)
        };
        res.status(200).json({ success: true, documents });
    } catch (error) {
        console.error('Error generating documents:', error);
        res.status(500).json({ error: 'Failed to generate legal document package' });
    }
});

// Document Storage Setup
const docUploadDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(docUploadDir)) {
    fs.mkdirSync(docUploadDir, { recursive: true });
}

const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/documents/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + file.originalname);
    }
});
const docUpload = multer({ storage: docStorage });

const http = require('http');
const https = require('https');

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
                return;
            }
            const fileStream = fs.createWriteStream(destPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        }).on('error', reject);
    });
}

// API Endpoint: Upload document file
app.post('/api/documents/upload', docUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        let finalFilename = req.file.filename;
        const filePath = req.file.path;

        if (ext === '.doc' || ext === '.rtf') {
            const fileBuffer = fs.readFileSync(filePath);
            const docxBuffer = await libre.convertAsync(fileBuffer, '.docx', undefined);

            const baseName = path.basename(req.file.originalname, ext);
            finalFilename = Date.now() + '_' + baseName + '.docx';
            const newPath = path.join(docUploadDir, finalFilename);

            fs.writeFileSync(newPath, docxBuffer);
            fs.unlinkSync(filePath);
        }

        const finalPath = path.join(docUploadDir, finalFilename);
        const originalFilename = 'original_' + finalFilename;
        const originalPath = path.join(docUploadDir, originalFilename);
        fs.copyFileSync(finalPath, originalPath);

        res.status(200).json({ success: true, filename: finalFilename });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process document upload' });
    }
});

// API Endpoint: List all uploaded document templates
app.get('/api/documents', (req, res) => {
    try {
        const files = fs.readdirSync(docUploadDir);
        // Return only the non-original, non-compiled DOCX files
        const templates = files.filter(f => f.endsWith('.docx') && !f.startsWith('original_') && !f.startsWith('compiled_'));
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Endpoint: Serve raw document to ONLYOFFICE
app.get('/api/documents/download/:filename', (req, res) => {
    const filePath = path.join(docUploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Document not found');
    }
    res.sendFile(filePath);
});

// API Endpoint: Download Original DOCX
app.get('/api/documents/download-original/:filename', (req, res) => {
    const filename = req.params.filename;
    const originalFilename = 'original_' + filename;
    const filePath = path.join(docUploadDir, originalFilename);
    if (!fs.existsSync(filePath)) {
        const currentPath = path.join(docUploadDir, filename);
        if (!fs.existsSync(currentPath)) {
            return res.status(404).send('Document not found');
        }
        return res.download(currentPath, filename.replace(/^\d+_(original_)?/, 'original_'));
    }
    res.download(filePath, filename.replace(/^\d+_(original_)?/, 'original_'));
});

// API Endpoint: Download Updated DOCX
app.get('/api/documents/download-updated/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(docUploadDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Document not found');
    }
    res.download(filePath, filename.replace(/^\d+_(original_)?/, 'updated_'));
});

// API Endpoint: Receive and save edits from ONLYOFFICE callback
app.post('/api/documents/callback/:filename', async (req, res) => {
    try {
        const { status, url } = req.body;
        const filename = req.params.filename;
        const filePath = path.join(docUploadDir, filename);

        if (status === 2 && url) {
            await downloadFile(url, filePath);
            console.log(`Document saved successfully via ONLYOFFICE callback: ${filename}`);
        }

        res.json({ error: 0 });
    } catch (error) {
        console.error('Save callback error:', error);
        res.status(500).json({ error: 1, message: 'Failed to save document' });
    }
});

// API Endpoint: Parse docx file to extract comments and quote text
app.get('/api/documents/comments/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(docUploadDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.json([]);
        }

        const ext = path.extname(filename).toLowerCase();
        if (ext !== '.docx') {
            return res.json([]);
        }

        const content = fs.readFileSync(filePath);
        const zip = new PizZip(content);

        if (!zip.files["word/comments.xml"]) {
            return res.json([]);
        }

        const commentsXml = zip.files["word/comments.xml"].asText();
        const documentXml = zip.files["word/document.xml"].asText();

        const comments = [];
        const commentBlockRegex = /<w:comment\s+[^>]*?w:id="([^"]+)"[\s\S]*?<\/w:comment>/g;
        let match;
        while ((match = commentBlockRegex.exec(commentsXml)) !== null) {
            const id = match[1];
            const body = match[0];

            const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            let textMatch;
            let textParts = [];
            while ((textMatch = textRegex.exec(body)) !== null) {
                textParts.push(textMatch[1]);
            }
            const text = textParts.join('');

            comments.push({ id, text, quote: '' });
        }

        comments.forEach(comment => {
            const rangeRegexStr = `<w:commentRangeStart\\s+[^>]*?w:id="${comment.id}"\\/>([\\s\\S]*?)<w:commentRangeEnd\\s+[^>]*?w:id="${comment.id}"\\/>`;
            const rangeRegex = new RegExp(rangeRegexStr);
            const rangeMatch = documentXml.match(rangeRegex);
            if (rangeMatch && rangeMatch[1]) {
                const rangeContent = rangeMatch[1];
                const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
                let tMatch;
                let quoteParts = [];
                while ((tMatch = tRegex.exec(rangeContent)) !== null) {
                    quoteParts.push(tMatch[1]);
                }
                comment.quote = quoteParts.join('');
            }
        });

        res.json(comments);
    } catch (err) {
        console.error("Error parsing comments:", err);
        res.status(500).json({ error: "Failed to parse comments: " + err.message });
    }
});

// API Endpoint: Convert DOCX to HTML for web editor
app.get('/api/documents/html/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(docUploadDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Document not found');
        }

        const result = await mammoth.convertToHtml({ path: filePath });
        res.json({ html: result.value, messages: result.messages });
    } catch (error) {
        console.error('Error converting DOCX to HTML:', error);
        res.status(500).json({ error: 'Failed to convert document to HTML' });
    }
});

// API Endpoint: Convert edited HTML back to DOCX
app.post('/api/documents/save-html/:filename', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(docUploadDir, filename);
        const { html } = req.body;

        if (!html) {
            return res.status(400).json({ error: 'No HTML content provided' });
        }

        const docxBuffer = await HTMLtoDOCX(html, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            header: true,
            pageNumber: true
        });

        fs.writeFileSync(filePath, docxBuffer);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving HTML to DOCX:', error);
        res.status(500).json({ error: 'Failed to save HTML back to DOCX' });
    }
});

// API Endpoint: Generate configuration for ONLYOFFICE DocEditor initialization
app.get('/api/documents/config/:filename', (req, res) => {
    const filename = req.params.filename;
    const ext = path.extname(filename).toLowerCase().substring(1);

    const fileUrl = `http://127.0.0.1:5000/api/documents/download/${encodeURIComponent(filename)}`;
    const callbackUrl = `http://127.0.0.1:5000/api/documents/callback/${encodeURIComponent(filename)}`;

    let documentType = 'word';
    if (['xlsx', 'xls', 'csv'].includes(ext)) documentType = 'cell';
    else if (['pptx', 'ppt'].includes(ext)) documentType = 'slide';

    const filePath = path.join(docUploadDir, filename);
    let key = Date.now().toString();
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        key = 'doc_' + stats.mtimeMs.toFixed(0);
    }

    const config = {
        document: {
            fileType: ext,
            key: key,
            title: filename,
            url: fileUrl,
            permissions: {
                edit: ext !== 'pdf',
                comment: true,
                download: true
            }
        },
        documentType: documentType,
        editorConfig: {
            callbackUrl: callbackUrl,
            mode: ext === 'pdf' ? 'view' : 'edit',
            user: {
                id: 'admin_id',
                name: 'System Admin'
            },
            customization: {
                autosave: true,
                forcesave: true,
                chat: false,
                feedback: false,
                help: false
            }
        }
    };

    res.json(config);
});

// API Endpoint: On-the-fly conversion of docx to PDF via LibreOffice
app.get('/api/documents/download-pdf/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(docUploadDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File not found');
        }

        const ext = path.extname(filename).toLowerCase();
        if (ext === '.pdf') {
            return res.download(filePath, filename);
        }

        const docBuffer = fs.readFileSync(filePath);
        const pdfBuffer = await libre.convertAsync(docBuffer, '.pdf', undefined);

        const pdfFilename = path.basename(filename, ext) + '.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF export error:', err);
        res.status(500).send('Error exporting PDF');
    }
});

// Helper functions to escape XML and resolve database values
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function resolveDatabaseValue(commentText, company, manualData = null) {
    // If manualData is provided, check it first
    if (manualData && manualData[commentText] !== undefined) {
        return manualData[commentText];
    }

    if (!company) return null;

    const text = commentText.toLowerCase().trim();
    if (text.includes('company name') || text.includes('name of the company')) return company.companyName || '';
    if (text.includes('cin')) return company.cin || '';
    if (text.includes('pan')) return company.pan || '';
    if (text.includes('email')) return company.email || '';
    if (text.includes('registered address') || text.includes('address')) return company.address || '';

    if (company.directors && company.directors[0]) {
        const dir = company.directors[0];
        if (text.includes('director name') || text.includes('name of director')) return dir.name || '';
        if (text.includes('din')) return dir.din || '';
        if (text.includes('designation')) return dir.designation || '';
    }

    if (text === 'day') {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[new Date().getDay()];
    }
    if (text === 'month') {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[new Date().getMonth()];
    }
    if (text === 'date') {
        return new Date().toLocaleDateString('en-GB');
    }

    return null;
}

function replaceCommentRanges(documentXml, commentsList, company, manualData = null) {
    let processedXml = documentXml;

    commentsList.forEach(comment => {
        const resolvedValue = resolveDatabaseValue(comment.text, company, manualData);
        if (resolvedValue === null) return;

        const escapedValue = escapeXml(String(resolvedValue));
        const rangeRegexStr = `(<w:commentRangeStart\\s+[^>]*?w:id="${comment.id}"\\/>)([\\s\\S]*?)(<w:commentRangeEnd\\s+[^>]*?w:id="${comment.id}"\\/>)`;
        const rangeRegex = new RegExp(rangeRegexStr, 'g');

        processedXml = processedXml.replace(rangeRegex, (match, startTag, midContent, endTag) => {
            let replaced = false;
            const updatedMidContent = midContent.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (tMatch, tText) => {
                if (!replaced) {
                    replaced = true;
                    return tMatch.replace(tText, escapedValue);
                }
                return tMatch.replace(tText, '');
            });
            return startTag + updatedMidContent + endTag;
        });
    });

    return processedXml;
}

// API Endpoint: Generate compiled document using dynamic comment-matching replacements
app.post('/api/documents/generate', async (req, res) => {
    try {
        const { documentId, companyId, manualData } = req.body;

        let company = null;
        if (companyId) {
            const companies = await Company.find({});
            company = companies.find(c => c._id === companyId || c.id === companyId);
        }

        const filePath = path.join(docUploadDir, documentId);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Template file not found' });
        }

        // 1. Extract comments directly from document file
        const content = fs.readFileSync(filePath);
        const zip = new PizZip(content);

        if (zip.files["word/comments.xml"]) {
            const commentsXml = zip.files["word/comments.xml"].asText();
            const documentXml = zip.files["word/document.xml"].asText();

            const comments = [];
            const commentBlockRegex = /<w:comment\s+[^>]*?w:id="([^"]+)"[\s\S]*?<\/w:comment>/g;
            let match;
            while ((match = commentBlockRegex.exec(commentsXml)) !== null) {
                const id = match[1];
                const body = match[0];
                const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
                let textMatch;
                let textParts = [];
                while ((textMatch = textRegex.exec(body)) !== null) {
                    textParts.push(textMatch[1]);
                }
                comments.push({ id, text: textParts.join('') });
            }

            // 2. Perform dynamic content replacements directly inside comment ranges
            const updatedDocumentXml = replaceCommentRanges(documentXml, comments, company, manualData);
            zip.file("word/document.xml", updatedDocumentXml);
        }

        const compiledBuffer = zip.generate({ type: 'nodebuffer' });
        const companyNamePart = company ? company.companyName.replace(/\s+/g, '_') : 'Manual';
        const compiledFilename = `compiled_${companyNamePart}_${documentId}`;
        const outputPath = path.join(docUploadDir, compiledFilename);
        fs.writeFileSync(outputPath, compiledBuffer);

        res.json({
            success: true,
            compiledFilename,
            downloadUrl: `http://localhost:5000/api/documents/download-updated/${compiledFilename}`
        });
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: 'Failed to generate document: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});