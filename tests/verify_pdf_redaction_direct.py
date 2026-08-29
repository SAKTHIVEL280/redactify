import os
import base64
import fitz # PyMuPDF
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence', exist_ok=True)

# Step 1: Create input PDF with exact test lines
doc = fitz.open()
page = doc.new_page(width=612, height=792)

text_lines = [
    (50, 80, "DOCUMENT REDACTION VERIFICATION BENCHMARK"),
    (50, 130, "Line A (Short PII): Case ID 9876543210 is confidential and under strict protective legal order."),
    (50, 180, "Line B (Long PII): Contact legal-compliance-audit-officer@enterprise.org regarding data security."),
    (50, 230, "Line C1 (Adjacent PII 1): Primary Telephone: +1-800-555-0199 (Operational Desk)"),
    (50, 260, "Line C2 (Adjacent PII 2): Emergency Telephone: +1-888-555-0144 (Incident Response Team)"),
    (50, 310, "Line D (Edge Margin): Right margin aligned tax identifier verification record PAN: ABCDE1234F"),
]

for x, y, line in text_lines:
    page.insert_text((x, y), line, fontsize=12, fontname="helv")

input_pdf_path = "verification_evidence/test_input.pdf"
doc.save(input_pdf_path)
doc.close()
print(f"[1] Created test input PDF: {input_pdf_path}")

# Render input PDF baseline
doc_in = fitz.open(input_pdf_path)
pix_in = doc_in[0].get_pixmap(dpi=150)
pix_in.save("verification_evidence/pdf_baseline_before_redaction.png")
doc_in.close()
print("[2] Rendered input baseline PNG")

# Read PDF bytes to send into browser
with open(input_pdf_path, "rb") as f:
    pdf_b64_in = base64.b64encode(f.read()).decode("utf-8")

# Step 2: In browser context, run extractTextFromPDF -> detectPII -> generatePDFBlob
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome_path, headless=True)
    b_page = browser.new_page(viewport={'width': 1280, 'height': 800})
    b_page.goto('http://localhost:4173')
    b_page.wait_for_load_state('networkidle')

    # Execute the full pipeline in page context
    redacted_b64 = b_page.evaluate("""
    async (pdfBase64) => {
        const { extractTextFromPDF, detectPII } = await import('./src/utils/piiDetector.js');
        const { generatePDFBlob } = await import('./src/utils/exportUtils.js');

        // Convert base64 to File object
        const binaryStr = atob(pdfBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const fileObj = new File([bytes], 'test_input.pdf', { type: 'application/pdf' });

        // 1. Extract text
        const extractedText = await extractTextFromPDF(fileObj);
        
        // 2. Detect PII
        const detected = detectPII(extractedText);
        
        // Ensure all are marked for redaction
        detected.forEach(d => d.redact = true);

        // 3. Generate Redacted PDF Blob
        const result = await generatePDFBlob(extractedText, fileObj, detected, true, 'test_input.pdf');

        // Convert output Blob to base64
        const outBuffer = await result.blob.arrayBuffer();
        let outBin = '';
        const outBytes = new Uint8Array(outBuffer);
        for (let i = 0; i < outBytes.byteLength; i++) {
            outBin += String.fromCharCode(outBytes[i]);
        }
        return {
            b64: btoa(outBin),
            detected: detected.map(d => ({ type: d.type, value: d.value, start: d.start, end: d.end }))
        };
    }
    """, pdf_b64_in)

    browser.close()

print(f"[3] Browser execution completed. Detected {len(redacted_b64['detected'])} items:")
for d in redacted_b64['detected']:
    print(f"    - [{d['type']}] '{d['value']}' (chars {d['start']}..{d['end']})")

# Step 3: Write out the exported PDF
output_pdf_path = "verification_evidence/test_output_redacted.pdf"
with open(output_pdf_path, "wb") as f:
    f.write(base64.b64decode(redacted_b64['b64']))
print(f"[4] Wrote exported PDF: {output_pdf_path}")

# Step 4: Render page 0 of exported PDF to PNG
doc_out = fitz.open(output_pdf_path)
page_out = doc_out[0]
pix_out = page_out.get_pixmap(dpi=150)
output_img_path = "verification_evidence/pdf_output_redacted.png"
pix_out.save(output_img_path)
doc_out.close()
print(f"[5] Rendered redacted PDF output to PNG: {output_img_path}")
