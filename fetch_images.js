const https = require('https');
const http = require('http');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const req = url.startsWith('https') ? https : http;
        req.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                resolve(fetchUrl(res.headers.location));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function extractImage(html) {
    const ogMatch = html.match(/meta property="og:image"\s+content="([^"]+)"/i);
    if (ogMatch) return ogMatch[1];
    const itemMatch = html.match(/meta content="([^"]+)"\s+itemprop="image"/i);
    if (itemMatch) return itemMatch[1];
    return null;
}

async function getOgImage(shortUrl) {
    try {
        const html = await fetchUrl(shortUrl);
        const imageUrl = extractImage(html);
        if (imageUrl) {
            console.log(shortUrl + ' => ' + imageUrl);
        } else {
            console.log(shortUrl + ' => NOT FOUND');
        }
    } catch (e) {
        console.log(shortUrl + ' => ERROR');
    }
}

const urls = [
    'https://maps.app.goo.gl/wHrGWNJFagFyTkNHA?g_st=atm',
    'https://maps.app.goo.gl/qCDWW6qTgCUP4UbF9?g_st=atm',
    'https://maps.app.goo.gl/vnp7ERzsuwVwrUFd8?g_st=atm',
    'https://maps.app.goo.gl/dmbobkMjsYdxwcHP8?g_st=atm',
    'https://maps.app.goo.gl/VoSbKibmuhX7tKEd9?g_st=atm',
    'https://maps.app.goo.gl/NeoEn51owMq9mFn68?g_st=atm',
    'https://maps.app.goo.gl/MQgATLk8YFpnNDP3A?g_st=atm',
    'https://maps.app.goo.gl/RFkQB9Td6x2Lsz7F8?g_st=atm',
    'https://maps.app.goo.gl/WpguCj8nQE6twcFY9?g_st=atm',
    'https://maps.app.goo.gl/5ZdxpFdD4LbgG1YA7?g_st=atm',
    'https://maps.app.goo.gl/YAxAdMpXkhAgPQE19?g_st=atm'
];

async function run() {
    for (let url of urls) {
        await getOgImage(url);
    }
}
run();
