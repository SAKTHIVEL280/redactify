import os
import zipfile
import fitz
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence/batch_output', exist_ok=True)

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

    # 1. Open Batch Processor
    batch_nav = page.locator("button:has-text('Batch')").first
    print("[1] Clicking Batch in navbar...")
    batch_nav.click()
    page.wait_for_timeout(1000)

    # 2. Select the 3 batch test files
    files_to_upload = [
        os.path.abspath("verification_evidence/batch_input/sample_table.docx"),
        os.path.abspath("verification_evidence/batch_input/two_column.pdf"),
        os.path.abspath("verification_evidence/batch_input/plain_notes.txt"),
    ]

    file_input = page.locator("input[type='file'][multiple]").first
    print("[2] Uploading 3 files into BatchProcessor...")
    file_input.set_input_files(files_to_upload)
    page.wait_for_timeout(2000)

    # 3. Click 'Process All Files'
    process_btn = page.locator("button:has-text('Process All Files')")
    if process_btn.count() > 0 and process_btn.first.is_visible():
        print("[3] Clicking Process All Files...")
        process_btn.first.click()

    # Wait for processing to complete for all files
    print("[4] Waiting for Export Formats Preserved (ZIP) button to become visible...")
    export_zip_btn = page.locator("button:has-text('Export Formats Preserved (ZIP)')")
    export_zip_btn.wait_for(state="visible", timeout=60000)
    page.wait_for_timeout(1000)

    # Take screenshot of the Batch Processor modal with completed files
    batch_modal_screenshot = "verification_evidence/batch_processor_ui_complete.png"
    page.screenshot(path=batch_modal_screenshot)
    print(f"[5] Saved Batch UI screenshot: {batch_modal_screenshot}")

    # 4. Click 'Export Formats Preserved (ZIP)'
    print("[6] Clicking 'Export Formats Preserved (ZIP)'...")
    with page.expect_download(timeout=30000) as download_info:
        export_zip_btn.click()

    download = download_info.value
    zip_path = os.path.abspath("verification_evidence/batch_output/redacted_batch.zip")
    download.save_as(zip_path)
    print(f"[7] Downloaded Batch ZIP to: {zip_path}")

    context.close()

# 5. Extract and inspect ZIP contents
print("\n[8] Inspecting ZIP Archive Contents:")
with zipfile.ZipFile("verification_evidence/batch_output/redacted_batch.zip", "r") as z:
    z.printdir()
    z.extractall("verification_evidence/batch_output/extracted")

extracted_files = os.listdir("verification_evidence/batch_output/extracted")
print("\n[9] Extracted files on disk:")
for f in extracted_files:
    full_p = os.path.join("verification_evidence/batch_output/extracted", f)
    print(f"    - {f} ({os.path.getsize(full_p)} bytes)")

# 6. Render the extracted two_column.pdf to PNG
out_pdf_name = [f for f in extracted_files if f.endswith(".pdf")][0]
doc_out = fitz.open(os.path.join("verification_evidence/batch_output/extracted", out_pdf_name))
doc_out[0].get_pixmap(dpi=150).save("verification_evidence/batch_pdf_output_redacted.png")
doc_out.close()
print(f"[10] Rendered batch redacted PDF to PNG: verification_evidence/batch_pdf_output_redacted.png")
