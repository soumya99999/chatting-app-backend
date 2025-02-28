import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

try {
    if(cloudinary.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET,
    })){
        console.log("Cloudinary configuration is valid");
    }
} catch (error) {
    console.error("Error configuring Cloudinary:", error);
}


export default cloudinary;