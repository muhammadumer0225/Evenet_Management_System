const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDirectory = path.join(__dirname, "../uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename : (req, file, cb) =>{
        const uniqueName = Date.now() + "-" + 
        Math.round(Math.random() * 1E9);
        cb(null, uniqueName + path.extname(file.originalname).toLowerCase());
    }
});

const fileFilter = (req, file, cb) =>{
    const allowedFileTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    
    if(allowedFileTypes.includes(file.mimetype)){
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG and WEBP images are allowed"));
    }
};


const upload = multer({
    storage,
    fileFilter,
    limits : {
        fileSize : 5 * 1024 * 1024,
    }
});


module.exports = upload;