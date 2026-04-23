import json
import os

for lang in ['ar', 'en']:
    with open(f'locales/{lang}.json', 'r', encoding='utf-8') as f:
        data = f.read()
    with open(f'locales/{lang}.js', 'w', encoding='utf-8') as f:
        f.write(f'window.translations_{lang} = {data};')
print("locale JS files created")
