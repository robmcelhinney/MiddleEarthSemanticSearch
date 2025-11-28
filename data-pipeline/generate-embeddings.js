import fs from "fs"
import { pipeline } from "@xenova/transformers"

// Configuration: Map filenames to readable Book Titles
const FILES = {
    "The-Fellowship-of-the-Ring.txt": "The Fellowship of the Ring",
    "The-Twin-Towers.txt": "The Two Towers", // Mapping your filename to the correct title
    "Return-of-the-King.txt": "The Return of the King",
}

const OUTPUT_FILE = "embeddings.json"

async function generate() {
    // 1. Load the model once (it's heavy)
    console.log("🤖 Loading AI model...")
    const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
    )

    const allData = []
    let globalId = 0 // Unique ID across all books

    // 2. Loop through each file
    for (const [filename, bookTitle] of Object.entries(FILES)) {
        console.log(`\n📖 Reading ${bookTitle}...`)

        let rawText
        try {
            rawText = fs.readFileSync(filename, "utf8")
        } catch (error) {
            console.error(`❌ Error reading ${filename}. Skipping...`)
            continue
        }

        // Chunking logic
        const paragraphs = rawText
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter((p) => p.length > 50)

        console.log(
            `   Found ${paragraphs.length} paragraphs. Generating vectors...`
        )

        // Process paragraphs for this specific book
        for (let i = 0; i < paragraphs.length; i++) {
            const text = paragraphs[i]

            const output = await extractor(text, {
                pooling: "mean",
                normalize: true,
            })

            allData.push({
                id: globalId++,
                text: text,
                book: bookTitle, // <--- NEW: Now we know which book it's from!
                vector: Array.from(output.data),
            })

            if ((i + 1) % 100 === 0) {
                process.stdout.write(`.`) // Simple progress dots
            }
        }
        console.log(" Done.")
    }

    // 3. Save everything to one big JSON file
    console.log(
        `\n💾 Saving ${allData.length} total entries to ${OUTPUT_FILE}...`
    )
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData))
    console.log("✅ Done!")
}

generate()
