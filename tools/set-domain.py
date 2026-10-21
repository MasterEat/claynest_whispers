#!/usr/bin/env python3
"""Update all static SEO URLs and public configuration when moving domain."""
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
root = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 tools/set-domain.py https://example.com/')
base = sys.argv[1].rstrip('/') + '/'
u = urlparse(base)
if u.scheme != 'https' or not u.netloc or u.query or u.fragment or u.username or u.password:
    raise SystemExit('Provide a public HTTPS base URL without query or fragment.')
config = root / 'assets/config.js'
old = re.search(r"canonicalBase: '([^']+)'", config.read_text()).group(1)
for path in [*root.glob('*.html'), root/'robots.txt', root/'sitemap.xml', config]:
    path.write_text(path.read_text().replace(old, base))
print('Updated static metadata, structured data, sitemap, robots and config.')
