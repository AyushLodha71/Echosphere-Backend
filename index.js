// import a package
const express = require('express')

// call a function, store result
const app = express()

const { execFile } = require('child_process')

// define a route
app.get('/health', (req, res) => {
    console.log('Status: alive')
    res.json({ status: 'alive' })
})

app.get('/stream/:youtubeId', (req, res) => {
    const videoUrl = `https://www.youtube.com/watch?v=${req.params.youtubeId}`
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