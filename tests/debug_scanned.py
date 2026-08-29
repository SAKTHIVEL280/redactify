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

    page.on("console", lambda msg: print(f"CONSOLE: [{msg.type}] {msg.text}"))
    page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')

    start_btn = page.locator("text='Start Redacting'").first
    if start_btn.is_visible():
        start_btn.click()
    else:
        page.locator("nav button:has-text('Redact')").first.click()
    time.sleep(1)

    print("Uploading pure_scanned_document.pdf...")
    file_input = page.locator("input[type='file']").first
    file_input.set_input_files(os.path.abspath("verification_evidence/pure_scanned_document.pdf"))

    time.sleep(3)
    page.screenshot(path="verification_evidence/debug_scanned_upload.png")
    print("Screenshot saved to verification_evidence/debug_scanned_upload.png")

    # Inspect all text visible on page
    body_text = page.locator("body").inner_text()
    print("Body text snippet:\n", body_text[:500])

    context.close()
