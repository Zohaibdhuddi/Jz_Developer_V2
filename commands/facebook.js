const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * FULLY WORKING FACEBOOK DOWNLOADER
 * Features: Dual-API Fallback, Anti-403 Headers, and Buffer Stream Logic
 */
async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) return await sock.sendMessage(chatId, { text: "❌ *Usage:* .fb <link>" }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let videoUrl = null;
        let title = "Facebook Video";

        // --- PHASE 1: TRY API #1 (Botcahx) ---
        try {
            const api1 = await axios.get(`https://api.botcahx.eu.org/api/dowloader/fbdown?url=${encodeURIComponent(url)}&apikey=btch-beta`);
            if (api1.data?.status) {
                videoUrl = api1.data.result?.media?.video_hd || api1.data.result?.media?.video_sd || api1.data.result?.url;
                title = api1.data.result?.title || title;
            }
        } catch (e) { console.log("API 1 Failed, trying API 2..."); }

        // --- PHASE 2: TRY API #2 (Alya Fallback) ---
        if (!videoUrl) {
            try {
                const api2 = await axios.get(`https://api.alyarchive.eu.org/api/fbdown?url=${encodeURIComponent(url)}`);
                if (api2.data?.status) {
                    videoUrl = api2.data.result?.url;
                    title = api2.data.result?.title || title;
                }
            } catch (e) { console.log("API 2 Failed."); }
        }

        if (!videoUrl) throw new Error("Could not retrieve a downloadable link from any API.");

        // --- PHASE 3: THE 403 BYPASS DOWNLOAD ---
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempPath = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        const writer = fs.createWriteStream(tempPath);
        
        // We use "Aggressive Headers" to bypass 403 blocks
        const videoRequest = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.facebook.com/',
                'Origin': 'https://www.facebook.com',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'video',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'cross-site'
            },
            timeout: 60000
        });

        videoRequest.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
        });

        // --- PHASE 4: VERIFY AND SEND ---
        const stats = fs.statSync(tempPath);
        if (stats.size < 1000) { // If less than 1KB, it's likely an error page
            throw new Error("403: The server blocked the download stream.");
        }

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(tempPath),
            mimetype: "video/mp4",
            caption: `✅ *FB DOWNLOADED BY LEE TECH BOT*\n\n📝 *Title:* ${title}\n⚖️ *Size:* ${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        // Cleanup
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    } catch (error) {
        console.error('FB ULTIMATE ERROR:', error.message);
        
        let finalError = `❌ *Error:* ${error.message}`;
        if (error.message.includes('403')) {
            finalError = "❌ *Error 403:* Access Forbidden. Facebook's security is blocking this bot. Try a different video link or wait a few minutes.";
        }

        await sock.sendMessage(chatId, { text: finalError }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = facebookCommand;
