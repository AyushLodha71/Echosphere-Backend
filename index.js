require('dotenv').config()

const express = require('express')
const app = express()

const { Client, TablesDB } = require('node-appwrite')

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY)

const tablesDB = new TablesDB(client)

// define the route health
app.get('/health', (req, res) => {
    console.log('Status: alive')
    res.json({ status: 'alive' })
})

// define the route stream
app.get('/stream/:youtubeId', async (req, res) => {
    const youtubeId = req.params.youtubeId
    const rowId = `yt_${youtubeId}`

    const title = req.query.title || 'Unknown'
    const artist = req.query.artist || null

    try {
        const row = await tablesDB.getRow({
            databaseId: process.env.APPWRITE_DATABASE_ID,
            tableId: process.env.APPWRITE_TABLE_ID,
            rowId: rowId
        })

        await tablesDB.updateRow({
            databaseId: process.env.APPWRITE_DATABASE_ID,
            tableId: process.env.APPWRITE_TABLE_ID,
            rowId: rowId,
            data: {
                playCount: row.playCount + 1,
                lastPlayedAt: new Date().toISOString()
            }
        })

        if (row.uploaded === true) {
            return res.json({ streamUrl: row.fileUrl, cached: true })
        } else {
            return res.status(404).json({ cached: false })
        }

    } catch (err) {

        if (err.code !== 404) {
            console.error('Appwrite error (not a miss):', err)
            return res.status(500).json({ error: 'Server error' })
        }

        console.log('New demand row for', youtubeId)

        await tablesDB.createRow({
            databaseId: process.env.APPWRITE_DATABASE_ID,
            tableId: process.env.APPWRITE_TABLE_ID,
            rowId: rowId,
            data: {
                title: title,
                artist: artist,
                playCount: 1,
                uploaded: false,
                lastPlayedAt: new Date().toISOString()
            }
        })

        return res.status(404).json({ cached: false })
    }
})

const port = process.env.PORT || 3000

// start server, run callback when up
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})