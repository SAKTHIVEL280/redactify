import urllib.request
import re

req = urllib.request.Request('https://redactify.daeq.in', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode('utf-8')
        scripts = re.findall(r'src="([^"]+)"', html)
        print('Scripts loaded on live production:')
        for s in scripts:
            print(' ', s)
            
        # Check if the main bundle has our new code
        main_js = [s for s in scripts if 'index-' in s]
        if main_js:
            js_url = 'https://redactify.daeq.in' + main_js[0]
            print('\nFetching main bundle:', js_url)
            with urllib.request.urlopen(js_url) as js_res:
                js_content = js_res.read().decode('utf-8')
                print('Contains ECDSA / licenseSigner references:', 'crypto.subtle' in js_content)
                print('Contains Logout button:', 'Logout' in js_content)
                print('Contains Resume Redactor:', 'Resume Redactor' in js_content)
except Exception as e:
    print('Error:', e)
