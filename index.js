const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeTempleDetails(url, templeData) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url);

        const address = await page.evaluate(() => {
            const addressElement = document.querySelector('.Details_info-item__i8iPw a');
            if (addressElement) {
                // Extract the inner text and replace <br> tags with spaces
                return addressElement.innerText.replace(/<br>/g, ' ');
            } else {
                return null;
            }
        });

        await browser.close();

        // Format the address
        if (address) {
            templeData.Address = address.trim().replace(/\n/g, ', '); // Replace newline characters with ', '
        } else {
            delete templeData.Address; // Remove the Address property if the address is not available
        }
    } catch (error) {
        console.error('An error occurred while scraping temple details:', error);
        await browser.close();
    }
}

async function scrapeTempleList(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url);

        // Wait for the elements to be fully loaded
        await page.waitForSelector('.DataList_templeName__fb4KU', { timeout: 30000 });
        await page.waitForSelector('.DataList_templeLocation___W0oB', { timeout: 30000 });
        await page.waitForSelector('.DataList_dedicated__T01EI', { timeout: 30000 });

        console.log('Selectors found, scraping data...');

        let utahTempleCount = 0; // Counter for Utah temples

        const templeData = await page.evaluate(() => {
            const nameElements = Array.from(document.querySelectorAll('.DataList_templeName__fb4KU'));
            const locElements = Array.from(document.querySelectorAll('.DataList_templeLocation___W0oB'));
            const dateElements = Array.from(document.querySelectorAll('.DataList_dedicated__T01EI'));

            // Exclude the first entry which represents the column titles
            nameElements.shift();
            locElements.shift();
            dateElements.shift();

            const names = nameElements.map(element => element.textContent.trim());
            const locations = locElements.map(element => element.textContent.trim());
            const dates = dateElements.map(element => element.textContent.trim());

            return names.map((name, index) => ({
                Name: name,
                Location: locations[index] || null,
                Date: dates[index] || null
            }));
        });

        // Iterate through each temple and scrape its details page if it's in Utah and doesn't have an address
        for (const temple of templeData) {
            if (temple.Location && temple.Location.toLowerCase().includes('utah') && !temple.Address) {
                utahTempleCount++; // Increment the counter for Utah temples
                const templeNameSlug = temple.Name.toLowerCase().replace(/\s+/g, '-');
                const templeDetailsUrl = `https://www.churchofjesuschrist.org/temples/details/${templeNameSlug}?lang=eng`;

                console.log('Temple details URL:', templeDetailsUrl); // Log the URL

                await scrapeTempleDetails(templeDetailsUrl, temple);
            } else {
                console.log('Skipping temple:', temple.Name);
            }
        }

        console.log('Number of Utah temples:', utahTempleCount); // Log the number of Utah temples

        await browser.close();

        const json = JSON.stringify(templeData, null, 2);
        fs.writeFileSync('temples.json', json);
        console.log('Data saved to temples.json');
    } catch (error) {
        console.error('An error occurred:', error);
        await browser.close(); // Close the browser in case of error
    }
}

const url = 'https://www.lds.org/temples/list?lang=eng';
scrapeTempleList(url);