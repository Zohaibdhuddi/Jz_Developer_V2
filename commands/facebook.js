const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Advanced Facebook Downloader
 * Features: 403 Bypass, Buffer Stream, Size Check, and Auto-Cleanup
 */
async function facebookCommand(sock, chatId, message) {
    try {
        // 1. Extract and Validate URL
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { text: "📝 *Usage:* .fb <link>" }, { quoted: message });
        }

        // 2. Visual Feedback
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // 3. API Request to fetch the streamable link
        const apiUrl = `https://api.botcahx.eu.org/api/dowloader/fbdown?url=${encodeURIComponent(url)}&apikey=btch-beta`;
        const apiResponse = await axios.get(apiUrl, { timeout: 15000 });
        const res = apiResponse.data;

        if (!res || !res.status) {
            throw new Error("API failed to resolve this link. The video might be private.");
        }

        // 4. Quality Selection (Prefer HD, fallback to SD)
        const videoUrl = res.result?.media?.video_hd || res.result?.media?.video_sd || res.result?.url;
        const videoTitle = res.result?.title || "Facebook Video";

        if (!videoUrl) throw new Error("No downloadable stream found.");

        // 5. Prepare Temporary File
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempPath = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        // 6. Download with Spoofed Headers (Anti-403 Logic)
        const writer = fs.createWriteStream(tempPath);
        const videoFetch = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
                'Referer': 'https://www.facebook.com/',
                'Range': 'bytes=0-' // Helps bypass some server-side blocks
            }
        });

        // 7. Size Check (Limit to 100MB to prevent server lag)
        const contentLength = videoFetch.headers['content-length'];
        if (contentLength && parseInt(contentLength) > 104857600) { // 100MB
            throw new Error("Video is too large (over 100MB).");
        }

        // 8. Execute Download
        videoFetch.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
        });

        // 9. Send to WhatsApp
        await sock.sendMessage(chatId, {
            video: fs.readFileSync(tempPath),
            mimetype: "video/mp4",
            caption: `✅ *Facebook Download Success*\n\n📝 *Title:* ${videoTitle}\n⚖️ *Size:* ${(fs.statSync(tempPath).size / 1024 / 1024).toFixed(2)} MB`,
            fileName: `${videoTitle}.mp4`
        }, { quoted: message });

        // 10. Final Cleanup
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('FB FULL ERROR:', error.message);
        
        let errorMsg = "❌ *Command Failed*";
        if (error.message.includes('403')) errorMsg = "❌ *Error 403:* Access Forbidden. This video is likely private or age-restricted.";
        if (error.message.includes('timeout')) errorMsg = "❌ *Timeout:* The server took too long to respond.";
        if (error.message.includes('large')) errorMsg = "❌ *Size Error:* Video exceeds 100MB limit.";

        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = facebookCommand;
