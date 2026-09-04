require('dotenv').config()

const { Client, TablesDB, Storage } = require('node-appwrite')
const { InputFile } = require('node-appwrite/file')
const { execFile } = require('child_process')
const util = require('util')
const fs = require('fs')

// promisify execFile so we can await it instead of using callbacks
const execFileAsync = util.promisify(execFile)

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY)

const tablesDB = new TablesDB(client)
const storage = new Storage(client)

const youtubeIds = [
    'dQw4w9WgXcQ',
    '9bZkp7q19f0',
    'kJQP7kiw5Fk'
]

async function seedOne(youtubeId) {
    const rowId = `yt_${youtubeId}`
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`

    // STEP 1: skip if already uploaded
    try {
        const row = await tablesDB.getRow({
            databaseId: process.env.APPWRITE_DATABASE_ID,
            tableId: process.env.APPWRITE_TABLE_ID,
            rowId: rowId
        })
        if (row.uploaded === true) {
            console.log('Already uploaded, skipping:', youtubeId)
            return
        }
        console.log('Row exists but not uploaded, will seed:', youtubeId)
    } catch (err) {
        if (err.code === 404) {
            console.log('No row yet, will seed:', youtubeId)
        } else {
            console.error('Unexpected error checking row:', err)
            return
        }
    }

    // STEP 2: download audio to temp/
    const outputTemplate = `temp/${youtubeId}.%(ext)s`
    const downloadArgs = [
        '--remote-components', 'ejs:github',
        '-f', '251/140/bestaudio',
        '-o', outputTemplate,
        videoUrl
    ]

    console.log('Downloading...')
    await execFileAsync('yt-dlp', downloadArgs)
    console.log('Download complete')

    // STEP 3: get metadata (title, artist, duration)
    const metaArgs = [
        '--remote-components', 'ejs:github',
        '--print', '%(title)s|||%(artist)s|||%(duration)s',
        videoUrl
    ]
    const { stdout } = await execFileAsync('yt-dlp', metaArgs)
    const [title, artist, duration] = stdout.trim().split('|||')

    console.log('Title:', title)
    console.log('Artist:', artist)
    console.log('Duration (s):', duration)

    // find the downloaded file (extension is unknown until yt-dlp picks it)
    const files = fs.readdirSync('temp').filter(f => f.startsWith(youtubeId))
    if (files.length === 0) {
        console.error('No file found after download for', youtubeId)
        return
    }
    const fileName = files[0]
    const filePath = `temp/${fileName}`
    console.log('File on disk:', fileName)

    // STEP 4: upload the file to Appwrite Storage
    console.log('Uploading to Appwrite Storage...')
    const uploaded = await storage.createFile({
        bucketId: process.env.APPWRITE_BUCKET_ID,
        fileId: rowId,
        file: InputFile.fromPath(filePath, fileName)
    })
    console.log('Uploaded, file ID:', uploaded.$id)

    // STEP 5: build the public file URL
    const fileUrl = `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.APPWRITE_BUCKET_ID}/files/${uploaded.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`

    // STEP 6: update the row -> mark uploaded + attach file info + metadata
    await tablesDB.upsertRow({
        databaseId: process.env.APPWRITE_DATABASE_ID,
        tableId: process.env.APPWRITE_TABLE_ID,
        rowId: rowId,
        data: {
            title: title,
            artist: artist,
            duration: parseInt(duration) || null,
            appwriteFileId: uploaded.$id,
            fileUrl: fileUrl,
            uploaded: true,
        }
    })
    console.log('Row upserted, uploaded = true')

    // STEP 7: delete the local temp file
    fs.unlinkSync(filePath)
    console.log('Temp file deleted')
}

async function seedAll(ids) {
    for (const id of ids) {
        console.log('\n=== Seeding', id, '===')
        try {
            await seedOne(id)
        } catch (err) {
            console.error('Failed to seed', id, '-', err.message)
            // continue to the next song instead of stopping the whole batch
        }
    }
    console.log('\nAll done')
}

seedAll(youtubeIds)