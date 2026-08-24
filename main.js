const currentUrl = window.location.href;

const regex = /^https:\/\/vnexpress\.net\/[a-z0-9-]+-\d+\.html$/;

if (regex.test(currentUrl)) {
    console.log("URL:", currentUrl);
} else {
    console.log("Err");
}