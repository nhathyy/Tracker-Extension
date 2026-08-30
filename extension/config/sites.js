const SITES = [
  {
    name: "VnExpress",
    domain: "vnexpress.net",
    urlPatterns: [/^https:\/\/(www\.)?vnexpress\.net\/[^\/]+-\d+\.html$/],
    contentSelectors: [
      "article.fck_detail",
      ".fck_detail",
      "#article_content",
      "article[itemprop='articleBody']"
    ]
  },
  {
    name: "Tuổi Trẻ",
    domain: "tuoitre.vn",
    urlPatterns: [/^https:\/\/(www\.)?tuoitre\.vn\/[^\/]+-\d+\.htm$/],
    contentSelectors: [
      "#main-detail .detail-cmain",
      "#main-detail",
      ".detail-cmain",
      ".detail-content",
      "#main-detail-body",
      "div[itemprop='articleBody']"
    ]
  },
  {
    name: "Dân Trí",
    domain: "dantri.com.vn",
    urlPatterns: [/^https:\/\/(www\.)?dantri\.com\.vn\/[^\/]+\/[^\/]+-\d+\.htm$/],
    contentSelectors: [
      "div[data-slot='content']",
      "#desktop-in-article",
      "#articleContent",
      "h2[data-slot='sapo']",
      "article#articleContent"
    ]
  }
];

function isTrackedArticle(url) {
  return SITES.some((site) =>
    site.urlPatterns.some((pattern) => pattern.test(url))
  );
}

function getSiteInfo(url) {
  return (
    SITES.find((site) =>
      site.urlPatterns.some((pattern) => pattern.test(url))
    ) || null
  );
}