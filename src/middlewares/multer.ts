import multer from 'multer';

const storage = multer.memoryStorage(); // Change from diskStorage to memoryStorage
const upload = multer({ storage });

console.log("Multer is working");

export default upload;
