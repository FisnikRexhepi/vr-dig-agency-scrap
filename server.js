const express = require("express");
const puppeteer = require("puppeteer");
const app = express();
const port = 3000;
const CsvParser = require("json2csv").Parser;
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.post("/", async (req, res) => {
  const keyword = req.body.keyword;
  console.log(`Scraping URLs for keyword: ${keyword}`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = `https://www.google.com/search?q=${keyword}`;
  await page.goto(url);
  let urls = [];
  while (urls.length < 500) {
    const currentUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const urls = links.map((link) => link.href);
      const nonGoogleUrls = urls.filter((url) => {
        return (
          !url.includes("google.") &&
          !url.includes("webcache.googleusercontent.com")
        );
      });
      return nonGoogleUrls;
    });
    urls = [...urls, ...currentUrls];
    urls = Array.from(new Set(urls));
    const nextButton = await page.$("#pnnext");
    if (urls.length >= 500 || !nextButton) {
      break;
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click("#pnnext"),
    ]);
  }
  const foundedUrls = urls.slice(0, 500).map((url) => ({ url }));
  console.log(`Finished scraping URLs`);
  await browser.close();
  foundedUrls.splice(0, 1);
  const csvFields = ["Url"];
  const csvParser = new CsvParser({ csvFields });
  const csvData = csvParser.parse(foundedUrls);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=urls.csv");
  res.status(200).end(csvData);
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
