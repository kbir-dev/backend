import { User } from "../models/user.models";
import { APIerror } from "../utils/APIerror"
import { asyncHandler } from "../utils/asyncHandler"



export const verifyJWT = asyncHandler(async (req,res,next) => {
    try {
        
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");

        if(!token){
            throw new APIerror(401, "Unauthorized request")
        }

        const decodedToken = await jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if(!user){
            throw new APIerror(401, "Invalid Access Token")
        }

        req.user = user;

        next();

    } catch (error) {
        throw new APIerror(500,"Error in verifying JWT Tokens")
    }
})