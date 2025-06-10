import DataUriParser from "datauri/parser.js";
import path from "path";

const parser = new DataUriParser();

const getDataUri = (file: Express.Multer.File): string | undefined => {
    if (!file || !file.buffer) return undefined; // Ensure file exists and has a buffer

    const extName = path.extname(file.originalname).toString();
    const dataUri = parser.format(extName, file.buffer).content;
    
    console.log(`Data URI generated: ${dataUri}`);
    return dataUri;
};

export default getDataUri;
