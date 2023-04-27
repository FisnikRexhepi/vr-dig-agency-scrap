const express = require("express");
const puppeteer = require("puppeteer");
const app = express();
const port = 3000;
const CsvParser = require("json2csv").Parser;
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
require("dotenv").config();

app.get("", async (req, res) => {
  res.send(
    "<html><head></head><body><h1><p>Please write your word to scrap in the url above: <br/> Example: https://vr-dig-agency-scrap.onrender.com/spotify</p> <br>Then wait a few seconds for the file CALLED 'urls.csv' to download</h1><br/> <h2>Thank you, have a nice day !</h2></body></html>"
  );
});

app.get("/:keyword", async (req, res) => {
  const keyword = req.params.keyword;
  console.log(keyword);
  try {
    let browser;
    console.log(`Scraping URLs for keyword: ${keyword}`);
    console.log("Opening the browser......");
    browser = await puppeteer.launch({
      devtools: false,
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath: "/usr/bin/google-chrome-stable",
    });
    const page = await browser.newPage();
    const url = `https://www.google.com/search?gl=us&hl=en&pws=0&gws_rd=cr&q=${keyword}`;
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
  } catch (err) {
    console.log("Could not create a browser instance => : ", err);
  }
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
