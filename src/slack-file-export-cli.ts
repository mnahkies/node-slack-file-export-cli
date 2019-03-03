import * as https from "https"
import path from "path"
import * as fs from "./fs"

interface ExportedSlackMessage {
    type: string
    text: string
    user: string
    ts: string
    files?: {
        url_private_download: string
    }[]
    attachments?: {}[]
}

async function run(inputDirectories: string[], baseOutputDirectory: string) {

    if (await fs.exists(baseOutputDirectory)) {
        throw new Error("output directory already exists!")
    }

    await fs.mkdir(baseOutputDirectory)

    for (let directory of inputDirectories) {

        let outputDirectory = path.join(baseOutputDirectory, path.basename(directory))

        await fs.mkdir(outputDirectory)

        for await (let file of loadSlackExportFiles(directory)) {

            let urls = extractAttachmentPaths(file)
            let i = 0

            console.info(`download ${urls.length} from ${directory}`)

            for (let url of urls) {
                await downloadSlackAttachment(url, outputDirectory)
                reportProgress(++i / urls.length)
            }
        }
    }
}

async function* loadSlackExportFiles(directory: string): AsyncIterableIterator<any[]> {
    let files = await fs.readdir(directory, "utf8")

    for (let file of files) {
        yield JSON.parse(await fs.readFile(path.join(directory, file), "utf8"))
    }
}

async function downloadSlackAttachment(url: string, destinationDirectory: string) {
    let outputFile = path.join(destinationDirectory, path.basename(url).split("?")[0])

    return new Promise((resolve) => {
        let writeStream = fs.createWriteStream(outputFile)

        https.get(url, (res) => {
            let stream = res.pipe(writeStream)
            stream.on("finish", resolve)
        })
    })
}

function extractAttachmentPaths(file: ExportedSlackMessage[]): string[] {
    return file.reduce((result, message) => {

        let urls = (message.files || [])
            .map((it) => it.url_private_download)

        return result.concat(urls)
    }, [] as string[])
}

function reportProgress(percentage: number) {
    percentage *= 100
    process.stdout.write(`${percentage.toFixed()}%\r`)
}

async function parseArgs() {

    let inputDirectory = process.argv[2]
    let outputDirectory = process.argv[3]

    if (!inputDirectory || !outputDirectory) {
        throw new Error("usage: $ slack-file-export input_path output_path")
    }

    inputDirectory = path.resolve(inputDirectory)
    outputDirectory = path.resolve(outputDirectory)

    console.info(`Reading file data from slack export located in:
${inputDirectory}

and downloading all files discovered to:
${outputDirectory}`)

    let channelDirectories = (await fs.readdir(inputDirectory, {withFileTypes: true}))
        .filter((it) => it.isDirectory())
        .map((it) => path.join(inputDirectory, it.name))

    console.info(`discovered ${channelDirectories.length} exported channels`)

    return {channelDirectories, outputDirectory}
}

parseArgs()
    .then(({channelDirectories, outputDirectory}) => {
        return run(channelDirectories, outputDirectory)
    })
    .then(() => {
        console.info("completed successfully")
        process.exit(0)
    })
    .catch((err: Error) => {
        console.error("failed with error", {err})
        process.exit(1)
    })
