import os
import time
from playwright.sync_api import sync_playwright

os.makedirs('verification_evidence', exist_ok=True)

with sync_playwright() as p:
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    browser = p.chromium.launch(executable_path=chrome_path, headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    # 1. Check Free UI State
    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    page.screenshot(path='verification_evidence/license_free_state.png')
    print("[1] Screenshot saved: verification_evidence/license_free_state.png")

    # 2. Attempt the Forgery Exploit directly inside the page context
    exploit_script = """
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

        localStorage.setItem('redactify_pro_license_encrypted', JSON.stringify(record));
        return { success: true, b64 };
    }
    """

    res = page.evaluate(exploit_script)
    print("[2] Forged payload injected into localStorage:", res)

    # 3. Reload page and check if Pro is unlocked
    page.reload()
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    page.screenshot(path='verification_evidence/license_forged_bypass_state.png')
    print("[3] Screenshot saved: verification_evidence/license_forged_bypass_state.png")

    # Evaluate whether pro is active in window / localStorage
    storage_val = page.evaluate("() => localStorage.getItem('redactify_pro_license_encrypted')")
    print("[4] LocalStorage content:", storage_val[:80] + '...')

    # Check UI elements: does 'Get Pro' or 'Upgrade' button still exist?
    has_get_pro = page.locator("text='Upgrade to Pro'").count() > 0 or page.locator("text='Get Pro'").count() > 0
    print("[5] Has Upgrade/Get Pro buttons:", has_get_pro)

    browser.close()
