import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js"
import { ApiResponse } from "../utils/APIresponse.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        console.log("User Id is : ", userId)
        const user = await User.findById(userId)
        console.log("I am User : ", user)
        console.log(process.env.ACCESS_TOKEN_EXPIRY)
        console.log(typeof process.env.ACCESS_TOKEN_EXPIRY)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        console.log(refreshToken)

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: true })
        return { accessToken, refreshToken }

    } catch (error) {
        console.log(error)
        throw new APIerror(500, "Something went wrong while generating refresh and access tokens")
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
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new APIerror(409, "User with email or username already exists");
    }

    //Check for Images in Local Path

    console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    console.log(avatarLocalPath)

    if (!avatarLocalPath) {
        throw new APIerror(400, "Avatar is required I am not uploaded in Local Path")
    }

    //Check for Images in Cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
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

    if (!createdUser) {
        throw new APIerror(500, "Error while creating user")
    }

    return res.status(200).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    const { username, password, email } = req.body;

    //check if username or email is there
    if (!username && !email) {
        throw new APIerror(400, "Username or Email is required")
    }

    //find the user is db
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    //Check if user data is accessed from db

    if (!user) {
        throw new APIerror(404, "User not found")
    }

    //password check 
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new APIerror(401, "Invalid Password")
    }

    //access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    //send LoggedIn User data
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //send cookies 
    const options = {
        httpsOnly: true,
        secure: true
    }

    //send response 
    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, loggedInUser, "User Logged In Successfully")
        )
});


const logoutUser = asyncHandler(async (req, res) => {
    //FINDING USER BY ID
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }, {
        new: true
    }
    )

    const options = {
        httpsOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Logged Out Successfully"))
})

//

const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new APIerror(401, "Refresh Token is required");
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new APIerror(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new APIerror(401, "Refresh Token is expired or used");
    }

    const options = {
        httpsOnly: true,
        secure: true
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access Token refreshed Successfully"
            )
        )
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword)

    if (!isPasswordCorrect) {
        throw new APIerror(401, "Invalid Old Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    res
        .status(200)
        .json(new ApiResponse(200, {}, "Password Changed Successfully"));
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, username, email } = req.body;

    if (!fullName || !email) {
        throw new APIerror(400, "All Fields are required");
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account Details Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new APIerror(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new APIerror(500, "Error while uploading avatar to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar Updated Successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new APIerror(400, "Avatar file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new APIerror(500, "Error while uploading avatar to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover Image Updated Successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const { username } = req.params;

    if(username?.trim()){
        throw new APIerror(400, "username is missing");
    }

    const channel = await User.aggregate([
        {
            $match : {
                username : username?.toLowerCase()
            }
        },{
            $lookup : {
                from : "subscription",
                localField : "_id",
                foreignField : "channel",
                as : "subscribers"
            }
        },{
            $lookup : {
                from : "subscription",
                localField : "_id",
                foreignField : "channel",
                as : "subscribedTo"
            }
        },{
            $addFields:{
                subscribersCount : {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    if : {$in : [req.user?._id, "$subscribers.subscriber"]},
                    then : true,
                    else: false
                }
            }
        },{
            $project: {
                _id: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                fullName : 1,
                email: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new APIerror(404, "channel does not exist");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User fetched Successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    updateUserAvatar,
    updateUserCoverImage,
    updateAccountDetails,
    getCurrentUser
}