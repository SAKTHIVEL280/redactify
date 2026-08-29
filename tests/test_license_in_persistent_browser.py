import os
import time
from playwright.sync_api import sync_playwright

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
user_data_dir = r"D:\Projects\Redactify\tests\chrome_profile"
os.makedirs(user_data_dir, exist_ok=True)
os.makedirs('verification_evidence', exist_ok=True)

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir,
        executable_path=chrome_path,
        headless=True,
        viewport={'width': 1280, 'height': 800}
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.on("console", lambda msg: print(f"CONSOLE: [{msg.type}] {msg.text}"))

    # Step 1: Open fresh page and screenshot Free state
    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    page.screenshot(path='verification_evidence/license_free_state.png')
    print("[1] Saved Free State screenshot")

    # Step 2: Inject forged key into IndexedDB
    inject_script = """
    async () => {
        const salt = 'redactify-pro-vault-seed-v1';
        localStorage.setItem('redactify_vault_salt', salt);
        const stableFingerprint = 'redactify-pro-v1-' + salt;
        const encoder = new TextEncoder();
        const data = encoder.encode(stableFingerprint);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const key = await crypto.subtle.importKey(
            'raw',
            hashBuffer,
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
            encoder.encode(JSON.stringify(plainData))
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

        // Write both to IndexedDB and to localStorage fallback
        localStorage.setItem('redactify_pro_license_encrypted', JSON.stringify(record));

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
    res = page.evaluate(inject_script)
    print("[2] Injected result:", res)

    # Step 3: Reload page to allow App.jsx mount effect to re-run verifyProStatus()
    page.reload()
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    page.screenshot(path='verification_evidence/license_forged_bypass_state.png')
    print("[3] Saved Forged Bypass screenshot")

    # Step 4: Check if PRO badge or features are active
    pro_badge = page.locator("text='PRO'")
    is_pro_badge_visible = pro_badge.first.is_visible() if pro_badge.count() > 0 else False
    print("[4] PRO badge visible:", is_pro_badge_visible)
    
    upgrade_btns = page.locator("button:has-text('Upgrade')")
    is_upgrade_visible = upgrade_btns.first.is_visible() if upgrade_btns.count() > 0 else False
    print("[5] Upgrade button visible:", is_upgrade_visible)
    
    batch_btn = page.locator("button:has-text('Batch')")
    is_batch_visible = batch_btn.first.is_visible() if batch_btn.count() > 0 else False
    print("[6] Batch button visible:", is_batch_visible)

    context.close()
