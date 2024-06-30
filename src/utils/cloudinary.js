import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath){ return null };
        console.log(localFilePath)
        //Upload the file on Cloudinary
        console.log("I am not being uploaded")
        console.log("cloud_name : " , process.env.CLOUDINARY_CLOUD_NAME)
        console.log("api_key : " , process.env.CLOUDINARY_API_KEY)
        console.log("api_secret : " , process.env.CLOUDINARY_API_SECRET)
        
        const response = await cloudinary.uploader.upload(
            localFilePath,{
                resource_type: "auto"
            }
        )
       //File Uploaded successfully on Cloudinary
       console.log("file is uploaded on cloudinary",response.url)
       fs.unlinkSync(localFilePath)
       return response;
    }
    catch (error) {
        console.log("upload : " , error)
        fs.unlinkSync(localFilePath) //removed locally saved file as the operation got failed
        return null;
    }
}

export {uploadOnCloudinary}


