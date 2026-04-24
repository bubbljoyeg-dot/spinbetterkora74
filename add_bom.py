import os

directory = r'c:\Users\SOFT\OneDrive\Desktop\spinbetterkora74-main\spinbetterkora74-main'
bom = b'\xef\xbb\xbf'

for root, _, files in os.walk(directory):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'rb') as f:
                content = f.read()
            
            if not content.startswith(bom):
                with open(filepath, 'wb') as f:
                    f.write(bom + content)
                print(f"Added BOM to {filepath}")
