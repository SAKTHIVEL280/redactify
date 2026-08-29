import os
import time
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence', exist_ok=True)

with sync_playwright() as p:
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    browser = p.chromium.launch(executable_path=chrome_path, headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # Inject forged license using the application's own storeProKey logic directly into IndexedDB
    idb_exploit = """
    async () => {
        const salt = 'redactify-pro-vault-seed-v1';
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(salt + '-redactify-key-derivation-2026'),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plainData = {
            key: 'FORGED-EXPLOIT-LICENSE-KEY',
            orderId: 'order_FAKE_BYPASS_123',
            paymentId: 'pay_FAKE_BYPASS_123',
            purchasedAt: new Date().toISOString(),
            expiresAt: null,
            isActive: true
        };

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(JSON.stringify(plainData))
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        let binary = '';
        const bytes = new Uint8Array(combined);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        const record = {
            id: 'pro_license',
            encrypted: b64,
            timestamp: Date.now()
        };

        // Put directly into IndexedDB 'ResumeRedactorDB', store 'proLicense'
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('ResumeRedactorDB', 5);
            req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction(['proLicense'], 'readwrite');
                const store = tx.objectStore('proLicense');
                const putReq = store.put(record);
                putReq.onsuccess = () => resolve({ success: true, b64 });
                putReq.onerror = (e) => reject(e);
            };
            req.onerror = (e) => reject(e);
        });
    }
    """

    res = page.evaluate(idb_exploit)
    print("[1] Injected forged record into IndexedDB:", res)

    # Reload page
    page.reload()
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    page.screenshot(path='verification_evidence/license_forged_bypass_state.png')
    print("[2] Screenshot saved: verification_evidence/license_forged_bypass_state.png")

    # Check for PRO badge and Upgrade button
    pro_badge_count = page.locator("text='PRO'").count()
    has_upgrade_btn = page.locator("button:has-text('Upgrade')").count() > 0
    has_batch_btn = page.locator("button:has-text('Batch')").count() > 0

    print(f"[3] PRO badge count: {pro_badge_count}")
    print(f"[4] Has Upgrade button: {has_upgrade_btn}")
    print(f"[5] Has Batch button: {has_batch_btn}")

    browser.close()
