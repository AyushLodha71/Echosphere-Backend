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

// define a route
app.get('/health', (req, res) => {
    console.log('Status: alive')
    res.json({ status: 'alive' })
})

app.get('/stream/:youtubeId', async (req, res) => {
    const videoUrl = `https://www.youtube.com/watch?v=${req.params.youtubeId}`
    // 1. CACHE CHECK — try to fetch the row by ID
    try {
        const row = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            process.env.APPWRITE_TABLE_ID,
            `yt_${req.params.youtubeId}`
        )
        // got here = cache HIT
        return res.json({ streamUrl: row.fileUrl, cached: true })
    } catch (err) {
        // getRow threw = cache MISS (row doesn't exist), fall through
        //console.error('Cache miss (or error):', err.message)
        console.error(err);           // full error to Render logs
        res.status(500).json({
            error: "Extraction failed",
            message: err.message,
            stderr: err.stderr?.toString(),   // <-- this is the yt-dlp output we need
        });
    }


    const args = ['--remote-components', 'ejs:github', '-f', 'bestaudio', '-g', videoUrl]
    execFile('yt-dlp', args, (error, stdout, stderr) => {
        if (error) {
            console.error(error)
            res.status(500).json({ error: 'Extraction failed' })
            return
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