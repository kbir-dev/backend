import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js"
import { ApiResponse } from "../utils/APIresponse.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

    //get user details from frontend
    const registerUser = asyncHandler(async (req, res) => {
    const { fullName, username, email, password } = req.body
    console.log("email : ", email)

    //validating if all details are entered
    if (
        [fullName, username, email, password].some((field) => {
            field?.trim() == ""
        })
    ) {
        throw new APIerror(400, "Enter all details")
    }

    //check if user already exists
    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new APIerror(409, "User with email or username already exists");
    }

    //Check for Images in Local Path

    console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    console.log(avatarLocalPath)

    if(!avatarLocalPath){
        throw new APIerror(400, "Avatar is required I am not uploaded in Local Path")
    }

    //Check for Images in Cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new APIerror(400, "Avatar is required I am not uploaded in Cloudinary")
    }

    //Create User Object to Store in DB

    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new APIerror(500, "Error while creating user")
    }

    return res.status(200).json(
        new ApiResponse(200,createdUser,"User Registered Successfully")
    )
})

export { registerUser }