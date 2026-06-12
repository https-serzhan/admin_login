import Database from 'better-sqlite3'

const db = new Database('users.db')

//Important: unique index is on email, so the user cant use the same email
function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'unverified',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME,
            email_token TEXT
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `)
}

initializeDatabase()

export default db