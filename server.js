const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3002;


// Uploads klasörü
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer ile dosya yükleme
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use(express.json({limit: '20mb'}));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));
app.use(bodyParser.json());

// Resim yükle
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({error: 'No file'});
    res.json({ url: '/uploads/' + req.file.filename });
});

// Galeri: uploads klasöründeki tüm resimler
app.get('/gallery', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({error: 'Read error'});
        const urls = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f)).map(f => '/uploads/' + f);
        res.json(urls);
    });
});

// Proje kaydet
app.post('/save-project', (req, res) => {
    const data = req.body;
    fs.writeFileSync(path.join(__dirname, 'project.json'), JSON.stringify(data, null, 2));
    res.json({ ok: true });
});

// Proje yükle
app.get('/load-project', (req, res) => {
    const file = path.join(__dirname, 'project.json');
    if (!fs.existsSync(file)) return res.json([]);
    const data = fs.readFileSync(file, 'utf8');
    res.json(JSON.parse(data));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === 'merve8387') {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log('Mimarcad backend running on http://localhost:' + PORT);
}); 