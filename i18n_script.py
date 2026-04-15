import os, re, json, hashlib

def safe_replace(html_content):
    # Map Arabic text to keys
    dict_ar = {}
    
    # 1. Hide scripts and styles
    blocks = {}
    def hide_block(match):
        uid = f"__BLOCK_{len(blocks)}__"
        blocks[uid] = match.group(0)
        return uid
        
    html_content = re.sub(r'<(script|style)[^>]*>.*?</\1>', hide_block, html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # Also hide title tags to prevent spans inside title which invalidates HTML
    def hide_title(match):
        uid = f"__TITLE_{len(blocks)}__"
        blocks[uid] = match.group(0)
        
        # We also need to extract from title
        title_text = match.group(1)
        if re.search(r'[\u0600-\u06FF]', title_text):
            clean_ext = title_text.strip()
            h = hashlib.md5(clean_ext.encode('utf-8')).hexdigest()[:6]
            key = f'txt_{h}'
            dict_ar[key] = clean_ext
            # replace inside block
            blocks[uid] = f'<title data-i18n="{key}">{title_text}</title>'
        
        return uid
    
    html_content = re.sub(r'<title>([^<]*)</title>', hide_title, html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # 2. Function to register text and return key
    def get_key(text):
        clean_ext = text.strip()
        if not clean_ext: return None
        # Create a short hash
        h = hashlib.md5(clean_ext.encode('utf-8')).hexdigest()[:6]
        key = f'txt_{h}'
        dict_ar[key] = clean_ext
        return key, clean_ext

    # 3. Replace text nodes inside tags. 
    # Use negative lookbehind and lookahead to ensure we are between > and <
    def text_repl(match):
        full_text = match.group(1)
        if not re.search(r'[\u0600-\u06FF]', full_text):
            return match.group(0) # unchanged
            
        key_res = get_key(full_text)
        if not key_res: return match.group(0)
        key, clean_txt = key_res
        
        # Replace the text with a span holding data-i18n
        return f'><span data-i18n=\"{key}\">{full_text}</span><'
        
    html_content = re.sub(r'>([^<]*[\u0600-\u06FF]+[^<]*)<', text_repl, html_content, flags=re.DOTALL)
    
    # 4. Attributes replacement
    def attr_repl(match):
        attr_name = match.group(1)
        full_text = match.group(2)
        if not re.search(r'[\u0600-\u06FF]', full_text):
            return match.group(0)
            
        key_res = get_key(full_text)
        if not key_res: return match.group(0)
        key, clean_txt = key_res
        
        return f'{attr_name}="{full_text}" data-i18n-{attr_name}="{key}"'
        
    html_content = re.sub(r'(placeholder|aria-label|title|alt)="([^"]*[\u0600-\u06FF]+.*?)"', attr_repl, html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # 5. Restore scripts, styles, and titles
    for uid, original in blocks.items():
        html_content = html_content.replace(uid, original)
        
    return html_content, dict_ar

# 6. Crawl all HTML files
src_dir = '.'
html_files = []
for root, dirs, files in os.walk(src_dir):
    if 'backup' in root.split(os.sep) or '.gemini' in root.split(os.sep) or 'locales' in root.split(os.sep):
        continue
    for f in files:
        if f.endswith('.html'):
            html_files.append(os.path.join(root, f))

global_dict_ar = {}

for file in html_files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    new_html, local_dict = safe_replace(content)
    global_dict_ar.update(local_dict)
    
    # Write back the modified HTML
    with open(file, 'w', encoding='utf-8') as f:
        f.write(new_html)

# Ensure locales directory exists
if not os.path.exists('locales'):
    os.makedirs('locales')

# Write ar.json
with open('locales/ar.json', 'w', encoding='utf-8') as f:
    json.dump(global_dict_ar, f, ensure_ascii=False, indent=2)

# Write en.json (with placeholders)
global_dict_en = {k: f"[EN] {v}" for k, v in global_dict_ar.items()}
with open('locales/en.json', 'w', encoding='utf-8') as f:
    json.dump(global_dict_en, f, ensure_ascii=False, indent=2)

print(f"Processed {len(html_files)} files.")
print(f"Total Arabic keys generated: {len(global_dict_ar)}")
