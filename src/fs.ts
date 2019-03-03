import fs from "fs"
import {promisify} from "util"

export const exists = promisify(fs.exists)
export const mkdir = promisify(fs.mkdir)
export const readdir = promisify(fs.readdir)
export const readFile = promisify(fs.readFile)
export const createWriteStream = fs.createWriteStream
