import os
import fitz # PyMuPDF
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence', exist_ok=True)

# 1. Create input PDF with exact required benchmark items
doc = fitz.open()
page = doc.new_page(width=612, height=792)

# Ensure line B fits well within margins:
# (a) short PII match next to a lot of text
# (b) long PII match where PII is longest word
# (c) two PII matches on adjacent lines
# (d) PII match at the very edge of the page margin
text_lines = [
    (50, 80, "DOCUMENT REDACTION VERIFICATION BENCHMARK"),
    (50, 130, "Line A (Short PII): Case ID 9876543210 is confidential and under strict protective legal order."),
    (50, 180, "Line B (Long PII): Contact legal-compliance-audit-officer@enterprise.org regarding data security."),
    (50, 230, "Line C1 (Adjacent PII 1): Primary Telephone: +1-800-555-0199 (Operational Desk)"),
    (50, 260, "Line C2 (Adjacent PII 2): Emergency Telephone: +1-888-555-0144 (Incident Response Team)"),
    (50, 310, "Line D (Edge Margin): Right margin aligned tax identifier verification record PAN: ABCDE1234F"),
]

for x, y, line in text_lines:
    page.insert_text((x, y), line, fontsize=11, fontname="helv")

input_pdf_path = "verification_evidence/test_input.pdf"
doc.save(input_pdf_path)
doc.close()
print(f"[1] Saved test input PDF: {input_pdf_path}")

# Baseline PNG
doc_in = fitz.open(input_pdf_path)
doc_in[0].get_pixmap(dpi=150).save("verification_evidence/pdf_baseline_before_redaction.png")
doc_in.close()
print("[2] Saved baseline PNG")

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=chrome_path,
        headless=True,
        downloads_path=os.path.abspath("verification_evidence")
    )
    context = browser.new_context(accept_downloads=True, viewport={'width': 1400, 'height': 900})
    page = context.new_page()

    # Pre-inject Pro key into localStorage fallback
    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')

    # Click 'Start Redacting' or 'Redact'
    start_btn = page.locator("text='Start Redacting'").first
    if start_btn.is_visible():
        start_btn.click()
    else:
        page.locator("nav button:has-text('Redact')").first.click()
    page.wait_for_timeout(500)

    # Upload PDF
    file_input = page.locator("input[type='file']").first
    file_input.set_input_files(os.path.abspath(input_pdf_path))
    
    # Wait for AI model modal or detection
    try:
        page.wait_for_selector("text='Downloading AI Model'", state="detached", timeout=60000)
    except Exception:
        pass
    page.wait_for_timeout(2000)

    # Click export PDF and wait for download
    with page.expect_download(timeout=30000) as download_info:
        btn = page.locator("button:has-text('Export as .PDF')")
        if btn.count() == 0 or not btn.first.is_visible():
            btn = page.locator("button:has-text('PDF')").last
        btn.click()

    download = download_info.value
    out_pdf = "verification_evidence/test_output_redacted.pdf"
    download.save_as(os.path.abspath(out_pdf))
    print(f"[3] Downloaded output PDF to: {out_pdf}")

    browser.close()

# Render output PDF to PNG
doc_out = fitz.open("verification_evidence/test_output_redacted.pdf")
doc_out[0].get_pixmap(dpi=150).save("verification_evidence/pdf_output_redacted.png")
doc_out.close()
print("[4] Rendered redacted output PDF to PNG: verification_evidence/pdf_output_redacted.png")
