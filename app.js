const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = 3000;

// 🚨 REPLACE THIS WITH YOUR ACTUAL S3 BUCKET NAME!
const BUCKET_NAME = 'YOUR_BUCKET_NAME_HERE';
const REGION = 'us-east-1';

// 1. Initialize S3 Client (Automatically uses your EC2 IAM Role!)
const s3Client = new S3Client({ region: REGION });

// 2. Configure file uploads to store temporarily in server memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');

// --- ROUTES ---

// 3. HOME PAGE: List all files currently in S3
app.get('/', async (req, res) => {
    try {
        const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
        const response = await s3Client.send(command);
        const files = response.Contents || [];
        res.render('index', { files: files, error: null });
    } catch (err) {
        console.error(err);
        res.render('index', { files: [], error: "S3 Error: Check your Bucket Name and IAM Role." });
    }
});

// 4. UPLOAD PAGE: Send the file from the browser directly to S3
app.post('/upload', upload.single('document'), async (req, res) => {
    if (!req.file) return res.redirect('/');

    const params = {
        Bucket: BUCKET_NAME,
        Key: req.file.originalname,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
    };

    try {
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.send("Failed to upload file.");
    }
});

// 5. SECURE DOWNLOAD: Generate a temporary Pre-Signed URL
app.get('/download/:filename', async (req, res) => {
    const filename = req.params.filename;

    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename
    });

    try {
        // This generates a secure download link that self-destructs after 60 seconds!
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
        res.redirect(signedUrl);
    } catch (err) {
        console.error(err);
        res.send("Error generating secure link.");
    }
});

// --- START SERVER ---
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Secure Mini Drive running on port ${port}`);
});