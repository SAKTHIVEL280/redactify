import os
import time
from playwright.sync_api import sync_playwright

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome_path, headless=True)
    page = browser.new_page()

    # Capture browser console messages
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: [{msg.type}] {msg.text}"))

    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')

    res = page.evaluate("""
    async () => {
        // Let's inspect what's in IndexedDB
        return new Promise((resolve) => {
            const req = indexedDB.open('ResumeRedactorDB', 5);
            req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction(['proLicense'], 'readonly');
                const store = tx.objectStore('proLicense');
                const getReq = store.get('pro_license');
                getReq.onsuccess = () => resolve({ idbRecord: getReq.result });
                getReq.onerror = () => resolve({ idbError: 'error reading' });
            };
            req.onerror = (e) => resolve({ openError: e });
        });
    }
    """)
    print("IDB inspection:", res)
    browser.close()
