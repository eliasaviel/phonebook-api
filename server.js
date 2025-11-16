// ================================
// 📘 PHONEBOOK BACKEND (SQLite + Express)
// ================================
// Uses better-sqlite3 (synchronous, super simple) to persist contacts.
// Your React Native app keeps calling the same endpoints (no changes).

import express from 'express'
import cors from 'cors'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'

// __dirname replacement for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(cors())

// -------------------------------
// 🗄️ Database setup (./data/phonebook.db)
// -------------------------------
const DATA_DIR = path.join(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'phonebook.db')

// Open or create the DB file
const db = new Database(DB_PATH)
// Good default for reliability with concurrent reads
db.pragma('journal_mode = WAL')

// Create table if it doesn't exist yet
db.prepare(`
  CREATE TABLE IF NOT EXISTS contacts(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT ''
  )
`).run()

// Seed two contacts only if empty (first run)
const rowCount = db.prepare(`SELECT COUNT(*) AS cnt FROM contacts`).get().cnt
if (rowCount === 0) {
  const seed = db.prepare(`INSERT INTO contacts(id, name, phone, email) VALUES (?, ?, ?, ?)`)
  seed.run(uuid(), 'Ron Levi', '050-111-2233', 'ron@example.com')
  seed.run(uuid(), 'Marine Azulay', '052-444-5566', 'marine@example.com')
}

// Reusable prepared statements
const stmtAll   = db.prepare(`SELECT id, name, phone, email FROM contacts ORDER BY name`)
const stmtGet   = db.prepare(`SELECT id, name, phone, email FROM contacts WHERE id = ?`)
const stmtAdd   = db.prepare(`INSERT INTO contacts(id, name, phone, email) VALUES (?, ?, ?, ?)`)
const stmtUpd   = db.prepare(`UPDATE contacts SET name = ?, phone = ?, email = ? WHERE id = ?`)
const stmtDel   = db.prepare(`DELETE FROM contacts WHERE id = ?`)

// -------------------------------
// 🌐 Routes
// -------------------------------
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'phonebook-api', db: path.basename(DB_PATH) })
})

// GET all contacts
app.get('/contacts', (req, res) => {
  const rows = stmtAll.all()
  res.json(rows)
})

// POST create
app.post('/contacts', (req, res) => {
  const { name, phone, email = '' } = req.body || {}
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' })
  }
  const id = uuid()
  stmtAdd.run(id, name, phone, email)
  const created = stmtGet.get(id)
  res.status(201).json(created)
})

// PUT update
app.put('/contacts/:id', (req, res) => {
  const { id } = req.params
  const { name, phone, email = '' } = req.body || {}
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' })
  }
  const before = stmtGet.get(id)
  if (!before) return res.status(404).json({ error: 'Contact not found.' })
  stmtUpd.run(name, phone, email, id)
  const updated = stmtGet.get(id)
  res.json(updated)
})

// DELETE remove
app.delete('/contacts/:id', (req, res) => {
  const { id } = req.params
  const info = stmtDel.run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Contact not found.' })
  res.status(204).send()
})

// -------------------------------
// 🚀 Start server (bind to all interfaces for LAN)
// -------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API with SQLite on http://0.0.0.0:${PORT}`)
  console.log(`DB file: ${DB_PATH}`)
})
