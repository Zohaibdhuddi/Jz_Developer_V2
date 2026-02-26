const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * LEE TECH BOT - UNIVERSAL FACEBOOK DOWNLOADER
 * Fully Working 2026 Edition
 */
async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        let url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "📝 *Usage:* `.fb <link>`\n\nExample: `.fb https://www.facebook.com/reel/123456`" 
            }, { quoted: message });
        }

        // 1. Visual Progress
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let videoUrl = null;
        let title = "Facebook Video";

        // --- MULTI-API FAILOVER SYSTEM ---
        const apis = [
            `https://api.vreden.my.id/api/facebook?url=${encodeURIComponent(url)}`,
            `https://widipe.com/facebook?url=${encodeURIComponent(url)}`,
            `https://api.botcahx.eu.org/api/dowloader/fbdown?url=${encodeURIComponent(url)}&apikey=btch-beta`,
            `https://api.sandipbaruwal.com/fbvideo?url=${encodeURIComponent(url)}`
        ];

        for (const api of apis) {
            try {
                const res = await axios.get(api, { timeout: 10000 });
                // Check various response structures (result.video, result.url, result.media)
                videoUrl = res.data.result?.video || 
                           res.data.result?.url || 
                           res.data.result?.media?.video_hd || 
                           res.data.result?.link ||
                           res.data.video_url;
                
                if (videoUrl) {
                    title = res.data.result?.title || res.data.title || title;
                    break; // Exit loop once a valid URL is found
                }
            } catch (e) {
                console.log(`API check failed for: ${api}`);
                continue; 
            }
        }

        // 2. Error if no API worked
        if (!videoUrl) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: "❌ *All servers are failing to process this link.*\n\nPossible reasons:\n• The video is **Private**.\n• The link is an **expired Story**.\n• Facebook has temporarily blocked your server IP." 
            }, { quoted: message });
        }

        // 3. Download to Local Storage (Bypass Direct Link Block)
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempPath = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        const writer = fs.createWriteStream(tempPath);
        
        // Critical: High-quality headers to mimic a Chrome browser
        const videoResponse = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
                'Referer': 'https://www.facebook.com/',
                'Connection': 'keep-alive',
                'Range': 'bytes=0-'
            },
            timeout: 120000 // 2 minutes for large videos
        });

        videoResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
        });

        // 4. Send the Video
        const stats = fs.statSync(tempPath);
        if (stats.size > 5000) { // Safety check: File must be > 5KB
            await sock.sendMessage(chatId, {
                video: fs.readFileSync(tempPath),
                mimetype: "video/mp4",
                caption: `✅ *LEE TECH BOT - SUCCESS*\n\n📝 *Title:* ${title}\n⚖️ *Size:* ${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            }, { quoted: message });
            
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            throw new Error("Downloaded file is corrupt or a 403 error page.");
        }

        // 5. Cleanup
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    } catch (error) {
        console.error('FB FULL ERROR:', error.message);
        
        let msg = "❌ *Download Failed*";
        if (error.message.includes('403')) msg = "❌ *Error 403:* Facebook is blocking the bot's IP. Try again in 5 minutes.";
        if (error.message.includes('timeout')) msg = "❌ *Timeout:* The video is too large or server is slow.";

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = facebookCommand;
