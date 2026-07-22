require('dotenv').config()

// import a package
const express = require('express')

// call a function, store result
const app = express()

const { execFile } = require('child_process')

const { Client, Databases, Storage } = require('node-appwrite')

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY)

const databases = new Databases(client)
const storage = new Storage(client)

const fs = require('fs')
if (process.env.YT_COOKIES_B64) {
    fs.writeFileSync('/tmp/cookies.txt', Buffer.from(process.env.YT_COOKIES_B64, 'base64'))
}

// define a route
app.get('/health', (req, res) => {
    console.log('Status: alive')
    res.json({ status: 'alive' })
})

app.get('/stream/:youtubeId', async (req, res) => {
    const tStart = Date.now()
    const videoUrl = `https://www.youtube.com/watch?v=${req.params.youtubeId}`
    // 1. CACHE CHECK — try to fetch the row by ID
    try {
        const row = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            process.env.APPWRITE_TABLE_ID,
            `yt_${req.params.youtubeId}`
        )
        // got here = cache HIT
        console.log('Appwrite lookup (hit):', Date.now() - tStart, 'ms')
        return res.json({ streamUrl: row.fileUrl, cached: true })
    } catch (err) {
        // getRow threw = cache MISS (row doesn't exist), fall through
        //console.error('Cache miss (or error):', err.message)
        console.log('Appwrite lookup (miss):', Date.now() - tStart, 'ms')
        console.log('Cache miss for', req.params.youtubeId)
    }


    const args = [ '--cookies', '/tmp/cookies.txt',
        '--js-runtimes',
        'node', '--remote-components',
        'ejs:github', '-f', 'bestaudio', '-g', videoUrl]
    
    const tYtdlp = Date.now()
    execFile('./bin/yt-dlp', args, (error, stdout, stderr) => {
        console.log('yt-dlp took:', Date.now() - tYtdlp, 'ms')
        if (error) {
            console.error('yt-dlp error:', error)
            console.error('yt-dlp stderr:', stderr)
            return res.status(500).json({
                error: 'Extraction failed',
                stderr: stderr?.toString(),
            })
        }
        res.json({ streamUrl: stdout.trim() })
    })
})

// read env var with fallback
const port = process.env.PORT || 3000

// start server, run callback when up
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})