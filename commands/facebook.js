const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        // 1. Extract URL safely from various message types
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || "";
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a Facebook video URL.\nExample: *.fb https://www.facebook.com/...*"
            }, { quoted: message });
        }

        // 2. Basic URL Validation
        if (!/facebook\.com|fb\.watch/g.test(url)) {
            return await sock.sendMessage(chatId, { 
                text: "❌ That is not a valid Facebook link."
            }, { quoted: message });
        }

        // 3. Loading Feedback
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // 4. API Fetching Logic
        const apiUrl = `https://api.botcahx.eu.org/api/dowloader/fbdown?url=${encodeURIComponent(url)}&apikey=btch-beta`;
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        const res = response.data;
        if (!res || res.status !== true) {
            throw new Error(res?.msg || "API returned invalid status");
        }

        // 5. Extract Video URL (Handling various nested structures)
        // Checks: result.url -> result.video -> result.media (HD/SD)
        let videoUrl = res.result?.url || 
                       res.result?.video || 
                       res.result?.media?.video_hd || 
                       res.result?.media?.video_sd;
        
        let title = res.result?.title || "Facebook Video";

        if (!videoUrl) {
            throw new Error("Could not find a downloadable video stream.");
        }

        // 6. Send Video directly via URL (Fastest Method)
        const caption = `✅ *Facebook Download*\n\n📝 *Title:* ${title}\n\n_Downloaded by LEE TECH Bot_`;

        try {
            await sock.sendMessage(chatId, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                caption: caption,
                fileName: `fb_video.mp4`
            }, { quoted: message });
            
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        } catch (sendError) {
            console.error("Direct URL send failed, trying buffer method...");
            
            // 7. Fallback: Buffer Method (If direct URL is restricted)
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
            const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

            const writer = fs.createWriteStream(tempFile);
            const stream = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                timeout: 60000
            });

            stream.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            await sock.sendMessage(chatId, {
                video: fs.readFileSync(tempFile),
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: message });

            // Cleanup
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        }

    } catch (error) {
        console.error('Facebook Cmd Error:', error.message);
        await sock.sendMessage(chatId, { 
            text: `❌ *Error:* ${error.message || "Failed to process video."}` 
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = facebookCommand;
