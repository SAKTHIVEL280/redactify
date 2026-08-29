import os
import time
from playwright.sync_api import sync_playwright

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

    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')

    start_btn = page.locator("text='Start Redacting'").first
    if start_btn.is_visible():
        start_btn.click()
    else:
        page.locator("nav button:has-text('Redact')").first.click()
    time.sleep(1)

    print("Uploading normal text PDF...")
    file_input = page.locator("input[type='file']").first
    file_input.set_input_files(os.path.abspath("verification_evidence/test_input.pdf"))

    # Wait for document to load
    time.sleep(3)

    normal_screenshot = "verification_evidence/normal_pdf_no_warning.png"
    page.screenshot(path=normal_screenshot)
    print(f"Saved: {normal_screenshot}")

    context.close()
