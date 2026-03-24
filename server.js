const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer  = require('multer');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'stayziya-super-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // in dev, use false
}));

// Setup Multer for Image Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });

// Database Setup
const db = new sqlite3.Database('./stayziya.sqlite');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT,
        room_type TEXT,
        image_url TEXT,
        description TEXT
    )`);
    // Upgrade existing schema safely
    db.run("ALTER TABLE photos ADD COLUMN description TEXT", (err) => { /* Ignore duplicate column err */ });
    db.run(`CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        image_url TEXT,
        date TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS owner_profile (
        id INTEGER PRIMARY KEY,
        name TEXT,
        bio TEXT,
        management_skills TEXT,
        image_url TEXT
    )`);

    // Seed default properties if missing
    db.get("SELECT count(*) as count FROM properties", (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare("INSERT INTO properties VALUES (?, ?, ?)");
            stmt.run('stayziya', 'Stayziya (Main)', 'Experience premium luxury co-living with Stayziya.');
            stmt.run('imperial-ladies', 'Stayziya Imperial PG for Ladies', 'Safe, serene, and sophisticated premium living for ladies.');
            stmt.run('imperial-gents', 'Stayziya Imperial PG for Gents', 'Tailored comfort and unmatched amenities for professional men.');
            stmt.finalize();
        }
    });

    // Seed default owner profile
    db.get("SELECT count(*) as count FROM owner_profile", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO owner_profile (id, name, bio, management_skills, image_url) VALUES (1, 'Vashnavi', 'Dedicated to redefining premium living through excellence and hospitality.', 'Hospitality Management, Operations, Community Building', '/uploads/owner-placeholder.jpg')");
        }
    });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- API ROUTES ---

// Authentication (Simple Password "admin123")
app.post('/api/login', (req, res) => {
    if (req.body.password === 'STAYZIYA@7632') {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.isAdmin) res.json({ success: true });
    else res.status(401).json({ error: 'Unauthorized' });
});

// GET Property Info + Photos
app.get('/api/properties/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM properties WHERE id = ?', [id], (err, prop) => {
        if (!prop || err) return res.status(404).json({ error: 'Not found' });
        
        db.all('SELECT * FROM photos WHERE property_id = ?', [id], (err, photos) => {
            res.json({
                ...prop,
                photos: photos || []
            });
        });
    });
});

// Auth Middleware for protected routes
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// Update Property Description (Auth Required)
app.put('/api/properties/:id', requireAdmin, (req, res) => {
    const desc = req.body.description;
    const id = req.params.id;
    db.run('UPDATE properties SET description = ? WHERE id = ?', [desc, id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true });
    });
});

// Upload Photo (Auth Required)
app.post('/api/upload', requireAdmin, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    const propId = req.body.property_id;
    const roomType = req.body.room_type;
    const desc = req.body.description || '';
    const imageUrl = '/uploads/' + req.file.filename;

    // Check current count
    db.get('SELECT count(*) as count FROM photos WHERE property_id = ? AND room_type = ?', [propId, roomType], (err, row) => {
        if (row && row.count >= 4) {
            // Overwrite oldest photo instead of rejecting
            db.get('SELECT id, image_url FROM photos WHERE property_id = ? AND room_type = ? ORDER BY id ASC LIMIT 1', [propId, roomType], (err, oldPhoto) => {
                if (oldPhoto) {
                    let purePath = oldPhoto.image_url;
                    if (purePath.startsWith('/')) purePath = purePath.substring(1);
                    const fileToDelete = path.join(__dirname, 'public', purePath);
                    try { if (fs.existsSync(fileToDelete)) fs.unlinkSync(fileToDelete); } catch(e){}
                    
                    db.run('UPDATE photos SET image_url = ?, description = ? WHERE id = ?', [imageUrl, desc, oldPhoto.id], function(err) {
                        if (err) res.status(500).json({ error: err.message });
                        else res.json({ success: true, id: oldPhoto.id, image_url: imageUrl, description: desc, replaced: true });
                    });
                }
            });
            return;
        }

        db.run('INSERT INTO photos (property_id, room_type, image_url, description) VALUES (?, ?, ?, ?)', 
        [propId, roomType, imageUrl, desc], function(err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ success: true, id: this.lastID, image_url: imageUrl, description: desc });
        });
    });
});

// Delete Photo (Auth Required)
app.delete('/api/photos/:id', requireAdmin, (req, res) => {
    db.get('SELECT image_url FROM photos WHERE id = ?', [req.params.id], (err, row) => {
        if (row && row.image_url) {
            let purePath = row.image_url;
            if (purePath.startsWith('/')) purePath = purePath.substring(1);
            const filePath = path.join(__dirname, 'public', purePath);
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) { console.error("Could not delete file", e); }
        }
        db.run('DELETE FROM photos WHERE id = ?', [req.params.id], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ success: true });
        });
    });
});

// --- BLOG & OWNER API ---

app.get('/api/owner', (req, res) => {
    db.get('SELECT * FROM owner_profile WHERE id = 1', (err, row) => {
        res.json(row || {});
    });
});

app.put('/api/owner', requireAdmin, (req, res) => {
    const { name, bio, management_skills } = req.body;
    db.run('UPDATE owner_profile SET name = ?, bio = ?, management_skills = ? WHERE id = 1', 
    [name, bio, management_skills], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true });
    });
});

// Owner Photo Upload
app.post('/api/owner/photo', requireAdmin, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const imageUrl = '/uploads/' + req.file.filename;
    db.run('UPDATE owner_profile SET image_url = ? WHERE id = 1', [imageUrl], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true, image_url: imageUrl });
    });
});

app.get('/api/blogs', (req, res) => {
    db.all('SELECT * FROM blogs ORDER BY id DESC', (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/blogs', requireAdmin, (req, res) => {
    const { title, content, image_url } = req.body;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    db.run('INSERT INTO blogs (title, content, image_url, date) VALUES (?, ?, ?, ?)', 
    [title, content, image_url, date], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/blogs/:id', requireAdmin, (req, res) => {
    db.get('SELECT image_url FROM blogs WHERE id = ?', [req.params.id], (err, row) => {
        if (row && row.image_url) {
            let purePath = row.image_url;
            if (purePath.startsWith('/')) purePath = purePath.substring(1);
            const filePath = path.join(__dirname, 'public', purePath);
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
        }
        
        db.run('DELETE FROM blogs WHERE id = ?', [req.params.id], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ success: true });
        });
    });
});

// Upload Global Site Image (Overwrite system)
app.post('/api/upload-site-image', requireAdmin, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    const imageKey = req.body.image_key;
    if (!imageKey) return res.status(400).json({ error: 'No image key provided.' });

    // Rename the uploaded file to overwrite the global image target
    const targetPath = path.join(__dirname, 'uploads', imageKey + '.jpg');
    
    // Rename/overwrite
    fs.rename(req.file.path, targetPath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, image_url: '/uploads/' + imageKey + '.jpg?' + Date.now() });
    });
});

// Fallback route for SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server running beautifully on http://localhost:${PORT}`);
});
