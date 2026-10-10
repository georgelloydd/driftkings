<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html><head><title>Mini Drifters</title><meta name="robots" content="noindex"/>
<style>body{margin:0;background:#0a0a0c;color:#eee;font-family:'Segoe UI',Arial,sans-serif}main{max-width:820px;margin:40px auto;padding:0 20px}h1{font-style:italic;font-weight:900;margin:0 0 6px}h1 span{color:#ff2a2a}p{color:#9a9aa3}table{width:100%;border-collapse:collapse;margin-top:18px;background:#141418;border-radius:12px;overflow:hidden}th,td{padding:12px 14px;text-align:left;border-bottom:1px solid #26262c}th{background:#1c1c22;color:#bbb;font-size:13px;text-transform:uppercase;letter-spacing:1px}a{color:#ff5a5a}img{width:40px;height:40px;border-radius:9px;vertical-align:middle}</style></head>
<body><main><h1>MINI <span>DRIFTERS</span> sitemap</h1>
<p>This is the sitemap for search engines. It lists <xsl:value-of select="count(s:urlset/s:url)"/> page(s). Submit <b>sitemap.xml</b> in Google Search Console.</p>
<table><tr><th></th><th>Page</th><th>Last updated</th><th>Updates</th><th>Priority</th></tr>
<xsl:for-each select="s:urlset/s:url"><tr>
<td><xsl:if test="image:image"><img src="{image:image/image:loc}" alt=""/></xsl:if></td>
<td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
<td><xsl:value-of select="s:lastmod"/></td><td><xsl:value-of select="s:changefreq"/></td><td><xsl:value-of select="s:priority"/></td>
</tr></xsl:for-each></table></main></body></html>
</xsl:template>
</xsl:stylesheet>
