import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js"
import { ApiResponse } from "../utils/APIresponse.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        console.log("User Id is : ",userId)
        const user = await User.findById(userId)
        console.log("I am User : ",user)
        console.log(process.env.ACCESS_TOKEN_EXPIRY)
        console.log(typeof process.env.ACCESS_TOKEN_EXPIRY)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        console.log(refreshToken)

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave : true})
        return {accessToken,refreshToken}

    }catch(error){
        console.log(error)
        throw new APIerror(500,"Something went wrong while generating refresh and access tokens")
    }
}

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
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path; 
    }

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

const loginUser = asyncHandler(async (req,res) => {
    const {username, password, email} = req.body;
    
    //check if username or email is there
    if(!username && !email){
        throw new APIerror(400, "Username or Email is required")
    }

    //find the user is db
    const user = await User.findOne({
        $or : [{username},{email}]
    })

    //Check if user data is accessed from db

    if(!user){
        throw new APIerror(404, "User not found")
    }

    //password check 
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new APIerror(401, "Invalid Password")
    }

    //access and refresh tokens
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //send LoggedIn User data
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //send cookies 
    const options = {
        httpsOnly : true,
        secure: true
    }

    //send response 
    return res.status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(200,loggedInUser,"User Logged In Successfully")
    )
});


const logoutUser = asyncHandler(async (req,res)=>{
    //FINDING USER BY ID
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },{
            new : true
        }
    )

    const options = {
        httpsOnly : true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200,{},"Logged Out Successfully"))
})

//

const refreshAccessToken = asyncHandler(async(req,res)=>{

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken ;

    if(!incomingRefreshToken){
        throw new APIerror(401, "Refresh Token is required");
    }
    
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);

    if(!user){
        throw new APIerror(401,"Invalid Refresh Token");
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new APIerror(401,"Refresh Token is expired or used");
    }

    const options = {
        httpsOnly : true,
        secure: true
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id);

    return res
   .status(200)
   .cookie("accessToken" , accessToken , options)
   .cookie("refreshToken" , newRefreshToken , options)
   .json(
    new ApiResponse(
        200,
        {accessToken , 
        refreshToken : newRefreshToken},
        "Access Token refreshed Successfully"
    )
   )
})

const changePassword = asyncHandler(async(req,res)=>{
    const {currentPassword, newPassword} = req.body;
    
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword)

    if(!isPasswordCorrect){
        throw new APIerror(401, "Invalid Old Password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave : false});

    res
    .status(200)
    .json(new ApiResponse(200,{},"Password Changed Successfully"));
})

export { registerUser , loginUser ,logoutUser}