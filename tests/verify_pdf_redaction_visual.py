import os
import fitz # PyMuPDF
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence', exist_ok=True)

# Step 1: Create the input PDF with the exact required test lines using PyMuPDF
doc = fitz.open()
page = doc.new_page(width=612, height=792) # Standard Letter size

# Add text matching criteria:
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
    page.insert_text((x, y), line, fontsize=12, fontname="helv")

input_pdf_path = "verification_evidence/test_input.pdf"
doc.save(input_pdf_path)
doc.close()
print(f"[1] Created test input PDF: {input_pdf_path}")

# Render input PDF to image for baseline comparison
doc_in = fitz.open(input_pdf_path)
page_in = doc_in[0]
pix_in = page_in.get_pixmap(dpi=150)
input_img_path = "verification_evidence/pdf_baseline_before_redaction.png"
pix_in.save(input_img_path)
doc_in.close()
print(f"[2] Rendered input baseline PNG: {input_img_path}")

# Step 2: Use Playwright to upload test_input.pdf into Redactify, redact PII, and download redacted PDF
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
user_data_dir = r"D:\Projects\Redactify\tests\chrome_profile"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir,
        executable_path=chrome_path,
        headless=True,
        viewport={'width': 1400, 'height': 900},
        accept_downloads=True
    )
    page = context.pages[0] if context.pages else context.new_page()

    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Click 'Redact' to navigate to redactor workspace if on landing
    redact_nav = page.locator("nav button:has-text('Redact')")
    if redact_nav.count() > 0 and redact_nav.first.is_visible():
        redact_nav.first.click()
        page.wait_for_timeout(500)

    # Upload file
    file_input = page.locator("input[type='file']").first
    file_input.set_input_files(os.path.abspath(input_pdf_path))
    
    # Dismiss cookie banner if visible
    cookie_btn = page.locator("button:has-text('Accept')")
    if cookie_btn.count() > 0 and cookie_btn.first.is_visible():
        cookie_btn.first.click()
        page.wait_for_timeout(500)

    # Wait for 'Downloading AI Model' modal to finish and disappear
    print("[3] Waiting for AI model download or detection to finish...")
    try:
        page.wait_for_selector("text='Downloading AI Model'", state="detached", timeout=60000)
        print("[3b] AI model download modal closed.")
    except Exception as e:
        print("[3b] No AI download modal or already closed:", e)

    page.wait_for_timeout(3000)

    # Screenshot the UI with redaction preview
    ui_preview_path = "verification_evidence/pdf_redaction_ui_preview.png"
    page.screenshot(path=ui_preview_path)
    print(f"[3c] Saved UI preview screenshot: {ui_preview_path}")

    download_path = os.path.abspath("verification_evidence/test_output_redacted.pdf")
    
    def on_download(download):
        print(f"[4b] Download event received: {download.suggested_filename}")
        download.save_as(download_path)
        print(f"[5] Exported PDF saved to: {download_path}")

    page.on("download", on_download)

    # Find PDF export button in sidebar
    export_btn = page.locator("button:has-text('Export as .PDF')")
    if export_btn.count() == 0 or not export_btn.first.is_visible():
        export_btn = page.locator("button:has-text('PDF')").last
    print("[4] Clicking export button:", export_btn)
    export_btn.click()

    page.wait_for_timeout(5000) # wait for download to flush

    context.close()

# Step 3: Render the exported PDF using PyMuPDF to inspect visually
doc_out = fitz.open(output_pdf_path)
page_out = doc_out[0]
pix_out = page_out.get_pixmap(dpi=150)
output_img_path = "verification_evidence/pdf_output_redacted.png"
pix_out.save(output_img_path)
doc_out.close()
print(f"[6] Rendered redacted PDF page to PNG: {output_img_path}")

