const SITES = [
  {
    name: "VnExpress",
    domain: "vnexpress.net",
    urlPatterns: [/^https:\/\/(www\.)?vnexpress\.net\/[^\/]+-\d+\.html$/],
    contentSelectors: [
      "article.fck_detail",
      ".fck_detail",
      "#article_content",
      ".content-detail",
      "article[itemprop='articleBody']"
    ]
  }
];

function isTrackedArticle(url) {
  return SITES.some(site =>
    site.urlPatterns.some(pattern => pattern.test(url))
  );
}

function getSiteInfo(url) {
  return SITES.find(site =>
    site.urlPatterns.some(pattern => pattern.test(url))
  ) || null;
}