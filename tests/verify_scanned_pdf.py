import os
import fitz # PyMuPDF
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence', exist_ok=True)

# Step 1: Create a purely scanned-image PDF (bitmap only, zero text layer)
img = Image.new('RGB', (800, 1000), color=(255, 255, 255))
draw = ImageDraw.Draw(img)
draw.rectangle([50, 50, 750, 950], outline=(100, 100, 100), width=2)
# Draw some lines to simulate scanned document content
draw.line([100, 150, 700, 150], fill=(50, 50, 50), width=3)
draw.line([100, 200, 600, 200], fill=(50, 50, 50), width=2)
draw.line([100, 250, 650, 250], fill=(50, 50, 50), width=2)

temp_img_path = "verification_evidence/temp_scanned_page.png"
img.save(temp_img_path)

scanned_pdf_path = "verification_evidence/pure_scanned_document.pdf"
scanned_doc = fitz.open()
scanned_page = scanned_doc.new_page(width=612, height=792)
scanned_page.insert_image(fitz.Rect(0, 0, 612, 792), filename=temp_img_path)
scanned_doc.save(scanned_pdf_path)
scanned_doc.close()
print(f"[1] Created pure scanned PDF: {scanned_pdf_path}")

# Normal text PDF path
normal_pdf_path = "verification_evidence/test_input.pdf"

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
user_data_dir = r"D:\Projects\Redactify\tests\chrome_profile"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir,
        executable_path=chrome_path,
        headless=True,
        viewport={'width': 1280, 'height': 800}
    )
    page = context.pages[0] if context.pages else context.new_page()

    # TEST A: Upload Scanned PDF and capture warning toast
    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Navigate to Redactor
    start_btn = page.locator("text='Start Redacting'").first
    if start_btn.is_visible():
        start_btn.click()
    else:
        page.locator("nav button:has-text('Redact')").first.click()
    page.wait_for_timeout(500)

    # Dismiss cookie banner
    cookie_btn = page.locator("button:has-text('Accept')")
    if cookie_btn.count() > 0 and cookie_btn.first.is_visible():
        cookie_btn.first.click()
        page.wait_for_timeout(300)

    print("[2] Uploading scanned PDF...")
    file_input = page.locator("input[type='file']").first
    file_input.set_input_files(os.path.abspath(scanned_pdf_path))

    # Wait for the toast to appear
    print("[3] Waiting for scanned PDF error toast...")
    page.wait_for_selector("text='scanned image'", timeout=15000)
    page.wait_for_timeout(500)

    scanned_screenshot = "verification_evidence/scanned_pdf_warning.png"
    page.screenshot(path=scanned_screenshot)
    print(f"[4] Saved scanned PDF warning screenshot: {scanned_screenshot}")

    # TEST B: Reload and upload Normal text PDF (verify banner is absent)
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    start_btn = page.locator("text='Start Redacting'").first
    if start_btn.is_visible():
        start_btn.click()
    else:
        page.locator("nav button:has-text('Redact')").first.click()
    page.wait_for_timeout(500)

    print("[5] Uploading normal text PDF...")
    file_input = page.locator("input[type='file']").first
    file_input.set_input_files(os.path.abspath(normal_pdf_path))

    # Wait for document to load in editor (look for editor toolbar or word count or page text)
    page.wait_for_selector("text='DOCUMENT REDACTION VERIFICATION BENCHMARK'", timeout=20000)
    page.wait_for_timeout(1000)

    normal_screenshot = "verification_evidence/normal_pdf_no_warning.png"
    page.screenshot(path=normal_screenshot)
    print(f"[6] Saved normal text PDF screenshot: {normal_screenshot}")

    context.close()
