// import a package
const { exec } = require('child_process')
const url = 'yt-dlp --remote-components ejs:github -f bestaudio -g "https://www.youtube.com/watch?v=4NRXx6U8ABQ"'
exec(url, (error, stdout, stderr) => {
    if (error) {
        console.log(error)
        return
    }
    console.log(stdout)
})
