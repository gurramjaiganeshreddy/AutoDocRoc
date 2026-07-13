const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const docUploadDir = path.join(__dirname, 'uploads', 'documents');
const files = fs.readdirSync(docUploadDir);
const allTemplates = files.filter(f =>
    f.endsWith('.docx') &&
    !f.startsWith('original_') &&
    !f.startsWith('compiled_') &&
    !f.startsWith('test_')
);

const grouped = {};
allTemplates.forEach(filename => {
    const i = filename.indexOf('_');
    const baseName = i > 0 ? filename.substring(i + 1) : filename;
    if (!grouped[baseName]) grouped[baseName] = [];
    grouped[baseName].push(filename);
});

Object.keys(grouped).forEach(baseName => {
    const versions = grouped[baseName];
    versions.sort((a, b) => {
        const sizeA = fs.statSync(path.join(docUploadDir, a)).size;
        const sizeB = fs.statSync(path.join(docUploadDir, b)).size;
        return sizeB - sizeA;
    });
    const sel = versions[0];
    console.log('Template:', sel, fs.statSync(path.join(docUploadDir, sel)).size, 'bytes');

    const zip = new PizZip(fs.readFileSync(path.join(docUploadDir, sel)));
    if (!zip.files['word/comments.xml']) {
        console.log('NO comments.xml');
        return;
    }

    const cx = zip.files['word/comments.xml'].asText();
    const dx = zip.files['word/document.xml'].asText();

    const cs = [];
    const r1 = /<w:comment\s+[^>]*?w:id="([^"]+)"[\s\S]*?<\/w:comment>/g;
    let m;
    while ((m = r1.exec(cx)) !== null) {
        const id = m[1];
        const body = m[0];
        const r2 = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let tm;
        const tp = [];
        while ((tm = r2.exec(body)) !== null) tp.push(tm[1]);
        cs.push({ id, text: tp.join('') });
    }

    console.log(cs.length, 'comments found');
    cs.forEach(c => console.log('  ID=' + c.id + ' text="' + c.text.substring(0, 60) + '"'));

    // Show actual commentRangeStart tags
    console.log('\n--- commentRangeStart tags in document.xml ---');
    const s1 = /<w:commentRangeStart[^>]*>/g;
    let sm;
    while ((sm = s1.exec(dx)) !== null) {
        console.log('  ' + sm[0]);
    }

    // Show actual commentRangeEnd tags
    console.log('\n--- commentRangeEnd tags in document.xml ---');
    const e1 = /<w:commentRangeEnd[^>]*>/g;
    let em;
    while ((em = e1.exec(dx)) !== null) {
        console.log('  ' + em[0]);
    }

    // Test the regex match
    console.log('\n--- Regex match test ---');
    cs.forEach(c => {
        const rs = '(<w:commentRangeStart\\s+[^>]*?w:id="' + c.id + '"[^>]*?\\/?>)([\\s\\S]*?)(<w:commentRangeEnd\\s+[^>]*?w:id="' + c.id + '"[^>]*?\\/?>)';
        const rx = new RegExp(rs, 'g');
        const rm = dx.match(rx);
        console.log('  ID ' + c.id + ': ' + (rm ? 'MATCHED ' + rm.length : '*** NO MATCH ***'));
    });
});
